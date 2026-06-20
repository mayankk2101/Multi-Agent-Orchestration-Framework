# AWS Documentation Audit — Hotel CRM

**Role:** Principal Architect / Documentation Governance Lead
**Date:** 2026-06-19
**Scope:** Documentation-only audit of all DigitalOcean (DO) / Cloudflare deployment assumptions across the repository.
**Strategic decision being enforced:** *All deployment documentation must use AWS.* DigitalOcean is no longer the deployment target.

> This is the **Phase 1** deliverable. No files were modified to produce this audit. Reconciliation (Phase 2), new deployment documentation (Phase 3), the Google Drive checklist (Phase 4), and the final report (Phase 5) follow in separate deliverables.

---

## AWS Target Service Mapping (Canonical)

| Concern | Old (DigitalOcean / Cloudflare) | New (AWS) |
|---|---|---|
| Compute | DO App Platform / Droplet | **EC2** |
| Database | DO Managed PostgreSQL | **RDS PostgreSQL** |
| Object storage | DO Spaces | **S3** |
| Container registry | DO Container Registry (`registry.digitalocean.com`) | **ECR** |
| Monitoring | DO Monitoring | **CloudWatch** |
| SSL/TLS | Cloudflare Origin Cert / Let's Encrypt | **ACM** |
| DNS | Cloudflare DNS | **Route53** (optional if domain stays external) |
| Secrets | DO App Platform env vars | **AWS Secrets Manager** (preferred) or env vars (MVP acceptable) |
| Edge / WAF / CDN | Cloudflare | **ALB + AWS WAF + CloudFront** (optional for MVP) |
| Region | `fra1` (Frankfurt) | `eu-central-1` (Frankfurt) |

---

## Severity Legend

- **CRITICAL** — Live/forward-looking doc presents DO/Cloudflare as the current deployment target; directly contradicts the AWS decision.
- **HIGH** — Live doc with embedded DO/Cloudflare procedures, env vars, or topology that an operator would follow.
- **MEDIUM** — Historical/point-in-time report that references DO as the platform of record; must be marked superseded but preserved.
- **LOW** — Incidental reference, mock, or false-positive (e.g. the word "spaces" meaning whitespace).
- **CODE** — Non-documentation artifact (script, CI workflow, nginx config, env file). **Out of scope** for this documentation-only task; logged as a follow-up engineering blocker.

---

## Findings — Documentation Files

