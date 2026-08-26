variable "domain_name" {
  description = "Root domain name (e.g. example.com)"
  type        = string
}

variable "create_zone" {
  description = "If true, create a new hosted zone; otherwise look up an existing one (unless zone_id is set)"
  type        = bool
  default     = true
}

variable "zone_id" {
  description = "Optional zone ID. When set, skips create/lookup (used for alias-only module calls)"
  type        = string
  default     = null
}

variable "enable_aliases" {
  description = "Create apex and API alias records (requires CloudFront and ALB inputs)"
  type        = bool
  default     = true
}

variable "cloudfront_domain_name" {
  description = "CloudFront distribution domain name for the apex alias"
  type        = string
  default     = ""
}

variable "cloudfront_hosted_zone_id" {
  description = "CloudFront Route53 hosted zone ID"
  type        = string
  default     = ""
}

variable "alb_dns_name" {
  description = "ALB DNS name for the API alias"
  type        = string
  default     = ""
}

variable "alb_zone_id" {
  description = "ALB Route53 zone ID"
  type        = string
  default     = ""
}

variable "api_hostname" {
  description = "API hostname (e.g. api.example.com)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to the hosted zone"
  type        = map(string)
  default     = {}
}
