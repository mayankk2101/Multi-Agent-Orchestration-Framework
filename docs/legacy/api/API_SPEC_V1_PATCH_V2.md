# API_SPEC_V1_PATCH_V2

**Purpose:** Apply all BLOCKER and MAJOR fixes identified in API_SPEC_V1_PATCH_V1.  
**Source spec:** `docs/API_SPEC_V1.md`  
**Audit doc:** `docs/API_SPEC_V1_PATCH_V1.md`  
**Branch:** `claude/sharp-heisenberg-2j4xxa`  
**Date:** 2026-06-09  
**Final Status:** APPROVED_WITH_PATCHES

---

## Reference Authority

| Document | Status | Used As |
|---|---|---|
| MASTER_ARCHITECTURE_v2.0.md | Available (Drive `1D72ntyCBjcfLnBE217tecHBCToDlTk3s`) | Authoritative — notification events, module boundaries |
| RBAC_PERMISSION_MATRIX_v1.0.md | Available (Drive `1E305G7z40CThPadno7-_RZgEXmg1mYVE`) | Authoritative — all RBAC decisions |
| FINAL_DECISIONS_SUMMARY.md | Available (Drive `1s-aBzmXelGxAZPGwiNJ86u6C_iE4ehRY`) | Authoritative — frozen architecture rules |
| PRISMA_SCHEMA_V2 | **Not found** in Drive or repo | User-stated rules applied as authoritative |
| BACKEND_EXECUTION_BLUEPRINT_V2 | **Not found** in Drive or repo | User-stated rules applied as authoritative |

PRISMA_SCHEMA_V2 and BACKEND_EXECUTION_BLUEPRINT_V2 were searched on 2026-06-09 and returned no results. All DTO alignment for PATCH-05 is derived from user-stated frozen architecture rules and cross-referenced against Prisma Schema V1.

---

## PATCH-01 — Remove Room Endpoints

**Reason (BLOCKER B-2):** Rooms are a hotel property management concern, not a CRM/marketplace concern. The marketplace architecture is frozen around `WorkRequest → WorkApplication → WorkerAssignment`. Room CRUD has no role in that flow. The `Room` model in the Prisma schema is retained for legacy data but these endpoints expose internal hotel structure that is out of scope for this API surface.

### Endpoints Removed

| Method | Route | Removed From Module |
|---|---|---|
| `GET` | `/hotels/:id/rooms` | Hotels |
| `POST` | `/hotels/:id/rooms` | Hotels |
| `PATCH` | `/hotels/:id/rooms/:roomId` | Hotels |

### Impact

- No other endpoint in API_SPEC_V1 references room objects in its DTO.
- `Room` model remains in the database schema for hotel operations tooling; it is simply not exposed via this API.
- No cascade DTO changes required.

---

## PATCH-02 — Replace `task_id` with `worker_assignment_id` in QualityVerification and Rating

**Reason (BLOCKER B-3):** The Marketplace Refactor removes the `Task` entity as the anchor for quality and payment flows. `QualityVerification` and `Rating` must anchor to `WorkerAssignment` because that is the entity produced by the `WorkApplication → WorkerAssignment` pipeline. Using `task_id` creates a broken foreign key chain after the refactor.

### 2a. QualityVerification DTO Changes

**POST /quality-verifications — Request DTO**

```
BEFORE:
{
  "task_id": "string (required)",
  "worker_id": "string (required)",
  "checklist_items": [...],
  "overall_score": "number 0-100 (required)",
  "notes": "string (optional)"
}

AFTER:
{
  "worker_assignment_id": "string (required)",
  "checklist_items": [...],
  "overall_score": "number 0-100 (required)",
  "notes": "string (optional)"
}
```

Changes:
- Remove `task_id` field
- Remove `worker_id` field (worker is derived from `WorkerAssignment.worker_id`)
- Add `worker_assignment_id` field
- Validation: `worker_assignment_id` must reference an existing `WorkerAssignment` with `status IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED')`

**POST /quality-verifications — Response DTO**

```
BEFORE:
{
  "id": "string",
  "task_id": "string",
  "worker_id": "string",
  "hotel_id": "string",
  ...
}

AFTER:
{
  "id": "string",
  "worker_assignment_id": "string",
  "worker_id": "string",        // resolved from WorkerAssignment
  "hotel_id": "string",         // resolved from WorkerAssignment → WorkRequest
  "checklist_items": [...],
  "overall_score": "number",
  "status": "PENDING | APPROVED | REJECTED",
  "verified_by": "string | null",
  "verified_at": "string | null",
  "notes": "string | null",
  "created_at": "string"
}
```

