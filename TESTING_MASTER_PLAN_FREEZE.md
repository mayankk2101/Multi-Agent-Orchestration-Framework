# TESTING MASTER PLAN — FREEZE

> **⚠️ NOTE (2026-06-19).** Any references to mocking "DigitalOcean Spaces" predate the migration to **AWS S3**. Mock the S3 client instead. All other testing guidance remains valid.
## Hotel CRM · Marketplace Architecture · Canonical Testing Record

**Status**: APPROVED — FROZEN  
**Effective**: 2026-06-09  
**Supersedes**: TESTING_MASTER_PLAN.md, TESTING_MASTER_PLAN_PATCH_V1.md, TESTING_MASTER_PLAN_PATCH_V2.md  
**Stack**: Express.js · TypeScript · Prisma · PostgreSQL · Jest · Supertest

---

## Pre-Implementation Requirement

Before any test runs, the following schema changes must be applied to `backend/prisma/schema.prisma` and migrated:

| Change | Detail |
|--------|--------|
| Add `WorkApplication` model | `PENDING → APPROVED → WorkerAssignment created` |
| Add `Attendance` model | `PENDING → CLOCKED_IN → CLOCKED_OUT → VERIFIED` |
| `QualityVerification.worker_assignment_id` | Replace `task_id` |
| `Rating.worker_assignment_id` | Replace `task_id` |

Schema shapes are defined in Section 4 (Fixture Strategy).

---

## 1. Unit Testing Scope

Unit tests cover **pure service logic in isolation**. All Prisma I/O, JWT, and external services are mocked. No database connection required.

### File Map

```
tests/unit/
├── staffing/
│   ├── service.test.ts               # WorkRequest + WorkerAssignment core logic
│   ├── work-application.test.ts      # WorkApplication state machine
│   ├── assignment-state.test.ts      # Valid/invalid status transitions
│   └── attendance.test.ts            # Attendance lifecycle
├── quality/
│   ├── verification.test.ts          # QualityVerification scoring rules
│   ├── rating.test.ts                # Rating 1–5 + WorkerOverallRating aggregate
│   └── leaderboard.test.ts           # Ranking algorithm
├── auth/
│   ├── jwt.test.ts
│   ├── auth-middleware.test.ts
│   └── permissions.test.ts
└── lib/
    ├── errors.test.ts
    └── utils.test.ts
```

### `staffing/service.test.ts`

| Test | Assertion |
|------|-----------|
| `assignWorkers` — ACTIVE worker + OPEN request | `workerAssignment.create` called; result status `ASSIGNED` |
| `assignWorkers` — FILLED request | throws |
| `assignWorkers` — worker outside hotel | throws |
| `assignWorkers` — fills last slot | `workRequest.update` called with `status: FILLED` |
| `startAssignment` — ASSIGNED → IN_PROGRESS | `update` called with `status: IN_PROGRESS`, `started_at` set |
| `startAssignment` — already COMPLETED | throws |
| `startAssignment` — wrong worker_id | throws |
| `completeAssignment` — IN_PROGRESS → COMPLETED | `update` called with `status: COMPLETED`, `completed_at` set |
| `completeAssignment` — not IN_PROGRESS | throws |

### `staffing/work-application.test.ts`

| Test | Assertion |
|------|-----------|
| `createApplication` — OPEN request | `workApplication.create` called; result status `PENDING` |
| `createApplication` — FILLED request | throws |
| `createApplication` — CANCELLED request | throws |
| `createApplication` — duplicate | throws |
| `approveApplication` — PENDING | `workApplication.update → APPROVED`; `workerAssignment.create` called |
| `approveApplication` — already APPROVED | throws |
| `approveApplication` — REJECTED | throws |
| `rejectApplication` — PENDING | `workApplication.update → REJECTED`; `workerAssignment.create` NOT called |
| `withdrawApplication` — own PENDING application | `workApplication.update → WITHDRAWN` |
| `withdrawApplication` — different worker | throws |
| `withdrawApplication` — already APPROVED | throws |

### `staffing/assignment-state.test.ts`

| From | To | Valid |
|------|-----|-------|
| ASSIGNED | IN_PROGRESS | ✅ |
| ASSIGNED | CANCELLED | ✅ |
| ASSIGNED | REASSIGNED | ✅ |
| IN_PROGRESS | COMPLETED | ✅ |
| IN_PROGRESS | CANCELLED | ✅ |
| IN_PROGRESS | ASSIGNED | ❌ |
| COMPLETED | IN_PROGRESS | ❌ |
| CANCELLED | ASSIGNED | ❌ |
| REASSIGNED | ASSIGNED | ❌ |

### `staffing/attendance.test.ts`

