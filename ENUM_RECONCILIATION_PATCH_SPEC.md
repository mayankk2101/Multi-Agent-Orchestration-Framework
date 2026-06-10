# ENUM_RECONCILIATION_PATCH_SPEC

**Generated:** 2026-06-10
**Type:** Enum reconciliation only — no workflow redesign, no entity redesign, no change to implementation order
**Governing authority for all enum definitions:** `docs/PRISMA_SCHEMA_V2_FREEZE.md` (L0, FREEZE)
**Source of conflicts:** `AUTHORITY_RECONCILIATION_V2_REPORT.md` §5.1
**Scope:** The four enum-set conflicts flagged in §5.1, plus validation of Backend BLOCK-01 / BLOCK-02.

> The mobile app-count conflict in §5.1 is **out of scope** — it is a product/deployment decision, not an enum conflict, and is explicitly excluded here.

---

## 0. Method and Rules

- L0 `PRISMA_SCHEMA_V2_FREEZE` is the **single canonical source for every enum value set**. Where any higher layer (L1–L4) disagrees, the higher layer is patched to the L0 set. No enum is redesigned. No L0 value is added, removed, or renamed.
- Reconciliation is by **explicit patch on the losing document(s)** — never a silent inline rewrite (Report Rule 4).
- Lifecycle/transition *semantics* in L1 are preserved by **mapping** non-canonical states onto canonical L0 values; the persisted enum still uses only L0 values.
- Documents and the branch each currently lives on:

| Layer | Document | Branch |
|---|---|---|
| L0 | `docs/PRISMA_SCHEMA_V2_FREEZE.md` | working tree / `main` |
| L1 | `WORKREQUEST_FINAL_ARCHITECTURE.md` (+`_PATCH_V1`) | `origin/claude/amazing-hypatia-DQ2lE` |
| L2 | `docs/API_SPEC_V1_PATCH_V2.md` | working tree / `main` |
| L3 | `BACKEND_EXECUTION_BLUEPRINT_V2.md` (+`_PATCH_V1`) | `origin/claude/optimistic-turing-wu7y5r` |
| L4 | `TESTING_MASTER_PLAN_FREEZE.md` | working tree / `main` |

---

## CONFLICT 1 — `WorkRequestStatus`

### Canonical values (L0 — FROZEN, do not alter)
```
DRAFT  OPEN  PARTIALLY_FILLED  FILLED  CANCELLED  EXPIRED
```
Lifecycle: `DRAFT → OPEN → PARTIALLY_FILLED → FILLED → CANCELLED / EXPIRED`. Maintained by the `sync_workers_confirmed` trigger.

### Affected documents and their divergence

| Doc | Current set | Delta vs L0 |
|---|---|---|
| L1 `WORKREQUEST_FINAL_ARCHITECTURE` §3 | `DRAFT, OPEN, PARTIALLY_FILLED, FILLED, IN_PROGRESS, COMPLETED, CANCELLED` | **adds** `IN_PROGRESS`, `COMPLETED`; **missing** `EXPIRED` |
| L2 `API_SPEC_V1_PATCH_V2` §5b | `OPEN, CLOSED, CANCELLED` | **adds** `CLOSED`; **missing** `DRAFT, PARTIALLY_FILLED, FILLED, EXPIRED` |
| L3 `BACKEND_EXECUTION_BLUEPRINT_V2` (Migration 5, Appendix B) | `OPEN, FILLED, CANCELLED, COMPLETED` | **adds** `COMPLETED`; **missing** `DRAFT, PARTIALLY_FILLED, EXPIRED` |

### Exact patch required

**L1 — `WORKREQUEST_FINAL_ARCHITECTURE` §3 (WorkRequest status table & transition table):**
- Remove `IN_PROGRESS` and `COMPLETED` as **WorkRequest** status values. The "shift started / shift ended" semantics they carried move to `AssignmentStatus` (`IN_PROGRESS` / `COMPLETED`) — WorkRequest does not carry a per-shift execution state.
- Add `EXPIRED` as a terminal value: a request that passes `expires_at` without being filled.
- Resulting transition table terminals become `FILLED`, `CANCELLED`, `EXPIRED`. Drop the `FILLED → IN_PROGRESS → COMPLETED` rows on WorkRequest; those transitions belong to WorkerAssignment.

