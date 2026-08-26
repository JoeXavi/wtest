output "cloudfront_url" {
  description = "Public SPA URL (CloudFront / apex domain)"
  value       = module.frontend.cloudfront_url
}

output "api_url" {
  description = "Direct API URL (ALB via api subdomain)"
  value       = "https://${local.api_hostname}"
}

output "table_name" {
  description = "DynamoDB table name"
  value       = module.dynamodb.table_name
}

output "ecr_url" {
  description = "ECR repository URL for the API image"
  value       = module.ecr.repository_url
}

output "web_deploy_role_arn" {
  description = "GitHub Actions role ARN for web deploys"
  value       = module.github_oidc.web_deploy_role_arn
}

output "api_deploy_role_arn" {
  description = "GitHub Actions role ARN for API deploys"
  value       = module.github_oidc.api_deploy_role_arn
}

output "terraform_role_arn" {
  description = "GitHub Actions role ARN for Terraform"
  value       = module.github_oidc.terraform_role_arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.frontend.cloudfront_distribution_id
}

output "web_bucket_name" {
  description = "S3 bucket for the SPA"
  value       = module.frontend.bucket_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = module.ecs.service_name
}

output "name_servers" {
  description = "Route53 name servers — point the domain registrar here when create_zone is true"
  value       = module.dns_zone.name_servers
}

output "ssm_parameter_names" {
  description = "SSM SecureString parameter names to populate with real PSP secrets"
  value       = module.ssm.parameter_names
}
