# API_SPEC_V1 — Consistency Audit & Patch V1

**Document:** API_SPEC_V1_PATCH_V1.md  
**Auditing:** `docs/API_SPEC_V1.md`  
**Audit Date:** 2026-06-09  
**Auditor:** Claude Code  
**Status:** REJECT

---

## ⚠️ CRITICAL META-FINDING — Reference Documents Not Found

Before the section-by-section audit, a critical finding must be documented.

**The following 7 reference documents named in the audit request DO NOT EXIST** in any accessible location — not in the repository (`/home/user/hotel-crm/`) and not in Google Drive:

| # | Document Name | Status |
|---|---------------|--------|
| 1 | Hotel Worker Management Architecture | ❌ NOT FOUND |
| 2 | WorkRequest Final Architecture | ❌ NOT FOUND |
| 3 | Quality & Rating Architecture | ❌ NOT FOUND |
| 4 | Marketplace Refactor Plan | ❌ NOT FOUND |
| 5 | Mobile Product Blueprint Patch V1 | ❌ NOT FOUND |
| 6 | Prisma Schema V2 | ❌ NOT FOUND |
| 7 | Backend Execution Blueprint V2 | ❌ NOT FOUND |

**Available authoritative documents used for this audit:**

| Document | Location | Authority |
|----------|----------|-----------|
| `MASTER_ARCHITECTURE_v2.0.md` | Google Drive (`1D72ntyCBjcfLnBE217tecHBCToDlTk3s`) | PRIMARY — supersedes all prior docs |
| `RBAC_PERMISSION_MATRIX_v1.0.md` | Google Drive (`1E305G7z40CThPadno7-_RZgEXmg1mYVE`) | SECONDARY |
| `FINAL_DECISIONS_SUMMARY.md` | Google Drive (`1s-aBzmXelGxAZPGwiNJ86u6C_iE4ehRY`) | SECONDARY |
| `backend/prisma/schema.prisma` (V1) | Repository | DATABASE GROUND TRUTH |

**Consequence:** Sections referencing "frozen decisions" from the 7 missing documents are audited using the user's stated rules as authoritative, cross-referenced against the documents that do exist. Violations are flagged with confidence level: **CONFIRMED** (verifiable from available docs) or **PENDING** (requires missing docs to confirm).

---

## SECTION A — Legacy Architecture Leakage

### A.1 — Search Results: All Legacy Entity References

**Occurrences of `Room` / `Rooms`:**

| Location in API_SPEC_V1 | Type | Line Reference |
|-------------------------|------|----------------|
| `GET /hotels/:id/rooms` | Full endpoint definition | Section 2, Hotels |
| `POST /hotels/:id/rooms` | Full endpoint definition | Section 2, Hotels |
| `PATCH /hotels/:id/rooms/:roomId` | Full endpoint definition | Section 2, Hotels |
| `GET /hotels/:id` response DTO | Nested `rooms[]` array in hotel detail | Section 2 |
| `GET /quality/verifications` response | `task.room.number`, `task.room.type` | Section 8 |
| `GET /ratings` response | Implicitly via task chain | Section 9 |
| `GET /assignments/:id` response | `daily_operations[].room_id` not shown but implied | Section 6 |
| Shared Schemas — QV object | `task → room` nested reference | Section 8 |

**Total Room references: 8 locations across 5 sections.**

---

**Occurrences of `Task` / `Tasks`:**

| Location in API_SPEC_V1 | Type |
|-------------------------|------|
| `POST /quality/verifications` — Request DTO `task_id` field | Anchor field |
| `POST /quality/verifications` — Validation rule "task must be COMPLETED" | Business logic |
| `GET /quality/verifications` — Response DTO `task` nested object | Response shape |
| `GET /quality/verifications/:id` — Full QV object | Response shape |
| `PATCH /quality/verifications/:id` — Validation "Edit window (24h) of creation" | Implicitly task-based |
| `POST /ratings` — Request DTO `task_id` field | Anchor field |
| `POST /ratings` — Request DTO `worker_id` field | Secondary anchor |
| `POST /ratings` — Validation "task must be COMPLETED" | Business logic |
| `GET /ratings` — Response DTO `task_id` field | Response field |
| `GET /workers/:userId/ratings` — Response shape | Response field |
| Audit Event `QUALITY.VERIFICATION_SUBMITTED` — `resource_type: Task` | Audit reference |

**Total Task references: 11 locations across 3 sections.**

---

**Occurrences of `TaskPhoto`:**

| Location | Type |
|----------|------|
| No direct endpoint for TaskPhoto | Missing endpoint |
| Photo upload not present in spec | Missing feature |

**TaskPhoto has 0 explicit references but 0 endpoints for photo upload — the entity was intentionally excluded from spec endpoints, but the underlying assumption it exists persists through Task references.**

---

**Occurrences of `DailyOperation`:**

| Location in API_SPEC_V1 | Type |
|-------------------------|------|
| `GET /assignments/:id` response — `daily_operations: []` array | Response field |
| Section 7 Attendance — clock-in/clock-out endpoints implicitly operate on assignment → DailyOperation chain | Implied dependency |

**Total DailyOperation references: 2 locations.**

---

**Occurrences of `Calendar`:**

| Location | Result |
|----------|--------|
| Full text search of API_SPEC_V1.md | **0 occurrences** — Calendar module not referenced |

---

### A.2 — MVP Removal Verification

**Per the user's stated frozen architecture (Marketplace Refactor Plan), the following are REMOVED from MVP:**