| Test | Assertion |
|------|-----------|
| `clockIn` — IN_PROGRESS assignment | Attendance created; `status: CLOCKED_IN`, `clock_in_at` set |
| `clockIn` — ASSIGNED (not started) | throws |
| `clockIn` — duplicate for same assignment | throws |
| `clockOut` — CLOCKED_IN | `status: CLOCKED_OUT`, `clock_out_at` set |
| `clockOut` — not CLOCKED_IN | throws |
| `verifyAttendance` — CLOCKED_OUT | `status: VERIFIED`, `verified_by_manager_id` set |
| `verifyAttendance` — not CLOCKED_OUT | throws |

### `quality/verification.test.ts`

| Test | Assertion |
|------|-----------|
| Creates verification with score 0–100 using `worker_assignment_id` | result score matches; `workerAssignment.findFirst` called |
| Score outside 0–100 | throws |
| Score < 60 → `needs_rework` | result status `needs_rework` |
| Duplicate `worker_assignment_id` | throws |
| Assignment not COMPLETED | throws |

### `quality/rating.test.ts`

| Test | Assertion |
|------|-----------|
| Creates rating using `worker_assignment_id` | result score matches; `workerOverallRating.upsert` called |
| New rating updates `WorkerOverallRating` average | `upsert` called |
| Score = 0 | throws |
| Score > 5 | throws |
| Duplicate `worker_assignment_id` | throws |

---

## 2. Integration Testing Scope

Integration tests run against a **live test PostgreSQL database**. The full Express app handles each request. Only third-party services (email, storage, push) are mocked.

### File Map

```
tests/integration/
├── staffing/
│   ├── work-requests.test.ts
│   ├── work-applications.test.ts
│   ├── assignments.test.ts
│   └── attendance.test.ts
├── quality/
│   ├── verifications.test.ts
│   └── ratings.test.ts
└── auth/
    └── jwt-flow.test.ts
```

### `staffing/assignments.test.ts`

| Route | Test | Expected |
|-------|------|----------|
| `POST /api/v1/staffing/work-requests/:id/assign-workers` | manager assigns worker | 201; `WorkerAssignment` in DB |
| `POST /api/v1/staffing/work-requests/:id/assign-workers` | worker role | 403 |
| `POST /api/v1/staffing/work-requests/:id/assign-workers` | FILLED request | 409 |
| `POST /api/v1/staffing/assignments/:id/start` | worker starts own assignment | 200; `status: IN_PROGRESS` |
| `POST /api/v1/staffing/assignments/:id/start` | different worker | 403 |
| `POST /api/v1/staffing/assignments/:id/complete` | worker completes IN_PROGRESS | 200; `status: COMPLETED` |
| `POST /api/v1/staffing/assignments/:id/complete` | assignment not IN_PROGRESS | 422 |

### `staffing/work-applications.test.ts`

| Route | Test | Expected |
|-------|------|----------|
| `POST /api/v1/staffing/work-requests/:id/apply` | worker applies to OPEN request | 201; `WorkApplication` in DB |
| `POST /api/v1/staffing/work-requests/:id/apply` | duplicate application | 409 |
| `POST /api/v1/staffing/work-requests/:id/apply` | FILLED request | 409 |
| `POST /api/v1/staffing/applications/:id/approve` | manager approves | 200; `WorkerAssignment` created |
| `POST /api/v1/staffing/applications/:id/approve` | worker role | 403 |
| `POST /api/v1/staffing/applications/:id/reject` | manager rejects | 200; no `WorkerAssignment` |
| `DELETE /api/v1/staffing/applications/:id` | worker withdraws own application | 200; `status: WITHDRAWN` |

### `staffing/attendance.test.ts`

| Route | Test | Expected |
|-------|------|----------|
| `POST /api/v1/staffing/assignments/:id/clock-in` | worker clocks in | 201; `Attendance(CLOCKED_IN)` |
| `POST /api/v1/staffing/assignments/:id/clock-in` | duplicate clock-in | 409 |
| `POST /api/v1/staffing/assignments/:id/clock-out` | worker clocks out | 200; `status: CLOCKED_OUT` |
| `PATCH /api/v1/staffing/attendance/:id/verify` | manager verifies | 200; `status: VERIFIED` |

### `quality/verifications.test.ts`

| Route | Test | Expected |
|-------|------|----------|
| `POST /api/v1/quality/verifications` | checker verifies completed assignment | 201; persisted with `worker_assignment_id` |
| `POST /api/v1/quality/verifications` | duplicate `worker_assignment_id` | 409 |
| `POST /api/v1/quality/verifications` | assignment not COMPLETED | 422 |

### `quality/ratings.test.ts`

| Route | Test | Expected |
|-------|------|----------|
| `POST /api/v1/quality/ratings` | checker rates worker | 201; `WorkerOverallRating` updated |
| `POST /api/v1/quality/ratings` | duplicate `worker_assignment_id` | 409 |
| `POST /api/v1/quality/ratings` | score 0 | 422 |
| `POST /api/v1/quality/ratings` | score 6 | 422 |

