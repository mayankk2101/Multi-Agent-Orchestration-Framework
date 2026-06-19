# AUTHORITY_RECONCILIATION_V2_REPORT

> **⚠️ SUPERSEDED — HISTORICAL RECORD (2026-06-19).** This document predates the platform migration to **AWS** and references DigitalOcean / Cloudflare infrastructure as it stood at the time. It is preserved unaltered as an audit/decision record. For the current deployment platform see `AWS_DEPLOYMENT_GUIDE.md`, `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN.md`, and `AWS_DOCUMENTATION_AUDIT.md`. Do not use the DigitalOcean topology described below for new deployments.

**Generated:** 2026-06-10
**Type:** Reconciliation only — no new architecture, no module redesign, no implementation plan
**Trigger:** The six authority documents previously declared "NOT RECOVERED" have now been physically located and read.

---

## 0. Scope and Method

This report reconciles the existing **governance documents** against the **actual recovered authority documents**. It does not design anything. It does three things only: (1) confirms which prior findings still hold, (2) marks which prior findings are now void, and (3) restates the resulting authority hierarchy, canonical MVP architecture, implementation order, and the dispositions for Sprint 1 and PR #2.

### 0.1 Recovery status — the central fact

The prior governance work (`GOVERNANCE_RECOVERY_DELTA_REPORT.md`, `MVP_EXECUTION_MASTER_PLAN.md`, `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md`, `PR2_FINAL_MERGE_DECISION.md`) was built on the premise that the WorkRequest, Backend, and Mobile authority documents were **absent / BLOCKED / NOT RECOVERED**. That premise is now **false**. All six are recovered on feature branches (per `AUTHORITY_DOCUMENT_EXISTENCE_REPORT.md`):

| Document | Branch | Verified |
|----------|--------|----------|
| WORKREQUEST_FINAL_ARCHITECTURE.md | `origin/claude/amazing-hypatia-DQ2lE` | ✅ read |
| WORKREQUEST_FINAL_ARCHITECTURE_PATCH_V1.md | `origin/claude/amazing-hypatia-DQ2lE` | ✅ read |
| BACKEND_EXECUTION_BLUEPRINT_V2.md | `origin/claude/optimistic-turing-wu7y5r` | ✅ read |
| BACKEND_EXECUTION_BLUEPRINT_V2_PATCH_V1.md | `origin/claude/optimistic-turing-wu7y5r` | ✅ read |
| MOBILE_PRODUCT_BLUEPRINT.md | `origin/claude/affectionate-tesla-mxsylr` | ✅ read |
| MOBILE_PRODUCT_BLUEPRINT_PATCH_V1.md | `origin/claude/affectionate-tesla-mxsylr` | ✅ read |

### 0.2 Note on named governance documents

Four governance documents named in the task do **not** exist under those names anywhere (working tree, all branches, or Google Drive). They map to actual artifacts by role:

| Task-referenced name | Actual artifact | Status |
|----------------------|-----------------|--------|
| CANONICAL_ARCHITECTURE_INDEX.md | — | Does not exist (designated for recreation) |
| GOVERNANCE_RECONSTRUCTION_REPORT.md | — | Does not exist (designated for recreation) |
| ARCHITECTURE_RECONCILIATION_REPORT.md | `GOVERNANCE_RECOVERY_DELTA_REPORT.md` | Reconciliation role |
| SPRINT_1_FINAL_REMEDIATION_PLAN.md | `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md` | Remediation role |
| AUTHORITY_EVIDENCE_ADJUDICATION.md | `SCHEMA_RECONCILIATION_DECISION.md` | Adjudication role |

This report validates against those actual artifacts plus the existing frozen authority set (`PRISMA_SCHEMA_V2_FREEZE`, `API_SPEC_V1_PATCH_V2`, `MARKETPLACE_REFACTOR_MASTER_PLAN`, `TESTING_MASTER_PLAN_FREEZE`, `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2`).

---

## 1. Task 1 — Validation of governance docs against recovered authority

Recovery has two opposite effects, and both must be recorded honestly:

1. **It unblocks** every governance item that was deferred solely because these documents were missing.
2. **It exposes conflicts** that the missing documents had been masking. The recovered WorkRequest/Backend/Mobile documents do **not** agree, on several enum sets and on the mobile app count, with the already-frozen `PRISMA_SCHEMA_V2_FREEZE` / `API_SPEC_V1_PATCH_V2` / `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2`.