| Entity | Removed From MVP | API_SPEC_V1 Status | Violation |
|--------|------------------|--------------------|-----------|
| `Room` | YES (per user) | 3 full endpoints + 5 DTO references | ❌ VIOLATION |
| `Task` | YES (per user) | 11 references as anchor field in QV and Rating | ❌ VIOLATION |
| `TaskPhoto` | YES (per user) | 0 explicit endpoints, but implicitly assumed | ⚠️ PARTIAL |
| `DailyOperation` | YES (per user) | 2 references embedded in Assignment | ❌ VIOLATION |
| `Calendar` | (already deferred in MA v2.0) | 0 references | ✅ CLEAN |

**NOTE:** `MASTER_ARCHITECTURE_v2.0.md` Section 4 explicitly INCLUDES Rooms, Tasks, TaskPhotos, and DailyOperations in the Phase 1 MVP. The contradiction between the available authoritative doc and the user's stated frozen decisions indicates the Marketplace Refactor Plan superseded MASTER_ARCHITECTURE_v2.0.md AFTER May 27, 2026. Confidence: **PENDING** (requires Marketplace Refactor Plan to confirm).

---

### A.3 — Endpoints That Must Be Deleted

Per frozen architecture (user-stated):

| Endpoint | Reason |
|----------|--------|
| `GET /hotels/:id/rooms` | Room entity removed from MVP |
| `POST /hotels/:id/rooms` | Room entity removed from MVP |
| `PATCH /hotels/:id/rooms/:roomId` | Room entity removed from MVP |

---

## SECTION B — Membership Model

### B.1 — Search Results: hotel_ids References

| Location in API_SPEC_V1 | Reference Type |
|-------------------------|----------------|
| `GET /auth/me` — Response DTO: `"hotel_ids": ["clx1hotel001"]` | Field in user object |
| `GET /hotels` — Description: "Managers see only their assigned hotels" | RBAC rule |
| `GET /hotels/:id` — RBAC: "MANAGER (own hotels)" | Scope rule |
| `POST /hotels/:id/rooms` — RBAC: "MANAGER (own hotels)" | Scope rule |
| `PATCH /hotels/:id/rooms/:roomId` — RBAC: "MANAGER (own hotels)" | Scope rule |
| `GET /hotels/:id/workers` — RBAC: "MANAGER (own hotels)" | Scope rule |
| `POST /hotels/:id/workers` — RBAC: "MANAGER (own hotels)" | Scope rule |
| `DELETE /hotels/:id/workers/:userId` — RBAC: "MANAGER (own hotels)" | Scope rule |
| `GET /workers/:userId` — RBAC: "MANAGER (worker must be in own hotel)" | Scope rule |
| `PATCH /workers/:userId/activate` — ADMIN only | Correct — no hotel_ids |
| `GET /work-requests` — RBAC: "MANAGER (own hotels)" | Scope rule |
| `GET /ratings/leaderboard` — Query param `hotel_id` scoping | Filter |
| `RBAC Matrix` table — "(own hotels)" appears in 28 cells | RBAC matrix |

**Total hotel_ids-based scoping references: 13+ direct references, 28 RBAC matrix cells.**

---

### B.2 — Architecture Violation Assessment

**User-stated rule:** Marketplace architecture removed `User.hotel_ids[]`. Membership is now enforced through a `HotelWorker` join table.

**Prisma Schema V1 ground truth:**
```prisma
model User {
  hotel_ids String[]  // ← STILL EXISTS in schema.prisma (V1)
}
```

**No `HotelWorker` model exists in the current Prisma schema (V1).**

**API_SPEC_V1 posture:** The spec has a `HotelWorker` module (`POST /hotels/:id/workers`, `DELETE /hotels/:id/workers/:userId`) but the underlying mechanic described internally implies it modifies `user.hotel_ids[]` — NOT a join table.

**Violations:**

| Issue | Severity | Confidence |
|-------|----------|------------|
| `GET /auth/me` response includes `hotel_ids` array field | MAJOR | PENDING |
| All RBAC scope checks reference "own hotels" but implementation would use hotel_ids lookup | MAJOR | PENDING |
| `HotelWorker` module semantics imply hotel_ids mutation, not join-table insert | MAJOR | PENDING |
| `POST /hotels/:id/workers` response DTO has no `HotelWorker` record shape | MAJOR | PENDING |

**Required Replacement Pattern:**

All scoping logic stated as "MANAGER (own hotels)" must change from:
```typescript
// OLD — hotel_ids array lookup
user.hotel_ids.includes(hotel_id)
```
To:
```typescript
// NEW — HotelWorker join table lookup
HotelWorker.exists({ user_id: user.id, hotel_id: hotel_id, is_active: true })
```

The `GET /auth/me` response DTO must remove `hotel_ids` field entirely. Scoping is resolved at query time through HotelWorker lookups, not a cached array on the user object.

---

## SECTION C — WorkApplication Flow

### C.1 — Marketplace Flow Validation

**Frozen architecture (user-stated):**
```
WorkRequest → WorkApplication → WorkerAssignment
```
Workers apply → Managers review → Assignment created on acceptance.

**API_SPEC_V1 endpoints for this flow:**

| Endpoint | Status |
|----------|--------|
| `POST /work-requests` — create request | ✅ Correct |
| `POST /work-requests/:id/apply` — worker applies | ✅ Correct |
| `GET /work-requests/:id/applications` — manager reviews | ✅ Correct |
| `PATCH /work-requests/:id/applications/:id` — accept/reject | ✅ Correct |
| `DELETE /work-requests/:id/applications/:id` — withdraw | ✅ Correct |
| **`POST /work-requests/:id/assign`** — **DIRECT assignment** | ❌ **VIOLATION** |

---

