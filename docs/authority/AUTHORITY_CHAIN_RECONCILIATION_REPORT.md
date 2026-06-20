# AUTHORITY CHAIN RECONCILIATION REPORT

**Status:** RECONCILIATION ONLY — no new architecture, no new plans.
**Date:** 2026-06-10
**Scope:** Reconcile the existing governance corpus against the documents named for
recovery, validate the authority hierarchy, and fix the final canonical MVP architecture,
implementation order, and PR #2 disposition.
**Constraint honored:** Findings derive **only** from documents that physically exist in
the repository, its git history, or the connected Google Drive. No content was inferred or
reconstructed for any absent document.

---

## 0. Evidence Base and Recovery Status

Every named document was searched in three locations: the working tree (incl. `docs/` and
`_legacy/`), git history across all branches (`git log --all`), and the connected Google
Drive (title + full-text search). A document is **PRESENT** only if found in at least one.

### 0.1 "Recovered" authority documents — recovery status

| Document | Found? | Evidence |
|---|---|---|
| WORKREQUEST_FINAL_ARCHITECTURE.md | ❌ ABSENT | Cited as hierarchy entry 2 by `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:177-179`; file does not exist anywhere |
| WORKREQUEST_FINAL_ARCHITECTURE_PATCH_V1.md | ❌ ABSENT | Not in repo, git, or Drive |
| BACKEND_EXECUTION_BLUEPRINT_V2.md | ❌ ABSENT | Cited as hierarchy entry 5; also cited as "not found" by `docs/API_SPEC_V1_PATCH_V2.md:19-22` |
| BACKEND_EXECUTION_BLUEPRINT_V2_PATCH_V1.md | ❌ ABSENT | Not in repo, git, or Drive |
| MOBILE_PRODUCT_BLUEPRINT.md | ❌ ABSENT | Cited as hierarchy entry 6; file does not exist anywhere |
| MOBILE_PRODUCT_BLUEPRINT_PATCH_V1.md | ❌ ABSENT | Not in repo, git, or Drive |

### 0.2 "Existing" authority documents — recovery status

| Document | Found? | Location |
|---|---|---|
| PRISMA_SCHEMA_V2_FREEZE.md | ✅ PRESENT | `docs/PRISMA_SCHEMA_V2_FREEZE.md` |
| API_SPEC_V1_PATCH_V2.md | ✅ PRESENT | `docs/API_SPEC_V1_PATCH_V2.md` |
| MARKETPLACE_REFACTOR_MASTER_PLAN.md | ✅ PRESENT | repo root |
| TESTING_MASTER_PLAN_FREEZE.md | ✅ PRESENT | repo root |
| INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md | ✅ PRESENT | repo root |

### 0.3 Named "governance" documents — recovery status

| Document | Found? | Evidence |
|---|---|---|
| CANONICAL_ARCHITECTURE_INDEX.md | ❌ ABSENT | Noted absent by `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:7` and `PR2_FINAL_MERGE_DECISION.md:25` |
| GOVERNANCE_RECONSTRUCTION_REPORT.md | ❌ ABSENT | Noted absent by `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:7` |
| ARCHITECTURE_RECONCILIATION_REPORT.md | ❌ ABSENT | Named in request only |
| SPRINT_1_FINAL_REMEDIATION_PLAN.md | ❌ ABSENT | Named in request only; role filled by present `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md` |

**The real, present governance corpus** (the documents that actually occupy these roles):
`ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md`, `SPRINT_1_COMPLIANCE_REPORT.md`,
`SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md`, `SCHEMA_RECONCILIATION_DECISION.md`,
`PR2_ARCHITECTURE_COMPLIANCE_AUDIT.md`, `PR2_SALVAGE_PLAN.md`, `PR2_FINAL_MERGE_DECISION.md`,
`GOVERNANCE_RECOVERY_DELTA_REPORT.md`, `MVP_EXECUTION_MASTER_PLAN.md`, and the supporting
`MERGE_CONFLICT_RESOLUTION_REPORT.md` / `MOBILE_*` / `INFRASTRUCTURE_*` reports.

### 0.4 Headline finding