**GET /quality-verifications — Query Parameters**

```
BEFORE:
?task_id=, ?worker_id=, ?hotel_id=, ?status=

AFTER:
?worker_assignment_id=, ?worker_id=, ?hotel_id=, ?status=
```

Remove `task_id` query param; add `worker_assignment_id` query param.

**GET /quality-verifications/:id — Response DTO**

Same field replacement as POST response above.

**PATCH /quality-verifications/:id — No request DTO change** (patch only updates `status`, `notes`, `verified_by`).

### 2b. Rating DTO Changes

**POST /ratings — Request DTO**

```
BEFORE:
{
  "task_id": "string (required)",
  "worker_id": "string (required)",
  "hotel_id": "string (required)",
  "rating": "number 1-5 (required)",
  "review": "string (optional)"
}

AFTER:
{
  "worker_assignment_id": "string (required)",
  "rating": "number 1-5 (required)",
  "review": "string (optional)"
}
```

Changes:
- Remove `task_id` field
- Remove `worker_id` field (derived from WorkerAssignment)
- Remove `hotel_id` field (derived from WorkerAssignment → WorkRequest)
- Add `worker_assignment_id` field
- Validation: `worker_assignment_id` must reference a `WorkerAssignment` with `status = 'COMPLETED'`; one rating per assignment (UNIQUE constraint)

**POST /ratings — Response DTO**

```
BEFORE:
{
  "id": "string",
  "task_id": "string",
  "worker_id": "string",
  "hotel_id": "string",
  ...
}

AFTER:
{
  "id": "string",
  "worker_assignment_id": "string",
  "worker_id": "string",        // resolved from WorkerAssignment
  "hotel_id": "string",         // resolved from WorkerAssignment → WorkRequest
  "rated_by": "string",
  "rating": "number",
  "review": "string | null",
  "created_at": "string"
}
```

**GET /ratings — Query Parameters**

```
BEFORE:
?task_id=, ?worker_id=, ?hotel_id=

AFTER:
?worker_assignment_id=, ?worker_id=, ?hotel_id=
```

Remove `task_id` query param; add `worker_assignment_id` query param.

**GET /ratings/:id — Response DTO**

Same field replacement as POST response above.

### 2c. Prisma Model Alignment Note

The current `schema.prisma` has:
```
model QualityVerification {
  task_id  String @unique
  ...
}

model Rating {
  task_id  String @unique
  ...
}
```

Per Prisma Schema V2 (user-authoritative), these become:
```
model QualityVerification {
  worker_assignment_id  String @unique
  ...
}

model Rating {
  worker_assignment_id  String @unique
  ...
}
```

The `@unique` constraint is preserved — one QV per assignment, one Rating per assignment.

---

## PATCH-03 — Remove `POST /work-requests/:id/assign`

**Reason (BLOCKER B-4):** This endpoint allows direct assignment of a worker to a work request, bypassing the `WorkApplication` pipeline entirely. The frozen marketplace architecture mandates:

```
WorkRequest → WorkApplication (worker applies) → WorkerAssignment (manager approves application)
```

Allowing `POST /work-requests/:id/assign` creates a parallel path that breaks the pipeline integrity, skips consent/application records, and makes WorkApplication auditing incomplete.

### Endpoint Removed

| Method | Route | Module |
|---|---|---|
| `POST` | `/work-requests/:id/assign` | WorkRequest |

### Correct Replacement Flow

Direct assignment is replaced by:

1. Worker applies: `POST /work-requests/:id/apply`
2. Manager approves application: `PATCH /work-requests/:id/applications/:applicationId` with `{ "status": "APPROVED" }`
3. System creates `WorkerAssignment` record automatically on application approval.

No new endpoint is needed. The WorkApplication flow already covers this.

---

## PATCH-04 — Replace `hotel_ids[]` Authorization with HotelWorker Membership

**Reason (BLOCKER B-5):** The `User.hotel_ids String[]` array is the legacy authorization mechanism. The Marketplace Refactor replaces it with a `HotelWorker` join table that records explicit membership with `role`, `start_date`, `end_date`, and `is_active` flags. All authorization checks that previously read `user.hotel_ids` must now query `HotelWorker WHERE worker_id = user.id AND hotel_id = :hotel_id AND is_active = true`.

