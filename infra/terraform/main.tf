provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

locals {
  project       = var.project
  lambda_name   = "${var.project}-sqs-consumer"
  queue_name    = "${var.project}-dropbox-sync"
  bucket_name   = var.bucket_name
}

resource "aws_sqs_queue" "sync" {
  name                      = local.queue_name
  visibility_timeout_seconds = 900
  message_retention_seconds = 345600
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "../lambda/sqs-consumer/dist"
  output_path = "./build/${local.lambda_name}.zip"
}

resource "aws_iam_role" "lambda_exec" {
  name = "${local.lambda_name}-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "basic_exec" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "access_policy" {
  name   = "${local.lambda_name}-access"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect : "Allow",
        Action : ["s3:PutObject", "s3:AbortMultipartUpload", "s3:CreateMultipartUpload", "s3:UploadPart", "s3:CompleteMultipartUpload"],
        Resource : ["arn:aws:s3:::${local.bucket_name}/*"]
      },
      {
        Effect : "Allow",
        Action : ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
        Resource : aws_sqs_queue.sync.arn
      },
      {
        Effect : "Allow",
        Action : ["mediaconvert:CreateJob"],
        Resource : "*"
      },
      {
        Effect : "Allow",
        Action : ["iam:PassRole"],
        Resource : var.mediaconvert_role_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.access_policy.arn
}

resource "aws_lambda_function" "consumer" {
  function_name = local.lambda_name
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs18.x"
  handler       = "index.handler"
  filename      = data.archive_file.lambda_zip.output_path
  timeout       = 900

  environment {
    variables = {
      AWS_REGION              = var.aws_region
      AWS_S3_BUCKET           = local.bucket_name
      DROPBOX_CLIENT_ID       = var.dropbox_client_id
      DROPBOX_CLIENT_SECRET   = var.dropbox_client_secret
      DROPBOX_REFRESH_TOKEN   = var.dropbox_refresh_token
      MEDIACONVERT_ENDPOINT   = var.mediaconvert_endpoint
      MEDIACONVERT_ROLE_ARN   = var.mediaconvert_role_arn
    }
  }
}

resource "aws_lambda_event_source_mapping" "sqs" {
  event_source_arn = aws_sqs_queue.sync.arn
  function_name    = aws_lambda_function.consumer.arn
  batch_size       = 1
  enabled          = true
}

output "sqs_queue_url" {
  value = aws_sqs_queue.sync.id
}