**The premise of the request — that six authority documents were recovered and that they
invalidate prior governance findings — is not substantiated. None of the six were recovered.**
They are *referenced* by an existing plan's authority hierarchy, but their content exists
nowhere. Therefore **no prior governance finding can be invalidated by them**, and the
correct disposition for all six is REQUIRES_UPDATE (dangling authority reference), not
"recovered authority."

---

## VALIDATED

Findings confirmed by present documents and unaffected by the (absent) recovered set.

- **V1 — Authority resolution rules.** The ordering rule ("higher entry wins; the layer
  closer to Prisma is authoritative for entities/state,"
  `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:113-114, 174`) and the versioning rule
  (`_FREEZE > _PATCH_V2 > _PATCH_V1 > base`, `:115`) are internally coherent and consistent
  with every present document. The *rules* stand even though three *slots* point to absent
  files (see REQUIRES_UPDATE).

- **V2 — Canonical entity inventory (13 MVP models).** Consistent across
  `PRISMA_SCHEMA_V2_FREEZE.md:17-34`, `SCHEMA_RECONCILIATION_DECISION.md:59-85`, and
  `MARKETPLACE_REFACTOR_MASTER_PLAN.md:11-22`:
  KEEP — User, Session, Hotel, HotelWorker, WorkRequest, WorkApplication, WorkerAssignment,
  Attendance, QualityVerification, Rating, WorkerOverallRating, Notification, AuditLog.
  REMOVE (legacy) — Room, Task, TaskPhoto, DailyOperation.
  DEFER to Phase 2 — Contract, ContractTemplate, ContractLineItem, WorkerDocument,
  RequiredDocument, Payroll, PayrollLineItem, DataRetentionLog, ConsentLog.

- **V3 — Core marketplace pipeline (no bypass).**
  `WorkRequest → WorkApplication → WorkerAssignment → {Attendance, QualityVerification, Rating}`.
  `WorkerAssignment.application_id` is non-nullable with FK to WorkApplication; every
  assignment must trace to an accepted application (`PRISMA_SCHEMA_V2_FREEZE.md:187-188`),
  confirmed by `MARKETPLACE_REFACTOR_MASTER_PLAN.md:11-22`. Roles: Worker applies + clocks
  in/out; Manager approves (manual, decision D2, `MARKETPLACE_REFACTOR_MASTER_PLAN.md:630-641`);
  Checker submits QualityVerification + Rating; Admin override.

- **V4 — Present governance reports are honest and mutually consistent.**
  `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md` transparently declares its own missing
  inputs (`:7`); the Sprint 1, schema, and PR #2 reports agree on entity inventory,
  disposition, and priorities.

- **V5 — PR #2 disposition (see dedicated section below).** Unaffected by the recovery delta.

- **V6 — Final MVP scope and Sprint 1 remediation priorities** as carried in
  `MVP_EXECUTION_MASTER_PLAN.md` and `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md:177-235`
  (Sprint 1 measured 57% complete vs marketplace architecture, `:359`).

---

## INVALIDATED

Statements that are themselves false and are struck. **No prior governance finding is
invalidated by the recovered documents** — because the recovered documents do not exist.
What is invalidated is the *premise* of recovery.

| Premise statement | Status | Reason |
|---|---|---|
| "Six authority documents were recovered." | **INVALIDATED** | Not found in repo, git, or Drive (§0.1) |
| "Prior governance work is stale because it predates the recovered documents." | **INVALIDATED** | No recovered content exists to make anything stale |
| "The canonical entity inventory is overruled by the blueprints." | **INVALIDATED** | Blueprints absent; the 13-model inventory stands (V2) |
| "The marketplace workflow is overruled by WORKREQUEST_FINAL_ARCHITECTURE." | **INVALIDATED** | Document absent; workflow stands per schema freeze (V3) |
| "PR #2 disposition changes in light of the recovered documents." | **INVALIDATED** | No recovered document touches PR #2; disposition is unchanged |

**No content was changed or removed on the strength of an unrecovered document.**

---

## REQUIRES_UPDATE

Items that are valid but incomplete or conflicting, and must be corrected before the
authority chain is fully resolvable. (No redesign is performed here — these are flagged,
not rewritten.)