### C.2 — `POST /work-requests/:id/assign` Audit

**Current spec description:** "Directly assign workers to a work request (bypass application flow)."

**The spec explicitly acknowledges this bypasses the application flow.**

**Assessment:** This endpoint is a direct violation of the frozen marketplace architecture. It is equivalent to the `POST /api/v1/staffing/work-requests/{id}/assign-workers` endpoint from the legacy MASTER_ARCHITECTURE_v2.0.md (Section 4, Rule 7, Step 3) — which predates the Marketplace Refactor Plan.

**MASTER_ARCHITECTURE_v2.0.md Rule 7 (Manager Workflow) included this flow as the ONLY assignment mechanism.** The Marketplace Refactor Plan replaced it with WorkApplication. The spec includes BOTH, creating a dual-path inconsistency.

**Decision:** `POST /work-requests/:id/assign` MUST be removed. Assignment creation must only occur via `PATCH /work-requests/:id/applications/:applicationId` with `status: "ACCEPTED"`.

---

## SECTION D — WorkerAssignment

### D.1 — Creation

| Path | Status | Issue |
|------|--------|-------|
| Via `POST /work-requests/:id/assign` | ❌ Remove | Direct bypass violates marketplace flow |
| Via `PATCH /work-requests/:id/applications/:id` with `status: ACCEPTED` | ✅ Correct | Proper marketplace path |

The spec states "Accepting an application automatically creates a WorkerAssignment record" — correct behavior, but must be the ONLY creation path.

### D.2 — Cancellation

`PATCH /assignments/:id/cancel` is correctly specified.

**Mismatch:** The spec says cancellation is blocked if assignment is `COMPLETED` or `CANCELLED`. Per `MASTER_ARCHITECTURE_v2.0.md` Rule 4, cancellation of an `IN_PROGRESS` assignment requires special handling ("Emergency cancel requires audit log note"). The spec does not distinguish between ASSIGNED and IN_PROGRESS cancellation — it blocks both by returning `INVALID_STATE_TRANSITION`. This oversimplifies the rule.

**Required:** Add `IN_PROGRESS` as a separate case for cancellation with a mandatory `reason` field and forced audit log entry.

### D.3 — Reassignment

`POST /assignments/:id/reassign` is specified.

**Mismatch:** Per `MASTER_ARCHITECTURE_v2.0.md` Rule 3, reassignment is only allowed when assignment status is `ASSIGNED` (not started). The spec says "CANNOT reassign if COMPLETED or CANCELLED" but does NOT explicitly block reassignment of `IN_PROGRESS` assignments. This is a gap — `IN_PROGRESS` must also block reassignment.

**Required:** Add `IN_PROGRESS` to the error conditions table for `POST /assignments/:id/reassign`.

### D.4 — Status Lifecycle

**Specified lifecycle:** `ASSIGNED → IN_PROGRESS → COMPLETED | CANCELLED | REASSIGNED`

Per frozen architecture, `IN_PROGRESS` status is triggered by clock-in (`POST /assignments/:id/clock-in`), which correctly maps to `started_at`. `COMPLETED` is triggered by clock-out. This is consistent.

**Missing:** The spec doesn't define what happens to `WorkRequest` status when all assignments are cancelled — whether it reverts to `OPEN`. This must be specified in the cancel endpoint response DTO.

---

## SECTION E — Attendance

### E.1 — Endpoint Coverage

| Endpoint | Status |
|----------|--------|
| `POST /assignments/:id/clock-in` | ✅ Present |
| `POST /assignments/:id/clock-out` | ✅ Present |
| `GET /hotels/:id/attendance` | ✅ Present |
| `GET /workers/:userId/attendance` | ✅ Present |

### E.2 — Missing Endpoints

| Missing Endpoint | Justification |
|-----------------|---------------|
| `PATCH /assignments/:id/attendance` — Manager manual correction | Managers must be able to correct clock-in/clock-out time when worker forgets to clock in/out. No such endpoint exists. |
| `GET /assignments/:id/attendance` — Fetch single assignment attendance record | The spec has no way to retrieve attendance for a single assignment directly. |

### E.3 — Missing Fields

**`POST /assignments/:id/clock-in` request:**

| Missing Field | Required? | Reason |
|--------------|-----------|--------|
| `device_id` | Optional | Platform requirement for deduplication |
| `clock_in_time` | Optional | Allows manager proxy with specific time (spec only records `now()`) |

**`POST /assignments/:id/clock-out` response:**

| Missing Field | Required? |
|--------------|-----------|
| `work_request` summary (hotel name, position) | Should be returned for mobile confirmation UI |

**`GET /hotels/:id/attendance` response:**

| Missing Field | Required? |
|--------------|-----------|
| `late_count` in summary object | Missing — workers who clocked in after shift_start_time |
| `total_hours_worked` in summary | Missing — aggregate for operational reporting |

### E.4 — Validation Gap

`POST /assignments/:id/clock-in` — no validation that current time is within reasonable range of `shift_start_time`. A worker should not be able to clock into a shift 3 days in the future. Must add: clock-in only allowed within configurable window (e.g., 2 hours before shift start).

---

## SECTION F — Quality Verification

### F.1 — Anchor Field Violations

**Frozen architecture rule:** QualityVerification must anchor to `worker_assignment_id`, NOT `task_id`.

**Current Prisma schema (V1):**
```prisma
model QualityVerification {
  task_id  String  @unique  // ← anchored to task
  task     Task    @relation(...)
}
```

**API_SPEC_V1 violations:**

