terraform {
  backend "s3" {
    # Fill after bootstrap. Example:
    bucket       = "norte-terraform-state-wtest"
    key          = "norte/prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
