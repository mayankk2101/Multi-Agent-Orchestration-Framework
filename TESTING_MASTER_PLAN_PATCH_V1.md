# TESTING MASTER PLAN — PATCH V1
## Consistency Audit Report

**Audited Document**: `TESTING_MASTER_PLAN.md`  
**Audit Date**: 2026-06-09  
**Auditor**: Architecture Consistency Review  
**Reference Sources**: Prisma Schema V2 · Actual Route Definitions (`staffing/routes.ts`, `quality/routes.ts`) · Marketplace Architecture

---

## SECTION A — Legacy Entity References

### Full Occurrence Inventory

Every occurrence of `Room`, `Task`, `TaskPhoto`, `DailyOperation`, `Calendar` found in the plan:

#### `Room` / `Rooms`

| Line | Location | Text |
|------|----------|------|
| 761 | `taskFixture` | `room_id: faker.string.uuid()` — Task fixture hard-couples to Room FK |
| 888 | `seedCompletedTask()` | `const room = await prisma().room.create(...)` — creates a Room record |
| 889 | `seedCompletedTask()` | `room_number: '101', type: 'STANDARD', status: 'dirty'` — Room field (also wrong field name: schema uses `number`, not `room_number`) |
| 893 | `seedCompletedTask()` | `room_id: room.id` — passes Room FK into Task |

**Tests that must be removed:** `seedCompletedTask()` entirely. Every test that calls it (all integration quality tests and the E2E quality-gate flow) loses its fixture anchor and must be rewritten around `WorkerAssignment`.

#### `Task` / `Tasks`

| Line | Location | Text |
|------|----------|------|
| 237 | `verification.test.ts` unit | `const task = taskFixture({ status: 'COMPLETED' })` |
| 238 | `verification.test.ts` unit | `prisma.task.findFirst.mockResolvedValue(task)` |
| 243 | `verification.test.ts` unit | `{ task_id: task.id, score: 87, notes: '' }` |
| 248 | `verification.test.ts` unit | `{ task_id: 'id', score: 105, notes: '' }` |
| 254 | `verification.test.ts` unit | `const task = taskFixture({ status: 'COMPLETED' })` |
| 255 | `verification.test.ts` unit | `prisma.task.findFirst.mockResolvedValue(task)` |
| 260 | `verification.test.ts` unit | `{ task_id: task.id, score: 45, notes: '' }` |
| 264 | `verification.test.ts` unit | `task_id: 'existing-task'` |
| 277 | `rating.test.ts` unit | `{ task_id: 'id', score: 4 }` |
| 283 | `rating.test.ts` unit | `{ task_id: 'id', score: 5 }` |
| 290–291 | `rating.test.ts` unit | `{ task_id: 'id', score: 0/6 }` |
| 365–366 | `globalTeardown.ts` | `"Task"` in TRUNCATE statement |
| 388 | `testEnv.ts` | `"Task"` in TRUNCATE statement |
| 479 | `verifications.test.ts` integration | `const { hotel, checker, task } = await seedCompletedTask()` |
| 482 | `verifications.test.ts` integration | `.send({ task_id: task.id, score: 92, notes: 'Excellent work' })` |
| 491 | `verifications.test.ts` integration | `.send({ task_id: task.id, score: 88, notes: '' })` |
| 505 | `ratings.test.ts` integration | `const { hotel, checker, worker, task } = await seedCompletedTask()` |
| 511 | `ratings.test.ts` integration | `.send({ task_id: task.id, worker_id: worker.id, score: 5 })` |
| 631 | `quality-gate.test.ts` E2E | `const { hotel, checker, worker, task } = await buildScenario.completedTask()` |
| 638 | `quality-gate.test.ts` E2E | `.send({ task_id: task.id, score: 88, notes: 'Good job' })` |
| 646 | `quality-gate.test.ts` E2E | `.send({ task_id: task.id, worker_id: worker.id, score: 4 })` |
| 663 | `quality-gate.test.ts` E2E | `const { checker, worker, task } = await buildScenario.completedTask()` |
| 665 | `quality-gate.test.ts` E2E | `.send({ task_id: task.id, score: 45 })` |
| 674 | `quality-gate.test.ts` E2E | `GET /api/v1/crm/tasks/${task.id}` — legacy CRM route |
| 676 | `quality-gate.test.ts` E2E | `expect(updatedTask.status).toBe('ASSIGNED')` — checks Task status, wrong entity |
| 693 | `fixtures/index.ts` | `import type { ... Task, ...} from '@prisma/client'` |
| 761–776 | `fixtures/index.ts` | Entire `taskFixture` definition |
| 891–903 | `db-seeds.ts` | `prisma().task.create(...)` block inside `seedCompletedTask()` |