| Location | Violation |
|----------|-----------|
| `POST /quality/verifications` — Request DTO: `"task_id": "clx1task001"` | ❌ Wrong anchor field |
| `POST /quality/verifications` — Validation: `task must be COMPLETED` | ❌ Wrong lifecycle check |
| `POST /quality/verifications` — Error: `422 INVALID_STATE_TRANSITION: Task not in COMPLETED status` | ❌ Wrong entity |
| `GET /quality/verifications` — Response: `task` nested object with `description`, `room` | ❌ Wrong nested entity |
| `GET /quality/verifications/:id` — Same task nesting | ❌ Wrong nested entity |
| `PATCH /quality/verifications/:id` — No anchor change but same wrong base | ❌ Wrong base |
| `POST /ratings` — Validation: `"No quality verification exists for this task by this checker"` | ❌ Wrong entity ref |
| Audit Event: `resource: Task` implied in QV creation | ❌ Wrong resource |

**Required replacement:**

```json
// OLD (VIOLATION)
{
  "task_id": "clx1task001"
}

// NEW (CORRECT)
{
  "worker_assignment_id": "clx1wa001"
}
```

All validation rules must change:
- OLD: `task.status == COMPLETED`
- NEW: `workerAssignment.status == COMPLETED`

All response DTOs must change:
- OLD: `task: { description, room: { number, type } }`
- NEW: `worker_assignment: { work_request: { position, shift_date }, worker: { ... } }`

### F.2 — Complete List of Violations

**Count: 8 violations across 4 endpoints and 2 response DTOs.**

---

## SECTION G — Rating

### G.1 — Anchor Field Violations

**Frozen architecture rule:** Rating must anchor to `worker_assignment_id`, NOT `task_id`.

**Current Prisma schema (V1):**
```prisma
model Rating {
  task_id  String  @unique  // ← anchored to task
  task     Task    @relation(...)
}
```

**API_SPEC_V1 violations:**

| Location | Violation |
|----------|-----------|
| `POST /ratings` — Request DTO: `"task_id": "clx1task001"` | ❌ Wrong anchor field |
| `POST /ratings` — Request DTO: `"worker_id": "clx1user001"` | ⚠️ Redundant if anchored to assignment (worker already on assignment) |
| `POST /ratings` — Validation: `task must be COMPLETED` | ❌ Wrong lifecycle check |
| `POST /ratings` — Error condition: `422 INVALID_STATE_TRANSITION: Task not COMPLETED` | ❌ Wrong entity |
| `POST /ratings` — Error condition: `422 OPERATION_NOT_ALLOWED: No quality verification exists for this task` | ❌ Wrong entity ref |
| `GET /ratings` — Response DTO: `task_id` field in rating object | ❌ Wrong field |
| `GET /workers/:userId/ratings` — Response description | ❌ Wrong base entity |
| Audit Event `RATING.SUBMITTED` — implied task resource | ❌ Wrong resource |

**Required replacement:**

```json
// OLD (VIOLATION)
{
  "task_id": "clx1task001",
  "worker_id": "clx1user001",
  "score": 5
}

// NEW (CORRECT)
{
  "worker_assignment_id": "clx1wa001",
  "score": 5,
  "comment": "Outstanding work"
}
```

Worker identity is derived from the WorkerAssignment — `worker_id` field is redundant and should be removed.

### G.2 — Complete List of Violations

**Count: 8 violations across 3 endpoints and 1 response DTO.**

---

## SECTION H — Notifications

### H.1 — Current Notification Types in Spec

```
TASK_ASSIGNED
TASK_COMPLETED
QUALITY_VERIFIED
RATING_RECEIVED
WORK_REQUEST_OPEN
ASSIGNMENT_CREATED
ASSIGNMENT_CANCELLED
ASSIGNMENT_REASSIGNED
WORK_REQUEST_FILLED
DOCUMENT_EXPIRING
PAYROLL_APPROVED
PAYROLL_PAID
```

### H.2 — Verification Against MASTER_ARCHITECTURE_v2.0.md

**MASTER_ARCHITECTURE_v2.0.md Section 12 defines these notification events:**

```
1. TASK_ASSIGNED
2. TASK_COMPLETED
3. QUALITY_VERIFIED
4. RATING_RECEIVED
5. CONTRACT_EXPIRING
6. DOCUMENT_UPLOADED
```

### H.3 — Obsolete Notification Types

Per the frozen marketplace architecture (Tasks removed, marketplace flow added):

| Type | Status | Reason |
|------|--------|--------|
| `TASK_ASSIGNED` | ❌ OBSOLETE | Task entity removed from MVP |
| `TASK_COMPLETED` | ❌ OBSOLETE | Task entity removed from MVP |

**IMPORTANT:** `MASTER_ARCHITECTURE_v2.0.md` explicitly includes TASK_ASSIGNED and TASK_COMPLETED. Marking these obsolete requires confirmation from Marketplace Refactor Plan. **CONFIDENCE: PENDING.**

### H.4 — Missing Notification Types

For the marketplace WorkApplication flow to be complete, these notifications are required but absent from the spec:

| Missing Type | Trigger | Recipients |
|-------------|---------|-----------|
| `WORK_APPLICATION_RECEIVED` | Worker submits application | Manager |
| `WORK_APPLICATION_ACCEPTED` | Manager accepts application | Worker |
| `WORK_APPLICATION_REJECTED` | Manager rejects application | Worker |
| `WORK_APPLICATION_WITHDRAWN` | Worker withdraws | Manager |
| `CONTRACT_EXPIRING` | Contract expiry approaching | Manager (from MASTER_ARCHITECTURE — present in source doc but missing from spec) |
| `DOCUMENT_UPLOADED` | New document uploaded | Manager (from MASTER_ARCHITECTURE — missing from spec) |
| `SHIFT_REMINDER` | Shift starting in X hours | Worker |
| `CLOCK_IN_MISSED` | Worker hasn't clocked in at shift start | Manager |

