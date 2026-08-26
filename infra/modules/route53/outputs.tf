output "zone_id" {
  description = "Route53 hosted zone ID"
  value       = local.resolved_zone_id
}

output "name_servers" {
  description = "Hosted zone name servers (empty when zone_id was passed in)"
  value       = local.name_servers
}

output "apex_fqdn" {
  description = "Apex record FQDN"
  value       = var.enable_aliases ? aws_route53_record.apex[0].fqdn : var.domain_name
}

output "api_fqdn" {
  description = "API record FQDN"
  value       = var.enable_aliases ? aws_route53_record.api[0].fqdn : var.api_hostname
}
