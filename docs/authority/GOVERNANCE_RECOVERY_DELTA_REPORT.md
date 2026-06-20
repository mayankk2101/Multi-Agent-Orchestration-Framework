# GOVERNANCE RECOVERY DELTA REPORT

**Status:** RECONCILIATION — read-only governance reconciliation
**Date:** 2026-06-10
**Scope:** Final governance reconciliation for Hotel CRM MVP. Reconciles the previously
produced governance documents against the authority documents named for recovery.
**Constraint honored:** No new architecture created. No modules redesigned. Findings are
derived **only** from documents that physically exist in the repository, its git history,
or the connected Google Drive.

---

## 0. Method and Evidence Base

Every document named in the reconciliation request was searched for in three locations:

1. The working tree (`/home/user/hotel-crm`, including `docs/` and `_legacy/`).
2. Git history across all branches (`git log --all`).
3. The connected Google Drive (`HotelCRM` folder tree — title and full-text search).

A document is treated as **RECOVERED** only if it was found in at least one of these. A
document is treated as **NOT RECOVERED** if it was found in none. No content was inferred
or reconstructed for a NOT RECOVERED document.

### 0.1 Recovery Status of Named Documents

**Previously produced governance documents (named in request):**

| Document | Found? | Location |
|---|---|---|
| CANONICAL_ARCHITECTURE_INDEX.md | ❌ NOT RECOVERED | Absent everywhere; explicitly noted absent by `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:7` and `PR2_FINAL_MERGE_DECISION.md:25` |
| GOVERNANCE_RECONSTRUCTION_REPORT.md | ❌ NOT RECOVERED | Absent everywhere; explicitly noted absent by `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:7` |
| ARCHITECTURE_RECONCILIATION_REPORT.md | ❌ NOT RECOVERED | Absent everywhere |
| SPRINT_1_FINAL_REMEDIATION_PLAN.md | ❌ NOT RECOVERED | Absent everywhere |

> The request describes these four as "previously recovered." They are **not present** in
> any evidence location. The actual, present governance artifacts that occupy these roles
> are named differently (see §0.3). This report reconciles against the documents that exist,
> not against the names assumed by the request.

**"Newly recovered" authority documents (named in request):**

| Document | Found? | Location |
|---|---|---|
| WORKREQUEST_FINAL_ARCHITECTURE.md | ❌ NOT RECOVERED | Cited as authority Layer 1 by `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:180` but file absent |
| WORKREQUEST_FINAL_ARCHITECTURE_PATCH_V1.md | ❌ NOT RECOVERED | Absent everywhere |
| BACKEND_EXECUTION_BLUEPRINT_V2.md | ❌ NOT RECOVERED | Cited as authority Layer 3 by `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:186`; also cited as "not found" by `docs/API_SPEC_V1_PATCH_V2.md:19-22`; file absent |
| BACKEND_EXECUTION_BLUEPRINT_V2_PATCH_V1.md | ❌ NOT RECOVERED | Absent everywhere |
| MOBILE_PRODUCT_BLUEPRINT.md | ❌ NOT RECOVERED | Cited as authority Layer 3 by `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:188`; file absent |
| MOBILE_PRODUCT_BLUEPRINT_PATCH_V1.md | ❌ NOT RECOVERED | Absent everywhere |

**Additional authority documents (named in request):**

| Document | Found? | Location |
|---|---|---|
| PRISMA_SCHEMA_V2_FREEZE.md | ✅ RECOVERED | `docs/PRISMA_SCHEMA_V2_FREEZE.md` |
| API_SPEC_V1_PATCH_V2.md | ✅ RECOVERED | `docs/API_SPEC_V1_PATCH_V2.md` |
| MARKETPLACE_REFACTOR_MASTER_PLAN.md | ✅ RECOVERED | repo root |
| TESTING_MASTER_PLAN_FREEZE.md | ✅ RECOVERED | repo root |
| INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md | ✅ RECOVERED | repo root |

