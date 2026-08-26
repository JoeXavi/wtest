locals {
  manage_zone = var.zone_id == null
}

resource "aws_route53_zone" "this" {
  count = local.manage_zone && var.create_zone ? 1 : 0

  name = var.domain_name

  tags = merge(var.tags, {
    Name = var.domain_name
  })
}

data "aws_route53_zone" "existing" {
  count = local.manage_zone && !var.create_zone ? 1 : 0

  name         = var.domain_name
  private_zone = false
}

locals {
  resolved_zone_id = (
    var.zone_id != null
    ? var.zone_id
    : (
      var.create_zone
      ? aws_route53_zone.this[0].zone_id
      : data.aws_route53_zone.existing[0].zone_id
    )
  )

  name_servers = (
    var.zone_id != null
    ? []
    : (
      var.create_zone
      ? aws_route53_zone.this[0].name_servers
      : data.aws_route53_zone.existing[0].name_servers
    )
  )
}

resource "aws_route53_record" "apex" {
  count = var.enable_aliases ? 1 : 0

  zone_id = local.resolved_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_ipv6" {
  count = var.enable_aliases ? 1 : 0

  zone_id = local.resolved_zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  count = var.enable_aliases ? 1 : 0

  zone_id = local.resolved_zone_id
  name    = var.api_hostname
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api_ipv6" {
  count = var.enable_aliases ? 1 : 0

  zone_id = local.resolved_zone_id
  name    = var.api_hostname
  type    = "AAAA"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
