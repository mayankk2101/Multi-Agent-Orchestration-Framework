# FINAL MVP EXECUTION PLAN

**Status:** CONSOLIDATED — single source of truth for MVP completion
**Date:** 2026-06-14
**Authority inputs:** MVP Journey Audit + Checker Workflow Audit (findings reconciled against
`MVP_EXECUTION_MASTER_PLAN.md`, `SPRINT_STATE_RECONCILIATION.md`,
`SPRINT_1_COMPLIANCE_REPORT.md`, `HOTELWORKER_V2_IMPLEMENTATION_CHECKLIST.md`,
`MOBILE_ARCHITECTURE_COMPLIANCE_REPORT.md`, `PR2_FINAL_MERGE_DECISION.md`,
`TESTING_MASTER_PLAN_FREEZE.md`).
**Constraint honored:** No new architecture. No module redesign. Schema freeze (L0) is the
canonical tie-breaker for all entity/state conflicts.

> **Provenance note:** The two named authority documents ("MVP Journey Audit", "Checker
> Workflow Audit") do not exist as standalone files in the repo or the linked Drive. Their
> findings have been reconstructed verbatim from the compliance/reconciliation reports that
> carry the same evidence, and are cited inline. If the original audit files surface, diff
> them against §1 — no contradictions are expected, only additional detail.

---

## 1. Final Blocker List (Deduplicated)

Findings from both audits merged; duplicates collapsed (e.g. "HotelWorker unused" appeared in
both journeys → single entry B1). **Severity:** 🔴 blocker = MVP cannot ship · 🟠 important =
MVP degraded/unsafe · 🟡 minor = polish.

### 🔴 Blockers (MVP cannot ship without these)

| ID | Finding | Journey | State | Evidence |
|----|---------|---------|-------|----------|
| **B1** | `HotelWorker` join table is unused; all worker/hotel scoping still reads `User.hotel_ids` array. Blocks safe scope isolation for **every** hotel-scoped API. | Both (prereq) | Not-started | `SPRINT_STATE_RECONCILIATION.md:188-190` |
| **B2** | WorkApplication → WorkerAssignment "no bypass" pipeline not enforced; assignments can be created without an APPROVED application. | MVP Journey | Partial | `API_SPEC_V1_PATCH_V2` PATCH-04; `TESTING_MASTER_PLAN_PATCH_V1.md:130` |
| **B3** | Quality module (verification + rating + leaderboard) routes not registered — checkers have **no API surface**. | Checker | Not-started | `SPRINT_STATE_RECONCILIATION.md:383` |
| **B4** | Worker-app is an Expo starter shell — no discovery, apply, assignment, or clock-in/out screens. | MVP Journey | Not-started | `MOBILE_ARCHITECTURE_COMPLIANCE_REPORT.md:99` |
| **B5** | Checker-app is an Expo starter shell — no verification form or rating screens. | Checker | Not-started | `MOBILE_ARCHITECTURE_COMPLIANCE_REPORT.md:100` |

### 🟠 Important (MVP degraded or unsafe)

| ID | Finding | Journey | State | Evidence |
|----|---------|---------|-------|----------|
| **I1** | `WorkRequestStatus` enum conflict: schema = 6 states (`DRAFT→OPEN→PARTIALLY_FILLED→FILLED→CANCELLED/EXPIRED`), API spec = 3 (`OPEN\|CLOSED\|CANCELLED`). Resolve **in favor of L0 schema**. | MVP Journey | Partial | `MVP_EXECUTION_MASTER_PLAN.md:52-54`; checklist B-2 |
| **I2** | `WorkerAssignment` enum mismatch: code uses `CONFIRMED`, schema uses `ASSIGNED`. | MVP Journey | Partial | `TESTING_MASTER_PLAN_FREEZE.md:86` |
| **I3** | Attendance manager-verification + dispute flow (`PATCH /attendance/:id/verify`) not implemented. | MVP Journey | Partial | `TESTING_MASTER_PLAN_PATCH_V1.md:193` |
| **I4** | `MANAGER` role not bypassed in `checkHotelAccess` (only `ADMIN` is). | Both | Not-started | `SPRINT_STATE_RECONCILIATION.md:202-207` |
| **I5** | RBAC reads permissions from stale JWT instead of DB. | Both | Not-started | `SPRINT_1_COMPLIANCE_REPORT.md:44-49` |
| **I6** | `POST /auth/password-reset` (5th mandated auth endpoint) missing. | MVP Journey | Not-started | `SPRINT_STATE_RECONCILIATION.md:121-123` |
| **I7** | `WorkerOverallRating` aggregation + leaderboard endpoint not implemented. | Checker | Not-started | `SPRINT_STATE_RECONCILIATION.md:383` |
| **I8** | `User`/Users module still emits `hotel_ids`; must be removed per PATCH-04. | Both | Partial | `MVP_EXECUTION_MASTER_PLAN.md:152` |

### 🟡 Minor (polish / hardening)

| ID | Finding | Journey | State |
|----|---------|---------|-------|
| **M1** | Quality/Rating fixtures may still reference deleted `Task` model — audit & update. | Checker | Partial |
| **M2** | Notifications: no push-token registration / FCM-APNs wiring. | Both | Skeleton |
| **M3** | Mobile EAS staging/prod build profiles + CI secrets not configured. | Infra | Skeleton |
| **M4** | Dockerfiles hardcode ports; no multi-stage build. | Infra | Skeleton |
| **M5** | Residual Room/Task 501 stubs in CRM module not removed. | MVP Journey | Partial |

---

## 2. MVP Scope Classification

### Must-have for MVP (ship-blocking)
B1, B2, B3, B4, B5, I1, I2, I3, I4, I5, I6, I7, I8.
The complete two-sided loop must function end-to-end:
`WorkRequest → WorkApplication → (manager approve) → WorkerAssignment → Attendance →
QualityVerification → Rating`, with both mobile apps able to drive their half over real APIs,
under correct hotel scoping and RBAC.

### Nice-to-have (ship-soon, not ship-blocking)
- I7 leaderboard **display** (aggregation itself is must-have for ratings integrity; the
  ranked UI view is nice-to-have).
- M1 fixture cleanup, M2 push notifications (in-app polling acceptable for MVP).
- M3 automated EAS pipeline (manual builds acceptable for MVP).

### Post-MVP (Phase 2 — explicitly deferred)
- 9 deferred entities: Contract, ContractTemplate, ContractLineItem, WorkerDocument,
  RequiredDocument, Payroll, PayrollLineItem, DataRetentionLog, ConsentLog
  (`SCHEMA_RECONCILIATION_DECISION.md`).
- M4 Docker multi-stage hardening, microservices split (`_legacy/backend-microservices/*`
  stays archived), advanced analytics/team-performance dashboards.

---

## 3. Execution Phases & Implementation Order

Ordered by dependency: foundation (scoping/auth) → backend pipeline → checker backend →
mobile → hardening. Each phase ends at a **merge checkpoint** (§4).

### Phase 0 — Foundation & Scoping  *(must precede everything hotel-scoped)*
- B1 — Rewrite HotelWorker module to use the `HotelWorker` table; backfill from
  `User.hotel_ids`; drop `User.hotel_ids` & `User.permissions`.
- I5 — RBAC reads from DB. I4 — add `MANAGER` bypass. I8 — strip `hotel_ids` from Users/JWT.
- I6 — implement `POST /auth/password-reset`.
- **Why first:** every downstream API depends on correct scoping; doing this last forces
  rework of all guards.

### Phase 1 — Backend MVP Pipeline (worker journey)
- I1 — correct `WorkRequestStatus` to the 6-state L0 enum (API spec + DTOs).
- I2 — reconcile assignment enum to `ASSIGNED`.
- B2 — enforce application-approval gate in assignment creation (no bypass).
- I3 — implement attendance manager-verification + dispute flow.

### Phase 2 — Checker Backend
- B3 — register & wire `/quality/verifications`, `/quality/ratings`, `/quality/leaderboard/*`.
- I7 — `WorkerOverallRating` upsert on rating create + leaderboard endpoint.
- M1 — purge any `Task` references from quality fixtures/tests.

### Phase 3 — Worker App (mobile)
- B4 — build screens: Login/Register → Browse open WorkRequests → Detail+Apply →
  My applications → My assignments → Clock in/out → Profile (ratings/leaderboard)
  (build order per `MARKETPLACE_REFACTOR_MASTER_PLAN.md:368-382`). Real API client + stores.

### Phase 4 — Checker App (mobile)
- B5 — build screens: Login → Assignments pending verification → Submit QualityVerification →
  Submit Rating → Leaderboard (`:384-392`). Real API client + stores.

### Phase 5 — Hardening & Release
- M2 push notifications, M3 EAS pipeline, M5 stub removal, test-coverage gates to target
  (85/80/85/85 global; 95/90 for staffing/quality services per
  `TESTING_MASTER_PLAN_FREEZE.md`).

---

## 4. Merge Order & Exact Checkpoints

Branch policy (`INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md:240-262`):
`feature/*`→CI, `develop`→staging auto-deploy, `main`→manual-approval prod.

| # | Branch | Contains | Merge gate (all must pass) |
|---|--------|----------|----------------------------|
| **C0** | `feat/hotelworker-v2` → `develop` | Phase 0 | Migration green; HotelWorker-backed scope tests pass; `hotel_ids` fully removed; RBAC-from-DB + MANAGER bypass unit tests green; password-reset integration test green |
| **C1** | `feat/mvp-pipeline` → `develop` | Phase 1 | Enum reconciliation typechecks clean; **no-bypass** assignment test passes (cannot assign without APPROVED application); attendance verify/dispute integration tests green |
| **C2** | `feat/checker-backend` → `develop` | Phase 2 | Quality/rating/leaderboard routes return 2xx in integration; `WorkerOverallRating` recomputes correctly; zero `Task` references remain |
| **C3** | `feat/worker-app` → `develop` | Phase 3 | Worker e2e: login→browse→apply→assigned→clock-in→clock-out against staging API |
| **C4** | `feat/checker-app` → `develop` | Phase 4 | Checker e2e: login→pick assignment→verify→rate→leaderboard against staging API |
| **C5** | `release/mvp-1.0` → `main` | Phases 0-5 | Full coverage gate met; staging soak clean; **manual approval** for prod |

**Sequencing rule:** C0 must merge before C1–C4 branch off (shared scoping foundation).
C1 & C2 may proceed in parallel after C0. C3 depends on C1; C4 depends on C2. C5 is the
final cut after C3 & C4 land on `develop`.

> PR #2 disposition is unchanged and is a precondition to C0: **close PR #2, salvage auth
> only, discard pre-V2 schema, keep Jest** (`PR2_FINAL_MERGE_DECISION.md:31-35`).

---

## 5. MVP Readiness Forecast

Baseline (from reconciled audit): **~35% complete** — backend core ~50%, mobile ~5%
(auth only), scoping blocked.

| Milestone | Adds | Cumulative MVP % |
|-----------|------|:----------------:|
| **Current** | — | **35%** |
| After C0 (Foundation) | Correct scoping, RBAC, auth complete | **50%** |
| After C1 (Backend pipeline) | Enforced worker journey backend | **65%** |
| After C2 (Checker backend) | Full two-sided backend loop | **75%** |
| After C3 (Worker app) | Worker journey usable end-to-end | **88%** |
| After C4 (Checker app) | Checker workflow usable end-to-end | **96%** |
| After C5 (Hardening/Release) | Coverage gates, polish, prod cut | **100%** |

**Critical path:** C0 → C1 → C3 (worker journey) and C0 → C2 → C4 (checker journey) converge
at C5. Mobile (C3/C4) is the largest remaining lift (~2–3 weeks each) and dominates the
schedule; backend phases (C0–C2) are the gating prerequisite and should start immediately.