### 0.2 Headline Finding

**The premise that "newly recovered authority documents" invalidate the prior governance
work cannot be substantiated, because none of those six documents were recovered.** They
are *referenced* by an existing planning document's authority hierarchy, but their content
does not exist in any accessible location. Consequently:

- No statement in the existing governance set can be **INVALIDATED** by these six documents
  (you cannot be overruled by a document whose content is absent).
- The correct classification for the six is **REQUIRES_CORRECTION — missing authority
  reference**, not "recovered authority."

### 0.3 Present Governance Artifacts (the real corpus)

These exist and serve the governance/report roles the request attributes to the missing files:

- `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md` — merge order, authority hierarchy, freeze packages (the "execution record").
- `SPRINT_1_COMPLIANCE_REPORT.md` — factual inventory of Sprint 1 code.
- `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md` — Sprint 1 remediation plan.
- `SCHEMA_RECONCILIATION_DECISION.md` — canonical schema outcome.
- `PR2_ARCHITECTURE_COMPLIANCE_AUDIT.md`, `PR2_SALVAGE_PLAN.md`, `PR2_FINAL_MERGE_DECISION.md` — PR #2 disposition.
- `MERGE_CONFLICT_RESOLUTION_REPORT.md`, `MOBILE_*`, `INFRASTRUCTURE_*`, `DOCUMENTATION_*` — supporting reports.

---

## 1. Validate the Authority Hierarchy → REQUIRES_CORRECTION

**Claimed hierarchy** (`ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:177-194`), 8 layers:

| Layer | Document | Recovered? |
|---|---|---|
| L0 — Domain model | PRISMA_SCHEMA_V2_FREEZE | ✅ |
| L1 — WR lifecycle | WORKREQUEST_FINAL_ARCHITECTURE | ❌ |
| L1 — Marketplace rules | MARKETPLACE_REFACTOR_MASTER_PLAN | ✅ |
| L2 — Interface | API_SPEC_V1_PATCH_V2 | ✅ |
| L3 — Module layout | BACKEND_EXECUTION_BLUEPRINT_V2 | ❌ |
| L3 — Mobile surface | MOBILE_PRODUCT_BLUEPRINT | ❌ |
| L4 — Test gating | TESTING_MASTER_PLAN_FREEZE | ✅ |
| L4 — Deploy topology | INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2 | ✅ |

**Resolution rules (validated as stated):**
- "Layer authority wins… lower layer (closer to Prisma) is authoritative for entities/state"
  (`:113-114`).
- Versioning precedence `_FREEZE > _PATCH_V2 > _PATCH_V1 > base` (`:115`).

**Findings:**
- ✅ **VALIDATED** — the *ordering rule* and *versioning rule* are internally coherent and
  consistent with the present documents.
- ⚠️ **REQUIRES_CORRECTION** — three of the eight hierarchy slots (L1-WR, L3-Backend,
  L3-Mobile) point to **NOT RECOVERED** documents. The hierarchy cannot be fully exercised
  for WorkRequest lifecycle, backend module boundaries, or mobile client surface.