**Tests referencing Task that must be removed or replaced:**
- Entire `verification.test.ts` unit test (all 4 describe blocks use `task_id`)
- Entire `rating.test.ts` unit test (all 3 describe blocks use `task_id`)
- Integration `verifications.test.ts` (both test cases)
- Integration `ratings.test.ts` (the test case)
- E2E `quality-gate.test.ts` (both test cases)
- `taskFixture` function in fixtures
- `seedCompletedTask()` function in db-seeds

#### `TaskPhoto`

No occurrences in the plan. ✓

#### `DailyOperation`

| Line | Location | Text |
|------|----------|------|
| 365 | `globalTeardown.ts` | `"DailyOperation"` in TRUNCATE statement |
| 388 | `testEnv.ts` | `"DailyOperation"` in TRUNCATE statement |

`DailyOperation` is not a marketplace test subject. The TRUNCATE references are cleanup artifacts from the CRM-era schema. They must be evaluated: `DailyOperation` belongs to `WorkerAssignment` (FK), so if it remains in the schema it still needs to be in teardown order. However, no test creates DailyOperation records, so the TRUNCATE inclusion is harmless but misleading—it implies scope that doesn't exist.

**Action**: Remove `DailyOperation` from teardown TRUNCATE if it is not in Prisma Schema V2 marketplace model. If it remains in schema as an internal assignment detail, keep in teardown but remove from test scope documentation.

#### `Calendar`

No occurrences in the plan. ✓

---

## SECTION B — Membership Model (`hotel_ids`)

### Occurrences

| Line | Location | Text |
|------|----------|------|
| 179 | Unit test comment | `// hotel_ids filter returns nothing` |
| 716 | `workerFixture` | `hotel_ids: [faker.string.uuid()]` |
| 847 | `seedWorker` | `hotel_ids: [hotel_id]` |
| 991–993 | `tokenFor` helper | `hotel_ids: user.hotel_ids` in JWT payload |

### Validation Against HotelWorker Architecture

**Current plan assumption**: Hotel membership is a `String[]` array on the `User` model (`hotel_ids`). This matches the current Prisma Schema V2 where `User.hotel_ids String[]` exists.

**HotelWorker architecture implication**: If the marketplace architecture introduces a dedicated `HotelWorker` junction entity (separate model with `hotel_id`, `worker_id`, `role`, `status`, `joined_at`), then:

1. `workerFixture` — `hotel_ids` field is invalid; membership comes from a join record
2. `seedWorker` — must also call `prisma().hotelWorker.create(...)` separately
3. `tokenFor` — `hotel_ids` in JWT payload would be derived at login time from `HotelWorker` records, not from `User` directly
4. Unit test at line 179 — `prisma.user.findFirst` with `hotel_ids` filter becomes `prisma.hotelWorker.findFirst` with `hotel_id` + `worker_id` filter

**Current schema status**: `hotel_ids String[]` on `User` IS present in Prisma Schema V2. The plan is consistent with the current schema.

**Risk**: If the HotelWorker architecture document defines a junction table that is not yet in Prisma Schema V2, the plan must be updated once V2 is migrated. Flag for re-audit after schema migration.

**Required fixture changes if HotelWorker is a separate model:**
- Replace `hotel_ids: [hotel_id]` in `workerFixture` with no hotel field (User has no hotel membership field)
- Add `hotelWorkerFixture({ hotel_id, worker_id, status: 'ACTIVE' })` to `fixtures/index.ts`
- Add `seedHotelWorker({ hotel_id, worker_id })` to `db-seeds.ts`
- Update `seedWorker` to call `seedHotelWorker` after user creation
- Update `tokenFor` to exclude `hotel_ids` or populate it from HotelWorker lookup

---

## SECTION C — WorkApplication Flow

### Current Plan Behavior

The plan jumps directly from `WorkRequest` to `WorkerAssignment`, completely skipping `WorkApplication`.

**Evidence of bypass:**

| Location | What Happens | What Should Happen |
|----------|-------------|-------------------|
| Unit `assignWorkers` test | `service.assignWorkers(request.id, [worker.id], 'manager-id')` — manager directly assigns | Worker must first submit WorkApplication; manager approves it |
| Integration `POST /api/v1/staffing/assign` | Manager sends `{ work_request_id, worker_ids }` → gets assignment back | Worker submits application; manager approves application ID |
| E2E Step 2 | Manager POSTs to assign endpoint with worker_ids | Worker sees request, submits application; manager approves |
| `worker-application.test.ts` E2E file | Listed in manifest, **no test code provided** | Full WorkApplication CRUD + approval flow |

### WorkApplication Is Completely Absent

- No `WorkApplication` model in any fixture
- No `workApplicationFixture`
- No `seedWorkApplication`
- No `prisma.workApplication.*` mock calls
- No `POST /api/v1/staffing/work-requests/:id/apply` endpoint tested
- No `POST /api/v1/staffing/applications/:id/approve` endpoint tested
- No `POST /api/v1/staffing/applications/:id/reject` endpoint tested