**MASTER_ARCHITECTURE violation:** `CONTRACT_EXPIRING` and `DOCUMENT_UPLOADED` are defined in the authoritative doc but missing from the spec. This is a **CONFIRMED** violation (does not require missing docs).

---

## SECTION I — RBAC

### I.1 — Verified Mismatches Against RBAC_PERMISSION_MATRIX_v1.0.md

| Endpoint | API_SPEC_V1 Rule | RBAC_MATRIX_v1.0 Rule | Verdict |
|----------|------------------|-----------------------|---------|
| `POST /auth/signup` | Public; WORKER/CHECKER by default; MANAGER/ADMIN requires existing ADMIN token | **Only ADMIN can create users. Signup is admin-initiated.** | ❌ MISMATCH |
| `GET /hotels` | CHECKER allowed | CHECKER: ❌ cannot list hotels | ❌ MISMATCH |
| `GET /hotels/:id` | CHECKER, WORKER allowed (own hotels) | CHECKER: view own hotel ✅; WORKER: ❌ not listed in Hotels section | ⚠️ PARTIAL |
| `GET /ratings` (list all ratings) | CHECKER can list own ratings | RBAC: Checker CANNOT list ratings by hotel. Only workers see own ratings. | ❌ MISMATCH |
| `GET /work-requests` | WORKER (status=OPEN) allowed | RBAC matrix: Worker CANNOT see work requests at all | ❌ MISMATCH |
| `GET /work-requests/:id` | WORKER (status=OPEN) allowed | RBAC matrix: No worker access to work requests | ❌ MISMATCH |
| `GET /assignments` | CHECKER not listed | RBAC matrix: Checker has no assignment visibility | ✅ CORRECT |
| `POST /work-requests/:id/assign` | MANAGER | Already marked for removal (Section C) | N/A |
| `PATCH /assignments/:id/cancel` | MANAGER (own hotels, own request) | ✅ Matches | ✅ CORRECT |
| `GET /workers/:userId/ratings` | CHECKER can view | RBAC matrix doesn't explicitly grant checker rating list access | ⚠️ AMBIGUOUS |
| `GET /ratings/leaderboard` | CHECKER allowed | RBAC matrix: `view leaderboard (own hotel)` = ✅ Admin, Manager, Checker, Worker | ✅ CORRECT |
| `POST /work-requests/:id/apply` | WORKER (own hotel) | **Note:** Marketplace introduces worker visibility of work requests, which conflicts with RBAC_MATRIX_v1.0. This is an expected conflict — the Marketplace Refactor Plan superseded RBAC v1.0 on this point. | ⚠️ PENDING |

### I.2 — Critical RBAC Violations (Confirmed)

**I.2.1 — Signup Registration Model**

`RBAC_PERMISSION_MATRIX_v1.0.md` states:
> "Only admin can create new users (signup endpoint)"

`API_SPEC_V1` states:
> "POST /auth/signup — Public (no auth required)"

This is a fundamental conflict. The spec allows self-registration; the RBAC matrix requires admin-initiated user creation.

**Note:** The frozen Marketplace architecture likely restored public worker self-registration (marketplace model requires workers to sign up independently). However, without Marketplace Refactor Plan confirmation, this cannot be resolved. **CONFIDENCE: PENDING.**

**I.2.2 — Checker Hotel Access**

`RBAC_PERMISSION_MATRIX_v1.0.md` Hotels section:
> Checker: list = ❌, view = ❌

`API_SPEC_V1 GET /hotels`: Checker = ✅

**This is a CONFIRMED violation** against the available authoritative RBAC document.

**I.2.3 — Worker Work Request Visibility**

`RBAC_PERMISSION_MATRIX_v1.0.md` Work Requests section:
> Workers: list = ❌, view = ❌

`API_SPEC_V1 GET /work-requests`: Workers (status=OPEN) = ✅

The RBAC matrix was written before the marketplace flow was introduced. The spec's worker visibility of OPEN requests is correct for a marketplace model but conflicts with the frozen RBAC_MATRIX_v1.0. **CONFIDENCE: PENDING (Marketplace Refactor Plan needed).**

---

## SECTION J — Prisma Consistency

### J.1 — API DTOs vs Prisma Schema V1

Auditing every module against `backend/prisma/schema.prisma`:

#### Auth Module

| DTO Field | Schema Field | Status |
|-----------|-------------|--------|
| `user.id` | `User.id` (CUID) | ✅ |
| `user.email` | `User.email` | ✅ |
| `user.first_name` | `User.first_name` | ✅ |
| `user.last_name` | `User.last_name` | ✅ |
| `user.phone` | `User.phone` (optional) | ✅ |
| `user.profile_photo_url` | `User.profile_photo_url` (optional) | ✅ |
| `user.role` | `User.role` (enum: WORKER/CHECKER/MANAGER/ADMIN) | ✅ |
| `user.hotel_ids` | `User.hotel_ids String[]` | ✅ Schema V1 — ❌ Marketplace violation (see Section B) |
| `user.permissions` | `User.permissions String[]` | ✅ |
| `user.is_active` | `User.is_active` | ✅ |

#### Hotels Module

