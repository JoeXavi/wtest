# Norte infrastructure (AWS / us-east-1)

Terraform modules and the prod root module for the Norte checkout stack: public VPC, DynamoDB, ECR, ECS Fargate, ALB, S3 + CloudFront (SPA + `/api/*`), Route53, SSM secrets, and GitHub Actions OIDC deploy roles.

## Production (live)

| Surface | URL |
| --- | --- |
| Storefront | `https://joexavisa.dev` |
| API (ALB / `api` subdomain) | `https://api.joexavisa.dev` |
| API via CloudFront | `https://joexavisa.dev/api/*` |
| Swagger | `https://api.joexavisa.dev/docs` |
| Health | `https://api.joexavisa.dev/health` |

Region: **us-east-1**. GitHub environment: **production**.

### Day-2 deploys

App and infra changes ship through GitHub Actions on `main` (not a local `terraform apply`):

| Workflow | Trigger | What it does |
| --- | --- | --- |
| [`deploy-web.yml`](../.github/workflows/deploy-web.yml) | push to `main` (web paths) or `workflow_dispatch` | Build SPA → sync to S3 → CloudFront invalidate |
| [`deploy-api.yml`](../.github/workflows/deploy-api.yml) | push to `main` (api paths) or `workflow_dispatch` | Build `linux/amd64` → push ECR → register ECS task → wait for stability |
| [`terraform.yml`](../.github/workflows/terraform.yml) | PR / push to `main` (`infra/**`) or `workflow_dispatch` | Plan on PRs; apply on `main` behind the `production` environment |

To rotate PSP secrets after the stack exists, use [Set SSM secrets](#3-set-ssm-secrets-recreate--rotate) below and force a new ECS deployment.

## First-time / recreate

Use these steps only when standing the stack up again (or for a new environment). Production is already applied.

### Prerequisites

- Terraform >= 1.5
- AWS CLI authenticated with permission to create the bootstrap bucket and (later) the full stack
- Domain `joexavisa.dev` (or your `domain_name`) ready for Route53 NS delegation

### 1. Bootstrap (one-time, local state)

Creates the S3 bucket used for remote state (versioned, encrypted, public access blocked). Uses **local** state only.

```bash
cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars   # if you add one; or pass -var
terraform init
terraform apply -var="state_bucket_name=norte-terraform-state-<unique>"
```

Copy the bucket name into `infra/envs/prod/backend.tf` and into `terraform.tfvars` as `terraform_state_bucket`.

### 2. Apply prod

```bash
cd infra/envs/prod
cp terraform.tfvars.example terraform.tfvars
# edit: domain_name, psp_base_url, psp_public_key, terraform_state_bucket, etc.
# never put PSP_PRIVATE_KEY / integrity / events secrets in tfvars

terraform init
terraform apply
```

If `create_zone = true`, point the registrar at the `name_servers` output. Wait for ACM DNS validation to complete (handled in-module).

Useful outputs: `cloudfront_url`, `api_url`, `table_name`, `ecr_url`, deploy role ARNs, `ssm_parameter_names`.

### 3. Set SSM secrets (recreate / rotate)

Placeholder SecureString parameters are created under `/norte-prod/...`. Replace values (Terraform ignores later value changes):

```bash
aws ssm put-parameter --name /norte-prod/PSP_PRIVATE_KEY --type SecureString --value '…' --overwrite
aws ssm put-parameter --name /norte-prod/PSP_INTEGRITY_SECRET --type SecureString --value '…' --overwrite
aws ssm put-parameter --name /norte-prod/PSP_EVENTS_SECRET --type SecureString --value '…' --overwrite
```

Then force a new ECS deployment so tasks pick up the secrets:

```bash
aws ecs update-service --cluster norte-prod-cluster --service norte-prod-api --force-new-deployment
```

### 4. GitHub Actions vars and secrets

Create a **production** environment (required for apply / deploy workflows) with protection rules as needed.

**Secrets**

| Name | Value |
| --- | --- |
| `AWS_WEB_DEPLOY_ROLE_ARN` | `web_deploy_role_arn` output |
| `AWS_API_DEPLOY_ROLE_ARN` | `api_deploy_role_arn` output |
| `AWS_TERRAFORM_ROLE_ARN` | `terraform_role_arn` output |

**Variables** (repo or environment)

| Name | Example |
| --- | --- |
| `AWS_REGION` | `us-east-1` |
| `WEB_BUCKET_NAME` | `web_bucket_name` output |
| `CLOUDFRONT_DISTRIBUTION_ID` | `cloudfront_distribution_id` output |
| `ECR_REPOSITORY` | `norte-prod-api` |
| `ECS_CLUSTER_NAME` | `ecs_cluster_name` output |
| `ECS_SERVICE_NAME` | `ecs_service_name` output |
| `ECS_TASK_FAMILY` | `norte-prod-api` |
| `VITE_API_BASE_URL` | `/api` |
| `VITE_PSP_PUBLIC_KEY` | public test/live key |
| `VITE_PSP_TOKENIZATION_URL` | same host as PSP base URL |
| `TF_DOMAIN_NAME` | `joexavisa.dev` |
| `TF_PSP_BASE_URL` | PSP sandbox/production base URL |
| `TF_PSP_PUBLIC_KEY` | public key |
| `TF_STATE_BUCKET` | bootstrap bucket name |
| `TF_CREATE_ZONE` | `true` / `false` |
| `TF_CREATE_OIDC_PROVIDER` | `true` / `false` |

## Layout

```
infra/
  bootstrap/       # state bucket (local state)
  modules/         # network, dynamodb, ecr, ecs, alb, frontend, route53, github-oidc, ssm
  envs/prod/       # wired stack + remote S3 backend
```

## Notes

- Fargate tasks use **public subnets** with `assign_public_ip = true` (no NAT). The ECS security group allows traffic **only from the ALB**.
- CloudFront default behavior serves the SPA from S3 (OAC); `/api/*` is forwarded to the ALB over HTTPS using `api.<domain>`.
- CSP `connect-src` includes the PSP host derived from `psp_base_url` (plus optional `psp_connect_src_extra`).
- Do not commit real secrets or the payment provider’s company name; use **PSP** naming only.