**L2 — `API_SPEC_V1_PATCH_V2` §5b "WorkRequest Status Enum Alignment":**
- Replace the `AFTER (V2): OPEN | CLOSED | CANCELLED` line and all dependent endpoint enum lists (`POST /work-requests`, `GET /work-requests` filter + response, `GET /work-requests/:id`, `PATCH /work-requests/:id`) with the canonical L0 set:
  ```
  DRAFT | OPEN | PARTIALLY_FILLED | FILLED | CANCELLED | EXPIRED
  ```
- Delete `CLOSED`. The §5b rationale ("OPEN until a confirmed assignment, then CLOSED") is superseded: fill state is `PARTIALLY_FILLED` / `FILLED`, not `CLOSED`.

**L3 — `BACKEND_EXECUTION_BLUEPRINT_V2` Migration 5 + Appendix B:**
- Replace the enum block with the L0 set:
  ```prisma
  enum WorkRequestStatus {
    DRAFT
    OPEN
    PARTIALLY_FILLED
    FILLED
    CANCELLED
    EXPIRED
  }
  ```
- **Supersede** the `_PATCH_V1` decisions that conflict with L0 (see Impact): PATCH-04 (DRAFT excluded) and PATCH-07 (PARTIALLY_FILLED removed) are **reversed** — both values are canonical and must be present.

### Impact assessment
- **L3 `_PATCH_V1` reversal (high):** Backend PATCH-04 ("DRAFT EXCLUDED from MVP") and PATCH-07 ("PARTIALLY_FILLED removed") were authored under `[SOURCE UNAVAILABLE]`. L0 is now the available governing source and **includes both values**. The `[SOURCE UNAVAILABLE]` assumptions resolve **against** those patches. PATCH-04 must be rewritten to "DRAFT INCLUDED (publish flow `DRAFT → OPEN`)" and PATCH-07's data-migration step (`UPDATE … SET status='OPEN' WHERE status='PARTIALLY_FILLED'`) must be **dropped** — that backfill would destroy a valid canonical state.
- **No migration impact on L0:** the frozen migration (Step 5) already creates the correct enum; only the L1/L2/L3 docs drift.
- **Trigger consistency:** `sync_workers_confirmed` already drives `OPEN ↔ PARTIALLY_FILLED ↔ FILLED` and guards `DRAFT/CANCELLED/EXPIRED`; the patched docs now match runtime behavior.

---

## CONFLICT 2 — `AssignmentStatus`

### Canonical values (L0 — FROZEN, do not alter)
```
CONFIRMED  IN_PROGRESS  COMPLETED  NO_SHOW  CANCELLED  REASSIGNED
```
> Canonical Prisma type name is **`AssignmentStatus`**. L3/existing code use `WorkerAssignmentStatus` — that is a naming drift to align to `AssignmentStatus`.

### Affected documents and their divergence

| Doc | Current set | Delta vs L0 |
|---|---|---|
| L1 `WORKREQUEST_FINAL_ARCHITECTURE` §5 | `ASSIGNED, CHECKED_IN, CHECKED_OUT, ATTENDANCE_VERIFIED, CANCELLED` | **non-canonical names**; missing `CONFIRMED, IN_PROGRESS, COMPLETED, NO_SHOW, REASSIGNED` |
| L2 `API_SPEC_V1_PATCH_V2` §5 (WorkerAssignment DTOs) | `ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED` | **adds** `ASSIGNED`; missing `CONFIRMED, NO_SHOW, REASSIGNED` |
| L3 `BACKEND_EXECUTION_BLUEPRINT_V2` (Migration 6, Appendix B) | `ASSIGNED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW` | **adds** `ASSIGNED`; **missing** `REASSIGNED` |
| L4 `TESTING_MASTER_PLAN_FREEZE` (transition matrix, fixtures) | uses `ASSIGNED`, `REASSIGNED` | **uses** non-canonical `ASSIGNED` as initial state |

### Exact patch required

**L1 — `WORKREQUEST_FINAL_ARCHITECTURE` §5:** Re-key the WorkerAssignment status table to the L0 set, mapping the lifecycle semantics:
- `ASSIGNED` → **`CONFIRMED`** (assignment created from accepted application).
- `CHECKED_IN` → **`IN_PROGRESS`** (worker checked in / shift started).
- `CHECKED_OUT` + `ATTENDANCE_VERIFIED` → **`COMPLETED`** (shift completed; verification of check-in/out times is tracked on `Attendance.verified_by_id/verified_at`, not as an assignment enum value).
- Add **`NO_SHOW`** (manager-set terminal) and **`REASSIGNED`** (leg replaced via `previous_assignment_id`).
- Keep `CANCELLED`.

