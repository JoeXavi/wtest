variable "name_prefix" {
  description = "Prefix for frontend resources"
  type        = string
}

variable "domain_name" {
  description = "Apex domain served by CloudFront (e.g. example.com)"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for ACM validation"
  type        = string
}

variable "api_origin_domain" {
  description = "Hostname of the ALB origin for /api/* (e.g. api.example.com)"
  type        = string
}

variable "psp_connect_src_hosts" {
  description = "Additional CSP connect-src hosts (PSP tokenization / API hosts)"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to frontend resources"
  type        = map(string)
  default     = {}
}
