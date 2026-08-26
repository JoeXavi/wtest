terraform {
  backend "s3" {
    # Fill after bootstrap. Example:
    # bucket       = "norte-tf-state-<account-id>"
    # key          = "prod/terraform.tfstate"
    # region       = "us-east-1"
    # encrypt      = true
    # use_lockfile = true
  }
}