| File | Issue | Severity | Required Change |
|---|---|---|---|
| `README.md` | Header, tech stack, DB, deployment, env-var, monitoring, and "Production (DigitalOcean)" sections name DO Managed PG, DO Spaces, App Platform, `registry.digitalocean.com`, DO APM. | CRITICAL | Rewrite all deployment/DB/monitoring/env-var references to EC2 + RDS + S3 + ECR + CloudWatch + ACM. |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN.md` | Canonical infra plan. Stack line, secrets store (DO App Platform), backups (DO Managed DB / DO Spaces), monitoring (DO Monitoring), logging (DO log drain), CI/CD (`digitalocean/app_action`), full DO topology diagram, App Platform spec, cost model, DR runbooks (`doctl`). | CRITICAL | Full rewrite to AWS: EC2/RDS/S3/ECR/CloudWatch/ACM/Secrets Manager, AWS topology diagram, `aws`/CodeDeploy-style CI, AWS cost model, AWS DR runbooks. |
| `backend/README.md` | "Using DigitalOcean (Production)" DB setup section. | HIGH | Replace with "Using AWS RDS (Production)". |
| `docs/STAGING_DEPLOY_RUNBOOK.md` | Entire runbook scoped to "staging Droplet"; `STAGING_DROPLET_IP` secret, `setup-droplet.sh`, SSH-to-Droplet flow. | HIGH | Re-scope to staging EC2 instance; rename Droplet → EC2; `STAGING_EC2_HOST`; reference AWS setup. |
| `DEPLOYMENT_READINESS_REPORT.md` | Live readiness report: provisioning checklist names DO Managed PG, DO Spaces, Droplet, Cloudflare origin cert; secrets `DO_SPACES_*`, `STAGING_DROPLET_IP`. | HIGH | Update provisioning checklist and blockers to RDS/S3/EC2/ACM/Route53; `AWS_*`/`S3_*` secrets. |
| `deploy/cloudflare-checklist.md` | Entire file is a Cloudflare DNS/SSL/WAF setup checklist for a Droplet origin. | HIGH | Replace with AWS edge checklist (Route53 DNS + ACM certificate + ALB/CloudFront + AWS WAF). File renamed to `deploy/aws-edge-checklist.md`. |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V1.md` | Historical patch: "App Platform vs Droplet", DO DPA, DO Spaces, Cloudflare layer. Point-in-time decision record. | MEDIUM | Add SUPERSEDED banner pointing to AWS canonical docs; preserve body as historical record. |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` | Historical patch: Droplet topology, DO Spaces, Cloudflare, DO Cloud Firewall, full DO diagram. | MEDIUM | Add SUPERSEDED banner; preserve body. |
| `INFRASTRUCTURE_CRITICAL_FIX_VALIDATION.md` | Historical validation of Droplet/DO Spaces script fixes. | MEDIUM | Add SUPERSEDED banner; preserve body. |
| `INFRASTRUCTURE_IMPLEMENTATION_COMPLIANCE_REPORT.md` | Historical compliance audit of Droplet artifacts, Cloudflare, DO Spaces. | MEDIUM | Add SUPERSEDED banner; preserve body. |
| `AUTHORITY_RECONCILIATION_V2_REPORT.md` | Records canonical infra as "DO Droplet + Cloudflare + DO Managed Postgres/Spaces". | MEDIUM | Add SUPERSEDED banner; preserve body. |
| `MVP_EXECUTION_MASTER_PLAN.md` | Topology line: "Single DigitalOcean Droplet + DO Managed PostgreSQL + DO Spaces + Cloudflare". | MEDIUM | Add SUPERSEDED banner; preserve body. |
| `SPRINT_1_CANONICAL_EXECUTION_PLAN.md` | Backlog item B-3 references DO Spaces / `DO_SPACES_*` credential mapping. | MEDIUM | Add SUPERSEDED banner; preserve body. |
| `DOCUMENTATION_AUDIT_REPORT.md` | Deployment architecture line "Cloudflare → Nginx → Express → PostgreSQL". | MEDIUM | Add SUPERSEDED banner; preserve body. |
| `TESTING_MASTER_PLAN.md` | Mocks "DO Spaces" in integration test guidance. | LOW | Add SUPERSEDED banner; note S3 mock equivalent; preserve body. |
| `TESTING_MASTER_PLAN_FREEZE.md` | Frozen testing plan referencing DO Spaces lineage. | LOW | Add SUPERSEDED banner; preserve body. |
| `TESTING_MASTER_PLAN_PATCH_V1.md` | Testing patch referencing DO Spaces lineage. | LOW | Add SUPERSEDED banner; preserve body. |
| `TESTING_MASTER_PLAN_PATCH_V2.md` | Testing patch referencing DO Spaces lineage. | LOW | Add SUPERSEDED banner; preserve body. |
| `docs/API_SPEC_V1.md` | Only matches on "spaces" = character class in validation rules. | LOW | No change (false positive). |
| `_legacy/reports/*.md` | Archived legacy reports under `_legacy/`. | LOW | No change — explicitly archived material. |

---

## Findings — Code / Config Artifacts (OUT OF SCOPE — documentation-only task)

These are **not documentation** and are **not modified** under this task's operating rules ("Do NOT write code / Do NOT create deployment scripts"). They are logged here as **engineering follow-up blockers** that must be reconciled to AWS before the AWS docs become executable truth.

| File | Issue | Severity | Required Change (follow-up ticket) |
|---|---|---|---|
| `scripts/setup-droplet.sh` | Provisions a DO Droplet (nvm, pm2, nginx, ufw); DO Spaces assumptions. | CODE | Replace with EC2 bootstrap (user-data / AMI) or note as deprecated. |
| `scripts/deploy.sh` | SSH-to-Droplet deploy. | CODE | Re-target to EC2 / CodeDeploy. |
| `scripts/backup-db.sh` | `pg_dump` → DO Spaces via `--endpoint-url …digitaloceanspaces.com`. | CODE | Re-target to S3 (`aws s3 cp`, no custom endpoint) + RDS automated snapshots. |
| `scripts/rotate-secrets.sh` | Rotates secrets in `/etc/hotel-crm/.env` on Droplet. | CODE | Re-target to AWS Secrets Manager rotation. |
| `nginx/hotelcrm.conf` | Cloudflare origin cert paths; Cloudflare IP rate-limit model. | CODE | Re-target to ACM-on-ALB or self-managed cert on EC2. |
| `.github/workflows/deploy-staging.yml` | SSH deploy to `STAGING_DROPLET_IP`. | CODE | Re-target to EC2/ECR/CodeDeploy; rename secrets. |
| `.github/workflows/deploy-production.yml` | SSH deploy to `PROD_DROPLET_IP`. | CODE | Re-target to AWS. |
| `.github/workflows/ci.yml` | References DO env vars in test matrix. | CODE | Update env var names to AWS equivalents. |
| `backend/.env.example` | `DO_SPACES_KEY/SECRET/BUCKET/REGION/ENDPOINT`. | CODE | Replace with `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. |
| `backend/.env.staging` | DO Spaces + Droplet Redis assumptions. | CODE | Replace with AWS S3/RDS values. |
| `backend/src/config/env.ts` | Validates `DO_SPACES_*` vars. | CODE | Validate `S3_*` / `AWS_*` vars. |
| `mobile/*/src/lib/api.ts` | Matched on `\bDO\b` only (false positive — no DO infra). | LOW | No change. |

---

## Summary Counts

- **Documentation files reviewed:** 59 markdown files (full repo, excluding `node_modules`).
- **Documentation files flagged for change:** 19 (6 CRITICAL/HIGH live docs + 13 historical/LOW banners).
- **Code/config artifacts flagged (out of scope):** 11 (engineering follow-up).
- **False positives confirmed:** `docs/API_SPEC_V1*.md`, `mobile/*/api.ts`, `_legacy/*`.

Reconciliation proceeds in Phase 2 on the live docs; historical reports receive a preserved-record SUPERSEDED banner.
</content>
</invoke>
