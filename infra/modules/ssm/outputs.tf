output "psp_private_key_arn" {
  description = "SSM parameter ARN for PSP_PRIVATE_KEY"
  value       = aws_ssm_parameter.psp_private_key.arn
}

output "psp_integrity_secret_arn" {
  description = "SSM parameter ARN for PSP_INTEGRITY_SECRET"
  value       = aws_ssm_parameter.psp_integrity_secret.arn
}

output "psp_events_secret_arn" {
  description = "SSM parameter ARN for PSP_EVENTS_SECRET"
  value       = aws_ssm_parameter.psp_events_secret.arn
}

output "parameter_names" {
  description = "SSM parameter names"
  value       = local.parameter_names
}