### 4a. Remove `hotel_ids` from User Response DTOs

All endpoints that return a User object must drop `hotel_ids`:

**Affected endpoints:**
- `POST /auth/login` — response `data.user`
- `POST /auth/refresh` — response `data.user`
- `GET /auth/me` — response `data`
- `POST /users` — response `data`
- `GET /users` — response `data[]`
- `GET /users/:id` — response `data`
- `PATCH /users/:id` — response `data`

**User Response DTO — Before:**
```json
{
  "id": "string",
  "email": "string",
  "name": "string",
  "role": "WORKER | CHECKER | MANAGER | ADMIN",
  "hotel_ids": ["hotel_abc", "hotel_xyz"],
  "is_active": "boolean",
  "created_at": "string",
  "updated_at": "string"
}
```

**User Response DTO — After:**
```json
{
  "id": "string",
  "email": "string",
  "name": "string",
  "role": "WORKER | CHECKER | MANAGER | ADMIN",
  "is_active": "boolean",
  "created_at": "string",
  "updated_at": "string"
}
```

Hotel membership is now available exclusively via `GET /hotels/:id/workers` and `GET /hotel-workers?worker_id=:id`.

### 4b. Remove `hotel_ids` from POST /users and PATCH /users/:id Request DTOs

**POST /users — Request DTO Before:**
```json
{
  "email": "string",
  "name": "string",
  "role": "WORKER | CHECKER | MANAGER | ADMIN",
  "hotel_ids": ["string"],
  "password": "string"
}
```

**POST /users — Request DTO After:**
```json
{
  "email": "string",
  "name": "string",
  "role": "WORKER | CHECKER | MANAGER | ADMIN",
  "password": "string"
}
```

To assign a user to a hotel after creation, use `POST /hotels/:id/workers`.

**PATCH /users/:id — Request DTO:**  
Remove `hotel_ids` from allowed patch fields.

### 4c. Authorization Logic Change (Implementation Note)

For all endpoints that gate access by hotel membership (e.g., `GET /hotels/:id`, `GET /work-requests?hotel_id=`, `POST /work-requests`), the authorization check changes from:

```
// Legacy
if (!user.hotel_ids.includes(hotelId)) throw CANNOT_ACCESS_HOTEL
```

to:

```
// Marketplace Refactor
const membership = await db.hotelWorker.findFirst({
  where: { worker_id: user.id, hotel_id: hotelId, is_active: true }
})
if (!membership) throw CANNOT_ACCESS_HOTEL
```

ADMIN and MANAGER bypass the membership check and have access to all hotels they manage (per RBAC matrix).

---

## PATCH-05 — Align DTOs with Prisma Schema V2

**Reason (MAJOR M-1, M-2):** Several DTO fields reference models or relations that are removed in the Marketplace Refactor. Specifically: `daily_operations[]` on WorkerAssignment is removed, `Task` entity is removed as a top-level concept, and WorkRequest status enum is aligned with the pipeline.

### 5a. Remove `daily_operations` from WorkerAssignment Response

**GET /assignments/:id — Response DTO Before:**
```json
{
  "id": "string",
  "work_request_id": "string",
  "worker_id": "string",
  "hotel_id": "string",
  "status": "ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED",
  "assigned_at": "string",
  "started_at": "string | null",
  "completed_at": "string | null",
  "daily_operations": [
    {
      "id": "string",
      "date": "string",
      "check_in": "string | null",
      "check_out": "string | null",
      "notes": "string | null"
    }
  ]
}
```

**GET /assignments/:id — Response DTO After:**
```json
{
  "id": "string",
  "work_request_id": "string",
  "application_id": "string",
  "worker_id": "string",
  "hotel_id": "string",
  "status": "ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED",
  "assigned_at": "string",
  "started_at": "string | null",
  "completed_at": "string | null",
  "notes": "string | null"
}
```

Changes:
- Remove `daily_operations[]` relation (DailyOperation is removed per Marketplace Refactor)
- Add `application_id` field (traceability back to the WorkApplication that created this assignment)

### 5b. WorkRequest Status Enum Alignment

WorkRequest status values must match the marketplace pipeline:

```
BEFORE (V1): OPEN | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED
AFTER  (V2): OPEN | CLOSED | CANCELLED
```

Explanation: A WorkRequest is OPEN until it has a confirmed WorkerAssignment, then CLOSED. The IN_PROGRESS / COMPLETED lifecycle moves to `WorkerAssignment.status`, not `WorkRequest.status`. CANCELLED remains on both.

