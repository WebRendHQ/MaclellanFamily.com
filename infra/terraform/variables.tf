variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "project" {
  type        = string
  description = "Project name prefix"
}

variable "bucket_name" {
  type        = string
  description = "Target S3 bucket for uploads"
}

variable "dropbox_client_id" {
  type        = string
  description = "Dropbox client id"
}

variable "dropbox_client_secret" {
  type        = string
  description = "Dropbox client secret"
}

variable "dropbox_refresh_token" {
  type        = string
  description = "Dropbox refresh token"
}

variable "mediaconvert_endpoint" {
  type        = string
  description = "MediaConvert account endpoint"
}

variable "mediaconvert_role_arn" {
  type        = string
  description = "IAM role ARN used by MediaConvert to access S3"
}