- **U1 — Three hierarchy slots point to ABSENT documents.** Entries 2 (WorkRequest
  lifecycle / L1), 5 (Backend module layout / L3), and 6 (Mobile surface / L3) of the
  8-layer hierarchy cite files that do not exist. These slots must be **recovered or
  formally marked DEFERRED**, including the four `_PATCH_V1` companions.

- **U2 — Parallel, unreconciled authority chain.** `API_SPEC_V1_PATCH_V2`
  (`docs/API_SPEC_V1_PATCH_V2.md:16-18`) and `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2`
  (`:557`) declare their own authorities — `MASTER_ARCHITECTURE_v2.0`,
  `RBAC_PERMISSION_MATRIX_v1.0`, `FINAL_DECISIONS_SUMMARY`, `EVENT_FLOW_MAPPING_v1.0` —
  which are **present in Google Drive but absent from the repo hierarchy**. They should be
  checked into the repo (or cited by stable Drive ID) and slotted into the hierarchy
  (RBAC at the interface layer, MASTER_ARCHITECTURE at the domain-logic layer).

- **U3 — WorkRequestStatus enum conflict.** Schema freeze defines
  `DRAFT → OPEN → PARTIALLY_FILLED → FILLED → CANCELLED / EXPIRED`
  (`PRISMA_SCHEMA_V2_FREEZE.md:55-65`); API spec PATCH-05 exposes `OPEN | CLOSED | CANCELLED`
  (`docs/API_SPEC_V1_PATCH_V2.md:352-451`). Per the validated layer rule, **the schema
  freeze (L0) governs**; the API spec (L2) must be corrected to expose the 6-state enum or a
  documented projection of it. The intended adjudicator (`WORKREQUEST_FINAL_ARCHITECTURE`,
  L1) is absent, so the schema freeze is the fallback authority.

- **U4 — `User.hotel_ids` sequencing nuance.** `SCHEMA_RECONCILIATION_DECISION.md` retains
  `User.hotel_ids`, while `API_SPEC_V1_PATCH_V2` PATCH-04 (`:254-349`) and
  `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN` Step 1 require **dropping** it in favor of
  HotelWorker/HotelMembership membership queries. Treat the retained field as a
  transitional backfill artifact, not a permanent entity surface.

- **U5 — Missing meta-authority indexes.** `CANONICAL_ARCHITECTURE_INDEX` and
  `GOVERNANCE_RECONSTRUCTION_REPORT` are referenced but absent and should be (re)issued so
  the authority chain has a single resolvable entry point.

---

## FINAL_AUTHORITY_HIERARCHY

The hierarchy from `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md:174-194` is retained as the
canonical ordering. Status flags mark which layers are usable today versus blocked on
recovery. Resolution rules: higher entry wins; the layer closer to Prisma is authoritative
for entities/state; `_FREEZE > _PATCH_V2 > _PATCH_V1 > base`.

| # | Layer / Authority | Governs | Status |
|---|---|---|---|
| 1 | **PRISMA_SCHEMA_V2_FREEZE** | entities, fields, enums, FKs, indexes | ✅ ACTIVE (canonical L0) |
| 2 | WORKREQUEST_FINAL_ARCHITECTURE (+ _PATCH_V1) | WR lifecycle, state machine, invariants | ⛔ DEFERRED — absent; **fallback = schema freeze (L0)** |
| 3 | **MARKETPLACE_REFACTOR_MASTER_PLAN** | listing/bid/award domain rules | ✅ ACTIVE |
| 4 | **API_SPEC_V1_PATCH_V2** | endpoint shapes, DTOs, authz boundaries | ✅ ACTIVE (subordinate to L0 on entities/state — see U3) |
| 5 | BACKEND_EXECUTION_BLUEPRINT_V2 (+ _PATCH_V1) | module layout, service boundaries, migration order | ⛔ DEFERRED — absent; backend steps blocked (U1) |
| 6 | MOBILE_PRODUCT_BLUEPRINT (+ _PATCH_V1) | mobile client surface, offline/sync model | ⛔ DEFERRED — absent; mobile steps blocked (U1) |
| 7 | **TESTING_MASTER_PLAN_FREEZE** | coverage matrix, gating + contract tests | ✅ ACTIVE |
| 8 | **INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2** | env topology, CI/CD, runtime config | ✅ ACTIVE |