- ⚠️ **REQUIRES_CORRECTION — secondary authority chain conflict.** `API_SPEC_V1_PATCH_V2`
  declares its *own* authorities — `RBAC_PERMISSION_MATRIX_v1.0`, `MASTER_ARCHITECTURE_v2.0`,
  `FINAL_DECISIONS_SUMMARY` (`docs/API_SPEC_V1_PATCH_V2.md:16-18`) — and so does
  `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2` (`MASTER_ARCHITECTURE_v2.0` as "signed,
  approved source of truth," `:557`). These three are **Google Drive reference documents**
  (present in Drive: `MASTER_ARCHITECTURE_v2.0.md`, `RBAC_PERMISSION_MATRIX_v1.0.md`,
  `FINAL_DECISIONS_SUMMARY.md`), but they are **absent from the 8-layer hierarchy**. The
  governance set therefore has two parallel, unreconciled authority chains.

**Correction required:** Either (a) recover the three missing layer documents, or (b)
formally re-issue the hierarchy with the missing layers marked DEFERRED and the Drive
reference documents inserted at their governing layers (RBAC at L2/interface, MASTER_ARCH
at L1/domain logic).

---

## 2. Validate the Canonical Entity Inventory → VALIDATED

The 13-model MVP inventory is **consistent across all three present sources**:

`PRISMA_SCHEMA_V2_FREEZE.md:17-34`, `SCHEMA_RECONCILIATION_DECISION.md:59-85`,
`MARKETPLACE_REFACTOR_MASTER_PLAN.md:11-22`.

**KEEP — 13 MVP models:** User, Session, Hotel, HotelWorker, WorkRequest, WorkApplication,
WorkerAssignment, Attendance, QualityVerification, Rating, WorkerOverallRating,
Notification, AuditLog.

**REMOVE — 4 legacy models:** Room, Task, TaskPhoto, DailyOperation
(`PRISMA_SCHEMA_V2_FREEZE.md:35`).

**DEFER to Phase 2 — 9 models:** Contract, ContractTemplate, ContractLineItem,
WorkerDocument, RequiredDocument, Payroll, PayrollLineItem, DataRetentionLog, ConsentLog
(`SCHEMA_RECONCILIATION_DECISION.md`).

**Finding:** ✅ **VALIDATED.** No contradiction between the schema freeze, the schema
reconciliation decision, and the marketplace plan on the entity set.

**One open follow-up (REQUIRES_CORRECTION, minor):** `SCHEMA_RECONCILIATION_DECISION.md`
records "main's V2 + 1 field (`User.hotel_ids`)" while `API_SPEC_V1_PATCH_V2` PATCH-04
(`:254-349`) and `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN` Step 1 require **dropping**
`User.hotel_ids` in favor of HotelWorker/HotelMembership membership queries. The retained
`hotel_ids` field is a transitional/backfill artifact, not a permanent entity surface. This
is a sequencing nuance, not an entity-set conflict — flagged for the master plan.

---

## 3. Validate the Marketplace Workflow → REQUIRES_CORRECTION

**Core pipeline (mandatory, no bypass) — VALIDATED:**

```
WorkRequest → WorkApplication → WorkerAssignment → {Attendance, QualityVerification, Rating}
```

- `WorkerAssignment.application_id` is non-nullable with FK to WorkApplication; "no bypass
  path… every assignment must trace back to an accepted application"
  (`PRISMA_SCHEMA_V2_FREEZE.md:187-188`).
- Confirmed identically by `MARKETPLACE_REFACTOR_MASTER_PLAN.md:11-22`.
- Roles: Worker applies + clocks in/out; Manager approves/rejects → assignment created
  (manual approve, decision D2, `MARKETPLACE_REFACTOR_MASTER_PLAN.md:630-641`); Checker
  submits QualityVerification + Rating; Admin override.

**State machines (VALIDATED as stated in the freeze):**
`HotelWorkerStatus`, `WorkRequestStatus`, `ApplicationStatus`, `AssignmentStatus`,
`AttendanceStatus`, `VerificationStatus` (`PRISMA_SCHEMA_V2_FREEZE.md:46-102`).

**⚠️ REQUIRES_CORRECTION — WorkRequestStatus enum conflict:**
- Schema freeze: `DRAFT → OPEN → PARTIALLY_FILLED → FILLED → CANCELLED / EXPIRED`
  (`PRISMA_SCHEMA_V2_FREEZE.md:55-65`).
- API spec PATCH-05: WorkRequest status enum = `OPEN | CLOSED | CANCELLED`
  (`docs/API_SPEC_V1_PATCH_V2.md:352-451`).

These are not reconcilable as written. Per the validated layer rule ("lower layer closer to
Prisma is authoritative for entities/state," `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:113`),
**the schema freeze enum (L0) governs**, and the API spec (L2) must be corrected to expose
the 6-state enum (or a documented projection of it). Flagged for correction; not resolved
here (no redesign permitted).

**⚠️ REQUIRES_CORRECTION — WorkRequest lifecycle authority is the missing
`WORKREQUEST_FINAL_ARCHITECTURE` (L1).** The definitive lifecycle/state-machine authority is
NOT RECOVERED, so the enum conflict above cannot be adjudicated by its intended owner. Until
recovered, the schema freeze is the fallback authority for WR state.

---

## 4. Validate the Governance Reports → VALIDATED (with scope note)

- `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md` — ✅ VALIDATED as a planning/execution
  record; it transparently declares its own missing inputs (`:7`). Honest and internally
  consistent.
- `SPRINT_1_COMPLIANCE_REPORT.md`, `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md`,
  `SCHEMA_RECONCILIATION_DECISION.md`, `PR2_*` — ✅ VALIDATED; mutually consistent on entity
  inventory, PR #2 disposition, and Sprint 1 priorities.
- The four governance documents the request calls "previously recovered"
  (CANONICAL_ARCHITECTURE_INDEX, GOVERNANCE_RECONSTRUCTION_REPORT,
  ARCHITECTURE_RECONCILIATION_REPORT, SPRINT_1_FINAL_REMEDIATION_PLAN) — **cannot be
  validated; they do not exist.** Classification: REQUIRES_CORRECTION (missing).

---

## 5. Statements Invalidated by Newly Recovered Documents → NONE (premise INVALIDATED)

Because all six "newly recovered" authority documents are **NOT RECOVERED**, no existing
statement is invalidated by them. The premise itself is classified **INVALIDATED**.

| Premise statement | Classification | Reason |
|---|---|---|
| "Six authority documents were recovered." | INVALIDATED | Not found in repo, git, or Drive |
| "Prior governance docs were created before these were recovered, so they are stale." | INVALIDATED | No recovered content exists to make them stale |
| "Existing entity inventory is overruled by the blueprints." | INVALIDATED | Blueprints absent; entity inventory stands (§2) |
| "Existing marketplace workflow is overruled by WORKREQUEST_FINAL_ARCHITECTURE." | INVALIDATED | Document absent; workflow stands per schema freeze (§3) |

**No content was changed or removed on the strength of an unrecovered document.**

---

## 6. Missing Authority References → REQUIRES_CORRECTION

The following are referenced by present documents but are **not recoverable**. Each is a
dangling authority reference that must be resolved before the hierarchy is complete:

| Missing document | Referenced by | Governs |
|---|---|---|
| WORKREQUEST_FINAL_ARCHITECTURE(.md / _PATCH_V1) | `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:180` | WorkRequest lifecycle / state machine (L1) |
| BACKEND_EXECUTION_BLUEPRINT_V2(.md / _PATCH_V1) | `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:186`; `docs/API_SPEC_V1_PATCH_V2.md:19-22` | Backend module layout / service boundaries (L3) |
| MOBILE_PRODUCT_BLUEPRINT(.md / _PATCH_V1) | `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:188` | Mobile client surface (L3) |
| CANONICAL_ARCHITECTURE_INDEX.md | `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:7`; `PR2_FINAL_MERGE_DECISION.md:25` | Pointer/meta-authority index |
| GOVERNANCE_RECONSTRUCTION_REPORT.md | `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:7` | Process record / meta-authority |
| ARCHITECTURE_RECONCILIATION_REPORT.md | (request only) | — |
| SPRINT_1_FINAL_REMEDIATION_PLAN.md | (request only; superseded in role by SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md) | Sprint 1 remediation |

**Reference documents present only in Google Drive** (governing API/Infra layers but absent
from the repo hierarchy): `MASTER_ARCHITECTURE_v2.0.md`, `RBAC_PERMISSION_MATRIX_v1.0.md`,
`FINAL_DECISIONS_SUMMARY.md`, `EVENT_FLOW_MAPPING_v1.0.md`. These should be checked into the
repo (or formally referenced by URL/ID) so the authority chain is fully resolvable offline.

---

## 7. Final MVP Scope → VALIDATED (see Master Plan §1)

Confirmed and carried to `MVP_EXECUTION_MASTER_PLAN.md`. No new scope introduced.

## 8. Final Implementation Order → VALIDATED (see Master Plan §2)

Confirmed and carried to `MVP_EXECUTION_MASTER_PLAN.md`. Caveat: L1/L3 blueprint-dependent
steps remain blocked pending recovery (see §6).

## 9. PR #2 Disposition → VALIDATED

**CLOSE PR #2 and reimplement as three separate scoped PRs** (auth improvements; pre-V2 CRM
schema discard/rewrite; test-runner governance). The PR is "architecturally incompatible
with `main` at the schema level"; merging it whole "would produce a non-compiling codebase"
(`PR2_FINAL_MERGE_DECISION.md:31-35, 88-100`). Not a split — the schema/package.json/CRM
changes "cannot be made mergeable at all" (`:105-107`). ✅ VALIDATED; unaffected by the
recovery delta.

## 10. Sprint 1 Remediation Priorities → VALIDATED

Ordered list from `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md:177-235` (Sprint 1 = 57% complete
vs marketplace architecture, `:359`):

0. **BLOCKED GATE** — obtain missing reference documents (still partially unmet, see §6).
1. Schema migration (add HotelMembership; backfill from `User.hotel_ids`; add
   `Hotel.deleted_at`; drop `User.hotel_ids`; drop `User.permissions`; add WorkerAssignment
   partial unique index; revisit DataRetentionLog FK onDelete).
2. JWT redesign (final payload shape; rewrite `src/lib/jwt.ts`; update `AuthContext`).
3. Session strategy decision.
4. RBAC redesign.
5. Auth module rewrite.
6. HotelWorker module rewrite.
7. User module rewrite.
8. Hotel (CRM) module patches.
9. Test suite updates.

✅ VALIDATED. ⚠️ Note: Step 0's blocking documents that map to NOT RECOVERED files
(§6) remain a live blocker for the backend/mobile-dependent steps.

---

## Classification Summary

| # | Task | Classification |
|---|---|---|
| 1 | Authority hierarchy | REQUIRES_CORRECTION (3 missing layers + parallel chain) |
| 2 | Canonical entity inventory | VALIDATED (minor `hotel_ids` follow-up) |
| 3 | Marketplace workflow | REQUIRES_CORRECTION (WorkRequestStatus enum conflict) |
| 4 | Governance reports | VALIDATED (present set); REQUIRES_CORRECTION (4 named-missing) |
| 5 | Statements invalidated by new docs | INVALIDATED premise — NONE invalidated |
| 6 | Missing authority references | REQUIRES_CORRECTION (7 docs + 4 Drive-only refs) |
| 7 | Final MVP scope | VALIDATED |
| 8 | Final implementation order | VALIDATED (blueprint steps blocked) |
| 9 | PR #2 disposition | VALIDATED (CLOSE + 3 PRs) |
| 10 | Sprint 1 remediation priorities | VALIDATED |

**Top correction actions:**
1. Recover or formally DEFER the three missing hierarchy layers (WORKREQUEST_FINAL_ARCHITECTURE,
   BACKEND_EXECUTION_BLUEPRINT_V2, MOBILE_PRODUCT_BLUEPRINT) and their PATCH_V1s.
2. Resolve the WorkRequestStatus enum conflict in favor of the schema freeze (L0).
3. Check the four Google-Drive-only reference documents into the repo or cite them by stable ID.
4. Re-issue `CANONICAL_ARCHITECTURE_INDEX` / `GOVERNANCE_RECONSTRUCTION_REPORT` (currently absent).