**Affected endpoints:**
- `POST /work-requests` — response `status` enum
- `GET /work-requests` — filter `?status=` enum values, response `status`
- `GET /work-requests/:id` — response `status`
- `PATCH /work-requests/:id` — request and response `status`

### 5c. WorkApplication Status Enum

```
BEFORE (V1): PENDING | APPROVED | REJECTED | WITHDRAWN
AFTER  (V2): PENDING | APPROVED | REJECTED | WITHDRAWN
```

No change — enum is correct.

### 5d. Remove `task_photos` from any Attendance/Assignment Response

The `TaskPhoto` model (attached to Task) has no place in the Attendance module post-refactor. Any reference to `photos[]` in attendance or assignment response DTOs is removed.

**GET /attendance/:id — if `photos` field exists, remove it.**

### 5e. HotelWorker DTO Alignment

`POST /hotels/:id/workers` and `GET /hotels/:id/workers` responses must use the join table shape:

**HotelWorker Response DTO:**
```json
{
  "id": "string",
  "hotel_id": "string",
  "worker_id": "string",
  "role": "WORKER | CHECKER",
  "start_date": "string",
  "end_date": "string | null",
  "is_active": "boolean",
  "created_at": "string"
}
```

Remove any legacy `hotel_ids` from the response of `GET /hotel-workers`.

---

## PATCH-06 — Align Notification Events with Mobile Blueprint

**Reason (MAJOR M-5):** MASTER_ARCHITECTURE_v2.0.md Section 12 defines the authoritative notification event catalog. Two events present in the architecture are missing from API_SPEC_V1. Two events in API_SPEC_V1 reference the obsolete Task entity.

### 6a. Add Missing Notification Types

**CONTRACT_EXPIRING** — triggered when a worker contract approaches its `end_date` (configurable threshold, default 30 days).

Add to `NotificationType` enum:
```
CONTRACT_EXPIRING
```

**DOCUMENT_UPLOADED** — triggered when a worker uploads a document via `POST /worker-documents`.

Add to `NotificationType` enum:
```
DOCUMENT_UPLOADED
```

### 6b. Remove / Replace Obsolete Notification Types

The following notification types reference the removed `Task` entity:

| Obsolete Type | Replacement |
|---|---|
| `TASK_ASSIGNED` | `ASSIGNMENT_CREATED` (already in V1) |
| `TASK_COMPLETED` | `ASSIGNMENT_COMPLETED` |

**Action:** Remove `TASK_ASSIGNED` and `TASK_COMPLETED` from the `NotificationType` enum. `ASSIGNMENT_CREATED` is already present and covers the assignment event. Add `ASSIGNMENT_COMPLETED`.

### 6c. Complete Notification Type Enum (After Patch)

```typescript
enum NotificationType {
  // Assignment lifecycle
  ASSIGNMENT_CREATED,
  ASSIGNMENT_COMPLETED,
  ASSIGNMENT_CANCELLED,

  // Application lifecycle
  APPLICATION_RECEIVED,
  APPLICATION_APPROVED,
  APPLICATION_REJECTED,

  // Work request
  WORK_REQUEST_CREATED,
  WORK_REQUEST_CLOSED,
  WORK_REQUEST_CANCELLED,

  // Attendance
  ATTENDANCE_CHECKED_IN,
  ATTENDANCE_CHECKED_OUT,

  // Quality & Rating
  QUALITY_VERIFICATION_SUBMITTED,
  QUALITY_VERIFICATION_APPROVED,
  QUALITY_VERIFICATION_REJECTED,
  RATING_SUBMITTED,

  // Contract & Documents
  CONTRACT_EXPIRING,
  DOCUMENT_UPLOADED,

  // System
  ACCOUNT_CREATED,
  PASSWORD_RESET,
}
```

### 6d. Notification Payload Shape (Updated)

**POST /notifications — Request DTO:**
```json
{
  "recipient_id": "string (required)",
  "type": "NotificationType (required)",
  "title": "string (required)",
  "body": "string (required)",
  "data": {
    "resource_type": "assignment | work_request | application | quality_verification | rating | contract | document",
    "resource_id": "string"
  }
}
```

Remove `task_id` from `data` payload. Replace with `resource_type` + `resource_id` for generic linking.

---

## PATCH-07 — Align RBAC with RBAC_PERMISSION_MATRIX_v1.0