**L2 — `API_SPEC_V1_PATCH_V2` §5 (both WorkerAssignment DTO blocks, lines ~365/389):** Replace `"status": "ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED"` with:
```
"status": "CONFIRMED | IN_PROGRESS | COMPLETED | NO_SHOW | CANCELLED | REASSIGNED"
```

**L3 — `BACKEND_EXECUTION_BLUEPRINT_V2` Migration 6 + Appendix B:** Replace the enum with the L0 set and rename the type `WorkerAssignmentStatus → AssignmentStatus`:
```prisma
enum AssignmentStatus {
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  NO_SHOW
  CANCELLED
  REASSIGNED
}
```
- Drop `ASSIGNED` (use `CONFIRMED`); add `REASSIGNED`. This also resolves Backend `_PATCH_V1` MINOR-01 (the `CONFIRMED` ambiguity): `CONFIRMED` is the **initial** state, replacing `ASSIGNED`, not an extra acknowledgment step.

**L4 — `TESTING_MASTER_PLAN_FREEZE`:** Update the assignment transition matrix and `assignmentFixture` to use `CONFIRMED` as the initial state (was `ASSIGNED`); keep `REASSIGNED`. Adjust any `ASSIGNED → REASSIGNED` row to `CONFIRMED → REASSIGNED`.

### Impact assessment
- **Type rename (medium):** `WorkerAssignmentStatus → AssignmentStatus` touches L3 migrations, L4 fixtures, and any generated client typing. L0 migration already names it `AssignmentStatus` (see partial-index predicate `'CONFIRMED'::"AssignmentStatus"`), so runtime is correct; only docs/tests drift.
- **Semantic mapping (medium):** L1's four execution states collapse to L0's `IN_PROGRESS`/`COMPLETED`. The partial unique index `WorkerAssignment_worker_active_per_request_uidx` is predicated on `status IN ('CONFIRMED','IN_PROGRESS')` — the patched L1/L3 set must keep both names exactly, or the index semantics break.
- **No NO_SHOW path in L1 (low):** L1 had no `NO_SHOW`; adding it requires a documented manager transition, but introduces no schema change (value already in L0).

---

## CONFLICT 3 — `AttendanceStatus`

### Canonical values (L0 — FROZEN, do not alter)
```
EXPECTED  PRESENT  LATE  PARTIAL  ABSENT  EXCUSED
```
Lifecycle: `EXPECTED → PRESENT / LATE / PARTIAL / ABSENT / EXCUSED`. Default `EXPECTED`.

### Affected documents and their divergence

| Doc | Current set | Delta vs L0 |
|---|---|---|
| L1 `WORKREQUEST_FINAL_ARCHITECTURE` §6 (+`_PATCH_V1` §2.7/B7) | `NOT_STARTED, CHECKED_IN, CHECKED_OUT, VERIFIED, DISPUTED, CANCELLED` | entirely non-canonical lifecycle |
| L3 `BACKEND_EXECUTION_BLUEPRINT_V2` (Migration 8, Appendix B) | `EXPECTED, CLOCKED_IN, CLOCKED_OUT, ABSENT, EXCUSED` | shares `EXPECTED/ABSENT/EXCUSED`; `CLOCKED_IN/CLOCKED_OUT` non-canonical; missing `PRESENT, LATE, PARTIAL` |
| L4 `TESTING_MASTER_PLAN_FREEZE` (fixtures line ~303, integration tests) | `PENDING, CLOCKED_IN, CLOCKED_OUT, VERIFIED, DISPUTED` | a **fourth** distinct set |

### Exact patch required

L0 models attendance as an **outcome** (`PRESENT/LATE/PARTIAL/ABSENT/EXCUSED`) with `EXPECTED` as the pre-shift default; the check-in/check-out *progression* (`CLOCKED_IN`, `CHECKED_IN`, etc.) is **not** an `AttendanceStatus` value — it is captured by the `check_in_at` / `check_out_at` / `verified_by_id` / `verified_at` columns. All non-L0 docs must drop progression-as-status and adopt the outcome set.

