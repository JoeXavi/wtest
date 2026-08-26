terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }
}

locals {
  name_prefix    = "${var.project}-${var.environment}"
  api_hostname   = "api.${var.domain_name}"
  cloudfront_url = "https://${var.domain_name}"

  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  # Derive CSP connect-src hosts from the PSP base URL host
  psp_host = try(regex("^https?://([^/]+)", var.psp_base_url)[0], var.psp_base_url)
}

# ---------------------------------------------------------------------------
# DNS zone (created first so ACM validation can use it)
# ---------------------------------------------------------------------------

module "dns_zone" {
  source = "../../modules/route53"

  domain_name    = var.domain_name
  create_zone    = var.create_zone
  enable_aliases = false
  tags           = local.tags
}

# ---------------------------------------------------------------------------
# Core platform
# ---------------------------------------------------------------------------

module "network" {
  source = "../../modules/network"

  name_prefix    = local.name_prefix
  vpc_cidr       = var.vpc_cidr
  container_port = var.container_port
  tags           = local.tags
}

module "dynamodb" {
  source = "../../modules/dynamodb"

  table_name = var.table_name
  tags       = local.tags
}

module "ecr" {
  source = "../../modules/ecr"

  repository_name = "${local.name_prefix}-api"
  tags            = local.tags
}

module "ssm" {
  source = "../../modules/ssm"

  name_prefix = local.name_prefix
  tags        = local.tags
}

module "alb" {
  source = "../../modules/alb"

  name_prefix       = local.name_prefix
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  security_group_id = module.network.alb_security_group_id
  container_port    = var.container_port
  health_check_path = var.health_check_path
  api_hostname      = local.api_hostname
  route53_zone_id   = module.dns_zone.zone_id
  tags              = local.tags
}

module "ecs" {
  source = "../../modules/ecs"

  name_prefix                  = local.name_prefix
  aws_region                   = var.aws_region
  subnet_ids                   = module.network.public_subnet_ids
  security_group_id            = module.network.ecs_security_group_id
  target_group_arn             = module.alb.target_group_arn
  ecr_repository_url           = module.ecr.repository_url
  image_tag                    = var.image_tag
  container_port               = var.container_port
  cpu                          = var.ecs_cpu
  memory                       = var.ecs_memory
  desired_count                = var.ecs_desired_count
  table_name                   = module.dynamodb.table_name
  table_arn                    = module.dynamodb.table_arn
  gsi1_arn                     = module.dynamodb.gsi1_arn
  psp_base_url                 = var.psp_base_url
  psp_public_key               = var.psp_public_key
  psp_private_key_ssm_arn      = module.ssm.psp_private_key_arn
  psp_integrity_secret_ssm_arn = module.ssm.psp_integrity_secret_arn
  psp_events_secret_ssm_arn    = module.ssm.psp_events_secret_arn
  pricing_base_fee_cents       = var.pricing_base_fee_cents
  pricing_delivery_fee_cents   = var.pricing_delivery_fee_cents
  reservation_ttl_seconds      = var.reservation_ttl_seconds
  cors_origin                  = local.cloudfront_url
  log_retention_days           = var.log_retention_days
  tags                         = local.tags

  depends_on = [module.alb]
}

module "frontend" {
  source = "../../modules/frontend"

  name_prefix           = local.name_prefix
  domain_name           = var.domain_name
  route53_zone_id       = module.dns_zone.zone_id
  api_origin_domain     = local.api_hostname
  psp_connect_src_hosts = concat(["https://${local.psp_host}"], var.psp_connect_src_extra)
  tags                  = local.tags
}

# ---------------------------------------------------------------------------
# DNS aliases (apex → CloudFront, api → ALB)
# ---------------------------------------------------------------------------

module "dns_aliases" {
  source = "../../modules/route53"

  domain_name               = var.domain_name
  create_zone               = false
  zone_id                   = module.dns_zone.zone_id
  enable_aliases            = true
  cloudfront_domain_name    = module.frontend.cloudfront_domain_name
  cloudfront_hosted_zone_id = module.frontend.cloudfront_hosted_zone_id
  alb_dns_name              = module.alb.alb_dns_name
  alb_zone_id               = module.alb.alb_zone_id
  api_hostname              = local.api_hostname
  tags                      = local.tags
}

# ---------------------------------------------------------------------------
# GitHub Actions OIDC deploy roles
# ---------------------------------------------------------------------------

module "github_oidc" {
  source = "../../modules/github-oidc"

  name_prefix                 = local.name_prefix
  github_org                  = var.github_org
  github_repo                 = var.github_repo
  create_oidc_provider        = var.create_oidc_provider
  web_bucket_arn              = module.frontend.bucket_arn
  cloudfront_distribution_arn = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${module.frontend.cloudfront_distribution_id}"
  ecr_repository_arn          = module.ecr.repository_arn
  ecs_task_execution_role_arn = module.ecs.execution_role_arn
  ecs_task_role_arn           = module.ecs.task_role_arn
  state_bucket_arn            = data.aws_s3_bucket.terraform_state.arn
  tags                        = local.tags
}

data "aws_caller_identity" "current" {}

data "aws_s3_bucket" "terraform_state" {
  bucket = var.terraform_state_bucket
}
