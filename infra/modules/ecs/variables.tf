variable "name_prefix" {
  description = "Prefix for ECS resources"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for Fargate tasks (public subnets with assign_public_ip)"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "target_group_arn" {
  description = "ALB target group ARN"
  type        = string
}

variable "ecr_repository_url" {
  description = "ECR repository URL for the API image"
  type        = string
}

variable "image_tag" {
  description = "Container image tag to deploy"
  type        = string
  default     = "latest"
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 3000
}

variable "cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate task memory (MiB)"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 1
}

variable "table_name" {
  description = "DynamoDB table name"
  type        = string
}

variable "table_arn" {
  description = "DynamoDB table ARN"
  type        = string
}

variable "gsi1_arn" {
  description = "DynamoDB GSI1 ARN"
  type        = string
}

variable "psp_base_url" {
  description = "PSP API base URL"
  type        = string
}

variable "psp_public_key" {
  description = "PSP public key (non-secret)"
  type        = string
}

variable "psp_private_key_ssm_arn" {
  description = "SSM SecureString ARN for PSP_PRIVATE_KEY"
  type        = string
}

variable "psp_integrity_secret_ssm_arn" {
  description = "SSM SecureString ARN for PSP_INTEGRITY_SECRET"
  type        = string
}

variable "psp_events_secret_ssm_arn" {
  description = "SSM SecureString ARN for PSP_EVENTS_SECRET"
  type        = string
}

variable "pricing_base_fee_cents" {
  description = "Base fee in cents"
  type        = number
  default     = 150000
}

variable "pricing_delivery_fee_cents" {
  description = "Delivery fee in cents"
  type        = number
  default     = 800000
}

variable "reservation_ttl_seconds" {
  description = "Stock reservation TTL in seconds"
  type        = number
  default     = 900
}

variable "cors_origin" {
  description = "CORS origin for the API"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "tags" {
  description = "Tags applied to ECS resources"
  type        = map(string)
  default     = {}
}