**L1 — `WORKREQUEST_FINAL_ARCHITECTURE` §6 + `_PATCH_V1` §2.7 (B7):**
- Replace the `AttendanceStatus` enum with `EXPECTED, PRESENT, LATE, PARTIAL, ABSENT, EXCUSED`.
- Map semantics: `NOT_STARTED → EXPECTED`; `CHECKED_IN/CHECKED_OUT/VERIFIED` are represented by timestamp + `verified_at` columns and resolve to a terminal outcome (`PRESENT`, `LATE`, or `PARTIAL`); `DISPUTED` is not a persisted status value — model disputes via the verification columns / `AuditLog`.
- **`_PATCH_V1` B7 (`CANCELLED`) is dropped:** `CANCELLED` is not an L0 `AttendanceStatus` value. Assignment cancellation is tracked on `WorkerAssignment.status = CANCELLED`; the Attendance row remains at its outcome (typically `EXCUSED` or `ABSENT`). Re-key B7 accordingly.

**L3 — `BACKEND_EXECUTION_BLUEPRINT_V2` Migration 8 + Appendix B:**
```prisma
enum AttendanceStatus {
  EXPECTED
  PRESENT
  LATE
  PARTIAL
  ABSENT
  EXCUSED
}
```
- Replace `CLOCKED_IN/CLOCKED_OUT` with timestamp columns + outcome values. This also resolves Backend `_PATCH_V1` MINOR-04 (`EXCUSED` orphan) — `EXCUSED` is canonical; define its transition.

**L4 — `TESTING_MASTER_PLAN_FREEZE`:**
- Update the `Attendance` fixture comment/values (line ~303), the model-change note (line ~18 `PENDING → CLOCKED_IN → CLOCKED_OUT → VERIFIED`), and all clock-in/out integration tests to the L0 outcome set. Replace assertions like `status: CLOCKED_IN` / `CLOCKED_OUT` / `VERIFIED` with timestamp assertions (`check_in_at set`, `check_out_at set`, `verified_at set`) plus the terminal outcome value (`PRESENT` / `LATE` / `PARTIAL`).

### Impact assessment
- **Highest-divergence conflict (high):** four different sets across L0/L1/L3/L4 — every non-L0 doc rewrites this enum, and L4 test assertions shift from status-string checks to timestamp+outcome checks. This is the largest test-suite delta.
- **Semantic model shift (high):** progression states (`CLOCKED_IN`, `CHECKED_OUT`, `VERIFIED`) cease to be enum values. Any code/test asserting them must move to the column-based representation. No L0 schema change — `Attendance` already has `check_in_at`, `check_out_at`, `verified_by_id`, `verified_at`, plus the `Attendance_verification_pair` CHECK.
- **L1 PATCH_V1 B7 void (medium):** the added `CANCELLED` terminal is removed; the cancellation-cascade narrative re-points to `WorkerAssignment.status`.

---

## CONFLICT 4 — `VerificationStatus` (a.k.a. `QualityVerificationStatus`)

### Canonical values (L0 — FROZEN, do not alter)
```
PASSED  FAILED  NEEDS_REWORK
```
> Canonical Prisma type name is **`VerificationStatus`** (L0 §2). The report's "QualityVerificationStatus" label maps to this type.

### Affected documents and their divergence

| Doc | Current set | Delta vs L0 |
|---|---|---|
| L1 `WORKREQUEST_FINAL_ARCHITECTURE` §7 | `PENDING, IN_PROGRESS, PASSED, FAILED, WAIVED` | adds `PENDING, IN_PROGRESS, WAIVED`; missing `NEEDS_REWORK` |
| L2 `API_SPEC_V1_PATCH_V2` (quality-verification DTO, line ~99) | `PENDING, APPROVED, REJECTED` | entirely non-canonical |
| L3 `BACKEND_EXECUTION_BLUEPRINT_V2` (Migration 7, Appendix B) | `VERIFIED, NEEDS_REWORK, DISPUTED` | adds `VERIFIED, DISPUTED`; missing `PASSED, FAILED` |
| L4 `TESTING_MASTER_PLAN_FREEZE` | lowercase `verified` / `needs_rework` | casing + `verified` vs `PASSED` |

### Exact patch required