| DTO Field | Schema Field | Status |
|-----------|-------------|--------|
| `hotel.id` | `Hotel.id` | ✅ |
| `hotel.name` | `Hotel.name` | ✅ |
| `hotel.city` | `Hotel.city` | ✅ |
| `hotel.country` | `Hotel.country` | ✅ |
| `hotel.address` | `Hotel.address` | ✅ |
| `hotel.timezone` | `Hotel.timezone` | ✅ |
| `hotel.is_active` | `Hotel.is_active` | ✅ |
| `hotel._counts.rooms` | `Hotel._count.rooms` | ✅ |
| `hotel._counts.active_workers` | Not a DB field | ⚠️ Computed |
| `room.status` | `Room.status String` (clean/dirty/occupied/maintenance) | ✅ |
| `room.type` | `Room.type String` (single/double/suite) | ✅ |

#### WorkRequest Module

| DTO Field | Schema Field | Status |
|-----------|-------------|--------|
| `work_request.hotel_id` | `WorkRequest.hotel_id` | ✅ |
| `work_request.position` | `WorkRequest.position String` | ✅ |
| `work_request.workers_needed` | `WorkRequest.workers_needed Int` | ✅ |
| `work_request.workers_filled` | Not a DB field | ⚠️ Computed from assignment count |
| `work_request.shift_date` | `WorkRequest.shift_date DateTime` | ⚠️ Spec uses `"2026-06-15"` (date string), schema uses `DateTime` |
| `work_request.shift_start_time` | `WorkRequest.shift_start_time String` (HH:MM) | ✅ |
| `work_request.shift_end_time` | `WorkRequest.shift_end_time String` | ✅ |
| `work_request.status` | `WorkRequest.status String` (OPEN/PARTIALLY_FILLED/FILLED/CANCELLED) | ✅ |
| `work_request.filled_at` | `WorkRequest.filled_at DateTime?` | ✅ |
| `work_request.cancelled_at` | `WorkRequest.cancelled_at DateTime?` | ✅ |

#### WorkerAssignment Module

| DTO Field | Schema Field | Status |
|-----------|-------------|--------|
| `assignment.id` | `WorkerAssignment.id` | ✅ |
| `assignment.worker_id` | `WorkerAssignment.worker_id` | ✅ |
| `assignment.work_request_id` | `WorkerAssignment.work_request_id` | ✅ |
| `assignment.assigned_by` | `WorkerAssignment.assigned_by_manager_id` | ✅ |
| `assignment.status` | `WorkerAssignment.status String` (ASSIGNED/IN_PROGRESS/COMPLETED/CANCELLED/REASSIGNED) | ✅ |
| `assignment.started_at` | `WorkerAssignment.started_at DateTime?` | ✅ |
| `assignment.completed_at` | `WorkerAssignment.completed_at DateTime?` | ✅ |
| `assignment.previous_assignment_id` | `WorkerAssignment.previous_assignment_id String?` | ✅ |
| `assignment.daily_operations` | `WorkerAssignment.daily_operations DailyOperation[]` | ⚠️ Present in schema V1, should be removed per Marketplace Refactor |

#### QualityVerification Module

| DTO Field | Schema Field | Status |
|-----------|-------------|--------|
| `verification.task_id` | `QualityVerification.task_id String @unique` | ✅ Schema V1 — ❌ Must become `worker_assignment_id` in V2 |
| `verification.verified_by_checker_id` | `QualityVerification.verified_by_checker_id` | ✅ |
| `verification.score` | `QualityVerification.score Int` (0-100) | ✅ |
| `verification.status` | `QualityVerification.status String` (verified/needs_rework) | ✅ |

#### Rating Module

| DTO Field | Schema Field | Status |
|-----------|-------------|--------|
| `rating.task_id` | `Rating.task_id String @unique` | ✅ Schema V1 — ❌ Must become `worker_assignment_id` in V2 |
| `rating.worker_id` | `Rating.worker_id` | ✅ Schema V1 — ⚠️ Redundant if using assignment anchor |
| `rating.rated_by_checker_id` | `Rating.rated_by_checker_id` | ✅ |
| `rating.score` | `Rating.score Int` (0-5) | ✅ |
| `rating.comment` | `Rating.comment String?` | ✅ |

#### Notifications Module

| DTO Field | Schema Field | Status |
|-----------|-------------|--------|
| `notification.type` | `Notification.type String` | ✅ |
| `notification.title` | `Notification.title String` | ✅ |
| `notification.message` | `Notification.message String` | ✅ |
| `notification.data` | `Notification.data Json?` | ✅ |
| `notification.is_read` | `Notification.is_read Boolean` | ✅ |
| `notification.read_at` | `Notification.read_at DateTime?` | ✅ |
| `unread_count` in list response | Computed field | ⚠️ Not in schema, must be aggregated |

### J.2 — Missing Fields in API DTOs (Not in Spec but in Schema)

| Schema Field | Model | Missing From |
|-------------|-------|-------------|
| `WorkerAssignment.reassigned_at` | WorkerAssignment | GET /assignments/:id response |
| `Contract.contract_number` | Contract | Not referenced in spec (HR module not covered) |
| `WorkRequest.notes` | WorkRequest | GET /work-requests response item ✅ Present |
| `QualityVerification.updated_at` | QualityVerification | PATCH /quality/verifications/:id response |
| `User.deleted_at` | User | Admin user management endpoints |

### J.3 — Enum Mismatches

| Field | Spec Says | Schema Says | Status |
|-------|-----------|-------------|--------|
| `UserRole` | WORKER, CHECKER, MANAGER, ADMIN | WORKER, CHECKER, MANAGER, ADMIN | ✅ |
| `TaskStatus` | ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED | ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED | ✅ (but Task entity itself may be removed) |
| `QV.status` | `verified`, `needs_rework` (lowercase) | `"verified"`, `"needs_rework"` (String, not enum) | ✅ |
| `Rating.score` | 1–5 in validation rule | `Int // 0-5 stars` in schema comment | ⚠️ MISMATCH — spec says min 1, schema allows 0 |
| `work_request.status` | OPEN, PARTIALLY_FILLED, FILLED, CANCELLED (uppercase) | String with same values | ✅ |

