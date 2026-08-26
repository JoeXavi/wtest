variable "name_prefix" {
  description = "Prefix for ALB resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID attached to the ALB"
  type        = string
}

variable "container_port" {
  description = "Target group port (container port)"
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "ALB health check path"
  type        = string
  default     = "/health"
}

variable "api_hostname" {
  description = "Hostname for the API certificate and HTTPS listener (e.g. api.example.com)"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID used for ACM DNS validation"
  type        = string
}

variable "tags" {
  description = "Tags applied to ALB resources"
  type        = map(string)
  default     = {}
}