Net: the bulk of the *structural* governance findings are **confirmed** by the recovered documents; the *premise-level* findings ("docs absent, work blocked") are **void**; and a small set of **new conflicts** is now surfaced for adjudication (no redesign performed here).

---

## 2. Task 2 — Findings that REMAIN VALID

| # | Finding | Source governance doc | Confirmed by recovered authority |
|---|---------|-----------------------|----------------------------------|
| V1 | **13-model MVP entity inventory** (User, Session, Hotel, HotelWorker, WorkRequest, WorkApplication, WorkerAssignment, Attendance, QualityVerification, Rating, WorkerOverallRating, Notification, AuditLog) | GOVERNANCE_RECOVERY_DELTA §2; MVP_EXECUTION §1 | `WORKREQUEST_FINAL_ARCHITECTURE` §1 lists the identical aggregate + supporting set |
| V2 | **Removal of Room, Task, TaskPhoto, DailyOperation** | SCHEMA_RECONCILIATION_DECISION; MARKETPLACE_REFACTOR | `WORKREQUEST_FINAL_ARCHITECTURE` §13 "Removed Tables"; `MOBILE_PRODUCT_BLUEPRINT_PATCH_V1` removes all 26 legacy references |
| V3 | **9 compliance/HR models deferred to Phase 2** | GOVERNANCE_RECOVERY_DELTA §2; SCHEMA_RECONCILIATION_DECISION | `WORKREQUEST_FINAL_ARCHITECTURE` keeps them as "Supporting Entities (Frozen)" in `hr`/`compliance`, consistent with deferral |
| V4 | **Mandatory marketplace pipeline, no bypass:** WorkRequest → WorkApplication → WorkerAssignment → {Attendance, QualityVerification, Rating} | MARKETPLACE_REFACTOR; MVP_EXECUTION §1 | `WORKREQUEST_FINAL_ARCHITECTURE` §§2–7 + §15 end-to-end workflow; assignment created only on application acceptance |
| V5 | **HotelWorker membership is the scoping mechanism; `User.hotel_ids` is not the WORKER/CHECKER authorization source** | API_SPEC_V1_PATCH_V2 PATCH-04; SPRINT_1_SALVAGE | `WORKREQUEST_FINAL_ARCHITECTURE_PATCH_V1` B1: "`User.hotel_ids` is retained exclusively for MANAGER scoping and must not be used for WORKER or CHECKER access decisions" |
| V6 | **Quality anchored to `worker_assignment_id`, never `task_id`** | API_SPEC_V1_PATCH_V2 PATCH-02; MARKETPLACE_REFACTOR | `WORKREQUEST_FINAL_ARCHITECTURE` §13 QV/Rating keyed on `worker_assignment_id`; `MOBILE_PRODUCT_BLUEPRINT_PATCH_V1` repoints payloads to `worker_assignment_id` |
| V7 | **Module boundaries** auth / crm / staffing / quality / notifications / hr / compliance, in-process service calls (no inter-module HTTP) | ARCHITECTURE_CONSOLIDATION; MARKETPLACE_REFACTOR | `WORKREQUEST_FINAL_ARCHITECTURE` §14; `BACKEND_EXECUTION_BLUEPRINT_V2` §2 module build order |
| V8 | **BACKEND_EXECUTION_BLUEPRINT_V2 requires its own patches** (HotelWorkerStatus enum, removal of `hotel_ids` from JWT/RBAC) | Implied by SPRINT_1/SCHEMA findings | `BACKEND_EXECUTION_BLUEPRINT_V2_PATCH_V1` BLOCK-01 / BLOCK-02 confirm these are still required |
| V9 | **PR #2 disposition: CLOSE and reimplement as scoped PRs** | PR2_FINAL_MERGE_DECISION; MVP_EXECUTION §3 | Unchanged — see Task 8 |
| V10 | **Infrastructure topology:** DO Droplet + Nginx + Docker Redis + Cloudflare + DO Managed Postgres/Spaces (fra1), two-secret JWT, ≈€85/mo | INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2 | Not contradicted by any recovered document |