---

## Summary of Findings

---

## 1. BLOCKER Issues

> These prevent implementation. Must be resolved before any code is written against this spec.

| # | Issue | Section | Confidence |
|---|-------|---------|------------|
| B-1 | **7 reference documents not found** — Complete audit cannot be performed without Marketplace Refactor Plan, Prisma Schema V2, Backend Execution Blueprint V2, Hotel Worker Management Architecture, WorkRequest Final Architecture, Quality & Rating Architecture, Mobile Product Blueprint Patch V1 | Meta | CONFIRMED |
| B-2 | **QualityVerification anchored to `task_id` instead of `worker_assignment_id`** — Affects entire QV module. 8 violations across request DTOs, response DTOs, validation rules, and error codes | Section F | PENDING |
| B-3 | **Rating anchored to `task_id` instead of `worker_assignment_id`** — Affects entire Rating module. 8 violations | Section G | PENDING |
| B-4 | **`POST /work-requests/:id/assign` bypasses WorkApplication flow** — Direct assignment violates the frozen `WorkRequest → WorkApplication → WorkerAssignment` chain | Section C | PENDING |
| B-5 | **Room endpoints present in spec (`GET/POST/PATCH /hotels/:id/rooms`)** — 3 endpoints for a removed entity | Section A | PENDING |
| B-6 | **`task_id` used as anchor throughout spec but Task entity removed from MVP** — 11 references across QV and Rating modules | Section A, F, G | PENDING |

---

## 2. MAJOR Issues

| # | Issue | Section | Confidence |
|---|-------|---------|------------|
| M-1 | **`hotel_ids[]` scoping throughout spec** — All RBAC enforcement describes hotel_ids array lookups. Must be replaced with HotelWorker join table queries. Affects 13+ endpoint descriptions and entire RBAC matrix | Section B | PENDING |
| M-2 | **`GET /auth/me` response includes `hotel_ids` field** — Field must be removed when HotelWorker replaces hotel_ids array | Section B | PENDING |
| M-3 | **Checker RBAC on `GET /hotels`** — Spec grants Checker access to hotel listing; RBAC_PERMISSION_MATRIX_v1.0 explicitly denies it | Section I | CONFIRMED |
| M-4 | **`DailyOperation` embedded in `GET /assignments/:id` response** — Entity should be removed per Marketplace Refactor; still present as nested object | Section A, D | PENDING |
| M-5 | **Missing `CONTRACT_EXPIRING` notification type** — Defined in MASTER_ARCHITECTURE_v2.0 Section 12 but absent from spec | Section H | CONFIRMED |
| M-6 | **Missing `DOCUMENT_UPLOADED` notification type** — Defined in MASTER_ARCHITECTURE_v2.0 Section 12 but absent from spec | Section H | CONFIRMED |
| M-7 | **Missing WorkApplication notification types** — `WORK_APPLICATION_RECEIVED`, `WORK_APPLICATION_ACCEPTED`, `WORK_APPLICATION_REJECTED` not in spec but required for marketplace flow | Section H | PENDING |
| M-8 | **`IN_PROGRESS` not blocked in `POST /assignments/:id/reassign`** — Per Rule 3 of MASTER_ARCHITECTURE, reassignment forbidden once worker has started. Spec only blocks COMPLETED/CANCELLED | Section D | CONFIRMED |
| M-9 | **Rating `score` range mismatch** — Spec requires min 1, schema comment says 0-5. Needs resolution | Section J | CONFIRMED |
| M-10 | **`POST /hotels/:id/workers` response DTO has no `HotelWorker` record shape** — When membership moves to join table, POST response must return HotelWorker record, not just `{user_id, hotel_id, added_at}` | Section B | PENDING |

---

## 3. MINOR Issues

| # | Issue | Section | Confidence |
|---|-------|---------|------------|
| m-1 | **Clock-in time window validation missing** — No guard against clocking into future/past shifts beyond reasonable window | Section E | CONFIRMED |
| m-2 | **`GET /hotels/:id/attendance` missing `late_count` and `total_hours_worked` in summary** | Section E | CONFIRMED |
| m-3 | **No manager attendance correction endpoint** — `PATCH /assignments/:id/attendance` missing | Section E | CONFIRMED |
| m-4 | **`work_request.workers_filled` is a computed field not in schema** — Spec exposes it as a plain DTO field without noting it is aggregated | Section J | CONFIRMED |
| m-5 | **`shift_date` type inconsistency** — Spec uses date string `"2026-06-15"` but Prisma schema stores as `DateTime` | Section J | CONFIRMED |
| m-6 | **`WORK_REQUEST_OPEN` notification type** — Spec lists this but MASTER_ARCHITECTURE_v2.0 does not. Needs source | Section H | CONFIRMED |
| m-7 | **`PAYROLL_APPROVED` and `PAYROLL_PAID` notification types** — Not in MASTER_ARCHITECTURE_v2.0 notification events. Source needed | Section H | CONFIRMED |
| m-8 | **`QualityVerification.updated_at` missing from PATCH response** | Section J | CONFIRMED |
| m-9 | **WorkRequest cancellation response missing `workers_reverted` field** — When request cancelled, assignments also cancelled; affected workers not reflected in response | Section D | CONFIRMED |
| m-10 | **Rate limiting not defined for `POST /work-requests/:id/apply`** — Application spam attack vector unguarded | Section E | CONFIRMED |