---

## 3. E2E Testing Scope

E2E tests exercise **complete marketplace flows** end-to-end. No mocks. Real database. Real Express app. Real JWT.

### File Map

```
tests/e2e/
├── helpers/
│   ├── api-client.ts
│   └── scenario.ts
└── flows/
    ├── worker-hiring-cycle.test.ts
    ├── worker-application.test.ts
    ├── quality-gate.test.ts
    └── attendance-tracking.test.ts
```

### `worker-hiring-cycle.test.ts`

**Happy path — full cycle:**
1. Manager creates WorkRequest → `status: OPEN`
2. Worker applies → `WorkApplication(PENDING)`
3. Manager approves → `WorkApplication(APPROVED)` + `WorkerAssignment(ASSIGNED)`
4. WorkRequest transitions to `FILLED`
5. Worker starts assignment → `WorkerAssignment(IN_PROGRESS)`, `started_at` set
6. Worker completes assignment → `WorkerAssignment(COMPLETED)`, `completed_at` set

**Partial fill path:**
- `workers_needed: 2`, assign 1 worker → `WorkRequest.status: PARTIALLY_FILLED`

### `worker-application.test.ts`

| Scenario | Outcome |
|----------|---------|
| Apply → Manager approves | `WorkerAssignment` in DB |
| Apply → Manager rejects | No `WorkerAssignment` |
| Worker withdraws PENDING application | `status: WITHDRAWN` |
| Duplicate application | 409 |

### `quality-gate.test.ts`

**Happy path:**
1. Seed completed `WorkerAssignment`
2. Checker verifies → `QualityVerification(verified)` with `worker_assignment_id`
3. Checker rates → `Rating(score: 4)` with `worker_assignment_id`
4. `GET /api/v1/quality/leaderboard/by-hotel/:hotel_id` → entry present with `average_score: 4`

**Needs-rework path:**
- Checker submits `score: 45` → `QualityVerification(needs_rework)`; `WorkerAssignment.status` returns to `ASSIGNED`

**Average calculation:**
- Two ratings for same worker (scores 4 and 2) → `WorkerOverallRating.average_score: 3`, `total_ratings: 2`

### `attendance-tracking.test.ts`

**Happy path:**
1. IN_PROGRESS assignment + worker clocks in → `Attendance(CLOCKED_IN)`, `clock_in_at` set
2. Worker clocks out → `Attendance(CLOCKED_OUT)`, `clock_out_at` set; `clock_out - clock_in ≥ 0`
3. Manager verifies → `Attendance(VERIFIED)`, `verified_by_manager_id` set, `verified_at` set
4. `GET /api/v1/staffing/assignments/:id/attendance` → attendance record retrievable

**Failure paths:**
- Wrong worker tries to clock in → 403

---

## 4. Fixture Strategy

### Schema additions (required in `prisma/schema.prisma`)

```prisma
model WorkApplication {
  id                     String      @id @default(cuid())
  work_request_id        String
  work_request           WorkRequest @relation(fields: [work_request_id], references: [id], onDelete: Cascade)
  worker_id              String
  worker                 User        @relation(fields: [worker_id], references: [id], onDelete: Cascade)
  status                 String      @default("PENDING") // PENDING | APPROVED | REJECTED | WITHDRAWN
  applied_at             DateTime    @default(now())
  notes                  String?
  reviewed_by_manager_id String?
  reviewed_by            User?       @relation("application_reviews", fields: [reviewed_by_manager_id], references: [id])
  reviewed_at            DateTime?

  @@unique([work_request_id, worker_id])
  @@index([work_request_id])
  @@index([worker_id])
  @@index([status])
}

model Attendance {
  id                     String          @id @default(cuid())
  worker_assignment_id   String          @unique
  worker_assignment      WorkerAssignment @relation(fields: [worker_assignment_id], references: [id], onDelete: Cascade)
  worker_id              String
  worker                 User            @relation(fields: [worker_id], references: [id])
  hotel_id               String
  hotel                  Hotel           @relation(fields: [hotel_id], references: [id])
  clock_in_at            DateTime?
  clock_out_at           DateTime?
  status                 String          @default("PENDING") // PENDING | CLOCKED_IN | CLOCKED_OUT | VERIFIED | DISPUTED
  verified_by_manager_id String?
  verified_by            User?           @relation("attendance_verifications", fields: [verified_by_manager_id], references: [id])
  verified_at            DateTime?
  notes                  String?
  created_at             DateTime        @default(now())
  updated_at             DateTime        @updatedAt

  @@index([worker_assignment_id])
  @@index([worker_id])
  @@index([hotel_id])
  @@index([status])
}
```