**L1 — `WORKREQUEST_FINAL_ARCHITECTURE` §7:** Reduce the persisted enum to `PASSED, FAILED, NEEDS_REWORK`.
- `PENDING` / `IN_PROGRESS` are **lifecycle stages, not persisted enum values** — represent "verification not yet decided" by the **absence** of a `QualityVerification` row (the row is created on submission) or via a separate non-enum flag; do not add them to `VerificationStatus`.
- `WAIVED` is not canonical; map manager/admin waivers onto an out-of-band mechanism (e.g., `AuditLog` + skip QV) rather than a status value, OR raise a **separate** freeze-revision request if a persisted `WAIVED` is genuinely required (out of scope here — L0 governs, so it is excluded).
- Add `NEEDS_REWORK` (rework requested; `rework_required = true`).

**L2 — `API_SPEC_V1_PATCH_V2` (quality-verification PATCH/response DTOs):** Replace `"status": "PENDING | APPROVED | REJECTED"` with:
```
"status": "PASSED | FAILED | NEEDS_REWORK"
```

**L3 — `BACKEND_EXECUTION_BLUEPRINT_V2` Migration 7 + Appendix B:**
```prisma
enum VerificationStatus {
  PASSED
  FAILED
  NEEDS_REWORK
}
```
- Drop `VERIFIED` (use `PASSED`) and `DISPUTED` (not canonical; handle disputes via `AuditLog` / attendance columns).

**L4 — `TESTING_MASTER_PLAN_FREEZE`:** Normalize casing and values: `verified → PASSED`, `needs_rework → NEEDS_REWORK`; add `FAILED` coverage. Update the `score < 60 → needs_rework` test to assert `NEEDS_REWORK` (uppercase) and align the threshold note with L0 + L1 PATCH_V1's `Hotel.quality_threshold` (default 70).

### Impact assessment
- **Type name + casing (medium):** confirm `VerificationStatus` everywhere; eliminate lowercase string statuses in L4 fixtures/tests.
- **Lifecycle-vs-persisted separation (medium):** `PENDING`/`IN_PROGRESS`/`WAIVED` claim/waiver semantics must be re-expressed without enum values; the L1 claim flow ("any active CHECKER may claim a PENDING QV") becomes a presence/assignment concern, not a status value.
- **Threshold consistency (low):** L4 uses 60, L1 PATCH_V1 sets `quality_threshold` default 70. Not an enum conflict, but flagged so the patched test threshold matches the governing default.

---

## 5. Validation — Backend BLOCK-01 and BLOCK-02

Both blocks are validated against L0 `PRISMA_SCHEMA_V2_FREEZE` and L1 `WORKREQUEST_FINAL_ARCHITECTURE_PATCH_V1` (B1).

### BLOCK-01 — `HotelWorkerStatus` enum is wrong — **VALID, PATCH-01 CONFIRMED CORRECT**

- L3 V2 defined `ACTIVE, INACTIVE, SUSPENDED`. L0 §2 freezes `INVITED, ACTIVE, SUSPENDED, REMOVED` (lifecycle `INVITED → ACTIVE ↔ SUSPENDED → REMOVED`).
- Backend `_PATCH_V1` PATCH-01 (`INVITED/ACTIVE/SUSPENDED/REMOVED`, default `INVITED`) **exactly matches L0**. No change to PATCH-01 required.
- L0 §6 "Resolved blockers" MP-4 independently confirms this correction.

**Required patch instruction:** Apply PATCH-01 as written. Cross-check the L3 `HotelWorker` invite-tracking fields (`invited_by/at`, `activated_at`, `removed_at/by`, `suspended_at/by`) against L0 §1/§3 — these are field-level additions, **not enum** changes, and are outside this spec's reconciliation scope; flag only, do not modify here. **Status: enum portion fully reconciled.**

### BLOCK-02 — `hotel_ids` scope enforcement — **VALID for WORKER/CHECKER; PATCH-02 NEEDS ONE AMENDMENT for MANAGER**

- BLOCK-02 correctly removes `User.hotel_ids` as the WORKER/CHECKER authorization source and routes enforcement through `HotelWorker` membership (`status = ACTIVE`). This matches L0 (Step 2 drops `hotel_ids` from the active authz path) and L1 PATCH_V1 **B1**, and corresponds to Report findings V5 / V8.
- **Divergence to patch:** PATCH-02 enforces the **MANAGER** path via `HotelWorker { role = MANAGER }`. The governing L1 PATCH_V1 **B1** states `User.hotel_ids` is **retained exclusively for MANAGER scoping** (and `SCHEMA_RECONCILIATION_DECISION` keeps a transitional `User.hotel_ids` for manager `checkHotelAccess()`). PATCH-02's manager path therefore over-reaches.