---

## 4. Required Endpoint Removals

| Endpoint | Reason |
|----------|--------|
| `GET /hotels/:id/rooms` | Room entity removed from MVP per Marketplace Refactor |
| `POST /hotels/:id/rooms` | Room entity removed from MVP |
| `PATCH /hotels/:id/rooms/:roomId` | Room entity removed from MVP |
| `POST /work-requests/:id/assign` | Bypasses WorkApplication flow; violates frozen marketplace architecture |

---

## 5. Required Endpoint Additions

| Endpoint | Reason |
|----------|--------|
| `GET /assignments/:id/attendance` | Retrieve attendance record for a single assignment |
| `PATCH /assignments/:id/attendance` | Manager manual correction of clock-in/clock-out time |
| `GET /hotels/:id/work-history` | (Pending) Operational summary replacing DailyOperation endpoints |
| `GET /auth/account/export` | GDPR data export (defined in MASTER_ARCHITECTURE but absent from spec) |
| `POST /auth/account/data-erase` | GDPR erasure right (defined in MASTER_ARCHITECTURE but absent from spec) |
| `GET /consent` | GDPR consent status for current user |
| `POST /consent` | Record user consent at signup (GDPR) |

---

## 6. Required DTO Changes

| Endpoint | Field | Change |
|----------|-------|--------|
| `GET /auth/me` | `hotel_ids` | Remove field when HotelWorker replaces hotel_ids |
| `POST /quality/verifications` (request) | `task_id` → `worker_assignment_id` | Replace anchor field |
| `GET /quality/verifications` (response) | `task` nested object | Replace with `worker_assignment` nested object |
| `POST /ratings` (request) | `task_id` → `worker_assignment_id` | Replace anchor field |
| `POST /ratings` (request) | `worker_id` | Remove — derivable from assignment |
| `GET /ratings` (response) | `task_id` field | Replace with `worker_assignment_id` |
| `POST /ratings` validation | `task must be COMPLETED` | Replace with `workerAssignment.status == COMPLETED` |
| `GET /assignments/:id` (response) | Remove `daily_operations[]` | Remove DailyOperation reference |
| `POST /hotels/:id/workers` (response) | Add full `HotelWorker` record shape | Reflect join table model |
| `GET /hotels/:id/attendance` (response) | Add `late_count`, `total_hours_worked` to summary | Operational completeness |
| `POST /work-requests/:id/cancel` (response) | Add `workers_reverted: [{assignment_id, worker_id}]` | Show impact on assignments |
| All QV error conditions | `Task not in COMPLETED status` → `Assignment not in COMPLETED status` | Wrong entity in error |
| Rating `score` validation | Change min from 1 to 0 OR update schema comment to min: 1 | Resolve mismatch |

---

## 7. Required RBAC Changes

| Endpoint | Current | Required | Rule Source |
|----------|---------|----------|-------------|
| `GET /hotels` | CHECKER: ✅ | CHECKER: ❌ | RBAC_MATRIX_v1.0 |
| `GET /work-requests` | WORKER: ✅ (OPEN only) | Verify against Marketplace Refactor Plan | PENDING |
| `GET /work-requests/:id` | WORKER: ✅ (OPEN) | Verify against Marketplace Refactor Plan | PENDING |
| `POST /auth/signup` | Public | Verify: Admin-only vs public marketplace registration | PENDING |
| `GET /ratings` | CHECKER: own ratings ✅ | CHECKER: ❌ per RBAC_MATRIX_v1.0 | CONFIRMED conflict |
| `POST /work-requests/:id/assign` | MANAGER | REMOVE endpoint entirely | Section C |
| All scoping ("own hotels") | Implemented via `hotel_ids` | Implement via HotelWorker table | Section B |

---

## 8. Final Status

```
╔══════════════════════════════════════════════════╗
║                                                  ║
║   FINAL STATUS:  R E J E C T                    ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

**Rejection Reasons (in priority order):**

1. **6 BLOCKER issues** — Cannot proceed with implementation when QualityVerification and Rating anchor the wrong entity, when a direct-assignment endpoint violates the frozen marketplace flow, and when Room/Task entities are present but removed from MVP.

2. **2 confirmed MAJOR violations from available authoritative docs** — Missing `CONTRACT_EXPIRING` and `DOCUMENT_UPLOADED` notification types defined in MASTER_ARCHITECTURE_v2.0 Section 12; Checker given hotel listing access denied by RBAC_PERMISSION_MATRIX_v1.0.

3. **Missing reference documents** — 7 of 7 named reference documents do not exist in Google Drive or the repository. This means 4 of 6 BLOCKER issues and 3 of 10 MAJOR issues have confidence level PENDING. The spec cannot be APPROVED when its primary reference material is unverifiable.

**Conditions for APPROVED status:**

| Condition | Description |
|-----------|-------------|
| C1 | All 7 reference documents must be stored in the repository under `docs/architecture/` |
| C2 | QualityVerification and Rating DTOs anchored to `worker_assignment_id` |
| C3 | `POST /work-requests/:id/assign` removed |
| C4 | Room endpoints removed |
| C5 | `hotel_ids` scoping replaced with HotelWorker-based scoping |
| C6 | Notification types updated per frozen architecture |
| C7 | RBAC matrix corrected (Checker/Hotels, Rating access) |
| C8 | Prisma Schema V2 must exist and match all DTO changes above |

---

*Audit v1 — Authored 2026-06-09 against API_SPEC_V1.md*  
*Next action: Retrieve and store all 7 reference documents, then regenerate API_SPEC_V1 with patches applied.*