### Tests That Bypass WorkApplication (Must Be Replaced)

| Test | Current Behavior | Required Behavior |
|------|-----------------|-------------------|
| Unit `assignWorkers` | Direct assignment | Test `createApplication` → `approveApplication` → verify `WorkerAssignment` created |
| Integration `POST /api/v1/staffing/assign` | Flat assign call | Split into apply + approve flow; `POST /api/v1/staffing/assign` route may not exist at all |
| E2E step 2 of hiring cycle | `post('/api/v1/staffing/assign').send({ worker_ids })` | Worker posts application; manager approves by application ID |
| E2E `worker-application.test.ts` | Empty (file named but no code) | Implement: apply → approve → verify assignment; apply → reject → verify no assignment |

### Required New Tests

```
tests/unit/staffing/
└── work-application.test.ts
    ├── createApplication: worker applies to OPEN request → WorkApplication(status=PENDING)
    ├── createApplication: worker applies to FILLED request → throws
    ├── createApplication: duplicate application → throws
    ├── approveApplication: PENDING → WorkerAssignment created + status=APPROVED
    ├── approveApplication: already APPROVED → throws
    └── rejectApplication: PENDING → status=REJECTED, no WorkerAssignment created

tests/integration/staffing/
└── work-applications.test.ts
    ├── POST /api/v1/staffing/work-requests/:id/apply → 201 + WorkApplication in DB
    ├── POST /api/v1/staffing/applications/:id/approve → 200 + WorkerAssignment in DB
    └── POST /api/v1/staffing/applications/:id/reject → 200 + no WorkerAssignment
```

---

## SECTION D — Attendance

### Current Plan Coverage

The plan acknowledges Attendance as a test scope item in two places:

| Location | Text |
|----------|------|
| Line 536 | E2E scope table: "Attendance Tracking \| Worker + Manager \| Assignment start/complete timestamps form attendance record" |
| Line 1323 | Test manifest: `attendance-tracking.test.ts` |

**But no Attendance test code exists in the plan.** The file is listed in the manifest but there is zero implementation.

### Architecture Mismatch

The plan treats Attendance as a **derived view of WorkerAssignment timestamps** (started_at / completed_at). If the marketplace architecture defines `Attendance` as a **first-class entity** with its own lifecycle (clock-in, clock-out, manager verification, dispute), then:

1. `Attendance` needs its own Prisma model (not in current schema V2)
2. `Attendance` needs its own fixtures
3. `Attendance` needs dedicated unit tests for lifecycle
4. Manager verification of attendance is a missing flow

### Missing Tests (All)

```
tests/unit/
└── staffing/
    └── attendance.test.ts
        ├── recordClockIn: WorkerAssignment IN_PROGRESS → Attendance(status=CLOCKED_IN, clock_in_at set)
        ├── recordClockOut: CLOCKED_IN → Attendance(status=CLOCKED_OUT, clock_out_at set)
        ├── managerVerifyAttendance: CLOCKED_OUT → Attendance(status=VERIFIED, verified_by set)
        ├── disputeAttendance: VERIFIED → Attendance(status=DISPUTED)
        └── rejectClockIn: clock-in without active WorkerAssignment → throws

tests/integration/
└── staffing/
    └── attendance.test.ts
        ├── POST /api/v1/staffing/assignments/:id/clock-in → 201 + Attendance record
        ├── POST /api/v1/staffing/assignments/:id/clock-out → 200 + clock_out_at set
        └── PATCH /api/v1/staffing/attendance/:id/verify → 200 + manager verified

tests/e2e/flows/
└── attendance-tracking.test.ts   ← currently EMPTY in plan
    ├── Full lifecycle: assign → clock-in → clock-out → manager verify
    └── Dispute path: verify → dispute → re-verify
```

---

## SECTION E — QualityVerification Violations

### Mandate
`QualityVerification` MUST use `worker_assignment_id`, NOT `task_id`.

### All Violations

**Unit tests — `quality/verification.test.ts`:**

| # | Line | Violation |
|---|------|-----------|
| 1 | 237 | `const task = taskFixture({ status: 'COMPLETED' })` — wrong entity anchor |
| 2 | 238 | `prisma.task.findFirst.mockResolvedValue(task)` — queries Task, must query WorkerAssignment |
| 3 | 243 | `{ task_id: task.id, score: 87, notes: '' }` — must be `{ worker_assignment_id: assignment.id, ... }` |
| 4 | 248 | `{ task_id: 'id', score: 105, notes: '' }` — must be `{ worker_assignment_id: 'id', ... }` |
| 5 | 254–255 | `taskFixture` + `prisma.task.findFirst` — must be assignmentFixture + `prisma.workerAssignment.findFirst` |
| 6 | 260 | `{ task_id: task.id, score: 45, notes: '' }` — must be `{ worker_assignment_id: ... }` |
| 7 | 264 | `task_id: 'existing-task'` — must be `worker_assignment_id: 'existing-assignment-id'` |

