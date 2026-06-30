# MVP EXECUTION MASTER PLAN

**Status:** CONSOLIDATED — reconciled from recovered authority documents only
**Date:** 2026-06-10
**Companion:** `GOVERNANCE_RECOVERY_DELTA_REPORT.md`
**Constraint honored:** No new architecture. No module redesign. Every item below traces to
a recovered document with a citation. Items that depend on NOT RECOVERED documents are marked
**[BLOCKED — pending recovery]** rather than invented.

---

## 0. Authority Hierarchy In Force

Per `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:177-194`, resolution rules at `:113-115`.
Lower layer wins for entities/state; closer-to-interface wins for endpoint shape;
closer-to-runtime wins for deployment. Versioning: `_FREEZE > _PATCH_V2 > _PATCH_V1 > base`.

| Layer | Authority | Status |
|---|---|---|
| L0 Domain model | `docs/PRISMA_SCHEMA_V2_FREEZE.md` | ✅ IN FORCE |
| L1 WR lifecycle | WORKREQUEST_FINAL_ARCHITECTURE | ⛔ BLOCKED — not recovered; schema freeze is fallback for WR state |
| L1 Marketplace rules | `MARKETPLACE_REFACTOR_MASTER_PLAN.md` | ✅ IN FORCE |
| L2 Interface | `docs/API_SPEC_V1_PATCH_V2.md` | ✅ IN FORCE |
| L3 Backend modules | BACKEND_EXECUTION_BLUEPRINT_V2 | ⛔ BLOCKED — not recovered |
| L3 Mobile surface | MOBILE_PRODUCT_BLUEPRINT | ⛔ BLOCKED — not recovered |
| L4 Testing | `TESTING_MASTER_PLAN_FREEZE.md` | ✅ IN FORCE |
| L4 Infra/deploy | `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` | ✅ IN FORCE |

Drive-only governing references (not yet in repo): `MASTER_ARCHITECTURE_v2.0`,
`RBAC_PERMISSION_MATRIX_v1.0`, `FINAL_DECISIONS_SUMMARY`, `EVENT_FLOW_MAPPING_v1.0`.

---

## 1. Final MVP Scope (VALIDATED)

### 1.1 Data model — 13 entities
User, Session, Hotel, HotelWorker, WorkRequest, WorkApplication, WorkerAssignment,
Attendance, QualityVerification, Rating, WorkerOverallRating, Notification, AuditLog
(`docs/PRISMA_SCHEMA_V2_FREEZE.md:17-34`).

- **Removed (4):** Room, Task, TaskPhoto, DailyOperation (`:35`).
- **Deferred to Phase 2 (9):** Contract, ContractTemplate, ContractLineItem, WorkerDocument,
  RequiredDocument, Payroll, PayrollLineItem, DataRetentionLog, ConsentLog
  (`SCHEMA_RECONCILIATION_DECISION.md`).

### 1.2 Marketplace workflow (mandatory pipeline, no bypass)
`WorkRequest → WorkApplication → WorkerAssignment → {Attendance, QualityVerification, Rating}`
(`docs/PRISMA_SCHEMA_V2_FREEZE.md:183-190`). Manual approval creates assignment (D2);
WORKER role + HotelWorker join (D3); GPS optional (D4); one QualityVerification per
assignment (D5) — `MARKETPLACE_REFACTOR_MASTER_PLAN.md:630-641`.

> **Correction carried from delta §3:** WorkRequestStatus enum conflict — schema freeze
> `DRAFT→OPEN→PARTIALLY_FILLED→FILLED→CANCELLED/EXPIRED` (L0, authoritative) vs API spec
> `OPEN|CLOSED|CANCELLED` (L2). API spec to be corrected to the L0 enum. No redesign here.