**Secondary Drive-only reference documents (U2)** — to be checked in / cited, slotted as
shown, never overriding an ACTIVE repo layer above them:
`MASTER_ARCHITECTURE_v2.0` (domain logic, near L2), `RBAC_PERMISSION_MATRIX_v1.0` (interface
authz, near L4), `FINAL_DECISIONS_SUMMARY` and `EVENT_FLOW_MAPPING_v1.0` (supporting).

**Final canonical MVP architecture:** the **modular-monolith marketplace** defined by the
five ACTIVE layers (L0/L1-marketplace/L2/L4/L8) — 13 entities, the no-bypass
WorkRequest→Application→Assignment→{Attendance,Quality,Rating} pipeline, manual manager
approval, and the V2 schema as the entity/state source of truth. No new architecture is
introduced; the absent L2-WR/L5/L6 layers are deferred, not replaced.

---

## FINAL_IMPLEMENTATION_ORDER

Carried unchanged from `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md:177-235` and
`MVP_EXECUTION_MASTER_PLAN.md`. Steps dependent on the absent L5/L6 blueprints are marked
BLOCKED (U1) but their ordering is preserved.

0. **GATE (partially unmet):** recover or formally DEFER the missing reference documents
   (WORKREQUEST_FINAL_ARCHITECTURE, BACKEND_EXECUTION_BLUEPRINT_V2, MOBILE_PRODUCT_BLUEPRINT
   and their `_PATCH_V1`s); check in the four Drive-only references (U2).
1. **Schema migration** — add HotelMembership; backfill from `User.hotel_ids`; add
   `Hotel.deleted_at`; drop `User.hotel_ids` (U4); drop `User.permissions`; add
   WorkerAssignment partial unique index; revisit DataRetentionLog FK onDelete.
2. **JWT redesign** — final payload shape; rewrite `src/lib/jwt.ts`; update `AuthContext`.
3. **Session strategy decision.**
4. **RBAC redesign.**
5. **Auth module rewrite.**
6. **HotelWorker module rewrite.**
7. **User module rewrite.**
8. **Hotel (CRM) module patches.**
9. **Test suite updates** (gated by `TESTING_MASTER_PLAN_FREEZE`).

⚠️ Steps whose authority is L5 (backend boundaries) or L6 (mobile surface) remain **BLOCKED**
until those blueprints are recovered or explicitly deferred. Resolve U3 (WorkRequestStatus)
in favor of the schema freeze before Step 1 finalization.

---

## PR #2 Disposition — UNCHANGED

**CLOSE PR #2 and reimplement as separate scoped PRs.** PR #2 bundles three unrelated
streams (auth improvements; a pre-V2 task-based CRM schema; a test-runner governance change)
into one branch that is "architecturally incompatible with `main` at the schema level"
(`PR2_FINAL_MERGE_DECISION.md` Exec Summary). Merging it whole — even after resolving all git
conflicts — "would produce a non-compiling codebase" (`:Q5`), because the schema conflict is
architectural, not syntactic, and `exportUserData()` queries models (`task`, `contract`,
`workerDocument`, `payroll`) that do not exist in V2. It is **not a split** — the
schema/package.json/CRM changes "cannot be made mergeable at all" and must be discarded or
rewritten; the genuine value (seven auth-module files) is extracted and merged cleanly
against `main`.

**Does PR #2 disposition change in light of the recovered documents? NO.** None of the six
named documents were recovered, and none bears on PR #2. The disposition stands.

---

## Classification Summary

| Task | Result |
|---|---|
| 1. Validate authority hierarchy | VALIDATED rules; REQUIRES_UPDATE for 3 absent layers + parallel chain |
| 2. Findings invalidated by recovered documents | NONE — recovered set is absent; the *premise* is INVALIDATED |
| 3. Findings still valid | Entity inventory, marketplace pipeline, governance reports, MVP scope, Sprint 1 priorities, PR #2 |
| 4. Final canonical MVP architecture | Modular-monolith marketplace on the 5 ACTIVE layers; V2 schema = source of truth |
| 5. Final implementation order | Unchanged 10-step order; L5/L6-dependent steps BLOCKED pending recovery |
| 6. PR #2 disposition change | NO — CLOSE + reimplement, unchanged |