**In-memory fixture — `fixtures/index.ts`:**

| # | Line | Violation |
|---|------|-----------|
| 8 | 780 | `task_id: faker.string.uuid()` in `verificationFixture` — must be `worker_assignment_id` |

**Integration tests — `quality/verifications.test.ts`:**

| # | Line | Violation |
|---|------|-----------|
| 9 | 479 | `const { ..., task } = await seedCompletedTask()` — must be `seedCompletedAssignment()` |
| 10 | 482 | `.send({ task_id: task.id, score: 92, ... })` — must use `worker_assignment_id` |
| 11 | 491 | `.send({ task_id: task.id, score: 88, ... })` — must use `worker_assignment_id` |

**E2E tests — `quality-gate.test.ts`:**

| # | Line | Violation |
|---|------|-----------|
| 12 | 631 | `buildScenario.completedTask()` — must be `buildScenario.completedAssignment()` |
| 13 | 638 | `.send({ task_id: task.id, score: 88, ... })` — must use `worker_assignment_id` |
| 14 | 663 | `buildScenario.completedTask()` — same |
| 15 | 665 | `.send({ task_id: task.id, score: 45, ... })` — must use `worker_assignment_id` |

**Total: 15 violations across unit, fixture, integration, and E2E layers.**

### Additional Logic Error

The duplicate-verification guard (line 264–268) calls `prisma.qualityVerification.findUnique` to check for existing records. The unique constraint must be on `worker_assignment_id`, not `task_id`. The mock setup and the guard logic are both wrong.

---

## SECTION F — Rating Violations

### Mandate
`Rating` MUST use `worker_assignment_id`, NOT `task_id`.

### All Violations

**Unit tests — `quality/rating.test.ts`:**

| # | Line | Violation |
|---|------|-----------|
| 1 | 277 | `service.createRating({ task_id: 'id', score: 4 }, 'checker-id')` |
| 2 | 283 | `service.createRating({ task_id: 'id', score: 5 }, 'checker-id')` |
| 3 | 290 | `service.createRating({ task_id: 'id', score: 0 }, 'checker-id')` |
| 4 | 291 | `service.createRating({ task_id: 'id', score: 6 }, 'checker-id')` |

**In-memory fixture — `fixtures/index.ts`:**

| # | Line | Violation |
|---|------|-----------|
| 5 | 793 | `task_id: faker.string.uuid()` in `ratingFixture` — must be `worker_assignment_id` |

**Integration tests — `quality/ratings.test.ts`:**

| # | Line | Violation |
|---|------|-----------|
| 6 | 505 | `const { ..., task } = await seedCompletedTask()` — must be `seedCompletedAssignment()` |
| 7 | 511 | `.send({ task_id: task.id, worker_id: worker.id, score: 5 })` — must use `worker_assignment_id` |

**E2E tests — `quality-gate.test.ts`:**

| # | Line | Violation |
|---|------|-----------|
| 8 | 646 | `.send({ task_id: task.id, worker_id: worker.id, score: 4 })` — must use `worker_assignment_id` |

**Total: 8 violations across unit, fixture, integration, and E2E layers.**

### Additional Issue: Rating FK to Worker

The Rating payload at line 511 and 646 passes `worker_id` as a separate field. If Rating is anchored to `worker_assignment_id`, the worker is already derivable from the assignment — `worker_id` should be removed from the request payload (derived server-side from the assignment lookup) or validated against the assignment's worker.

---

## SECTION G — Fixture Violations Against Prisma Schema V2

### `taskFixture` (lines 761–776)

| Field in Fixture | Schema Status | Issue |
|-----------------|---------------|-------|
| `room_id` | Present in Task schema | Valid field, but Task is a legacy entity |
| `scheduled_at` | **NOT in schema** | Field does not exist on Task model — will cause Prisma type error |
| `priority: 'MEDIUM'` | Schema: `String @default("medium")` | Enum casing mismatch — schema uses lowercase strings (`"low"`, `"medium"`, `"high"`), fixture uses uppercase |
| Entire fixture | Task is legacy CRM entity | `taskFixture` must be **removed** from marketplace test suite |

### `verificationFixture` (lines 778–789)

| Field in Fixture | Schema Status | Issue |
|-----------------|---------------|-------|
| `task_id` | Present in current schema | **Architecture violation** — must be `worker_assignment_id` |
| `updated_at` | Present in schema | Valid |

### `ratingFixture` (lines 791–802)

| Field in Fixture | Schema Status | Issue |
|-----------------|---------------|-------|
| `task_id` | Present in current schema | **Architecture violation** — must be `worker_assignment_id` |
| `updated_at` | **NOT in Rating schema** | Schema line 214: `Rating` has no `updated_at` field — will cause Prisma type error |