### 1.3 Backend stack & API surface
Express.js · TypeScript · Prisma · PostgreSQL (`TESTING_MASTER_PLAN_FREEZE.md:7`).
46-endpoint API surface after 7 patches, with Room CRUD, direct `work-requests/:id/assign`,
and Task/DailyOperation endpoints removed (`docs/API_SPEC_V1_PATCH_V2.md:880-977, 26-251`).
RBAC per `RBAC_PERMISSION_MATRIX_v1.0`; notification types per `MASTER_ARCHITECTURE_v2.0`
(`docs/API_SPEC_V1_PATCH_V2.md:455-639`). Detailed module/service boundaries are
**[BLOCKED — pending BACKEND_EXECUTION_BLUEPRINT_V2]**.

### 1.4 Mobile scope (two apps, JWT auth, no Supabase — D1)
- **Worker App** (build order): Login/Register → Browse open WorkRequests → Request detail +
  Apply → My applications → My assignments → Clock in/out → Profile w/ ratings & leaderboard
  (`MARKETPLACE_REFACTOR_MASTER_PLAN.md:368-382`).
- **Checker App** (build order): Login → Assignments pending verification → Submit
  QualityVerification → Submit Rating → Leaderboard (`:384-392`).
- Definitive mobile client surface is **[BLOCKED — pending MOBILE_PRODUCT_BLUEPRINT]**.

### 1.5 Infrastructure
Single DigitalOcean Droplet (8GB/4vCPU, Ubuntu 24.04, **fra1** for EU/GDPR residency) +
DO Managed PostgreSQL + DO Spaces + Cloudflare CDN + Nginx + pm2 + Docker Redis; ≈€85/month
(`INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md:32-50, 814-815`). Not microservices; the
`_legacy/backend-microservices/*` tree is archived and out of scope.

### 1.6 Testing targets
Global coverage 85% stmt / 80% branch / 85% func / 85% line; elevated 95/90 for
`staffing/service.ts`, `quality/service.ts`, jwt/error libs; 90/85 auth middleware. 11 unit +
7 integration + 4 e2e files; 7 entities, 17 routes, 32 workflows
(`TESTING_MASTER_PLAN_FREEZE.md:692-706, 944-997, 1034-1036`). Jest + Supertest (Vitest
prohibited — frozen).

---

## 2. Final Implementation Order (VALIDATED)

### 2.1 Architecture consolidation merge sequence
(`ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:52-66, 267-269`)

1. Prisma v2 → `arch/prisma-v2`
2. WorkRequest → `arch/wr-final` **[BLOCKED — WORKREQUEST_FINAL_ARCHITECTURE not recovered]**
3. Marketplace → `arch/marketplace`
4. API Spec → `arch/api-v1p2` → **cut `arch/mvp-freeze`**
5. Backend Blueprint → `arch/backend-v2` **[BLOCKED — BACKEND_EXECUTION_BLUEPRINT_V2 not recovered]**
6. Mobile Blueprint → `arch/mobile-v1` → cut `arch/impl-ready` **[BLOCKED — MOBILE_PRODUCT_BLUEPRINT not recovered]**
7. Testing Freeze → `arch/testing-freeze` → cut `arch/test-ready`
8. Infra Patch V2 → `arch/infra-v2` → cut `arch/deploy-ready`

> Steps 1, 3, 4, 7, 8 are executable now. Steps 2, 5, 6 are blocked on document recovery;
> for WR state, the schema freeze (L0) serves as interim authority.

### 2.2 Schema/build execution (marketplace refactor)
(`MARKETPLACE_REFACTOR_MASTER_PLAN.md:580-641`)
- Phase 0 Baseline (Day 0) → Phase 1 Schema (Day 1) → Phase 2 Backend removals (Day 1–2) →
  Phase 3 Backend additions (Day 2–5) → Phase 4 Mobile (Day 5–10) → Phase 5 QA (Day 10–12).
- Schema migration ordering: remove legacy FKs → drop legacy tables
  (daily_operations→task_photos→tasks→rooms) → add columns → create new tables
  (work_applications, hotel_workers, attendances) → apply assignment_id FKs → clean User model
  (`:37-266`).

