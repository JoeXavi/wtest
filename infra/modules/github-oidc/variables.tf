variable "name_prefix" {
  description = "Prefix for IAM role names"
  type        = string
}

variable "github_org" {
  description = "GitHub organization or user"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
}

variable "create_oidc_provider" {
  description = "Create the GitHub OIDC provider in this account (set false if it already exists)"
  type        = bool
  default     = true
}

variable "web_bucket_arn" {
  description = "S3 web bucket ARN for the web deploy role"
  type        = string
}

variable "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN for invalidations"
  type        = string
}

variable "ecr_repository_arn" {
  description = "ECR repository ARN for the API deploy role"
  type        = string
}

variable "ecs_task_execution_role_arn" {
  description = "ECS task execution role ARN (for PassRole)"
  type        = string
}

variable "ecs_task_role_arn" {
  description = "ECS task role ARN (for PassRole)"
  type        = string
}

variable "state_bucket_arn" {
  description = "Terraform state bucket ARN for the terraform deploy role"
  type        = string
}

variable "tags" {
  description = "Tags applied to IAM roles"
  type        = map(string)
  default     = {}
}
