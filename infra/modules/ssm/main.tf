locals {
  parameter_names = {
    psp_private_key      = "/${var.name_prefix}/PSP_PRIVATE_KEY"
    psp_integrity_secret = "/${var.name_prefix}/PSP_INTEGRITY_SECRET"
    psp_events_secret    = "/${var.name_prefix}/PSP_EVENTS_SECRET"
  }
}

# Placeholder SecureString values — replace via AWS CLI/Console after apply.
# Terraform ignores subsequent value changes so secrets are not overwritten.
resource "aws_ssm_parameter" "psp_private_key" {
  name        = local.parameter_names.psp_private_key
  description = "PSP private API key (set after apply; never commit real values)"
  type        = "SecureString"
  value       = "REPLACE_ME"

  tags = merge(var.tags, {
    Name = local.parameter_names.psp_private_key
  })

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "psp_integrity_secret" {
  name        = local.parameter_names.psp_integrity_secret
  description = "PSP integrity secret for transaction signatures"
  type        = "SecureString"
  value       = "REPLACE_ME"

  tags = merge(var.tags, {
    Name = local.parameter_names.psp_integrity_secret
  })

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "psp_events_secret" {
  name        = local.parameter_names.psp_events_secret
  description = "PSP events/webhook checksum secret"
  type        = "SecureString"
  value       = "REPLACE_ME"

  tags = merge(var.tags, {
    Name = local.parameter_names.psp_events_secret
  })

  lifecycle {
    ignore_changes = [value]
  }
}