**`QualityVerification` — replace `task_id` with `worker_assignment_id`:**

```prisma
// Remove:
task_id   String @unique
task      Task   @relation(...)

// Add:
worker_assignment_id  String          @unique
worker_assignment     WorkerAssignment @relation(fields: [worker_assignment_id], references: [id], onDelete: Cascade)
```

**`Rating` — replace `task_id` with `worker_assignment_id`:**

```prisma
// Remove:
task_id   String @unique
task      Task   @relation(...)

// Add:
worker_assignment_id  String          @unique
worker_assignment     WorkerAssignment @relation(fields: [worker_assignment_id], references: [id], onDelete: Cascade)
```

---

### `tests/fixtures/index.ts` — In-memory fixtures

```typescript
import { faker } from '@faker-js/faker';
import type { User, WorkRequest, WorkerAssignment, Hotel } from '@prisma/client';

export const hotelFixture = (overrides: Partial<Hotel> = {}): Hotel => ({
  id:         faker.string.uuid(),
  name:       faker.company.name() + ' Hotel',
  city:       'Berlin',
  country:    'Germany',
  address:    faker.location.streetAddress(),
  timezone:   'Europe/Berlin',
  is_active:  true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export const workerFixture = (overrides: Partial<User> = {}): User => ({
  id:                faker.string.uuid(),
  email:             faker.internet.email(),
  password_hash:     '$2b$10$hashedpassword',
  first_name:        faker.person.firstName(),
  last_name:         faker.person.lastName(),
  phone:             faker.phone.number(),
  profile_photo_url: null,
  role:              'WORKER',
  hotel_ids:         [faker.string.uuid()],
  permissions:       ['staffing:read'],
  is_active:         true,
  deleted_at:        null,
  created_at:        new Date(),
  updated_at:        new Date(),
  ...overrides,
});

export const managerFixture = (o: Partial<User> = {}) =>
  workerFixture({ role: 'MANAGER', permissions: ['staffing:write', 'staffing:read', 'quality:read'], ...o });

export const checkerFixture = (o: Partial<User> = {}) =>
  workerFixture({ role: 'CHECKER', permissions: ['quality:write', 'quality:read'], ...o });

export const workRequestFixture = (overrides: Partial<WorkRequest> = {}): WorkRequest => ({
  id:                    faker.string.uuid(),
  hotel_id:              faker.string.uuid(),
  created_by_manager_id: faker.string.uuid(),
  position:              'housekeeping',
  workers_needed:        2,
  shift_date:            new Date('2026-06-10'),
  shift_start_time:      '08:00',
  shift_end_time:        '16:00',
  notes:                 null,
  status:                'OPEN',
  created_at:            new Date(),
  filled_at:             null,
  cancelled_at:          null,
  ...overrides,
});

export const workApplicationFixture = (overrides: Record<string, any> = {}) => ({
  id:                     faker.string.uuid(),
  work_request_id:        faker.string.uuid(),
  worker_id:              faker.string.uuid(),
  status:                 'PENDING',
  applied_at:             new Date(),
  notes:                  null,
  reviewed_by_manager_id: null,
  reviewed_at:            null,
  ...overrides,
});

// Fields per schema: no created_at, no updated_at; has reassigned_at
export const assignmentFixture = (overrides: Partial<WorkerAssignment> = {}): WorkerAssignment => ({
  id:                      faker.string.uuid(),
  worker_id:               faker.string.uuid(),
  work_request_id:         faker.string.uuid(),
  assigned_by_manager_id:  faker.string.uuid(),
  status:                  'ASSIGNED',
  assigned_at:             new Date(),
  started_at:              null,
  completed_at:            null,
  previous_assignment_id:  null,
  reassigned_at:           null,
  ...overrides,
});

export const verificationFixture = (overrides: Record<string, any> = {}) => ({
  id:                     faker.string.uuid(),
  worker_assignment_id:   faker.string.uuid(),
  hotel_id:               faker.string.uuid(),
  verified_by_checker_id: faker.string.uuid(),
  score:                  85,
  notes:                  'Good work',
  status:                 'verified',
  created_at:             new Date(),
  updated_at:             new Date(),
  ...overrides,
});

// Rating schema has no updated_at
export const ratingFixture = (overrides: Record<string, any> = {}) => ({
  id:                   faker.string.uuid(),
  worker_assignment_id: faker.string.uuid(),
  hotel_id:             faker.string.uuid(),
  worker_id:            faker.string.uuid(),
  rated_by_checker_id:  faker.string.uuid(),
  score:                4,
  comment:              null,
  created_at:           new Date(),
  ...overrides,
});

export const overallRatingFixture = (overrides: Record<string, any> = {}) => ({
  id:            faker.string.uuid(),
  worker_id:     faker.string.uuid(),
  average_score: 4.0,
  total_ratings: 1,
  updated_at:    new Date(),
  ...overrides,
});

export const attendanceFixture = (overrides: Record<string, any> = {}) => ({
  id:                     faker.string.uuid(),
  worker_assignment_id:   faker.string.uuid(),
  worker_id:              faker.string.uuid(),
  hotel_id:               faker.string.uuid(),
  clock_in_at:            null,
  clock_out_at:           null,
  status:                 'PENDING',
  verified_by_manager_id: null,
  verified_at:            null,
  notes:                  null,
  created_at:             new Date(),
  updated_at:             new Date(),
  ...overrides,
});
```