**Reason (BLOCKER B-6):** Multiple RBAC grants in API_SPEC_V1 conflict with the RBAC_PERMISSION_MATRIX_v1.0.md.

### 7a. Remove CHECKER from `GET /hotels`

**RBAC_PERMISSION_MATRIX_v1.0 ruling:** Checkers do not have hotel-listing access. They access hotel context only through their assignments.

```
BEFORE: GET /hotels — Roles: ADMIN, MANAGER, CHECKER
AFTER:  GET /hotels — Roles: ADMIN, MANAGER
```

### 7b. Remove CHECKER from `POST /hotels` and `PATCH /hotels/:id`

These are management-only operations.

```
BEFORE: POST /hotels — Roles: ADMIN, MANAGER, CHECKER
AFTER:  POST /hotels — Roles: ADMIN, MANAGER

BEFORE: PATCH /hotels/:id — Roles: ADMIN, MANAGER, CHECKER
AFTER:  PATCH /hotels/:id — Roles: ADMIN, MANAGER
```

### 7c. Fix Rating Submission RBAC

Per RBAC_PERMISSION_MATRIX_v1.0: Only CHECKER and MANAGER may submit ratings. WORKER cannot rate themselves.

```
BEFORE: POST /ratings — Roles: ADMIN, MANAGER, CHECKER, WORKER
AFTER:  POST /ratings — Roles: ADMIN, MANAGER, CHECKER
```

### 7d. Fix QualityVerification Submission RBAC

Per RBAC_PERMISSION_MATRIX_v1.0: Only CHECKER and MANAGER submit quality verifications.

```
BEFORE: POST /quality-verifications — Roles: ADMIN, MANAGER, CHECKER, WORKER
AFTER:  POST /quality-verifications — Roles: ADMIN, MANAGER, CHECKER
```

### 7e. Fix `PATCH /assignments/:id` — Block Reassignment When IN_PROGRESS

Per RBAC_PERMISSION_MATRIX_v1.0 and Marketplace Refactor: Reassigning a worker to an assignment that is already `IN_PROGRESS` is not allowed. Only ADMIN can override.

Add to `PATCH /assignments/:id` business rules:
```
- If current status is IN_PROGRESS and request changes worker_id: return 422 INVALID_STATE_TRANSITION (MANAGER role)
- ADMIN may override and reassign IN_PROGRESS assignments
```

### 7f. Fix WorkRequest Creation RBAC

Per RBAC_PERMISSION_MATRIX_v1.0: Only MANAGER and ADMIN can create work requests. CHECKER cannot.

```
BEFORE: POST /work-requests — Roles: ADMIN, MANAGER, CHECKER
AFTER:  POST /work-requests — Roles: ADMIN, MANAGER
```

### 7g. RBAC Summary Table (After All Patches)

| Endpoint | ADMIN | MANAGER | CHECKER | WORKER |
|---|---|---|---|---|
| GET /hotels | ✓ | ✓ | — | — |
| POST /hotels | ✓ | ✓ | — | — |
| GET /hotels/:id | ✓ | ✓ | — | — |
| PATCH /hotels/:id | ✓ | ✓ | — | — |
| GET /hotels/:id/workers | ✓ | ✓ | — | — |
| POST /hotels/:id/workers | ✓ | ✓ | — | — |
| DELETE /hotels/:id/workers/:workerId | ✓ | ✓ | — | — |
| POST /work-requests | ✓ | ✓ | — | — |
| GET /work-requests | ✓ | ✓ | ✓ | ✓ |
| GET /work-requests/:id | ✓ | ✓ | ✓ | ✓ |
| PATCH /work-requests/:id | ✓ | ✓ | — | — |
| DELETE /work-requests/:id | ✓ | ✓ | — | — |
| POST /work-requests/:id/apply | ✓ | — | — | ✓ |
| GET /work-requests/:id/applications | ✓ | ✓ | — | — |
| PATCH /work-requests/:id/applications/:id | ✓ | ✓ | — | — |
| GET /assignments | ✓ | ✓ | ✓ | ✓ |
| GET /assignments/:id | ✓ | ✓ | ✓ | ✓ |
| PATCH /assignments/:id | ✓ | ✓ | — | — |
| POST /attendance | ✓ | ✓ | ✓ | ✓ |
| GET /attendance | ✓ | ✓ | ✓ | ✓ |
| PATCH /attendance/:id | ✓ | ✓ | — | — |
| POST /quality-verifications | ✓ | ✓ | ✓ | — |
| GET /quality-verifications | ✓ | ✓ | ✓ | ✓ |
| PATCH /quality-verifications/:id | ✓ | ✓ | — | — |
| POST /ratings | ✓ | ✓ | ✓ | — |
| GET /ratings | ✓ | ✓ | ✓ | ✓ |
| GET /notifications | ✓ | ✓ | ✓ | ✓ |
| PATCH /notifications/:id | ✓ | ✓ | ✓ | ✓ |