### 2.3 Infrastructure rollout
(`INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md:1149-1318`)
Phase 0 Legal/GDPR (BLOCKER) → Phase 1 Infra (W1) → Phase 2 App setup (W2) → Phase 3
Observability & CI/CD (W3) → Phase 4 DR hardening (W4). Branch policy: `feature/*`,`fix/*`→CI;
`develop`→staging auto-deploy; `main`→manual-approval prod (`:240-262`).

### 2.4 Test execution gate
typecheck + ESLint (parallel) → unit (~30s, no DB) → integration (~90s, test DB) → e2e
(~2min) → coverage gate (`TESTING_MASTER_PLAN_FREEZE.md:734-750`).

---

## 3. PR #2 Disposition (VALIDATED)

**CLOSE PR #2; reimplement as three separate scoped PRs** (`PR2_FINAL_MERGE_DECISION.md:31-35`):
1. Auth code improvements (salvage per `PR2_SALVAGE_PLAN.md`).
2. Pre-V2 CRM schema — **discard/rewrite** against V2 (not mergeable, `:105-107`).
3. Test-runner governance — Vitest→Jest reverted to honor `TESTING_MASTER_PLAN_FREEZE`
   (`PR2_ARCHITECTURE_COMPLIANCE_AUDIT.md:399`).

Merging whole "would produce a non-compiling codebase" (`:88-100`). Schema is `main`'s V2 +
transitional `User.hotel_ids` (`SCHEMA_RECONCILIATION_DECISION.md:211-221`).

---

## 4. Sprint 1 Remediation Priorities (VALIDATED)

(`SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md:177-235`; Sprint 1 = 57% of marketplace
architecture, `:359`)

0. **BLOCKED GATE** — obtain missing reference documents (partially unmet — see delta §6).
1. **Schema migration** — add HotelMembership; backfill from `User.hotel_ids`; add
   `Hotel.deleted_at`; drop `User.hotel_ids`; drop `User.permissions`; add WorkerAssignment
   partial unique index; revisit DataRetentionLog FK onDelete.
2. **JWT redesign** — final payload shape; rewrite `src/lib/jwt.ts`; update `AuthContext`.
   (Fix `signRefreshToken` to use `JWT_REFRESH_SECRET ?? JWT_SECRET`.)
3. **Session strategy decision.**
4. **RBAC redesign** (read permissions from DB, not stale JWT — `SPRINT_1_COMPLIANCE_REPORT.md:44-49`).
5. **Auth module rewrite** (remove `prisma.task`/`prisma.contract` references; remove
   `hotel_ids` from JWT per API PATCH-04; fix role casing).
6. **HotelWorker module rewrite.**
7. **User module rewrite.**
8. **Hotel (CRM) module patches.**
9. **Test suite updates.**

---

## 5. Blocking Items Before Full Execution

1. Recover or formally DEFER: WORKREQUEST_FINAL_ARCHITECTURE (+PATCH_V1),
   BACKEND_EXECUTION_BLUEPRINT_V2 (+PATCH_V1), MOBILE_PRODUCT_BLUEPRINT (+PATCH_V1).
   → unblocks merge steps 2, 5, 6 and Sprint 1 backend/mobile work.
2. Resolve WorkRequestStatus enum conflict in favor of the L0 schema freeze.
3. Commit the four Drive-only reference docs into the repo (or cite by stable ID).
4. Re-issue CANONICAL_ARCHITECTURE_INDEX and GOVERNANCE_RECONSTRUCTION_REPORT (currently absent).

**Ready to execute now (no blockers):** Prisma v2 migration, Marketplace refactor schema
work, API Spec alignment (with enum correction), Testing freeze gates, Infrastructure rollout,
PR #2 closure + three replacement PRs, Sprint 1 Steps 1–4 and 9.