---

### `tests/fixtures/db-seeds.ts` — Database fixtures

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

const prisma = () => (global as any).prisma as PrismaClient;

let _hashedPassword: string | null = null;
async function hashedPassword(): Promise<string> {
  if (!_hashedPassword) _hashedPassword = await bcrypt.hash('Test1234!', 10);
  return _hashedPassword;
}

export const seedHotel = (overrides: Record<string, any> = {}) =>
  prisma().hotel.create({
    data: {
      name: faker.company.name() + ' Hotel',
      city: 'Berlin', country: 'Germany',
      address: faker.location.streetAddress(),
      timezone: 'Europe/Berlin', is_active: true,
      ...overrides,
    },
  });

export const seedWorker = async ({ hotel_id, ...overrides }: { hotel_id: string } & Record<string, any>) =>
  prisma().user.create({
    data: {
      email: faker.internet.email(), password_hash: await hashedPassword(),
      first_name: faker.person.firstName(), last_name: faker.person.lastName(),
      phone: faker.phone.number(), role: 'WORKER',
      hotel_ids: [hotel_id], permissions: ['staffing:read'], is_active: true,
      ...overrides,
    },
  });

export const seedManager = ({ hotel_id, ...o }: { hotel_id: string } & Record<string, any>) =>
  seedWorker({ hotel_id, role: 'MANAGER', permissions: ['staffing:write', 'staffing:read', 'quality:read'], ...o });

export const seedChecker = ({ hotel_id, ...o }: { hotel_id: string } & Record<string, any>) =>
  seedWorker({ hotel_id, role: 'CHECKER', permissions: ['quality:write', 'quality:read'], ...o });

export const seedWorkRequest = ({
  hotel_id, manager_id, overrides = {},
}: { hotel_id: string; manager_id: string; overrides?: Record<string, any> }) =>
  prisma().workRequest.create({
    data: {
      hotel_id, created_by_manager_id: manager_id,
      position: 'housekeeping', workers_needed: 1,
      shift_date: new Date('2026-06-10'),
      shift_start_time: '08:00', shift_end_time: '16:00', status: 'OPEN',
      ...overrides,
    },
  });

export const seedWorkApplication = ({
  work_request_id, worker_id, overrides = {},
}: { work_request_id: string; worker_id: string; overrides?: Record<string, any> }) =>
  prisma().workApplication.create({
    data: { work_request_id, worker_id, status: 'PENDING', ...overrides },
  });

export const seedAssignment = ({
  work_request_id, worker_id, manager_id, overrides = {},
}: { work_request_id: string; worker_id: string; manager_id: string; overrides?: Record<string, any> }) =>
  prisma().workerAssignment.create({
    data: {
      worker_id, work_request_id,
      assigned_by_manager_id: manager_id,
      status: 'ASSIGNED', assigned_at: new Date(),
      ...overrides,
    },
  });

export const seedAttendance = ({
  assignment, worker, hotel, overrides = {},
}: { assignment: any; worker: any; hotel: any; overrides?: Record<string, any> }) =>
  prisma().attendance.create({
    data: {
      worker_assignment_id: assignment.id,
      worker_id: worker.id, hotel_id: hotel.id,
      status: 'PENDING', ...overrides,
    },
  });

// Composite: hotel + manager + worker + checker + OPEN WorkRequest + ASSIGNED WorkerAssignment
export const seedAssignedWorker = async () => {
  const hotel   = await seedHotel();
  const manager = await seedManager({ hotel_id: hotel.id });
  const worker  = await seedWorker({ hotel_id: hotel.id });
  const workReq = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
  const application = await seedWorkApplication({ work_request_id: workReq.id, worker_id: worker.id });
  const assignment  = await seedAssignment({ work_request_id: workReq.id, worker_id: worker.id, manager_id: manager.id });
  return { hotel, manager, worker, workReq, application, assignment };
};