### `assignmentFixture` (lines 746–759)

| Field in Fixture | Schema Status | Issue |
|-----------------|---------------|-------|
| `created_at` | **NOT in schema** | `WorkerAssignment` has no `created_at` field (lines 426–448 of schema) |
| `updated_at` | **NOT in schema** | `WorkerAssignment` has no `updated_at` field |
| `reassigned_at` | Present in schema | **Missing from fixture** — should be included |

### `workRequestFixture` (lines 731–744)

| Field in Fixture | Schema Status | Issue |
|-----------------|---------------|-------|
| `updated_at` | **NOT in schema** | `WorkRequest` has no `updated_at` field |
| `notes` | Present in schema | **Missing from fixture** |
| `filled_at` | Present in schema | **Missing from fixture** |
| `cancelled_at` | Present in schema | **Missing from fixture** |

### `hotelFixture` (lines 694–705)

| Field in Fixture | Schema Status | Issue |
|-----------------|---------------|-------|
| `country: faker.location.country()` | Schema default: `"Germany"` | Fixture uses random country; test DB seeds use `'India'` — inconsistent with schema defaults |
| `timezone: 'Asia/Kolkata'` | Schema default: `'Europe/Berlin'` | Mismatched timezone default |

### `seedCompletedTask()` in `db-seeds.ts` (lines 883–903)

| Issue | Detail |
|-------|--------|
| Creates `Room` via `prisma().room.create(...)` | Room is legacy CRM entity not in marketplace scope |
| Uses `room_number: '101'` | **Wrong field name** — schema defines `Room.number`, not `Room.room_number` |
| Creates `Task` via `prisma().task.create(...)` | Task is legacy entity; entire function must be **replaced** |
| Returns `{ hotel, manager, worker, checker, task }` | `task` is wrong entity anchor for quality tests |

### Missing Fixtures

| Missing Fixture | Required For |
|-----------------|-------------|
| `workApplicationFixture` | WorkApplication unit tests |
| `attendanceFixture` | Attendance unit tests |
| `seedWorkApplication` | Integration WorkApplication tests |
| `seedCompletedAssignment` | Replaces `seedCompletedTask` for quality integration tests |
| `hotelWorkerFixture` | If HotelWorker is a junction model |

---

## SECTION H — Integration Test Route Violations

### Incorrect HTTP Methods

| Plan Route | Actual Route (from `staffing/routes.ts`) | Issue |
|-----------|------------------------------------------|-------|
| `PATCH /api/v1/staffing/assignments/:id/start` | `POST /api/v1/staffing/assignments/:assignment_id/start` | Method mismatch: plan uses PATCH, actual uses POST |
| `PATCH /api/v1/staffing/assignments/:id/complete` | `POST /api/v1/staffing/assignments/:assignment_id/complete` | Method mismatch: plan uses PATCH, actual uses POST |

### Non-Existent Routes

| Plan Route | Actual Route | Issue |
|-----------|--------------|-------|
| `POST /api/v1/staffing/assign` | `POST /api/v1/staffing/work-requests/:work_request_id/assign-workers` | Route path entirely wrong; plan sends `work_request_id` in body, actual uses URL param |
| `GET /api/v1/staffing/work-requests/${id}` | Not defined in `staffing/routes.ts` | No GET single work-request route exists |
| `GET /api/v1/quality/leaderboard?hotel_id=` | `GET /api/v1/quality/leaderboard/by-hotel/:hotel_id` | Query param vs path param mismatch |
| `GET /api/v1/crm/tasks/${task.id}` | Not in marketplace scope | Legacy CRM route; must be removed from E2E tests |

### Missing Route Tests (Not Tested in Plan)

| Route | Module | Test Gap |
|-------|--------|----------|
| `GET /api/v1/staffing/available-workers` | staffing | No test for worker availability endpoint |
| `GET /api/v1/quality/leaderboard/by-hotel/:hotel_id` | quality | Parameterized leaderboard not tested |
| WorkApplication apply endpoint | staffing | Entire flow untested |
| WorkApplication approve/reject endpoint | staffing | Entire flow untested |
| Attendance clock-in/clock-out endpoint | staffing | Entire flow untested |

---

## SECTION I — E2E Coverage Gaps

### Missing Happy Paths

| Flow | Gap |
|------|-----|
| WorkApplication | Worker submits application → Manager approves → WorkerAssignment verified in DB |
| WorkApplication rejection | Worker submits application → Manager rejects → WorkApplication.status=REJECTED, no WorkerAssignment |
| Partial fill | WorkRequest(workers_needed=3) + assign 1 → WorkRequest.status=PARTIALLY_FILLED |
| WorkRequest cancellation | Manager cancels OPEN request → status=CANCELLED, assigned workers notified |
| Worker reassignment | Existing assignment REASSIGNED, new assignment created with previous_assignment_id FK |
| Multiple ratings average | Worker receives 3 ratings → WorkerOverallRating.average_score is correct mean |
| Attendance full lifecycle | Clock-in → Clock-out → Manager verifies → Attendance.status=VERIFIED |

