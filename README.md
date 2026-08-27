# Norte — checkout for JoeXavi Dev Hours

Public monorepo implementing a mobile-first checkout SPA and NestJS API. Pay with a credit card through a sandbox Payment Service Provider (**PSP**), reserve stock in DynamoDB, and show the result.

> The repository intentionally avoids the PSP company name in code, docs, and config keys.

## Live URLs

| Surface | URL |
| --- | --- |
| Storefront | _pending deploy_ → `https://joexavisa.dev` |
| API (Swagger) | _pending deploy_ → `https://api.joexavisa.dev/docs` |
| Health | `https://api.joexavisa.dev/health` |

## Stack

- **Web:** React 19 + Vite + Redux Toolkit + CSS Modules (Jest)
- **API:** NestJS 11 + hexagonal architecture + ROP `Result` type (Jest)
- **DB:** DynamoDB single-table
- **Infra:** Terraform (ECS Fargate, ALB, S3, CloudFront, Route53, SSM, GitHub OIDC)
- **CI/CD:** GitHub Actions

## Docs

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Frontend design spec](docs/design-spec.md)
- [Postman collection](docs/postman/collection.json)
- [Infrastructure](infra/README.md)

## Local development

Prerequisites: Node 22, pnpm 10, Docker.

```bash
cp .env.example .env   # fill PSP_* from the test brief (sandbox only)
pnpm install
pnpm db:up             # DynamoDB Local on :8000
pnpm --filter @norte/api db:setup
pnpm seed
pnpm dev:api           # http://localhost:3000  (Swagger /docs)
pnpm dev:web           # http://localhost:5173
```

Sandbox card numbers (outcome by PAN):

- `4242 4242 4242 4242` → APPROVED
- `4111 1111 1111 1111` → DECLINED

## Scripts

```bash
pnpm test          # unit tests
pnpm test:cov      # coverage (thresholds enforced)
pnpm build
pnpm typecheck
```

## API surface

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/products` | Catalogue |
| GET | `/api/products/:id` | Product detail |
| GET | `/api/stock/:productId` | Availability |
| POST | `/api/checkout/transactions` | Reserve + create PENDING tx |
| POST | `/api/checkout/transactions/:ref/pay` | Charge via PSP |
| POST | `/api/checkout/transactions/:ref/cancel` | Void unpaid PENDING tx + release stock |
| GET | `/api/transactions/:ref` | Poll / finalize |
| GET | `/api/customers/:id` | Customer |
| GET/PATCH | `/api/deliveries/:ref` | Delivery |
| POST | `/api/webhooks/psp` | PSP events |
| GET | `/health` | ALB health |
| GET | `/docs` | Swagger UI |

Amounts are **server-computed** (hours × 50.000 COP + 1.500 base + 8.000 delivery). Declined payments return **HTTP 200** with `status: DECLINED`.

## Coverage (local run)

| Package | Suites | Notes |
| --- | --- | --- |
| `@norte/api` | 35 tests | Domain, use cases, Result mapper, env — thresholds ≥80% lines on collected sources |
| `@norte/web` | 56 tests | Validators, UI primitives, checkout slice, persistence |

Paste CI artifact summaries here after the first green pipeline.

## Security highlights

- PAN tokenized in the browser with the PSP public key — never hits our API
- Integrity signature and private key stay server-side (SSM SecureString)
- Helmet, throttling, validation whitelist, redacted logs, CloudFront security headers
- Least-privilege DynamoDB IAM on the ECS task role

## Deploy

See [infra/README.md](infra/README.md). High level:

1. Bootstrap Terraform state bucket
2. Apply `infra/envs/prod`
3. Put PSP secrets in SSM
4. Configure GitHub Actions vars/roles from Terraform outputs
5. Push to `main` → CI + deploy workflows

## Product

**JoeXavi Dev Hours** — USD 20 / hour, billed at **50.000 COP / hour** (fixed test rate 2.500 COP per USD). Quantity = hours (seed stock 48).

## AI-assisted development

This solution was built with Cursor as a coding assistant: architecture docs, hexagonal NestJS core, React/Redux SPA, Terraform, and GitHub Actions were authored and iterated with AI under human review. Feature branches and PRs are recommended per the test brief.

## License

Private evaluation / interview exercise. Do not share solutions with other candidates.