// Composite: all above + assignment status COMPLETED
export const seedCompletedAssignment = async () => {
  const hotel   = await seedHotel();
  const manager = await seedManager({ hotel_id: hotel.id });
  const worker  = await seedWorker({ hotel_id: hotel.id });
  const checker = await seedChecker({ hotel_id: hotel.id });
  const workReq = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
  const assignment = await seedAssignment({
    work_request_id: workReq.id, worker_id: worker.id, manager_id: manager.id,
    overrides: { status: 'COMPLETED', started_at: new Date(), completed_at: new Date() },
  });
  return { hotel, manager, worker, checker, workReq, assignment };
};
```

---

## 5. Mocking Strategy

### Principle

| Layer | Database | External Services |
|-------|----------|-------------------|
| Unit | Fully mocked via `jest-mock-extended` | Mocked |
| Integration | Real test DB | Mocked |
| E2E | Real test DB | Mocked |

### Prisma mock (`tests/mocks/prisma.ts`)

```typescript
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

export const prismaMock = mockDeep<PrismaClient>();
beforeEach(() => { mockReset(prismaMock); });
```

### External services mock (`tests/mocks/external.ts`)

```typescript
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-spaces.url/file.jpg'),
}));
jest.mock('firebase-admin', () => ({
  messaging: () => ({ send: jest.fn().mockResolvedValue({ name: 'mock-id' }) }),
}));
```

### Auth helper (`tests/helpers/auth.ts`)

```typescript
import { generateToken } from '@/lib/jwt';
import type { User } from '@prisma/client';

export const tokenFor = (user: User): string =>
  generateToken({
    sub:         user.id,
    email:       user.email,
    role:        user.role,
    hotel_ids:   user.hotel_ids,
    permissions: user.permissions,
  });
```

### ApiClient (`tests/e2e/helpers/api-client.ts`)

```typescript
import request from 'supertest';
import type { Application } from 'express';
import type { User } from '@prisma/client';
import { tokenFor } from '../../helpers/auth';

export class ApiClient {
  private app: Application;
  private token?: string;

  constructor(app: Application) { this.app = app; }

  as(user: User): ApiClient {
    const client = new ApiClient(this.app);
    client.token = tokenFor(user);
    return client;
  }

  private auth(req: any) {
    return this.token ? req.set('Authorization', `Bearer ${this.token}`) : req;
  }

  get(path: string)    { return this.auth(request(this.app).get(path)); }
  post(path: string)   { return this.auth(request(this.app).post(path)); }
  patch(path: string)  { return this.auth(request(this.app).patch(path)); }
  delete(path: string) { return this.auth(request(this.app).delete(path)); }
}
```

---

## 6. Coverage Targets

### Global thresholds

| Metric | Target |
|--------|--------|
| Statements | **85%** |
| Branches | **80%** |
| Functions | **85%** |
| Lines | **85%** |

### Per-module targets

| Module | Statements | Branches | Rationale |
|--------|-----------|----------|-----------|
| `staffing/service.ts` | 95% | 90% | Core marketplace — assignment + application state machines |
| `quality/service.ts` | 95% | 90% | Rating affects worker pay |
| `auth/` middleware | 90% | 85% | Security boundary |
| `lib/errors.ts` | 95% | 90% | All error paths |
| `lib/jwt.ts` | 95% | 90% | Auth critical path |
| `crm/service.ts` | 80% | 75% | Standard CRUD |
| `hr/service.ts` | 80% | 75% | Standard CRUD |

### Critical branches

| File | Branch |
|------|--------|
| `staffing/service.ts` | `assignment.status !== 'ASSIGNED'` on `startAssignment` |
| `staffing/service.ts` | `work_request.status === 'FILLED'` on assign / apply |
| `staffing/service.ts` | `application.status !== 'PENDING'` on approve / reject |
| `staffing/service.ts` | `attendance.status !== 'CLOCKED_IN'` on `clockOut` |
| `quality/service.ts` | `score < 60` → `needs_rework` |
| `quality/service.ts` | Duplicate `worker_assignment_id` guard |
| `middleware/auth.ts` | Missing header / malformed token / expired token |
| `middleware/permissions.ts` | Wildcard permission match |

### Excluded paths

```
src/server.ts
src/config/env.ts
src/lib/logger.ts
prisma/
```

---

## 7. CI Execution Order

```
Push / PR
    │
    ├─▶ [Parallel] TypeScript check  +  ESLint
    │                │
    │                ▼ both pass
    ├─▶ Unit Tests  (~30s, no DB)
    │                │
    │                ▼ pass
    ├─▶ Integration Tests  (~90s, test DB)
    │                │
    │   [Parallel]   ▼ pass
    ├─▶ E2E Tests    (~2min, test DB)
    └─▶ Coverage Gate