### Missing Failure Paths

| Flow | Gap |
|------|-----|
| Worker starts another worker's assignment | Must → 403 |
| Worker completes assignment not IN_PROGRESS | Must → 422 |
| Checker verifies non-COMPLETED assignment | Must → 422 |
| Checker rates same assignment twice | Must → 409 |
| Worker applies to already-FILLED request | Must → 409 |
| Worker applies twice to same request | Must → 409 |

### Broken E2E Test Logic

**`quality-gate.test.ts` — needs_rework path (lines 662–677)**

```typescript
// CURRENT (broken):
const { body: { data: updatedTask } } = await api
  .as(worker)
  .get(`/api/v1/crm/tasks/${task.id}`)          // ← legacy route
  .expect(200);
expect(updatedTask.status).toBe('ASSIGNED');     // ← wrong entity (Task status)

// REQUIRED:
const { body: { data: assignment } } = await api
  .as(worker)
  .get(`/api/v1/staffing/assignments/${assignment.id}`)
  .expect(200);
expect(assignment.status).toBe('ASSIGNED');      // WorkerAssignment back to ASSIGNED for rework
// OR: verify Notification was sent to worker
```

**`worker-hiring-cycle.test.ts` — attendance assertion (lines 618–621)**

```typescript
// CURRENT (incomplete):
expect(
  new Date(completed.completed_at).getTime() - new Date(inProgress.started_at).getTime()
).toBeGreaterThan(0);  // ← not an attendance record, just arithmetic on timestamps

// REQUIRED if Attendance is first-class entity:
const { body: { data: attendance } } = await api
  .as(manager)
  .get(`/api/v1/staffing/assignments/${assignment.id}/attendance`)
  .expect(200);
expect(attendance.status).toBe('COMPLETED');
expect(attendance.clock_in_at).toBeTruthy();
expect(attendance.clock_out_at).toBeTruthy();
```

---

## OUTPUT

---

### 1. BLOCKER Issues

> Plan cannot be implemented as written. Tests will not compile or will test the wrong architecture.

| ID | Section | Issue |
|----|---------|-------|
| **B-01** | E, F | `QualityVerification` and `Rating` use `task_id` throughout — **23 total violations** across all test layers. Architecture mandates `worker_assignment_id`. Every quality test is wrong. |
| **B-02** | C | `WorkApplication` entity is **completely absent**. All staffing tests bypass the WorkRequest → WorkApplication → WorkerAssignment flow. The `worker-application.test.ts` file is listed in the manifest but has zero code. |
| **B-03** | H | `POST /api/v1/staffing/assign` does **not exist**. Actual route is `POST /api/v1/staffing/work-requests/:work_request_id/assign-workers`. Every integration and E2E assignment test will 404. |
| **B-04** | H | `PATCH` used for assignment start/complete but routes define `POST`. All start/complete integration and E2E tests will 405. |
| **B-05** | G | `taskFixture` contains `scheduled_at` field that **does not exist** in Prisma schema. TypeScript compilation will fail. |
| **B-06** | G | `ratingFixture` contains `updated_at` field that **does not exist** on the `Rating` model in Prisma schema. TypeScript compilation will fail. |
| **B-07** | G | `assignmentFixture` contains `created_at` and `updated_at` fields that **do not exist** on `WorkerAssignment` in schema. TypeScript compilation will fail. |

---

### 2. MAJOR Issues

> Significant architectural or logical errors that produce incorrect test behavior.

| ID | Section | Issue |
|----|---------|-------|
| **M-01** | A | `seedCompletedTask()` creates `Room` and `Task` entities as prerequisites for quality tests. These are legacy CRM entities. All quality integration and E2E tests are anchored to the wrong domain model. |
| **M-02** | D | `Attendance` is listed as a test subject and has a manifest entry, but **zero test code exists**. If Attendance is a first-class entity, this is a complete omission. |
| **M-03** | H | `GET /api/v1/quality/leaderboard?hotel_id=` uses query param but actual route is `GET /api/v1/quality/leaderboard/by-hotel/:hotel_id` (path param). E2E leaderboard assertions will 404. |
| **M-04** | I | `needs_rework` E2E test calls `GET /api/v1/crm/tasks/:id` and checks Task status. This is the wrong entity and route entirely. |
| **M-05** | G | `workRequestFixture` includes `updated_at` field not in schema; missing `notes`, `filled_at`, `cancelled_at`. |
| **M-06** | G | `assignmentFixture` missing `reassigned_at` field that is present in schema. |
| **M-07** | I | E2E worker-hiring-cycle "attendance" assertion (lines 618–621) is arithmetic on timestamps, not verification of an Attendance record. If Attendance is a real entity, this test proves nothing. |
| **M-08** | H | `GET /api/v1/staffing/work-requests/:id` (single record) used in E2E hiring cycle but no such route exists in `staffing/routes.ts`. |

