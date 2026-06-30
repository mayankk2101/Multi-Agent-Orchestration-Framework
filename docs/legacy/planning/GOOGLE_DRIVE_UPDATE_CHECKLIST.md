# Google Drive Update Checklist — AWS Reconciliation

**Date:** 2026-06-19
**Purpose:** Track which repository documents changed during the DigitalOcean → AWS reconciliation and whether the corresponding Google Drive copy must be updated to stay in sync.

> Anyone maintaining a Google Drive mirror of these docs should re-upload/replace the Drive copy wherever **Drive Update Required = Yes**. Documents marked **No** either did not change materially or have no infrastructure content.

---

## Live / Canonical Documents (Updated to AWS)

| Document | Repo Updated | Drive Update Required | Notes |
|---|---|---|---|
| `README.md` | ✅ Yes | **Yes** | Deployment, DB, cache, monitoring, env-var, and production sections re-pointed from DigitalOcean to AWS (EC2/RDS/S3/ECR/CloudWatch/ACM). |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN.md` | ✅ Yes | **Yes** | Full rewrite to AWS: secrets, backups, monitoring, logging, CI/CD, topology diagram, cost model, DR runbooks. Primary infra reference. |
| `backend/README.md` | ✅ Yes | **Yes** | "Using DigitalOcean (Production)" → "Using AWS RDS (Production)". |
| `docs/STAGING_DEPLOY_RUNBOOK.md` | ✅ Yes | **Yes** | Re-scoped from staging Droplet to staging EC2 (SSM/ECR, RDS, S3). |
| `DEPLOYMENT_READINESS_REPORT.md` | ✅ Yes | **Yes** | Provisioning checklist, blockers, and secrets updated to AWS services. |
| `deploy/cloudflare-checklist.md` → `deploy/aws-edge-checklist.md` | ✅ Yes (renamed) | **Yes** | Replaced Cloudflare DNS/SSL/WAF checklist with AWS Route53 + ACM + ALB + AWS WAF. **Delete the old Drive file** and upload the new one. |

## New Documents (Created)

| Document | Repo Updated | Drive Update Required | Notes |
|---|---|---|---|
| `AWS_DOCUMENTATION_AUDIT.md` | ✅ New | **Yes** | Phase 1 audit of all DO/Cloudflare references + AWS service mapping. |
| `AWS_DEPLOYMENT_GUIDE.md` | ✅ New | **Yes** | 16-section step-by-step AWS deployment guide. Add to Drive deployment folder. |
| `GOOGLE_DRIVE_UPDATE_CHECKLIST.md` | ✅ New | **Yes** | This file. |
| `AWS_DOCUMENTATION_RECONCILIATION_REPORT.md` | ✅ New | **Yes** | Phase 5 final report. |

## Historical Records (SUPERSEDED banner added — body preserved)

| Document | Repo Updated | Drive Update Required | Notes |
|---|---|---|---|
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V1.md` | ✅ Banner only | Optional | Preserved as historical record; banner redirects to AWS docs. Update Drive only if it shows the banner. |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` | ✅ Banner only | Optional | Same as above. |
| `INFRASTRUCTURE_CRITICAL_FIX_VALIDATION.md` | ✅ Banner only | Optional | Same. |
| `INFRASTRUCTURE_IMPLEMENTATION_COMPLIANCE_REPORT.md` | ✅ Banner only | Optional | Same. |
| `AUTHORITY_RECONCILIATION_V2_REPORT.md` | ✅ Banner only | Optional | Same. |
| `MVP_EXECUTION_MASTER_PLAN.md` | ✅ Banner only | Optional | Partial-supersede banner (infra section only). |
| `SPRINT_1_CANONICAL_EXECUTION_PLAN.md` | ✅ Banner only | Optional | Partial-supersede banner (B-3 / DO Spaces). |
| `DOCUMENTATION_AUDIT_REPORT.md` | ✅ Banner only | Optional | Note added re: Cloudflare → AWS. |
| `TESTING_MASTER_PLAN.md` | ✅ Banner only | Optional | Note: mock S3 instead of DO Spaces. |
| `TESTING_MASTER_PLAN_FREEZE.md` | ✅ Banner only | Optional | Same. |
| `TESTING_MASTER_PLAN_PATCH_V1.md` | ✅ Banner only | Optional | Same. |
| `TESTING_MASTER_PLAN_PATCH_V2.md` | ✅ Banner only | Optional | Same. |

## Not Changed (No Drive action)

| Document | Repo Updated | Drive Update Required | Notes |
|---|---|---|---|
| `docs/API_SPEC_V1*.md` | No | No | Only matched "spaces" (validation rule text) — false positive. |
| `_legacy/reports/*.md` | No | No | Explicitly archived material. |
| All other `*.md` | No | No | No DigitalOcean/Cloudflare content. |

---

### Drive Maintainer Actions Summary

1. Replace Drive copies of all **Live/Canonical** docs (6 files).
2. Upload the 4 **New** docs.
3. **Delete** `cloudflare-checklist` from Drive; upload `aws-edge-checklist`.
4. Optionally refresh historical docs so the SUPERSEDED banner is visible in Drive.
</content>