```

### `backend/jest.config.ts`

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: { '^.+\\.tsx?$': ['ts-jest', { useESM: true }] },
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/modules/**/*.ts',
    'src/lib/**/*.ts',
    'src/middleware/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThresholds: {
    global: { branches: 80, functions: 85, lines: 85, statements: 85 },
    './src/modules/staffing/service.ts': { branches: 90, functions: 95, lines: 95, statements: 95 },
    './src/modules/quality/service.ts':  { branches: 90, functions: 95, lines: 95, statements: 95 },
  },
  globalSetup:        '<rootDir>/tests/setup/globalSetup.ts',
  globalTeardown:     '<rootDir>/tests/setup/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/testEnv.ts'],
  projects: [
    { displayName: 'unit',        testMatch: ['<rootDir>/tests/unit/**/*.test.ts'] },
    { displayName: 'integration', testMatch: ['<rootDir>/tests/integration/**/*.test.ts'] },
    { displayName: 'e2e',         testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'] },
  ],
};

export default config;
```

### `backend/package.json` scripts

```json
{
  "scripts": {
    "test":             "jest",
    "test:unit":        "jest --selectProjects unit",
    "test:integration": "dotenv-cli -e .env.test -- jest --selectProjects integration --runInBand",
    "test:e2e":         "dotenv-cli -e .env.test -- jest --selectProjects e2e --runInBand",
    "test:coverage":    "jest --coverage --coverageReporters=lcov,text",
    "test:ci":          "jest --ci --coverage --forceExit"
  }
}
```

### `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop, 'claude/*']
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20'
  POSTGRES_USER: hotelcrm
  POSTGRES_PASSWORD: hotelcrm
  POSTGRES_DB: hotelcrm_test

jobs:

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - run: cd backend && npm ci && npm run typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - run: cd backend && npm ci && npm run lint

  unit-tests:
    runs-on: ubuntu-latest
    needs: [typecheck, lint]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - run: cd backend && npm ci
      - run: cd backend && npm run test:unit -- --coverage --coverageReporters=lcov,json
      - uses: actions/upload-artifact@v4
        with: { name: unit-coverage, path: backend/coverage/ }

  integration-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests]
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER:     ${{ env.POSTGRES_USER }}
          POSTGRES_PASSWORD: ${{ env.POSTGRES_PASSWORD }}
          POSTGRES_DB:       ${{ env.POSTGRES_DB }}
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - run: cd backend && npm ci
      - run: cd backend && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://${{ env.POSTGRES_USER }}:${{ env.POSTGRES_PASSWORD }}@localhost:5432/${{ env.POSTGRES_DB }}
      - run: cd backend && npm run test:integration -- --coverage --coverageReporters=lcov,json
        env:
          DATABASE_URL: postgresql://${{ env.POSTGRES_USER }}:${{ env.POSTGRES_PASSWORD }}@localhost:5432/${{ env.POSTGRES_DB }}
          JWT_SECRET: ci-test-secret-32-characters-min-x
          NODE_ENV: test
          LOG_LEVEL: silent
      - uses: actions/upload-artifact@v4
        with: { name: integration-coverage, path: backend/coverage/ }

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [integration-tests]
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER:     ${{ env.POSTGRES_USER }}
          POSTGRES_PASSWORD: ${{ env.POSTGRES_PASSWORD }}
          POSTGRES_DB:       ${{ env.POSTGRES_DB }}
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - run: cd backend && npm ci
      - run: cd backend && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://${{ env.POSTGRES_USER }}:${{ env.POSTGRES_PASSWORD }}@localhost:5432/${{ env.POSTGRES_DB }}
      - run: cd backend && npm run test:e2e
        env:
          DATABASE_URL: postgresql://${{ env.POSTGRES_USER }}:${{ env.POSTGRES_PASSWORD }}@localhost:5432/${{ env.POSTGRES_DB }}
          JWT_SECRET: ci-test-secret-32-characters-min-x
          NODE_ENV: test
          LOG_LEVEL: silent

  coverage-gate:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - uses: actions/download-artifact@v4
        with: { name: unit-coverage, path: backend/coverage/unit }
      - uses: actions/download-artifact@v4
        with: { name: integration-coverage, path: backend/coverage/integration }
      - run: cd backend && npm ci
      - run: |
          cd backend && npx jest --coverage \
            --coverageDirectory=coverage/merged \
            --coverageThreshold='{"global":{"branches":80,"functions":85,"lines":85,"statements":85}}'