**Required patch instructions for BLOCK-02 / PATCH-02:**
1. **Keep unchanged** — WORKER/CHECKER enforcement via `HotelWorker` `{ user_id, hotel_id, status: ACTIVE }` lookup; removal of `hotel_ids` from the JWT payload; removal of `hotel_ids.includes(hotelId)` from `permissions.ts`; RBAC-matrix and Sprint-2 task rewording. These are all consistent with L0 + L1 B1.
2. **Amend the MANAGER path** — replace "MANAGER enforcement uses `HotelWorker` with `role = MANAGER`" with: *MANAGER hotel scoping uses the transitional `User.hotel_ids` per L1 PATCH_V1 B1 and `SCHEMA_RECONCILIATION_DECISION`; it must never be consulted for WORKER or CHECKER access.* This keeps `hotel_ids` out of the JWT (still a per-request lookup) but sources manager scope from the manager-only field, not a `HotelWorker` role row.
3. **Note (not an enum change):** This is an RBAC/authorization-source reconciliation, included per the task's "include any required patch instructions" clause. It does not alter any enum value set.

**BLOCK-02 status:** valid and required; apply PATCH-02 with the MANAGER-path amendment above.

---

## 6. Consolidated Patch Checklist

| # | Target doc | Enum / item | Action |
|---|---|---|---|
| 1 | L1 WORKREQUEST_FINAL_ARCHITECTURE | WorkRequestStatus | drop `IN_PROGRESS`,`COMPLETED`; add `EXPIRED` |
| 2 | L2 API_SPEC_V1_PATCH_V2 §5b | WorkRequestStatus | replace `OPEN/CLOSED/CANCELLED` with full L0 set |
| 3 | L3 BACKEND_EXECUTION_BLUEPRINT_V2 | WorkRequestStatus | L0 set; **reverse** PATCH-04 (DRAFT) & PATCH-07 (PARTIALLY_FILLED) |
| 4 | L1 | AssignmentStatus | re-key `ASSIGNED/CHECKED_*/ATTENDANCE_VERIFIED` → L0 set |
| 5 | L2 §5 | AssignmentStatus | `CONFIRMED\|IN_PROGRESS\|COMPLETED\|NO_SHOW\|CANCELLED\|REASSIGNED` |
| 6 | L3 | AssignmentStatus | L0 set; rename type `WorkerAssignmentStatus → AssignmentStatus`; resolves MINOR-01 |
| 7 | L4 TESTING_MASTER_PLAN_FREEZE | AssignmentStatus | initial state `ASSIGNED → CONFIRMED` in matrix + fixtures |
| 8 | L1 (+PATCH_V1 B7) | AttendanceStatus | L0 outcome set; drop progression states + `CANCELLED` |
| 9 | L3 | AttendanceStatus | L0 set; drop `CLOCKED_IN/OUT`; resolves MINOR-04 |
| 10 | L4 | AttendanceStatus | outcome set; convert status-string asserts to timestamp+outcome |
| 11 | L1 §7 | VerificationStatus | reduce to `PASSED/FAILED/NEEDS_REWORK`; drop `PENDING/IN_PROGRESS/WAIVED` |
| 12 | L2 (QV DTO) | VerificationStatus | replace `PENDING/APPROVED/REJECTED` |
| 13 | L3 | VerificationStatus | drop `VERIFIED/DISPUTED`; add `PASSED/FAILED` |
| 14 | L4 | VerificationStatus | uppercase + `verified→PASSED`, `needs_rework→NEEDS_REWORK`; threshold 70 |
| 15 | L3 _PATCH_V1 | BLOCK-01 / PATCH-01 | apply as-is (matches L0) |
| 16 | L3 _PATCH_V1 | BLOCK-02 / PATCH-02 | apply with MANAGER-path amendment (use manager-only `hotel_ids` per L1 B1) |

**Out of scope (per Report §5.1 / task):** mobile app-count conflict; field-level (non-enum) additions in PATCH-01/03/05; any change to entities, workflows, or implementation order. L0 enum value sets are unchanged by this spec — every patch moves a non-L0 document **toward** L0.

*End of ENUM_RECONCILIATION_PATCH_SPEC.md*
