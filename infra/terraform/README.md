# Terraform: SQS + Lambda (Dropbox Sync) + MediaConvert

## Prereqs
- Node 18+, yarn/npm
- Build Lambda first:
  - cd ../../infra/lambda/sqs-consumer
  - yarn && yarn build (or npm i && npm run build)
- Terraform >= 1.5, AWS credentials configured

## Configure
Create `terraform.tfvars` with:

```
aws_region           = "us-east-1"
project              = "maclellanfamily"
bucket_name          = "your-s3-bucket"
dropbox_client_id    = "REPLACE"
dropbox_client_secret= "REPLACE"
dropbox_refresh_token= "REPLACE"
mediaconvert_endpoint= "https://abcd.mediaconvert.us-east-1.amazonaws.com"
mediaconvert_role_arn= "arn:aws:iam::123456789012:role/MediaConvertAccessRole"
```

## Deploy

```
terraform init
terraform apply
```

Outputs will include `sqs_queue_url`. Set this as `SQS_QUEUE_URL` in Vercel env.

## Notes
- Ensure `MediaConvertAccessRole` allows read/write on your bucket and is trusted by `mediaconvert.amazonaws.com`.
- Rebuild and re-apply when Lambda code changes.