```

### Local commands

```bash
npm run test:unit --watch                                   # fast inner loop
npm run test:unit && npm run test:integration               # before push
npm run test:coverage && open coverage/lcov-report/index.html
jest --testPathPattern="staffing" --watch                  # single module
```

---

## 8. Marketplace Workflow Coverage Matrix

### Entity Coverage

| Entity | Unit | Integration | E2E |
|--------|:----:|:-----------:|:---:|
| WorkRequest | ✅ | ✅ | ✅ |
| WorkApplication | ✅ | ✅ | ✅ |
| WorkerAssignment | ✅ | ✅ | ✅ |
| Attendance | ✅ | ✅ | ✅ |
| QualityVerification | ✅ | ✅ | ✅ |
| Rating | ✅ | ✅ | ✅ |
| WorkerOverallRating | ✅ | ✅ | ✅ |

### Route Coverage

| Method | Route | Integration | E2E |
|--------|-------|:-----------:|:---:|
| POST | `/api/v1/staffing/work-requests` | ✅ | ✅ |
| GET  | `/api/v1/staffing/available-workers` | ✅ | — |
| POST | `/api/v1/staffing/work-requests/:id/assign-workers` | ✅ | ✅ |
| POST | `/api/v1/staffing/work-requests/:id/apply` | ✅ | ✅ |
| POST | `/api/v1/staffing/applications/:id/approve` | ✅ | ✅ |
| POST | `/api/v1/staffing/applications/:id/reject` | ✅ | ✅ |
| DELETE | `/api/v1/staffing/applications/:id` | ✅ | ✅ |
| POST | `/api/v1/staffing/assignments/:id/start` | ✅ | ✅ |
| POST | `/api/v1/staffing/assignments/:id/complete` | ✅ | ✅ |
| POST | `/api/v1/staffing/assignments/:id/clock-in` | ✅ | ✅ |
| POST | `/api/v1/staffing/assignments/:id/clock-out` | ✅ | ✅ |
| PATCH | `/api/v1/staffing/attendance/:id/verify` | ✅ | ✅ |
| GET  | `/api/v1/staffing/assignments/:id/attendance` | ✅ | ✅ |
| POST | `/api/v1/quality/verifications` | ✅ | ✅ |
| POST | `/api/v1/quality/ratings` | ✅ | ✅ |
| GET  | `/api/v1/quality/leaderboard` | ✅ | — |
| GET  | `/api/v1/quality/leaderboard/by-hotel/:hotel_id` | ✅ | ✅ |

### Workflow Coverage

| Workflow | Happy Path | Failure Paths |
|----------|:----------:|:-------------:|
| Create work request | ✅ | — |
| Worker applies | ✅ | Filled (409), Duplicate (409), Cancelled (422) |
| Manager approves application | ✅ | Non-manager (403), Already approved (422) |
| Manager rejects application | ✅ | Non-manager (403) |
| Worker withdraws application | ✅ | Wrong worker (403), Already approved (422) |
| Assign workers directly | ✅ | Non-manager (403), Filled (409) |
| Worker starts assignment | ✅ | Wrong worker (403), Wrong state (422) |
| Worker completes assignment | ✅ | Wrong state (422) |
| Partial fill (PARTIALLY_FILLED) | ✅ | — |
| Worker clock-in | ✅ | Wrong worker (403), Duplicate (409) |
| Worker clock-out | ✅ | Not clocked-in (422) |
| Manager verifies attendance | ✅ | Not clocked-out (422) |
| Checker verifies assignment | ✅ | Duplicate (409), Not completed (422) |
| Checker rates worker | ✅ | Duplicate (409), Score 0 (422), Score > 5 (422) |
| Leaderboard by hotel | ✅ | — |
| Needs-rework flow (score < 60) | ✅ | — |
| Multiple ratings → correct average | ✅ | — |

### Fixture Coverage

| Fixture | Unit | Integration | E2E |
|---------|:----:|:-----------:|:---:|
| `hotelFixture` / `seedHotel` | ✅ | ✅ | ✅ |
| `workerFixture` / `seedWorker` | ✅ | ✅ | ✅ |
| `managerFixture` / `seedManager` | ✅ | ✅ | ✅ |
| `checkerFixture` / `seedChecker` | ✅ | ✅ | ✅ |
| `workRequestFixture` / `seedWorkRequest` | ✅ | ✅ | ✅ |
| `workApplicationFixture` / `seedWorkApplication` | ✅ | ✅ | ✅ |
| `assignmentFixture` / `seedAssignment` | ✅ | ✅ | ✅ |
| `verificationFixture` | ✅ | — | — |
| `ratingFixture` | ✅ | — | — |
| `overallRatingFixture` | ✅ | — | — |
| `attendanceFixture` / `seedAttendance` | ✅ | ✅ | ✅ |
| `seedAssignedWorker` (composite) | — | ✅ | ✅ |
| `seedCompletedAssignment` (composite) | — | ✅ | ✅ |

---

## Final Status

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   STATUS:   APPROVED — FROZEN                                    ║
║                                                                  ║
║   This document is the canonical testing source of truth.       ║
║   No further audits or patches are required.                     ║
║   Implement directly from this document.                         ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

| Dimension | Count |
|-----------|------:|
| Unit test files | 11 |
| Integration test files | 7 |
| E2E test files | 4 |
| Entities covered | 7 |
| Routes covered | 17 |
| Workflows covered (happy + failure) | 32 |