---

### 3. MINOR Issues

| ID | Section | Issue |
|----|---------|-------|
| **N-01** | Setup | `jest.config.ts` line 60: `setupFilesAfterFramework` is not a valid Jest config key. Must be `setupFilesAfterEnv`. |
| **N-02** | G | `hotelFixture` uses `timezone: 'Asia/Kolkata'` and `seedHotel` hardcodes `city: 'Mumbai', country: 'India'`. Schema defaults are `timezone: 'Europe/Berlin'`, `country: 'Germany'`. Inconsistency will cause confusion in tests asserting on defaults. |
| **N-03** | G | `taskFixture` uses `priority: 'MEDIUM'` (uppercase). Schema defines priority as free-form string with default `"medium"` (lowercase). |
| **N-04** | 7 | Coverage gate job uses `npx nyc` to merge Jest coverage reports. Jest does not produce NYC-compatible output by default; requires `--coverageProvider=v8` and `nyc` configuration. Should use Jest's built-in `--coverage` with `--coverageReporters` instead. |
| **N-05** | A | `globalTeardown.ts` and `testEnv.ts` TRUNCATE statements include `"DailyOperation"` and `"Task"` — legacy tables not created in marketplace tests. Harmless but signals scope confusion. |
| **N-06** | B | `hotel_ids` usage is consistent with current Prisma Schema V2 but may break if HotelWorker junction table replaces the array. Flag for re-audit after schema migration. |
| **N-07** | G | `db-seeds.ts` uses top-level `await bcrypt.hash(...)` outside an async function. This is a syntax error in CommonJS and requires explicit module type handling in ESM. Must be wrapped in a `const getHashedPassword = async () => ...` pattern or computed lazily. |

---

### 4. Required Fixture Changes

| Fixture | Change Required |
|---------|----------------|
| `taskFixture` | **DELETE entirely**. Legacy CRM entity not in marketplace test scope. |
| `verificationFixture` | Replace `task_id` with `worker_assignment_id`. Remove `hotel_id` if not present in V2 QualityVerification model. |
| `ratingFixture` | Replace `task_id` with `worker_assignment_id`. Remove `updated_at` (not in schema). |
| `assignmentFixture` | Remove `created_at`, `updated_at` (not in schema). Add `reassigned_at: null`. |
| `workRequestFixture` | Remove `updated_at` (not in schema). Add `notes: null`, `filled_at: null`, `cancelled_at: null`. |
| `hotelFixture` | Change default `timezone` to `'Europe/Berlin'`, `country` to `'Germany'`. |
| `workerFixture` | Flag for update if HotelWorker architecture removes `hotel_ids` from User. |
| **ADD** `workApplicationFixture` | New: `{ id, work_request_id, worker_id, status: 'PENDING', applied_at, notes }` |
| **ADD** `attendanceFixture` | New: `{ id, worker_assignment_id, status: 'CLOCKED_IN', clock_in_at, clock_out_at: null, verified_by: null }` |
| `seedCompletedTask()` | **DELETE entirely**. |
| **ADD** `seedCompletedAssignment()` | Replaces `seedCompletedTask()`. Returns `{ hotel, manager, worker, checker, assignment }` where `assignment.status = 'COMPLETED'`. No Room or Task created. |
| **ADD** `seedWorkApplication()` | Seed a WorkApplication in PENDING state. |
| `db-seeds.ts` `bcrypt.hash` | Move to lazy async initializer — remove top-level `await`. |

---

### 5. Required Unit Test Changes

| File | Change |
|------|--------|
| `quality/verification.test.ts` | **Rewrite all 4 test cases.** Replace `task_id` with `worker_assignment_id`. Replace `taskFixture` + `prisma.task.findFirst` with `assignmentFixture` + `prisma.workerAssignment.findFirst`. |
| `quality/rating.test.ts` | **Rewrite all 3 test cases.** Replace `task_id` with `worker_assignment_id`. Remove `worker_id` from payload if derived from assignment. |
| `staffing/service.test.ts` — `assignWorkers` | **Replace with WorkApplication flow.** Test `createApplication` and `approveApplication` instead of direct `assignWorkers`. The approval creates the WorkerAssignment. |
| **ADD** `staffing/work-application.test.ts` | New file. Test full WorkApplication state machine: PENDING → APPROVED → WorkerAssignment created; PENDING → REJECTED → no assignment. |
| **ADD** `staffing/attendance.test.ts` | New file. Test Attendance lifecycle if Attendance is a first-class entity. |
| `jest.config.ts` | Fix `setupFilesAfterFramework` → `setupFilesAfterEnv`. |

---

