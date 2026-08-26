variable "name_prefix" {
  description = "Prefix for SSM parameter paths"
  type        = string
}

variable "tags" {
  description = "Tags applied to SSM parameters"
  type        = map(string)
  default     = {}
}