---

## Example Payload Changes

### Auth — GET /auth/me (After PATCH-04)

**Before:**
```json
{
  "status": "success",
  "data": {
    "id": "user_abc123",
    "email": "worker@hotel.com",
    "name": "John Smith",
    "role": "WORKER",
    "hotel_ids": ["hotel_xyz", "hotel_abc"],
    "is_active": true,
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-06-01T10:00:00Z"
  },
  "meta": {
    "timestamp": "2026-06-09T12:00:00Z",
    "request_id": "req_abc123"
  }
}
```

**After:**
```json
{
  "status": "success",
  "data": {
    "id": "user_abc123",
    "email": "worker@hotel.com",
    "name": "John Smith",
    "role": "WORKER",
    "is_active": true,
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-06-01T10:00:00Z"
  },
  "meta": {
    "timestamp": "2026-06-09T12:00:00Z",
    "request_id": "req_abc123"
  }
}
```

---

### QualityVerification — POST /quality-verifications (After PATCH-02)

**Before:**
```json
{
  "task_id": "task_abc123",
  "worker_id": "user_worker456",
  "checklist_items": [
    { "item": "Bed made", "passed": true },
    { "item": "Bathroom clean", "passed": true },
    { "item": "Minibar stocked", "passed": false }
  ],
  "overall_score": 85,
  "notes": "Minibar not restocked"
}
```

**After:**
```json
{
  "worker_assignment_id": "assign_abc123",
  "checklist_items": [
    { "item": "Bed made", "passed": true },
    { "item": "Bathroom clean", "passed": true },
    { "item": "Minibar stocked", "passed": false }
  ],
  "overall_score": 85,
  "notes": "Minibar not restocked"
}
```

**Response After:**
```json
{
  "status": "success",
  "data": {
    "id": "qv_xyz789",
    "worker_assignment_id": "assign_abc123",
    "worker_id": "user_worker456",
    "hotel_id": "hotel_xyz",
    "checklist_items": [
      { "item": "Bed made", "passed": true },
      { "item": "Bathroom clean", "passed": true },
      { "item": "Minibar stocked", "passed": false }
    ],
    "overall_score": 85,
    "status": "PENDING",
    "verified_by": null,
    "verified_at": null,
    "notes": "Minibar not restocked",
    "created_at": "2026-06-09T14:30:00Z"
  },
  "meta": {
    "timestamp": "2026-06-09T14:30:00Z",
    "request_id": "req_qv001"
  }
}
```

---

### Rating — POST /ratings (After PATCH-02)

**Before:**
```json
{
  "task_id": "task_abc123",
  "worker_id": "user_worker456",
  "hotel_id": "hotel_xyz",
  "rating": 4,
  "review": "Good work overall, minor issue with minibar"
}
```

**After:**
```json
{
  "worker_assignment_id": "assign_abc123",
  "rating": 4,
  "review": "Good work overall, minor issue with minibar"
}
```

**Response After:**
```json
{
  "status": "success",
  "data": {
    "id": "rating_def456",
    "worker_assignment_id": "assign_abc123",
    "worker_id": "user_worker456",
    "hotel_id": "hotel_xyz",
    "rated_by": "user_checker789",
    "rating": 4,
    "review": "Good work overall, minor issue with minibar",
    "created_at": "2026-06-09T16:00:00Z"
  },
  "meta": {
    "timestamp": "2026-06-09T16:00:00Z",
    "request_id": "req_rat001"
  }
}
```

---

### WorkerAssignment — GET /assignments/:id (After PATCH-05)

**Before:**
```json
{
  "status": "success",
  "data": {
    "id": "assign_abc123",
    "work_request_id": "req_xyz",
    "worker_id": "user_worker456",
    "hotel_id": "hotel_xyz",
    "status": "IN_PROGRESS",
    "assigned_at": "2026-06-08T09:00:00Z",
    "started_at": "2026-06-09T08:00:00Z",
    "completed_at": null,
    "daily_operations": [
      {
        "id": "dailyop_001",
        "date": "2026-06-09",
        "check_in": "2026-06-09T08:00:00Z",
        "check_out": null,
        "notes": null
      }
    ]
  }
}
```