### 6. Required Integration Test Changes

| File | Change |
|------|--------|
| `staffing/assignments.test.ts` | Replace `POST /api/v1/staffing/assign` → `POST /api/v1/staffing/work-requests/:id/assign-workers`. Change `PATCH` → `POST` for start/complete. |
| `quality/verifications.test.ts` | Replace `seedCompletedTask()` with `seedCompletedAssignment()`. Replace `task_id` with `worker_assignment_id` in all request payloads. |
| `quality/ratings.test.ts` | Replace `seedCompletedTask()` with `seedCompletedAssignment()`. Replace `task_id` with `worker_assignment_id`. |
| **ADD** `staffing/work-applications.test.ts` | New file. Test apply → approve and apply → reject flows end-to-end through DB. |
| **ADD** `staffing/attendance.test.ts` | New file. Test clock-in, clock-out, manager verification routes. |
| `globalTeardown.ts` | Remove `"Task"` from TRUNCATE. Re-evaluate `"DailyOperation"` based on whether it exists in marketplace V2 schema. |
| `testEnv.ts` | Remove `"Task"` from afterEach TRUNCATE. |
| Quality leaderboard test | Change `?hotel_id=` query param to `/by-hotel/:hotel_id` path param. |

---

### 7. Required E2E Test Changes

| File | Change |
|------|--------|
| `worker-hiring-cycle.test.ts` Step 2 | Replace direct `post('/api/v1/staffing/assign')` with WorkApplication flow: worker applies, manager approves. Update step numbering. |
| `worker-hiring-cycle.test.ts` start/complete | Change `PATCH` → `POST` for assignment start and complete endpoints. |
| `worker-hiring-cycle.test.ts` route check | Change `GET /api/v1/staffing/work-requests/${id}` to valid route once defined. |
| `worker-hiring-cycle.test.ts` attendance step | Replace timestamp arithmetic with real Attendance entity assertion (if Attendance is first-class). |
| `quality-gate.test.ts` | Replace `buildScenario.completedTask()` with `buildScenario.completedAssignment()` throughout. |
| `quality-gate.test.ts` verification payload | Replace `task_id` with `worker_assignment_id`. |
| `quality-gate.test.ts` rating payload | Replace `task_id` with `worker_assignment_id`. Remove `worker_id` if server-derived. |
| `quality-gate.test.ts` leaderboard | Change `?hotel_id=` to `/by-hotel/:hotel_id`. |
| `quality-gate.test.ts` needs_rework | Remove `GET /api/v1/crm/tasks/:id`. Replace with `GET /api/v1/staffing/assignments/:id` status check OR notification assertion. |
| `worker-application.test.ts` | **Implement entirely** (currently empty in plan). Apply → Approve → WorkerAssignment verified. Apply → Reject → no WorkerAssignment. |
| `attendance-tracking.test.ts` | **Implement entirely** (currently empty in plan). Full attendance lifecycle with manager verification. |
| **ADD** partial-fill scenario | New test in hiring cycle or separate file: `workers_needed=3`, assign 1 → `status=PARTIALLY_FILLED`. |

---

### 8. Final Status

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│   FINAL STATUS:   ██████  R E J E C T  ██████                   │
│                                                                   │
│   7 BLOCKER issues prevent compilation and correct execution.    │
│   Plan cannot be used as-is for any marketplace implementation.  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Rejection reasons (Blockers only):**

| # | Blocker | Impact |
|---|---------|--------|
| B-01 | `task_id` used for QualityVerification + Rating (23 violations) | Every quality test tests the wrong architecture |
| B-02 | WorkApplication entirely absent | Staffing tests bypass mandatory application flow |
| B-03 | `POST /api/v1/staffing/assign` does not exist | All assignment integration + E2E tests will 404 |
| B-04 | PATCH used where POST is defined for start/complete | All start/complete tests will 405 |
| B-05 | `scheduled_at` on `taskFixture` not in schema | TypeScript build fails |
| B-06 | `updated_at` on `ratingFixture` not in schema | TypeScript build fails |
| B-07 | `created_at`/`updated_at` on `assignmentFixture` not in schema | TypeScript build fails |

**Path to APPROVED_WITH_PATCHES:**

1. Resolve all 7 Blockers (mandatory)
2. Resolve Major issues M-01 through M-08 (mandatory before Phase 1 implementation)
3. Minor issues N-01, N-04, N-07 (compilation/tooling — fix before CI runs)
4. Minor issues N-02, N-03, N-05, N-06 (cleanup — acceptable in PATCH V2)

**Estimated patch scope**: Full rewrite of Section 1 (Quality unit tests), Section 2 (integration quality + assignment), Section 3 (all E2E quality + application + attendance), Section 4 (7 fixture changes + 5 new fixtures).

---

*Audit complete. TESTING_MASTER_PLAN.md requires PATCH V2 before implementation begins.*