---

## 3. Task 3 — Findings that BECOME INVALID

| # | Prior finding (now void) | Where asserted | Why it is invalid now |
|---|--------------------------|----------------|-----------------------|
| X1 | **"The six authority documents are NOT RECOVERED; the premise of recovery cannot be substantiated."** | GOVERNANCE_RECOVERY_DELTA §0.2, §5 | They are recovered (§0.1 above). The premise is now substantiated; the "INVALIDATED premise" classification is itself void. |
| X2 | **Authority hierarchy: "3 of 8 layers blocked" (L1 WorkRequest, L3 Backend, L3 Mobile)** | GOVERNANCE_RECOVERY_DELTA §1; MVP_EXECUTION §0 | All eight layers are now materially populated. No layer is blocked on absence. |
| X3 | **Implementation Steps 2, 5, 6 "BLOCKED — pending document recovery"** | MVP_EXECUTION §2 | Unblocked — the governing documents exist. |
| X4 | **Mobile client surface "[BLOCKED — pending MOBILE_PRODUCT_BLUEPRINT]"** | MVP_EXECUTION §1 | Defined: `MOBILE_PRODUCT_BLUEPRINT` (+PATCH_V1) specifies the full screen/route/event surface. |
| X5 | **Sprint 1 "Step 0 BLOCKED GATE — obtain missing reference documents"** | SPRINT_1_SALVAGE PART 3 | The gate's blocking inputs now exist (note: several were already in-repo; the WorkRequest/Backend/Mobile inputs are the ones newly resolved). |
| X6 | **`[SOURCE UNAVAILABLE]` flags in BACKEND_EXECUTION_BLUEPRINT_V2_PATCH_V1** (DRAFT requirement MAJOR-02; HotelManager MAJOR-04) | BACKEND_EXECUTION_BLUEPRINT_V2_PATCH_V1 | The "source unavailable" basis is void: `WORKREQUEST_FINAL_ARCHITECTURE` answers these (DRAFT **is** a required WorkRequest state §2; no separate `HotelManager` model — manager scoping rides on `User.hotel_ids` per PATCH_V1 B1). |
| X7 | **"WorkRequestStatus enum conflict resolves trivially in favor of L0 schema" treated as the only enum conflict** | GOVERNANCE_RECOVERY_DELTA §3; SCHEMA_RECONCILIATION | Incomplete, now superseded: recovery reveals the conflict is **multi-enum** (WorkRequest, WorkerAssignment, Attendance, QualityVerification). See Task 5 / §6. |

