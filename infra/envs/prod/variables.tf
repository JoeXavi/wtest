variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used in resource prefixes"
  type        = string
  default     = "norte"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Apex domain (e.g. joexavisa.dev)"
  type        = string
}

variable "create_zone" {
  description = "Create a new Route53 hosted zone for domain_name"
  type        = bool
  default     = true
}

variable "github_org" {
  description = "GitHub org or user that owns the repo"
  type        = string
  default     = "JoeXavi"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "wtest"
}

variable "create_oidc_provider" {
  description = "Create the GitHub OIDC provider (false if one already exists in the account)"
  type        = bool
  default     = true
}

variable "terraform_state_bucket" {
  description = "S3 bucket name created by infra/bootstrap (for IAM grants)"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "table_name" {
  description = "DynamoDB table name"
  type        = string
  default     = "norte-main"
}

variable "container_port" {
  description = "API container port"
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "ALB health check path"
  type        = string
  default     = "/health"
}

variable "image_tag" {
  description = "Initial ECS image tag (CI overwrites via new task definitions)"
  type        = string
  default     = "latest"
}

variable "ecs_cpu" {
  description = "Fargate CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "ecs_memory" {
  description = "Fargate memory in MiB"
  type        = number
  default     = 512
}

variable "ecs_desired_count" {
  description = "Desired ECS task count"
  type        = number
  default     = 1
}

variable "psp_base_url" {
  description = "PSP API base URL (sandbox or production)"
  type        = string
}

variable "psp_public_key" {
  description = "PSP public key (safe for env vars; not a secret)"
  type        = string
}

variable "psp_connect_src_extra" {
  description = "Extra CSP connect-src entries beyond the PSP base URL host"
  type        = list(string)
  default     = []
}

variable "pricing_base_fee_cents" {
  description = "Checkout base fee in cents"
  type        = number
  default     = 150000
}

variable "pricing_delivery_fee_cents" {
  description = "Checkout delivery fee in cents"
  type        = number
  default     = 800000
}

variable "reservation_ttl_seconds" {
  description = "Stock reservation TTL"
  type        = number
  default     = 900
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for the API"
  type        = number
  default     = 14
}
