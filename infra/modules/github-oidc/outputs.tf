output "oidc_provider_arn" {
  description = "GitHub Actions OIDC provider ARN"
  value       = local.oidc_provider_arn
}

output "web_deploy_role_arn" {
  description = "IAM role ARN for web deploys"
  value       = aws_iam_role.web_deploy.arn
}

output "api_deploy_role_arn" {
  description = "IAM role ARN for API deploys"
  value       = aws_iam_role.api_deploy.arn
}

output "terraform_role_arn" {
  description = "IAM role ARN for Terraform plan/apply"
  value       = aws_iam_role.terraform.arn
}