> **Important:** No *structural* finding (entities, pipeline, module map, removals, PR #2 disposition) becomes invalid. What becomes invalid is the **premise of absence** and everything derived purely from it.

---

## 4. Task 4 — Final Authority Hierarchy

The 8-layer hierarchy from `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md` stands, now fully populated. Precedence rules carry over unchanged: **`_FREEZE > _PATCH_Vn > base`**, **`Vn > Vn-1`**, and **lower layer (closer to Prisma) wins for entities/state; closer-to-interface wins for endpoint shape; closer-to-runtime wins for deployment topology.**

| Layer | Document(s) | Authoritative for |
|-------|-------------|-------------------|
| **L0** | `docs/PRISMA_SCHEMA_V2_FREEZE.md` *(FREEZE)* | **Entity set and enum/state definitions** — governs where any higher layer disagrees on the data contract |
| **L1** | `WORKREQUEST_FINAL_ARCHITECTURE.md` + `…_PATCH_V1.md`; `MARKETPLACE_REFACTOR_MASTER_PLAN.md` *(FROZEN)* | **Domain lifecycle, state-transition semantics, entity chain, RBAC matrix, concurrency rules** |
| **L2** | `docs/API_SPEC_V1_PATCH_V2.md` | **Endpoint shape, DTOs, route prefixes** |
| **L3** | `BACKEND_EXECUTION_BLUEPRINT_V2.md` + `…_PATCH_V1.md`; `MOBILE_PRODUCT_BLUEPRINT.md` + `…_PATCH_V1.md` | **Backend execution sequencing / module layout; mobile client surface** |
| **L4** | `TESTING_MASTER_PLAN_FREEZE.md`; `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` | **Test strategy; deployment topology** |

Patch precedence within the recovered families (self-declared and consistent with the rules above):
- `WORKREQUEST_FINAL_ARCHITECTURE_PATCH_V1` **takes precedence over** its base (states "where this document and the base conflict, this document takes precedence").
- `BACKEND_EXECUTION_BLUEPRINT_V2_PATCH_V1` is a **compliance patch** over its base; the base is `APPROVED_WITH_PATCHES` (apply BLOCK-01/BLOCK-02 before use).
- `MOBILE_PRODUCT_BLUEPRINT_PATCH_V1` (`APPROVED_WITH_PATCHES`) **supersedes** its base in 34 places.

**Secondary references** still only on Google Drive and not in-repo (carried forward as an open item, unchanged): `MASTER_ARCHITECTURE_v2.0`, `RBAC_PERMISSION_MATRIX_v1.0`, `FINAL_DECISIONS_SUMMARY`, `EVENT_FLOW_MAPPING_v1.0`.

---

## 5. Task 5 — Final Canonical MVP Architecture

Unchanged in substance from the validated governance picture; now fully sourced. Stated for record:

- **Entities (13):** User, Session, Hotel, HotelWorker, WorkRequest, WorkApplication, WorkerAssignment, Attendance, QualityVerification, Rating, WorkerOverallRating, Notification, AuditLog.
- **Removed (4):** Room, Task, TaskPhoto, DailyOperation.
- **Deferred to Phase 2 (9):** Contract, ContractTemplate, ContractLineItem, WorkerDocument, RequiredDocument, Payroll, PayrollLineItem, DataRetentionLog, ConsentLog.
- **Pipeline:** WorkRequest → WorkApplication → WorkerAssignment → {Attendance, QualityVerification → Rating → WorkerOverallRating}. No bypass.
- **Scoping:** HotelWorker membership for WORKER/CHECKER; `User.hotel_ids` for MANAGER only (L1 PATCH_V1 B1). MVP may retain a transitional denormalized `User.hotel_ids` for manager `checkHotelAccess()` per `SCHEMA_RECONCILIATION_DECISION` — this is a **sequencing nuance, not an entity conflict**, and is consistent with B1's "manager-only" rule.
- **Modules:** auth, crm, staffing, quality, notifications, hr, compliance — in-process service calls; `quality` is parameter-driven so it never imports `staffing` (L1 PATCH_V1 B10).
- **Backend stack:** Express.js · TypeScript · Prisma · PostgreSQL · Redis.
- **Infra:** DO Droplet + Nginx + Docker Redis + Cloudflare + DO Managed Postgres/Spaces (fra1); two-secret JWT.

### 5.1 Conflicts surfaced by recovery — FLAGGED, NOT RESOLVED

These are genuine disagreements among authority documents that recovery exposed. Per instruction, they are **reconciled by pointing to the governing layer only** — no enum is redesigned here, and each requires a patch on the losing document(s) (Rule 4: no silent rewrites).

| Conflict | L0 `PRISMA_SCHEMA_V2_FREEZE` | L1 `WORKREQUEST_FINAL_ARCHITECTURE` | L3 `BACKEND_EXECUTION_BLUEPRINT_V2` | Governing layer & resolution |
|----------|------------------------------|-------------------------------------|-------------------------------------|------------------------------|
| **WorkRequestStatus** | `DRAFT, OPEN, PARTIALLY_FILLED, FILLED, CANCELLED, EXPIRED` | `DRAFT, OPEN, PARTIALLY_FILLED, FILLED, IN_PROGRESS, COMPLETED, CANCELLED` | `OPEN, FILLED, CANCELLED, COMPLETED` | **L0 governs the enum set.** L1 supplies transition semantics; L1's `IN_PROGRESS`/`COMPLETED` and L0's `EXPIRED` must be reconciled by a patch on the non-governing docs. L2 (`OPEN/CLOSED/CANCELLED`) and L3 must be patched to the L0 set. |
| **AssignmentStatus** | `CONFIRMED, IN_PROGRESS, COMPLETED, NO_SHOW, CANCELLED, REASSIGNED` | `ASSIGNED, CHECKED_IN, CHECKED_OUT, ATTENDANCE_VERIFIED, CANCELLED` | `ASSIGNED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW` | **L0 governs.** L1/L3 enum names must be patched to the L0 set; L1's check-in/out semantics map onto L0 `IN_PROGRESS`/`COMPLETED`. |
| **AttendanceStatus** | `EXPECTED, PRESENT, LATE, PARTIAL, ABSENT, EXCUSED` | `NOT_STARTED, CHECKED_IN, CHECKED_OUT, VERIFIED, DISPUTED (+CANCELLED)` | `EXPECTED, CLOCKED_IN, CLOCKED_OUT, ABSENT, EXCUSED` | **L0 governs.** Note `TESTING_MASTER_PLAN_FREEZE` uses a fourth set (`PENDING/CLOCKED_IN/CLOCKED_OUT/VERIFIED/DISPUTED`). All non-L0 docs require a patch to the L0 set. |
| **QualityVerificationStatus** | `PASSED, FAILED, NEEDS_REWORK` | `PENDING, IN_PROGRESS, PASSED, FAILED, WAIVED` | `VERIFIED, NEEDS_REWORK, DISPUTED` | **L0 governs the persisted enum.** L1's `PENDING/IN_PROGRESS/WAIVED` lifecycle stages must be reconciled by patch. |
| **Mobile app count** | — | — (mobile not in scope of L1) | `MOBILE_PRODUCT_BLUEPRINT` (+PATCH_V1): **two separate apps** (Worker 15 screens, Checker 11). Repo has `mobile/worker-app` + `mobile/checker-app`. | **Direct L3↔L4 conflict.** `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2` PATCH-09 mandates a **single role-based app** (`com.zirove.hotelcrm`), citing Master Architecture v2.0 §9; `DOCUMENTATION_AUDIT_REPORT` Issue #7 already noted this ambiguity. App count is client-surface (L3) **and** deployment-packaging (L4) — the layer rule does not cleanly arbitrate. **Requires an explicit product/deployment decision; not resolvable by reconciliation.** |

> These flags **replace** the earlier governance claim (X7) that the only enum conflict was `WorkRequestStatus` resolvable trivially in favor of L0. The resolution mechanism (L0 schema is authoritative for enum sets; losers get a patch, never an inline rewrite) is unchanged — only the **count** of conflicts grows.

---

## 6. Task 6 — Final Implementation Order

The ordering itself does not change; what changes is that the previously **blocked** steps are now **executable**, with concrete governing sources.

| Step | Item | Prior status | Now |
|------|------|--------------|-----|
| 1 | Schema migration to V2 (+ transitional `User.hotel_ids`) | Executable | Executable — governed by L0 + `WORKREQUEST_FINAL_ARCHITECTURE_PATCH_V1` 13-step migration sequence |
| 2 | WorkRequest lifecycle / state machine | **BLOCKED** | **Executable** — governed by `WORKREQUEST_FINAL_ARCHITECTURE` §§2–11 (subject to §5.1 enum reconciliation) |
| 3 | API surface (auth, hotels, marketplace) | Executable | Executable — L2 `API_SPEC_V1_PATCH_V2` |
| 4 | RBAC / HotelWorker scoping | Executable | Executable — L1 PATCH_V1 B1 + API PATCH-04 |
| 5 | Backend module build order | **BLOCKED** | **Executable** — `BACKEND_EXECUTION_BLUEPRINT_V2` §2 + Sprint 1–7, **after** applying BLOCK-01/BLOCK-02 patches |
| 6 | Mobile client surface | **BLOCKED** | **Executable** — `MOBILE_PRODUCT_BLUEPRINT` (+PATCH_V1), **pending the app-count decision (§5.1)** |
| 7 | Testing | Executable | Executable — L4 `TESTING_MASTER_PLAN_FREEZE` (Attendance enum to be reconciled per §5.1) |
| 8 | Infrastructure / deploy | Executable | Executable — L4 `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2` |

**Pre-conditions that must precede coding (carried forward, not new plans):** apply the §5.1 enum patches against the non-governing documents, apply Backend BLOCK-01/BLOCK-02, and obtain the mobile app-count decision.

---

## 7. Task 7 — Does the Sprint 1 remediation plan change?

**No change in substance; its blocking gate is lifted.**

- `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN` Step 0 (the BLOCKED GATE) is **released** — the WorkRequest/Backend/Mobile inputs now exist. (Several of its other listed inputs — `PRISMA_SCHEMA_V2_FREEZE`, `API_SPEC_V1_PATCH_V2`, `MARKETPLACE_REFACTOR`, `SCHEMA_RECONCILIATION_DECISION` — were already in-repo; that part of the gate reflected a stale view.)
- The plan's architectural **direction is confirmed**, not redirected: move WORKER/CHECKER scoping from a `hotel_ids` array to HotelWorker membership (Steps 2, 4, 6, 7) is exactly what L1 PATCH_V1 B1 requires.
- The transitional retention of `User.hotel_ids` for **manager** scoping (per `SCHEMA_RECONCILIATION_DECISION`) remains compatible with B1's "manager-only" rule — so no step reverses.
- The 57% completion measurement against marketplace architecture stands; recovery does not lower it (the recovered docs confirm rather than contradict the target).

**Conclusion:** Sprint 1 plan content is **unchanged and now unblocked**. Effort estimates firm from ranges to commitments once the §5.1 enum reconciliation is applied.

---

## 8. Task 8 — Does the PR #2 disposition change?

**No.** PR #2 remains **CLOSE without merge; reimplement as scoped PRs** (`PR2_FINAL_MERGE_DECISION`). Recovery reinforces, and does not disturb, every load-bearing reason:

- The canonical schema is the V2 marketplace schema (L0, now corroborated by L1 `WORKREQUEST_FINAL_ARCHITECTURE` §13). PR #2's task-based CRM/HR schema is incompatible by entity name, relation, and cardinality — unchanged.
- PR #2's `exportUserData()` references removed models (`prisma.task`, etc.) → still a compile-time failure against V2.
- `package.json` (vitest/argon2) still collides with `TESTING_MASTER_PLAN_FREEZE` (FROZEN) → still a governance decision, not a merge.

**What recovery firms up (details, not disposition):**
- **D-4 (`hotel_ids` on User):** L1 PATCH_V1 B1 confirms `hotel_ids` is **manager-only**; the salvaged auth PR keeps it for managers and must not use it for WORKER/CHECKER authorization.
- **D-3 (signup semantics):** L1 RBAC matrix defines roles but does not itself open or restrict self-signup; the `requireRole('admin')` on `POST /signup` remains an explicit product decision to confirm before the salvage PR lands — unchanged from the merge-conflict report.

**Conclusion:** disposition **unchanged**; the Stream A auth-salvage scope is unchanged; only decision-detail ambiguity is reduced.

---

## 9. Summary

1. **Premise flip:** the six authority documents are recovered. Every "BLOCKED / NOT RECOVERED / [SOURCE UNAVAILABLE]" finding derived purely from their absence is **void** (X1–X7).
2. **Structure holds:** all entity, pipeline, module, removal, scoping, PR #2, Sprint 1, and infrastructure findings are **confirmed** by the recovered documents (V1–V10).
3. **New conflicts surfaced (must be patched, not redesigned):** four enum-set divergences (WorkRequest, Assignment, Attendance, QualityVerification) resolve to **L0 `PRISMA_SCHEMA_V2_FREEZE`** as the governing data contract; one **unresolved product/deployment conflict** — *two mobile apps (Mobile Blueprint, repo folders) vs. single role-based app (Infrastructure Plan PATCH-09)* — requires an explicit decision.
4. **Authority hierarchy:** the 8-layer model stands, now fully populated; precedence rules unchanged.
5. **Sprint 1:** unblocked, substance unchanged.
6. **PR #2:** CLOSE + scoped reimplementation, unchanged.

**Open items requiring a decision (outside reconciliation scope):**
- (a) Apply enum-reconciliation patches to L1/L2/L3/L4 docs against the L0 schema set.
- (b) Resolve the mobile app-count conflict (two apps vs single role-based app).
- (c) Apply Backend BLOCK-01 / BLOCK-02 patches before backend implementation.
- (d) Commit the four Google-Drive-only reference documents into the repo, and (re)create `CANONICAL_ARCHITECTURE_INDEX` / `GOVERNANCE_RECONSTRUCTION_REPORT`.

*End of AUTHORITY_RECONCILIATION_V2_REPORT.md*