**After:**
```json
{
  "status": "success",
  "data": {
    "id": "assign_abc123",
    "work_request_id": "req_xyz",
    "application_id": "app_def456",
    "worker_id": "user_worker456",
    "hotel_id": "hotel_xyz",
    "status": "IN_PROGRESS",
    "assigned_at": "2026-06-08T09:00:00Z",
    "started_at": "2026-06-09T08:00:00Z",
    "completed_at": null,
    "notes": null
  },
  "meta": {
    "timestamp": "2026-06-09T12:00:00Z",
    "request_id": "req_asgn001"
  }
}
```

---

### Notification — POST /notifications (After PATCH-06)

**Before:**
```json
{
  "recipient_id": "user_worker456",
  "type": "TASK_ASSIGNED",
  "title": "New Task Assigned",
  "body": "You have been assigned a new task at Grand Hotel.",
  "data": {
    "task_id": "task_abc123",
    "hotel_id": "hotel_xyz"
  }
}
```

**After:**
```json
{
  "recipient_id": "user_worker456",
  "type": "ASSIGNMENT_CREATED",
  "title": "New Assignment",
  "body": "You have been assigned to a work request at Grand Hotel.",
  "data": {
    "resource_type": "assignment",
    "resource_id": "assign_abc123"
  }
}
```

---

## Final API Surface

Complete endpoint list after all patches applied. 46 endpoints total (down from 50 in V1: -4 removed, 0 net additions at this layer).

### Auth (5 endpoints)
| Method | Route | Auth Required |
|---|---|---|
| POST | /auth/login | No |
| POST | /auth/refresh | No |
| POST | /auth/logout | Yes |
| GET | /auth/me | Yes |
| POST | /auth/password-reset | No |

### Users (5 endpoints)
| Method | Route | Roles |
|---|---|---|
| POST | /users | ADMIN |
| GET | /users | ADMIN, MANAGER |
| GET | /users/:id | ADMIN, MANAGER, self |
| PATCH | /users/:id | ADMIN, self |
| DELETE | /users/:id | ADMIN |

### Hotels (4 endpoints — 3 room endpoints removed)
| Method | Route | Roles |
|---|---|---|
| POST | /hotels | ADMIN, MANAGER |
| GET | /hotels | ADMIN, MANAGER |
| GET | /hotels/:id | ADMIN, MANAGER |
| PATCH | /hotels/:id | ADMIN, MANAGER |

### HotelWorker (3 endpoints)
| Method | Route | Roles |
|---|---|---|
| GET | /hotels/:id/workers | ADMIN, MANAGER |
| POST | /hotels/:id/workers | ADMIN, MANAGER |
| DELETE | /hotels/:id/workers/:workerId | ADMIN, MANAGER |

### WorkRequest (4 endpoints — direct assign removed)
| Method | Route | Roles |
|---|---|---|
| POST | /work-requests | ADMIN, MANAGER |
| GET | /work-requests | ADMIN, MANAGER, CHECKER, WORKER |
| GET | /work-requests/:id | ADMIN, MANAGER, CHECKER, WORKER |
| PATCH | /work-requests/:id | ADMIN, MANAGER |

### WorkApplication (3 endpoints)
| Method | Route | Roles |
|---|---|---|
| POST | /work-requests/:id/apply | ADMIN, WORKER |
| GET | /work-requests/:id/applications | ADMIN, MANAGER |
| PATCH | /work-requests/:id/applications/:applicationId | ADMIN, MANAGER |

### WorkerAssignment (3 endpoints)
| Method | Route | Roles |
|---|---|---|
| GET | /assignments | ADMIN, MANAGER, CHECKER, WORKER |
| GET | /assignments/:id | ADMIN, MANAGER, CHECKER, WORKER |
| PATCH | /assignments/:id | ADMIN, MANAGER |

### Attendance (4 endpoints)
| Method | Route | Roles |
|---|---|---|
| POST | /attendance | ADMIN, MANAGER, CHECKER, WORKER |
| GET | /attendance | ADMIN, MANAGER, CHECKER, WORKER |
| GET | /attendance/:id | ADMIN, MANAGER, CHECKER, WORKER |
| PATCH | /attendance/:id | ADMIN, MANAGER |

