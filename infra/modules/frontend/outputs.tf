output "bucket_name" {
  description = "S3 bucket name for the SPA"
  value       = aws_s3_bucket.web.id
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.web.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = aws_cloudfront_distribution.web.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront Route53 hosted zone ID"
  value       = aws_cloudfront_distribution.web.hosted_zone_id
}

output "cloudfront_url" {
  description = "HTTPS URL for the apex domain via CloudFront"
  value       = "https://${var.domain_name}"
}

output "certificate_arn" {
  description = "ACM certificate ARN for the web domain"
  value       = aws_acm_certificate.web.arn
}