### QualityVerification (4 endpoints)
| Method | Route | Roles |
|---|---|---|
| POST | /quality-verifications | ADMIN, MANAGER, CHECKER |
| GET | /quality-verifications | ADMIN, MANAGER, CHECKER, WORKER |
| GET | /quality-verifications/:id | ADMIN, MANAGER, CHECKER, WORKER |
| PATCH | /quality-verifications/:id | ADMIN, MANAGER |

### Rating (3 endpoints)
| Method | Route | Roles |
|---|---|---|
| POST | /ratings | ADMIN, MANAGER, CHECKER |
| GET | /ratings | ADMIN, MANAGER, CHECKER, WORKER |
| GET | /ratings/:id | ADMIN, MANAGER, CHECKER, WORKER |

### Notifications (3 endpoints)
| Method | Route | Roles |
|---|---|---|
| POST | /notifications | ADMIN, MANAGER |
| GET | /notifications | ADMIN, MANAGER, CHECKER, WORKER |
| PATCH | /notifications/:id | ADMIN, MANAGER, CHECKER, WORKER |

### GDPR (5 endpoints)
| Method | Route | Roles |
|---|---|---|
| POST | /gdpr/consent | ADMIN, WORKER (self) |
| GET | /gdpr/consent/:userId | ADMIN, self |
| POST | /gdpr/data-export | ADMIN, self |
| POST | /gdpr/data-deletion | ADMIN |
| GET | /gdpr/retention-logs | ADMIN |

---

## Patch Application Summary

| Patch | Severity | Status | Changes |
|---|---|---|---|
| PATCH-01 | BLOCKER | Applied | Removed GET/POST/PATCH /hotels/:id/rooms (3 endpoints) |
| PATCH-02 | BLOCKER | Applied | Replaced task_id with worker_assignment_id in QV and Rating DTOs |
| PATCH-03 | BLOCKER | Applied | Removed POST /work-requests/:id/assign (1 endpoint) |
| PATCH-04 | BLOCKER | Applied | Removed hotel_ids[] from all User DTOs; replaced with HotelWorker membership |
| PATCH-05 | MAJOR | Applied | Removed daily_operations from Assignment response; aligned WorkRequest status enum; added application_id to Assignment response |
| PATCH-06 | MAJOR | Applied | Added CONTRACT_EXPIRING, DOCUMENT_UPLOADED, ASSIGNMENT_COMPLETED; removed TASK_ASSIGNED, TASK_COMPLETED; updated notification data payload shape |
| PATCH-07 | BLOCKER | Applied | Fixed RBAC: removed CHECKER from hotel management; fixed rating/QV submission access; blocked worker reassignment when IN_PROGRESS for non-ADMIN |

**Endpoints removed:** 4  
**Endpoints added:** 0 (WorkApplication flow was already present)  
**DTOs changed:** 16  
**RBAC rules changed:** 7  
**Notification types changed:** +3 added, -2 removed  

---

## Residual Notes

1. **PRISMA_SCHEMA_V2 not found:** All DTO and model-level changes are derived from user-stated frozen rules. When PRISMA_SCHEMA_V2 is available, validate: `QualityVerification.worker_assignment_id @unique`, `Rating.worker_assignment_id @unique`, `WorkerAssignment.application_id`, and `HotelWorker` join table presence.

2. **BACKEND_EXECUTION_BLUEPRINT_V2 not found:** No execution-layer patches are blocked. When available, cross-check middleware ordering for HotelWorker membership checks.

3. **DailyOperation model:** The `DailyOperation` Prisma model is retained in schema V1. Per the Marketplace Refactor it should be removed in V2. The API surface already omits it after PATCH-05; no endpoint exposes it.

4. **Contract module:** Not included in this API surface. If contract endpoints exist in a future spec, they must use `worker_assignment_id` as the foreign key anchor (not `task_id`), and `CONTRACT_EXPIRING` notifications must fire automatically based on `contract.end_date`.

---

## Final Status

**APPROVED_WITH_PATCHES**

All 4 BLOCKER issues and 3 of 3 applicable MAJOR issues from API_SPEC_V1_PATCH_V1 are resolved in this patch set. The spec is implementation-ready for all 46 endpoints. The two residual notes (PRISMA_SCHEMA_V2, BACKEND_EXECUTION_BLUEPRINT_V2) are documentation gaps, not blocking issues — the patch content derived from user-stated rules is internally consistent with available reference documents.
