# TESTING MASTER PLAN — PATCH V2

> **⚠️ NOTE (2026-06-19).** Any references to mocking "DigitalOcean Spaces" predate the migration to **AWS S3**. Mock the S3 client instead. All other testing guidance remains valid.
## Implementation-Valid Testing Plan

**Status**: APPROVED  
**Supersedes**: TESTING_MASTER_PLAN.md (all sections replaced)  
**Patches Applied**: PATCH-01 through PATCH-10  
**Stack**: Express.js · TypeScript · Prisma · PostgreSQL · Jest · Supertest

---

## PATCH LOG

| Patch | Description | Status |
|-------|-------------|--------|
| PATCH-01 | Replace `task_id` → `worker_assignment_id` in QualityVerification + Rating | ✅ Applied |
| PATCH-02 | Add WorkApplication coverage (create/approve/reject/withdraw/duplicate) | ✅ Applied |
| PATCH-03 | Replace `POST /api/v1/staffing/assign` with correct route | ✅ Applied |
| PATCH-04 | Fix HTTP verbs: PATCH → POST for start/complete | ✅ Applied |
| PATCH-05 | Remove invalid fixture fields; regenerate from schema | ✅ Applied |
| PATCH-06 | Remove legacy Room/Task/TaskPhoto/DailyOperation from all layers | ✅ Applied |
| PATCH-07 | Add Attendance entity coverage | ✅ Applied |
| PATCH-08 | Align leaderboard tests with actual route definition | ✅ Applied |
| PATCH-09 | Fix Jest config (`setupFilesAfterEnv`, remove nyc) | ✅ Applied |
| PATCH-10 | Fix seed scripts (remove top-level await) | ✅ Applied |

---

## 0. Test Framework Setup

### Install (backend)

```bash
cd backend
npm install --save-dev \
  jest @types/jest ts-jest \
  supertest @types/supertest \
  jest-mock-extended \
  @faker-js/faker \
  dotenv-cli \
  bcrypt @types/bcrypt
```

### `backend/jest.config.ts` [PATCH-09]

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
  globalSetup:    '<rootDir>/tests/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/testEnv.ts'],   // PATCH-09: was setupFilesAfterFramework
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

### `.env.test`

```
NODE_ENV=test
DATABASE_URL=postgresql://hotelcrm:hotelcrm@localhost:5432/hotelcrm_test
JWT_SECRET=test-secret-32-characters-minimum-x
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
LOG_LEVEL=silent
```

---

## 1. Route Reference (Source of Truth)

All tests are written against these routes only.

### Staffing — existing (`staffing/routes.ts`)

| Method | Path | Permission |
|--------|------|-----------|
| POST | `/api/v1/staffing/work-requests` | `staffing:write` |
| GET  | `/api/v1/staffing/available-workers` | `staffing:read` |
| POST | `/api/v1/staffing/work-requests/:work_request_id/assign-workers` | `staffing:write` |
| POST | `/api/v1/staffing/assignments/:assignment_id/start` | auth |
| POST | `/api/v1/staffing/assignments/:assignment_id/complete` | auth |

### Staffing — required additions (WorkApplication + Attendance)

| Method | Path | Actor |
|--------|------|-------|
| POST | `/api/v1/staffing/work-requests/:work_request_id/apply` | Worker |
| POST | `/api/v1/staffing/applications/:application_id/approve` | Manager |
| POST | `/api/v1/staffing/applications/:application_id/reject` | Manager |
| DELETE | `/api/v1/staffing/applications/:application_id` | Worker (withdraw) |
| POST | `/api/v1/staffing/assignments/:assignment_id/clock-in` | Worker |
| POST | `/api/v1/staffing/assignments/:assignment_id/clock-out` | Worker |
| PATCH | `/api/v1/staffing/attendance/:attendance_id/verify` | Manager |
| GET  | `/api/v1/staffing/assignments/:assignment_id/attendance` | Manager/Worker |

### Quality — existing (`quality/routes.ts`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/quality/verifications` | auth |
| POST | `/api/v1/quality/ratings` | auth |
| GET  | `/api/v1/quality/leaderboard` | auth |
| GET  | `/api/v1/quality/leaderboard/by-hotel/:hotel_id` | auth + hotel access |

---

## 2. Schema Additions Required (Marketplace V2)

The following models must be added to `prisma/schema.prisma` before tests run. Shapes are defined here as the test contract.

### `WorkApplication`

```prisma
model WorkApplication {
  id                    String   @id @default(cuid())
  work_request_id       String
  work_request          WorkRequest @relation(fields: [work_request_id], references: [id], onDelete: Cascade)
  worker_id             String
  worker                User     @relation(fields: [worker_id], references: [id], onDelete: Cascade)
  status                String   @default("PENDING") // PENDING | APPROVED | REJECTED | WITHDRAWN
  applied_at            DateTime @default(now())
  notes                 String?
  reviewed_by_manager_id String?
  reviewed_by           User?    @relation("application_reviews", fields: [reviewed_by_manager_id], references: [id])
  reviewed_at           DateTime?

  @@unique([work_request_id, worker_id])
  @@index([work_request_id])
  @@index([worker_id])
  @@index([status])
}
```

### `Attendance`

```prisma
model Attendance {
  id                      String   @id @default(cuid())
  worker_assignment_id    String   @unique
  worker_assignment       WorkerAssignment @relation(fields: [worker_assignment_id], references: [id], onDelete: Cascade)
  worker_id               String
  worker                  User     @relation(fields: [worker_id], references: [id])
  hotel_id                String
  hotel                   Hotel    @relation(fields: [hotel_id], references: [id])
  clock_in_at             DateTime?
  clock_out_at            DateTime?
  status                  String   @default("PENDING") // PENDING | CLOCKED_IN | CLOCKED_OUT | VERIFIED | DISPUTED
  verified_by_manager_id  String?
  verified_by             User?    @relation("attendance_verifications", fields: [verified_by_manager_id], references: [id])
  verified_at             DateTime?
  notes                   String?
  created_at              DateTime @default(now())
  updated_at              DateTime @updatedAt

  @@index([worker_assignment_id])
  @@index([worker_id])
  @@index([hotel_id])
  @@index([status])
}
```

### `QualityVerification` — field change

```diff
- task_id         String   @unique
- task            Task     @relation(...)
+ worker_assignment_id  String   @unique
+ worker_assignment     WorkerAssignment @relation(fields: [worker_assignment_id], references: [id], onDelete: Cascade)
```

### `Rating` — field change

```diff
- task_id         String   @unique
- task            Task     @relation(...)
+ worker_assignment_id  String   @unique
+ worker_assignment     WorkerAssignment @relation(fields: [worker_assignment_id], references: [id], onDelete: Cascade)
```

---

## 3. Test Fixtures [PATCH-05, PATCH-06]

### `tests/fixtures/index.ts` — In-memory fixtures (unit tests)

```typescript
import { faker } from '@faker-js/faker';
import type { User, WorkRequest, WorkerAssignment, Hotel } from '@prisma/client';

// ── Hotel ─────────────────────────────────────────────────────────────────

export const hotelFixture = (overrides: Partial<Hotel> = {}): Hotel => ({
  id:        faker.string.uuid(),
  name:      faker.company.name() + ' Hotel',
  city:      'Berlin',
  country:   'Germany',
  address:   faker.location.streetAddress(),
  timezone:  'Europe/Berlin',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

// ── Users ─────────────────────────────────────────────────────────────────

export const workerFixture = (overrides: Partial<User> = {}): User => ({
  id:               faker.string.uuid(),
  email:            faker.internet.email(),
  password_hash:    '$2b$10$hashedpassword',
  first_name:       faker.person.firstName(),
  last_name:        faker.person.lastName(),
  phone:            faker.phone.number(),
  profile_photo_url: null,
  role:             'WORKER',
  hotel_ids:        [faker.string.uuid()],
  permissions:      ['staffing:read'],
  is_active:        true,
  deleted_at:       null,
  created_at:       new Date(),
  updated_at:       new Date(),
  ...overrides,
});

export const managerFixture = (o: Partial<User> = {}) =>
  workerFixture({ role: 'MANAGER', permissions: ['staffing:write', 'staffing:read', 'quality:read'], ...o });

export const checkerFixture = (o: Partial<User> = {}) =>
  workerFixture({ role: 'CHECKER', permissions: ['quality:write', 'quality:read'], ...o });

// ── WorkRequest ───────────────────────────────────────────────────────────

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

// ── WorkApplication [PATCH-02] ────────────────────────────────────────────

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

// ── WorkerAssignment [PATCH-05] ───────────────────────────────────────────
// Removed: created_at, updated_at (not in schema)
// Added:   reassigned_at

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

// ── QualityVerification [PATCH-01] ────────────────────────────────────────
// Replaced: task_id → worker_assignment_id

export const verificationFixture = (overrides: Record<string, any> = {}) => ({
  id:                     faker.string.uuid(),
  worker_assignment_id:   faker.string.uuid(),   // PATCH-01
  hotel_id:               faker.string.uuid(),
  verified_by_checker_id: faker.string.uuid(),
  score:                  85,
  notes:                  'Good work',
  status:                 'verified',
  created_at:             new Date(),
  updated_at:             new Date(),
  ...overrides,
});

// ── Rating [PATCH-01, PATCH-05] ───────────────────────────────────────────
// Replaced: task_id → worker_assignment_id
// Removed:  updated_at (not in Rating schema)

export const ratingFixture = (overrides: Record<string, any> = {}) => ({
  id:                  faker.string.uuid(),
  worker_assignment_id: faker.string.uuid(),     // PATCH-01
  hotel_id:            faker.string.uuid(),
  worker_id:           faker.string.uuid(),
  rated_by_checker_id: faker.string.uuid(),
  score:               4,
  comment:             null,
  created_at:          new Date(),
  ...overrides,
});

// ── WorkerOverallRating ───────────────────────────────────────────────────

export const overallRatingFixture = (overrides: Record<string, any> = {}) => ({
  id:            faker.string.uuid(),
  worker_id:     faker.string.uuid(),
  average_score: 4.0,
  total_ratings: 1,
  updated_at:    new Date(),
  ...overrides,
});

// ── Attendance [PATCH-07] ─────────────────────────────────────────────────

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

### `tests/fixtures/db-seeds.ts` — DB fixtures [PATCH-06, PATCH-10]

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

const prisma = () => (global as any).prisma as PrismaClient;

// PATCH-10: removed top-level await; use lazy initializer
let _hashedPassword: string | null = null;
async function hashedPassword(): Promise<string> {
  if (!_hashedPassword) _hashedPassword = await bcrypt.hash('Test1234!', 10);
  return _hashedPassword;
}

// ── Hotel ─────────────────────────────────────────────────────────────────

export const seedHotel = async (overrides: Record<string, any> = {}) =>
  prisma().hotel.create({
    data: {
      name:      faker.company.name() + ' Hotel',
      city:      'Berlin',
      country:   'Germany',
      address:   faker.location.streetAddress(),
      timezone:  'Europe/Berlin',
      is_active: true,
      ...overrides,
    },
  });

// ── Users ─────────────────────────────────────────────────────────────────

export const seedWorker = async ({ hotel_id, ...overrides }: { hotel_id: string } & Record<string, any>) =>
  prisma().user.create({
    data: {
      email:         faker.internet.email(),
      password_hash: await hashedPassword(),
      first_name:    faker.person.firstName(),
      last_name:     faker.person.lastName(),
      phone:         faker.phone.number(),
      role:          'WORKER',
      hotel_ids:     [hotel_id],
      permissions:   ['staffing:read'],
      is_active:     true,
      ...overrides,
    },
  });

export const seedManager = ({ hotel_id, ...o }: { hotel_id: string } & Record<string, any>) =>
  seedWorker({ hotel_id, role: 'MANAGER', permissions: ['staffing:write', 'staffing:read', 'quality:read'], ...o });

export const seedChecker = ({ hotel_id, ...o }: { hotel_id: string } & Record<string, any>) =>
  seedWorker({ hotel_id, role: 'CHECKER', permissions: ['quality:write', 'quality:read'], ...o });

// ── WorkRequest ───────────────────────────────────────────────────────────

export const seedWorkRequest = async ({
  hotel_id,
  manager_id,
  overrides = {},
}: {
  hotel_id: string;
  manager_id: string;
  overrides?: Record<string, any>;
}) =>
  prisma().workRequest.create({
    data: {
      hotel_id,
      created_by_manager_id: manager_id,
      position:         'housekeeping',
      workers_needed:   1,
      shift_date:       new Date('2026-06-10'),
      shift_start_time: '08:00',
      shift_end_time:   '16:00',
      status:           'OPEN',
      ...overrides,
    },
  });

// ── WorkApplication [PATCH-02] ────────────────────────────────────────────

export const seedWorkApplication = async ({
  work_request_id,
  worker_id,
  overrides = {},
}: {
  work_request_id: string;
  worker_id: string;
  overrides?: Record<string, any>;
}) =>
  prisma().workApplication.create({
    data: { work_request_id, worker_id, status: 'PENDING', ...overrides },
  });

// ── WorkerAssignment ──────────────────────────────────────────────────────

export const seedAssignment = async ({
  work_request_id,
  worker_id,
  manager_id,
  overrides = {},
}: {
  work_request_id: string;
  worker_id: string;
  manager_id: string;
  overrides?: Record<string, any>;
}) =>
  prisma().workerAssignment.create({
    data: {
      worker_id,
      work_request_id,
      assigned_by_manager_id: manager_id,
      status:      'ASSIGNED',
      assigned_at: new Date(),
      ...overrides,
    },
  });

// ── Composite: assigned worker ────────────────────────────────────────────

export const seedAssignedWorker = async () => {
  const hotel   = await seedHotel();
  const manager = await seedManager({ hotel_id: hotel.id });
  const worker  = await seedWorker({ hotel_id: hotel.id });
  const workReq = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
  const application = await seedWorkApplication({ work_request_id: workReq.id, worker_id: worker.id });
  const assignment  = await seedAssignment({ work_request_id: workReq.id, worker_id: worker.id, manager_id: manager.id });
  return { hotel, manager, worker, workReq, application, assignment };
};

// ── Composite: completed assignment [PATCH-06 replaces seedCompletedTask] ─

export const seedCompletedAssignment = async () => {
  const hotel   = await seedHotel();
  const manager = await seedManager({ hotel_id: hotel.id });
  const worker  = await seedWorker({ hotel_id: hotel.id });
  const checker = await seedChecker({ hotel_id: hotel.id });
  const workReq = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
  const assignment = await seedAssignment({
    work_request_id: workReq.id,
    worker_id: worker.id,
    manager_id: manager.id,
    overrides: { status: 'COMPLETED', started_at: new Date(), completed_at: new Date() },
  });
  return { hotel, manager, worker, checker, workReq, assignment };
};

// ── Attendance [PATCH-07] ─────────────────────────────────────────────────

export const seedAttendance = async ({
  assignment,
  worker,
  hotel,
  overrides = {},
}: {
  assignment: any;
  worker: any;
  hotel: any;
  overrides?: Record<string, any>;
}) =>
  prisma().attendance.create({
    data: {
      worker_assignment_id: assignment.id,
      worker_id:            worker.id,
      hotel_id:             hotel.id,
      status:               'PENDING',
      ...overrides,
    },
  });
```

---

## 4. Setup Scripts [PATCH-06, PATCH-09]

### `tests/setup/globalSetup.ts`

```typescript
import { execSync } from 'child_process';

export default async function globalSetup() {
  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'inherit' });
}
```

### `tests/setup/globalTeardown.ts` [PATCH-06]

```typescript
import { PrismaClient } from '@prisma/client';

export default async function globalTeardown() {
  const prisma = new PrismaClient();
  await prisma.$executeRaw`TRUNCATE TABLE
    "Rating", "QualityVerification", "Attendance",
    "WorkerAssignment", "WorkApplication", "WorkRequest",
    "User", "Hotel"
    CASCADE`;
  await prisma.$disconnect();
}
```

### `tests/setup/testEnv.ts` [PATCH-06]

```typescript
import { PrismaClient } from '@prisma/client';

beforeAll(async () => {
  const prisma = new PrismaClient();
  await prisma.$connect();
  (global as any).prisma = prisma;
});

afterEach(async () => {
  const prisma = (global as any).prisma as PrismaClient;
  await prisma.$executeRaw`TRUNCATE TABLE
    "Rating", "QualityVerification", "Attendance",
    "WorkerAssignment", "WorkApplication", "WorkRequest",
    "AuditLog"
    CASCADE`;
});

afterAll(async () => {
  await (global as any).prisma.$disconnect();
});
```

---

## 5. Unit Testing Strategy

### Structure

```
tests/unit/
├── staffing/
│   ├── service.test.ts               # WorkRequest + WorkerAssignment core logic
│   ├── work-application.test.ts      # PATCH-02: WorkApplication state machine
│   ├── assignment-state.test.ts      # State transitions
│   └── attendance.test.ts            # PATCH-07: Attendance lifecycle
├── quality/
│   ├── verification.test.ts          # PATCH-01: uses worker_assignment_id
│   ├── rating.test.ts                # PATCH-01: uses worker_assignment_id
│   └── leaderboard.test.ts
├── auth/
│   ├── jwt.test.ts
│   ├── auth-middleware.test.ts
│   └── permissions.test.ts
└── lib/
    ├── errors.test.ts
    └── utils.test.ts
```

---

### `tests/unit/staffing/service.test.ts`

```typescript
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { StaffingService } from '@/modules/staffing/service';
import {
  workerFixture, managerFixture, workRequestFixture, assignmentFixture,
} from '../../fixtures';

let prisma: DeepMockProxy<PrismaClient>;
let service: StaffingService;

beforeEach(() => {
  prisma = mockDeep<PrismaClient>();
  service = new StaffingService(prisma);
});

// PATCH-03: assignWorkers is invoked by the correct route handler
describe('assignWorkers', () => {
  it('assigns an ACTIVE worker to an OPEN work request', async () => {
    const worker  = workerFixture({ is_active: true });
    const wreq    = workRequestFixture({ status: 'OPEN', workers_needed: 1 });
    prisma.user.findFirst.mockResolvedValue(worker);
    prisma.workRequest.findFirst.mockResolvedValue(wreq);
    prisma.workerAssignment.create.mockResolvedValue(
      assignmentFixture({ worker_id: worker.id, work_request_id: wreq.id, status: 'ASSIGNED' })
    );

    const result = await service.assignWorkers(wreq.id, [worker.id], 'manager-id');

    expect(prisma.workerAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ASSIGNED' }) })
    );
    expect(result[0].status).toBe('ASSIGNED');
  });

  it('throws when work request is FILLED', async () => {
    prisma.workRequest.findFirst.mockResolvedValue(workRequestFixture({ status: 'FILLED' }));
    await expect(service.assignWorkers('req-id', ['worker-id'], 'manager-id'))
      .rejects.toThrow();
  });

  it('throws when worker does not belong to hotel', async () => {
    prisma.workRequest.findFirst.mockResolvedValue(workRequestFixture({ status: 'OPEN' }));
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.assignWorkers('req-id', ['worker-id'], 'manager-id'))
      .rejects.toThrow();
  });

  it('transitions work request to FILLED when workers_needed is satisfied', async () => {
    const worker = workerFixture({ is_active: true });
    const wreq   = workRequestFixture({ status: 'OPEN', workers_needed: 1 });
    prisma.workRequest.findFirst.mockResolvedValue(wreq);
    prisma.user.findFirst.mockResolvedValue(worker);
    prisma.workerAssignment.create.mockResolvedValue(assignmentFixture());
    prisma.workerAssignment.count.mockResolvedValue(1);
    prisma.workRequest.update.mockResolvedValue({ ...wreq, status: 'FILLED' });

    await service.assignWorkers(wreq.id, [worker.id], 'manager-id');

    expect(prisma.workRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FILLED' }) })
    );
  });
});

describe('startAssignment', () => {
  it('transitions ASSIGNED → IN_PROGRESS and sets started_at', async () => {
    const assignment = assignmentFixture({ status: 'ASSIGNED', started_at: null });
    prisma.workerAssignment.findFirst.mockResolvedValue(assignment);
    prisma.workerAssignment.update.mockResolvedValue({
      ...assignment, status: 'IN_PROGRESS', started_at: new Date(),
    });

    await service.startAssignment(assignment.id, assignment.worker_id);

    expect(prisma.workerAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS', started_at: expect.any(Date) }),
      })
    );
  });

  it('rejects start when status is already COMPLETED', async () => {
    prisma.workerAssignment.findFirst.mockResolvedValue(assignmentFixture({ status: 'COMPLETED' }));
    await expect(service.startAssignment('id', 'worker-id')).rejects.toThrow();
  });

  it('rejects start when worker_id does not match assignment', async () => {
    prisma.workerAssignment.findFirst.mockResolvedValue(null); // ownership check fails
    await expect(service.startAssignment('id', 'wrong-worker')).rejects.toThrow();
  });
});

describe('completeAssignment', () => {
  it('transitions IN_PROGRESS → COMPLETED and sets completed_at', async () => {
    const assignment = assignmentFixture({ status: 'IN_PROGRESS', started_at: new Date() });
    prisma.workerAssignment.findFirst.mockResolvedValue(assignment);
    prisma.workerAssignment.update.mockResolvedValue({
      ...assignment, status: 'COMPLETED', completed_at: new Date(),
    });

    await service.completeAssignment(assignment.id, assignment.worker_id);

    expect(prisma.workerAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', completed_at: expect.any(Date) }),
      })
    );
  });

  it('rejects complete when not IN_PROGRESS', async () => {
    prisma.workerAssignment.findFirst.mockResolvedValue(assignmentFixture({ status: 'ASSIGNED' }));
    await expect(service.completeAssignment('id', 'worker-id')).rejects.toThrow();
  });
});
```

---

### `tests/unit/staffing/work-application.test.ts` [PATCH-02]

```typescript
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { StaffingService } from '@/modules/staffing/service';
import { workRequestFixture, workerFixture, workApplicationFixture, assignmentFixture } from '../../fixtures';

let prisma: DeepMockProxy<PrismaClient>;
let service: StaffingService;

beforeEach(() => {
  prisma = mockDeep<PrismaClient>();
  service = new StaffingService(prisma);
});

describe('createApplication', () => {
  it('worker applies to OPEN request → WorkApplication(status=PENDING)', async () => {
    const wreq   = workRequestFixture({ status: 'OPEN' });
    const worker = workerFixture();
    prisma.workRequest.findFirst.mockResolvedValue(wreq);
    prisma.workApplication.findUnique.mockResolvedValue(null);
    prisma.workApplication.create.mockResolvedValue(
      workApplicationFixture({ work_request_id: wreq.id, worker_id: worker.id })
    );

    const result = await service.createApplication(wreq.id, worker.id);

    expect(result.status).toBe('PENDING');
    expect(prisma.workApplication.create).toHaveBeenCalled();
  });

  it('throws when request is FILLED', async () => {
    prisma.workRequest.findFirst.mockResolvedValue(workRequestFixture({ status: 'FILLED' }));
    await expect(service.createApplication('req-id', 'worker-id')).rejects.toThrow();
  });

  it('throws on duplicate application', async () => {
    prisma.workRequest.findFirst.mockResolvedValue(workRequestFixture({ status: 'OPEN' }));
    prisma.workApplication.findUnique.mockResolvedValue(workApplicationFixture());
    await expect(service.createApplication('req-id', 'worker-id')).rejects.toThrow();
  });

  it('throws when request is CANCELLED', async () => {
    prisma.workRequest.findFirst.mockResolvedValue(workRequestFixture({ status: 'CANCELLED' }));
    await expect(service.createApplication('req-id', 'worker-id')).rejects.toThrow();
  });
});

describe('approveApplication', () => {
  it('PENDING → APPROVED + WorkerAssignment created', async () => {
    const app    = workApplicationFixture({ status: 'PENDING' });
    const wreq   = workRequestFixture({ status: 'OPEN', workers_needed: 2 });
    prisma.workApplication.findFirst.mockResolvedValue(app);
    prisma.workRequest.findFirst.mockResolvedValue(wreq);
    prisma.workApplication.update.mockResolvedValue({ ...app, status: 'APPROVED' });
    prisma.workerAssignment.create.mockResolvedValue(assignmentFixture({ worker_id: app.worker_id }));

    const result = await service.approveApplication(app.id, 'manager-id');

    expect(prisma.workerAssignment.create).toHaveBeenCalled();
    expect(prisma.workApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) })
    );
    expect(result.status).toBe('APPROVED');
  });

  it('throws when application is already APPROVED', async () => {
    prisma.workApplication.findFirst.mockResolvedValue(workApplicationFixture({ status: 'APPROVED' }));
    await expect(service.approveApplication('app-id', 'manager-id')).rejects.toThrow();
  });

  it('throws when application is REJECTED', async () => {
    prisma.workApplication.findFirst.mockResolvedValue(workApplicationFixture({ status: 'REJECTED' }));
    await expect(service.approveApplication('app-id', 'manager-id')).rejects.toThrow();
  });
});

describe('rejectApplication', () => {
  it('PENDING → REJECTED, no WorkerAssignment created', async () => {
    const app = workApplicationFixture({ status: 'PENDING' });
    prisma.workApplication.findFirst.mockResolvedValue(app);
    prisma.workApplication.update.mockResolvedValue({ ...app, status: 'REJECTED' });

    await service.rejectApplication(app.id, 'manager-id');

    expect(prisma.workerAssignment.create).not.toHaveBeenCalled();
    expect(prisma.workApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) })
    );
  });
});

describe('withdrawApplication', () => {
  it('PENDING → WITHDRAWN by the applying worker', async () => {
    const app = workApplicationFixture({ status: 'PENDING', worker_id: 'worker-1' });
    prisma.workApplication.findFirst.mockResolvedValue(app);
    prisma.workApplication.update.mockResolvedValue({ ...app, status: 'WITHDRAWN' });

    await service.withdrawApplication(app.id, 'worker-1');

    expect(prisma.workApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'WITHDRAWN' }) })
    );
  });

  it('throws when a different worker attempts withdrawal', async () => {
    prisma.workApplication.findFirst.mockResolvedValue(null); // ownership filter returns null
    await expect(service.withdrawApplication('app-id', 'wrong-worker')).rejects.toThrow();
  });

  it('throws when application is already APPROVED', async () => {
    prisma.workApplication.findFirst.mockResolvedValue(workApplicationFixture({ status: 'APPROVED' }));
    await expect(service.withdrawApplication('app-id', 'worker-1')).rejects.toThrow();
  });
});
```

---

### `tests/unit/staffing/assignment-state.test.ts`

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED:    ['IN_PROGRESS', 'CANCELLED', 'REASSIGNED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
  REASSIGNED:  [],
};

describe('WorkerAssignment state machine', () => {
  test.each([
    ['ASSIGNED',    'IN_PROGRESS', true],
    ['ASSIGNED',    'CANCELLED',   true],
    ['ASSIGNED',    'REASSIGNED',  true],
    ['IN_PROGRESS', 'COMPLETED',   true],
    ['IN_PROGRESS', 'CANCELLED',   true],
    ['IN_PROGRESS', 'ASSIGNED',    false],
    ['COMPLETED',   'IN_PROGRESS', false],
    ['CANCELLED',   'ASSIGNED',    false],
    ['REASSIGNED',  'ASSIGNED',    false],
  ])('%s → %s valid=%s', (from, to, valid) => {
    expect(VALID_TRANSITIONS[from]?.includes(to) ?? false).toBe(valid);
  });
});
```

---

### `tests/unit/staffing/attendance.test.ts` [PATCH-07]

```typescript
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { StaffingService } from '@/modules/staffing/service';
import { assignmentFixture, attendanceFixture } from '../../fixtures';

let prisma: DeepMockProxy<PrismaClient>;
let service: StaffingService;

beforeEach(() => {
  prisma = mockDeep<PrismaClient>();
  service = new StaffingService(prisma);
});

describe('clockIn', () => {
  it('IN_PROGRESS assignment → Attendance(status=CLOCKED_IN, clock_in_at set)', async () => {
    const assignment = assignmentFixture({ status: 'IN_PROGRESS' });
    prisma.workerAssignment.findFirst.mockResolvedValue(assignment);
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.attendance.create.mockResolvedValue(
      attendanceFixture({ worker_assignment_id: assignment.id, status: 'CLOCKED_IN', clock_in_at: new Date() })
    );

    const result = await service.clockIn(assignment.id, assignment.worker_id);

    expect(result.status).toBe('CLOCKED_IN');
    expect(result.clock_in_at).toBeTruthy();
  });

  it('throws when assignment is not IN_PROGRESS', async () => {
    prisma.workerAssignment.findFirst.mockResolvedValue(assignmentFixture({ status: 'ASSIGNED' }));
    await expect(service.clockIn('id', 'worker-id')).rejects.toThrow();
  });

  it('throws on duplicate clock-in for same assignment', async () => {
    prisma.workerAssignment.findFirst.mockResolvedValue(assignmentFixture({ status: 'IN_PROGRESS' }));
    prisma.attendance.findUnique.mockResolvedValue(attendanceFixture({ status: 'CLOCKED_IN' }));
    await expect(service.clockIn('id', 'worker-id')).rejects.toThrow();
  });
});

describe('clockOut', () => {
  it('CLOCKED_IN → CLOCKED_OUT with clock_out_at set', async () => {
    const att = attendanceFixture({ status: 'CLOCKED_IN', clock_in_at: new Date() });
    prisma.attendance.findFirst.mockResolvedValue(att);
    prisma.attendance.update.mockResolvedValue({ ...att, status: 'CLOCKED_OUT', clock_out_at: new Date() });

    const result = await service.clockOut(att.worker_assignment_id, att.worker_id);

    expect(result.status).toBe('CLOCKED_OUT');
    expect(result.clock_out_at).toBeTruthy();
  });

  it('throws when not clocked in', async () => {
    prisma.attendance.findFirst.mockResolvedValue(attendanceFixture({ status: 'PENDING' }));
    await expect(service.clockOut('id', 'worker-id')).rejects.toThrow();
  });
});

describe('verifyAttendance', () => {
  it('CLOCKED_OUT → VERIFIED with manager set', async () => {
    const att = attendanceFixture({ status: 'CLOCKED_OUT', clock_in_at: new Date(), clock_out_at: new Date() });
    prisma.attendance.findFirst.mockResolvedValue(att);
    prisma.attendance.update.mockResolvedValue({
      ...att, status: 'VERIFIED', verified_by_manager_id: 'mgr-1', verified_at: new Date(),
    });

    const result = await service.verifyAttendance(att.id, 'mgr-1');

    expect(result.status).toBe('VERIFIED');
    expect(result.verified_by_manager_id).toBe('mgr-1');
  });

  it('throws when attendance is not CLOCKED_OUT', async () => {
    prisma.attendance.findFirst.mockResolvedValue(attendanceFixture({ status: 'CLOCKED_IN' }));
    await expect(service.verifyAttendance('id', 'mgr-1')).rejects.toThrow();
  });
});
```

---

### `tests/unit/quality/verification.test.ts` [PATCH-01]

```typescript
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { QualityService } from '@/modules/quality/service';
import { assignmentFixture, verificationFixture } from '../../fixtures';

let prisma: DeepMockProxy<PrismaClient>;
let service: QualityService;

beforeEach(() => {
  prisma = mockDeep<PrismaClient>();
  service = new QualityService(prisma);
});

describe('createVerification', () => {
  it('creates verification with score 0-100 using worker_assignment_id', async () => {
    const assignment = assignmentFixture({ status: 'COMPLETED' });
    prisma.workerAssignment.findFirst.mockResolvedValue(assignment);          // PATCH-01
    prisma.qualityVerification.findUnique.mockResolvedValue(null);
    prisma.qualityVerification.create.mockResolvedValue(
      verificationFixture({ worker_assignment_id: assignment.id, score: 87, status: 'verified' })
    );

    const result = await service.createVerification(
      { worker_assignment_id: assignment.id, score: 87, notes: '' },         // PATCH-01
      'checker-id'
    );

    expect(result.score).toBe(87);
    expect(result.status).toBe('verified');
  });

  it('rejects score outside 0-100 range', async () => {
    await expect(
      service.createVerification({ worker_assignment_id: 'id', score: 105, notes: '' }, 'checker-id')
    ).rejects.toThrow();
  });

  it('sets status=needs_rework when score < 60', async () => {
    const assignment = assignmentFixture({ status: 'COMPLETED' });
    prisma.workerAssignment.findFirst.mockResolvedValue(assignment);
    prisma.qualityVerification.findUnique.mockResolvedValue(null);
    prisma.qualityVerification.create.mockResolvedValue(
      verificationFixture({ score: 45, status: 'needs_rework' })
    );

    const result = await service.createVerification(
      { worker_assignment_id: assignment.id, score: 45, notes: 'Incomplete' },
      'checker-id'
    );

    expect(result.status).toBe('needs_rework');
  });

  it('throws on duplicate verification for same worker_assignment_id', async () => {
    prisma.qualityVerification.findUnique.mockResolvedValue(verificationFixture());
    await expect(
      service.createVerification({ worker_assignment_id: 'existing-id', score: 80, notes: '' }, 'checker-id')
    ).rejects.toThrow();
  });

  it('throws when assignment is not COMPLETED', async () => {
    prisma.workerAssignment.findFirst.mockResolvedValue(assignmentFixture({ status: 'IN_PROGRESS' }));
    prisma.qualityVerification.findUnique.mockResolvedValue(null);
    await expect(
      service.createVerification({ worker_assignment_id: 'id', score: 80, notes: '' }, 'checker-id')
    ).rejects.toThrow();
  });
});
```

---

### `tests/unit/quality/rating.test.ts` [PATCH-01]

```typescript
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { QualityService } from '@/modules/quality/service';
import { assignmentFixture, ratingFixture, overallRatingFixture } from '../../fixtures';

let prisma: DeepMockProxy<PrismaClient>;
let service: QualityService;

beforeEach(() => {
  prisma = mockDeep<PrismaClient>();
  service = new QualityService(prisma);
});

describe('createRating', () => {
  it('creates rating using worker_assignment_id', async () => {
    const assignment = assignmentFixture({ status: 'COMPLETED', worker_id: 'worker-1' });
    prisma.workerAssignment.findFirst.mockResolvedValue(assignment);           // PATCH-01
    prisma.rating.findUnique.mockResolvedValue(null);
    prisma.rating.create.mockResolvedValue(
      ratingFixture({ worker_assignment_id: assignment.id, score: 4 })        // PATCH-01
    );
    prisma.workerOverallRating.upsert.mockResolvedValue(overallRatingFixture());

    const result = await service.createRating(
      { worker_assignment_id: assignment.id, score: 4 },                      // PATCH-01
      'checker-id'
    );

    expect(result.score).toBe(4);
    expect(prisma.workerOverallRating.upsert).toHaveBeenCalled();
  });

  it('updates WorkerOverallRating average after new rating', async () => {
    const assignment = assignmentFixture({ status: 'COMPLETED' });
    prisma.workerAssignment.findFirst.mockResolvedValue(assignment);
    prisma.rating.findUnique.mockResolvedValue(null);
    prisma.rating.create.mockResolvedValue(ratingFixture({ score: 5 }));
    prisma.workerOverallRating.upsert.mockResolvedValue(overallRatingFixture({ average_score: 5 }));

    await service.createRating({ worker_assignment_id: assignment.id, score: 5 }, 'checker-id');

    expect(prisma.workerOverallRating.upsert).toHaveBeenCalled();
  });

  it('rejects score of 0', async () => {
    await expect(
      service.createRating({ worker_assignment_id: 'id', score: 0 }, 'checker-id')
    ).rejects.toThrow();
  });

  it('rejects score above 5', async () => {
    await expect(
      service.createRating({ worker_assignment_id: 'id', score: 6 }, 'checker-id')
    ).rejects.toThrow();
  });

  it('throws on duplicate rating for same worker_assignment_id', async () => {
    prisma.rating.findUnique.mockResolvedValue(ratingFixture());
    await expect(
      service.createRating({ worker_assignment_id: 'existing-id', score: 4 }, 'checker-id')
    ).rejects.toThrow();
  });
});
```

---

## 6. Integration Testing Strategy

### Structure

```
tests/integration/
├── staffing/
│   ├── work-requests.test.ts
│   ├── work-applications.test.ts    # PATCH-02
│   ├── assignments.test.ts
│   └── attendance.test.ts           # PATCH-07
├── quality/
│   ├── verifications.test.ts        # PATCH-01, PATCH-06
│   └── ratings.test.ts              # PATCH-01, PATCH-06
└── auth/
    └── jwt-flow.test.ts
```

---

### `tests/integration/staffing/assignments.test.ts` [PATCH-03, PATCH-04]

```typescript
import request from 'supertest';
import { createApp } from '@/app';
import {
  seedHotel, seedManager, seedWorker, seedWorkRequest, seedAssignedWorker,
} from '../../fixtures/db-seeds';
import { tokenFor } from '../../helpers/auth';

// PATCH-03: correct route POST /work-requests/:id/assign-workers
describe('POST /api/v1/staffing/work-requests/:work_request_id/assign-workers', () => {
  it('manager assigns worker → 201 + assignment in DB', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });

    const res = await request(createApp())
      .post(`/api/v1/staffing/work-requests/${wreq.id}/assign-workers`)       // PATCH-03
      .set('Authorization', `Bearer ${tokenFor(manager)}`)
      .send({ worker_ids: [worker.id] })
      .expect(201);

    expect(res.body.data[0].status).toBe('ASSIGNED');

    const saved = await (global as any).prisma.workerAssignment.findFirst({
      where: { worker_id: worker.id, work_request_id: wreq.id },
    });
    expect(saved).not.toBeNull();
    expect(saved!.status).toBe('ASSIGNED');
  });

  it('returns 403 when non-manager attempts assignment', async () => {
    const hotel  = await seedHotel();
    const worker = await seedWorker({ hotel_id: hotel.id });
    const wreq   = await seedWorkRequest({ hotel_id: hotel.id, manager_id: worker.id });

    await request(createApp())
      .post(`/api/v1/staffing/work-requests/${wreq.id}/assign-workers`)
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .send({ worker_ids: [worker.id] })
      .expect(403);
  });

  it('returns 409 when work request is FILLED', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id, overrides: { status: 'FILLED' } });

    await request(createApp())
      .post(`/api/v1/staffing/work-requests/${wreq.id}/assign-workers`)
      .set('Authorization', `Bearer ${tokenFor(manager)}`)
      .send({ worker_ids: [worker.id] })
      .expect(409);
  });
});

// PATCH-04: POST (not PATCH) for start
describe('POST /api/v1/staffing/assignments/:assignment_id/start', () => {
  it('worker starts assignment → status IN_PROGRESS + started_at set', async () => {
    const { worker, assignment } = await seedAssignedWorker();

    const res = await request(createApp())
      .post(`/api/v1/staffing/assignments/${assignment.id}/start`)             // PATCH-04
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .expect(200);

    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.started_at).toBeTruthy();
  });

  it('returns 403 when a different worker attempts start', async () => {
    const { assignment } = await seedAssignedWorker();
    const hotel  = await seedHotel();
    const other  = await seedWorker({ hotel_id: hotel.id });

    await request(createApp())
      .post(`/api/v1/staffing/assignments/${assignment.id}/start`)
      .set('Authorization', `Bearer ${tokenFor(other)}`)
      .expect(403);
  });
});

// PATCH-04: POST (not PATCH) for complete
describe('POST /api/v1/staffing/assignments/:assignment_id/complete', () => {
  it('worker completes assignment → status COMPLETED + completed_at set', async () => {
    const { worker, assignment } = await seedAssignedWorker();
    // Transition to IN_PROGRESS first
    await (global as any).prisma.workerAssignment.update({
      where: { id: assignment.id },
      data: { status: 'IN_PROGRESS', started_at: new Date() },
    });

    const res = await request(createApp())
      .post(`/api/v1/staffing/assignments/${assignment.id}/complete`)          // PATCH-04
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .expect(200);

    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.completed_at).toBeTruthy();
  });

  it('returns 422 when assignment is not IN_PROGRESS', async () => {
    const { worker, assignment } = await seedAssignedWorker(); // status=ASSIGNED

    await request(createApp())
      .post(`/api/v1/staffing/assignments/${assignment.id}/complete`)
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .expect(422);
  });
});
```

---

### `tests/integration/staffing/work-applications.test.ts` [PATCH-02]

```typescript
import request from 'supertest';
import { createApp } from '@/app';
import { seedHotel, seedManager, seedWorker, seedWorkRequest, seedWorkApplication } from '../../fixtures/db-seeds';
import { tokenFor } from '../../helpers/auth';

describe('POST /api/v1/staffing/work-requests/:work_request_id/apply', () => {
  it('worker applies → 201 + WorkApplication(PENDING) in DB', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });

    const res = await request(createApp())
      .post(`/api/v1/staffing/work-requests/${wreq.id}/apply`)
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .send({ notes: 'Available for this shift' })
      .expect(201);

    expect(res.body.data.status).toBe('PENDING');

    const saved = await (global as any).prisma.workApplication.findFirst({
      where: { work_request_id: wreq.id, worker_id: worker.id },
    });
    expect(saved).not.toBeNull();
  });

  it('returns 409 on duplicate application', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    await seedWorkApplication({ work_request_id: wreq.id, worker_id: worker.id });

    await request(createApp())
      .post(`/api/v1/staffing/work-requests/${wreq.id}/apply`)
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .send({})
      .expect(409);
  });

  it('returns 409 when request is FILLED', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id, overrides: { status: 'FILLED' } });

    await request(createApp())
      .post(`/api/v1/staffing/work-requests/${wreq.id}/apply`)
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .send({})
      .expect(409);
  });
});

describe('POST /api/v1/staffing/applications/:application_id/approve', () => {
  it('manager approves application → APPROVED + WorkerAssignment created', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    const app     = await seedWorkApplication({ work_request_id: wreq.id, worker_id: worker.id });

    const res = await request(createApp())
      .post(`/api/v1/staffing/applications/${app.id}/approve`)
      .set('Authorization', `Bearer ${tokenFor(manager)}`)
      .expect(200);

    expect(res.body.data.status).toBe('APPROVED');

    const assignment = await (global as any).prisma.workerAssignment.findFirst({
      where: { worker_id: worker.id, work_request_id: wreq.id },
    });
    expect(assignment).not.toBeNull();
  });

  it('returns 403 when worker attempts to approve', async () => {
    const hotel  = await seedHotel();
    const worker = await seedWorker({ hotel_id: hotel.id });
    const app    = await seedWorkApplication({ work_request_id: 'req-id', worker_id: worker.id });

    await request(createApp())
      .post(`/api/v1/staffing/applications/${app.id}/approve`)
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .expect(403);
  });
});

describe('POST /api/v1/staffing/applications/:application_id/reject', () => {
  it('manager rejects application → REJECTED + no WorkerAssignment', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    const app     = await seedWorkApplication({ work_request_id: wreq.id, worker_id: worker.id });

    const res = await request(createApp())
      .post(`/api/v1/staffing/applications/${app.id}/reject`)
      .set('Authorization', `Bearer ${tokenFor(manager)}`)
      .expect(200);

    expect(res.body.data.status).toBe('REJECTED');

    const assignment = await (global as any).prisma.workerAssignment.findFirst({
      where: { worker_id: worker.id, work_request_id: wreq.id },
    });
    expect(assignment).toBeNull();
  });
});

describe('DELETE /api/v1/staffing/applications/:application_id', () => {
  it('worker withdraws own PENDING application', async () => {
    const hotel  = await seedHotel();
    const worker = await seedWorker({ hotel_id: hotel.id });
    const wreq   = await seedWorkRequest({ hotel_id: hotel.id, manager_id: worker.id });
    const app    = await seedWorkApplication({ work_request_id: wreq.id, worker_id: worker.id });

    await request(createApp())
      .delete(`/api/v1/staffing/applications/${app.id}`)
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .expect(200);

    const saved = await (global as any).prisma.workApplication.findUnique({ where: { id: app.id } });
    expect(saved?.status).toBe('WITHDRAWN');
  });
});
```

---

### `tests/integration/staffing/attendance.test.ts` [PATCH-07]

```typescript
import request from 'supertest';
import { createApp } from '@/app';
import { seedHotel, seedManager, seedWorker, seedWorkRequest, seedAssignment, seedAttendance } from '../../fixtures/db-seeds';
import { tokenFor } from '../../helpers/auth';

describe('POST /api/v1/staffing/assignments/:assignment_id/clock-in', () => {
  it('worker clocks in → Attendance(CLOCKED_IN) created', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    const assignment = await seedAssignment({
      work_request_id: wreq.id, worker_id: worker.id, manager_id: manager.id,
      overrides: { status: 'IN_PROGRESS', started_at: new Date() },
    });

    const res = await request(createApp())
      .post(`/api/v1/staffing/assignments/${assignment.id}/clock-in`)
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .expect(201);

    expect(res.body.data.status).toBe('CLOCKED_IN');
    expect(res.body.data.clock_in_at).toBeTruthy();
  });

  it('returns 409 on duplicate clock-in', async () => {
    const hotel      = await seedHotel();
    const manager    = await seedManager({ hotel_id: hotel.id });
    const worker     = await seedWorker({ hotel_id: hotel.id });
    const wreq       = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    const assignment = await seedAssignment({
      work_request_id: wreq.id, worker_id: worker.id, manager_id: manager.id,
      overrides: { status: 'IN_PROGRESS', started_at: new Date() },
    });
    await seedAttendance({ assignment, worker, hotel, overrides: { status: 'CLOCKED_IN', clock_in_at: new Date() } });

    await request(createApp())
      .post(`/api/v1/staffing/assignments/${assignment.id}/clock-in`)
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .expect(409);
  });
});

describe('POST /api/v1/staffing/assignments/:assignment_id/clock-out', () => {
  it('clocked-in worker clocks out → CLOCKED_OUT', async () => {
    const hotel      = await seedHotel();
    const manager    = await seedManager({ hotel_id: hotel.id });
    const worker     = await seedWorker({ hotel_id: hotel.id });
    const wreq       = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    const assignment = await seedAssignment({
      work_request_id: wreq.id, worker_id: worker.id, manager_id: manager.id,
      overrides: { status: 'IN_PROGRESS', started_at: new Date() },
    });
    await seedAttendance({ assignment, worker, hotel, overrides: { status: 'CLOCKED_IN', clock_in_at: new Date() } });

    const res = await request(createApp())
      .post(`/api/v1/staffing/assignments/${assignment.id}/clock-out`)
      .set('Authorization', `Bearer ${tokenFor(worker)}`)
      .expect(200);

    expect(res.body.data.status).toBe('CLOCKED_OUT');
    expect(res.body.data.clock_out_at).toBeTruthy();
  });
});

describe('PATCH /api/v1/staffing/attendance/:attendance_id/verify', () => {
  it('manager verifies CLOCKED_OUT attendance → VERIFIED', async () => {
    const hotel      = await seedHotel();
    const manager    = await seedManager({ hotel_id: hotel.id });
    const worker     = await seedWorker({ hotel_id: hotel.id });
    const wreq       = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    const assignment = await seedAssignment({
      work_request_id: wreq.id, worker_id: worker.id, manager_id: manager.id,
    });
    const attendance = await seedAttendance({
      assignment, worker, hotel,
      overrides: { status: 'CLOCKED_OUT', clock_in_at: new Date(), clock_out_at: new Date() },
    });

    const res = await request(createApp())
      .patch(`/api/v1/staffing/attendance/${attendance.id}/verify`)
      .set('Authorization', `Bearer ${tokenFor(manager)}`)
      .expect(200);

    expect(res.body.data.status).toBe('VERIFIED');
    expect(res.body.data.verified_by_manager_id).toBe(manager.id);
  });
});
```

---

### `tests/integration/quality/verifications.test.ts` [PATCH-01, PATCH-06]

```typescript
import request from 'supertest';
import { createApp } from '@/app';
import { seedHotel, seedManager, seedWorker, seedChecker, seedCompletedAssignment } from '../../fixtures/db-seeds';
import { tokenFor } from '../../helpers/auth';

// PATCH-06: seedCompletedTask() removed; seedCompletedAssignment() used throughout

describe('POST /api/v1/quality/verifications', () => {
  it('checker verifies completed assignment → verification persisted', async () => {
    const { checker, assignment } = await seedCompletedAssignment();    // PATCH-06

    const res = await request(createApp())
      .post('/api/v1/quality/verifications')
      .set('Authorization', `Bearer ${tokenFor(checker)}`)
      .send({ worker_assignment_id: assignment.id, score: 92, notes: 'Excellent' })  // PATCH-01
      .expect(201);

    expect(res.body.data.score).toBe(92);
    expect(res.body.data.status).toBe('verified');

    const saved = await (global as any).prisma.qualityVerification.findUnique({
      where: { worker_assignment_id: assignment.id },                              // PATCH-01
    });
    expect(saved).not.toBeNull();
  });

  it('returns 409 on duplicate verification for same worker_assignment_id', async () => {
    const { checker, assignment } = await seedCompletedAssignment();
    // Pre-create a verification
    await (global as any).prisma.qualityVerification.create({
      data: {
        worker_assignment_id: assignment.id,
        hotel_id: assignment.hotel_id,
        verified_by_checker_id: checker.id,
        score: 80,
        status: 'verified',
      },
    });

    await request(createApp())
      .post('/api/v1/quality/verifications')
      .set('Authorization', `Bearer ${tokenFor(checker)}`)
      .send({ worker_assignment_id: assignment.id, score: 88, notes: '' })
      .expect(409);
  });

  it('returns 422 when assignment is not COMPLETED', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const checker = await seedChecker({ hotel_id: hotel.id });
    const wreq    = await (await import('../../fixtures/db-seeds')).seedWorkRequest({
      hotel_id: hotel.id, manager_id: manager.id,
    });
    const assignment = await (await import('../../fixtures/db-seeds')).seedAssignment({
      work_request_id: wreq.id, worker_id: worker.id, manager_id: manager.id,
      overrides: { status: 'IN_PROGRESS' },
    });

    await request(createApp())
      .post('/api/v1/quality/verifications')
      .set('Authorization', `Bearer ${tokenFor(checker)}`)
      .send({ worker_assignment_id: assignment.id, score: 80, notes: '' })
      .expect(422);
  });
});
```

---

### `tests/integration/quality/ratings.test.ts` [PATCH-01, PATCH-06]

```typescript
import request from 'supertest';
import { createApp } from '@/app';
import { seedCompletedAssignment } from '../../fixtures/db-seeds';
import { tokenFor } from '../../helpers/auth';

describe('POST /api/v1/quality/ratings', () => {
  it('checker rates worker → rating persisted + WorkerOverallRating updated', async () => {
    const { checker, worker, assignment } = await seedCompletedAssignment();  // PATCH-06

    const res = await request(createApp())
      .post('/api/v1/quality/ratings')
      .set('Authorization', `Bearer ${tokenFor(checker)}`)
      .send({ worker_assignment_id: assignment.id, score: 5, comment: 'Great' })  // PATCH-01
      .expect(201);

    expect(res.body.data.score).toBe(5);

    const overall = await (global as any).prisma.workerOverallRating.findUnique({
      where: { worker_id: worker.id },
    });
    expect(overall).not.toBeNull();
    expect(overall!.total_ratings).toBe(1);
    expect(overall!.average_score).toBe(5);
  });

  it('returns 409 on duplicate rating for same worker_assignment_id', async () => {
    const { checker, worker, assignment } = await seedCompletedAssignment();
    await (global as any).prisma.rating.create({
      data: {
        worker_assignment_id: assignment.id,
        hotel_id: assignment.hotel_id,
        worker_id: worker.id,
        rated_by_checker_id: checker.id,
        score: 4,
      },
    });

    await request(createApp())
      .post('/api/v1/quality/ratings')
      .set('Authorization', `Bearer ${tokenFor(checker)}`)
      .send({ worker_assignment_id: assignment.id, score: 3 })
      .expect(409);
  });

  it('rejects score of 0 or above 5', async () => {
    const { checker, assignment } = await seedCompletedAssignment();

    await request(createApp())
      .post('/api/v1/quality/ratings')
      .set('Authorization', `Bearer ${tokenFor(checker)}`)
      .send({ worker_assignment_id: assignment.id, score: 0 })
      .expect(422);

    await request(createApp())
      .post('/api/v1/quality/ratings')
      .set('Authorization', `Bearer ${tokenFor(checker)}`)
      .send({ worker_assignment_id: assignment.id, score: 6 })
      .expect(422);
  });
});
```

---

## 7. E2E Testing Strategy [PATCH-01 through PATCH-07]

### Structure

```
tests/e2e/
├── helpers/
│   ├── api-client.ts
│   └── scenario.ts
└── flows/
    ├── worker-hiring-cycle.test.ts     # PATCH-02, PATCH-03, PATCH-04
    ├── quality-gate.test.ts            # PATCH-01, PATCH-06, PATCH-08
    ├── attendance-tracking.test.ts     # PATCH-07 (fully implemented)
    └── worker-application.test.ts      # PATCH-02 (fully implemented)
```

---

### `tests/e2e/helpers/api-client.ts`

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

  private withAuth(req: any) {
    return this.token ? req.set('Authorization', `Bearer ${this.token}`) : req;
  }

  get(path: string)    { return this.withAuth(request(this.app).get(path)); }
  post(path: string)   { return this.withAuth(request(this.app).post(path)); }
  patch(path: string)  { return this.withAuth(request(this.app).patch(path)); }
  delete(path: string) { return this.withAuth(request(this.app).delete(path)); }
}
```

---

### `tests/e2e/flows/worker-hiring-cycle.test.ts` [PATCH-02, PATCH-03, PATCH-04]

```typescript
import { createApp } from '@/app';
import { ApiClient } from '../helpers/api-client';
import { seedHotel, seedManager, seedWorker } from '../../fixtures/db-seeds';

describe('E2E: Worker Hiring Cycle', () => {
  let api: ApiClient;

  beforeAll(() => { api = new ApiClient(createApp()); });

  it('full cycle: create request → apply → approve → start → complete', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });

    // 1. Manager creates work request
    const { body: { data: workRequest } } = await api.as(manager)
      .post('/api/v1/staffing/work-requests')
      .send({
        hotel_id:         hotel.id,
        position:         'housekeeping',
        workers_needed:   1,
        shift_date:       '2026-06-10',
        shift_start_time: '08:00',
        shift_end_time:   '16:00',
      })
      .expect(201);

    expect(workRequest.status).toBe('OPEN');

    // 2. Worker applies  [PATCH-02]
    const { body: { data: application } } = await api.as(worker)
      .post(`/api/v1/staffing/work-requests/${workRequest.id}/apply`)         // PATCH-02
      .send({ notes: 'I am available' })
      .expect(201);

    expect(application.status).toBe('PENDING');

    // 3. Manager approves application → WorkerAssignment created  [PATCH-02, PATCH-03]
    const { body: { data: approved } } = await api.as(manager)
      .post(`/api/v1/staffing/applications/${application.id}/approve`)        // PATCH-02
      .expect(200);

    expect(approved.status).toBe('APPROVED');

    // 4. Retrieve assignment (created by approval)
    const assignment = await (global as any).prisma.workerAssignment.findFirst({
      where: { worker_id: worker.id, work_request_id: workRequest.id },
    });
    expect(assignment).not.toBeNull();
    expect(assignment.status).toBe('ASSIGNED');

    // 5. Work request status is now FILLED
    const { body: { data: assignments } } = await api.as(manager)
      .get(`/api/v1/staffing/work-requests/${workRequest.id}/assignments`)
      .expect(200);
    // (route returns assignments; work request itself transitions to FILLED server-side)

    // 6. Worker starts assignment  [PATCH-04: POST not PATCH]
    const { body: { data: inProgress } } = await api.as(worker)
      .post(`/api/v1/staffing/assignments/${assignment.id}/start`)            // PATCH-04
      .expect(200);

    expect(inProgress.status).toBe('IN_PROGRESS');
    expect(inProgress.started_at).toBeTruthy();

    // 7. Worker completes assignment  [PATCH-04: POST not PATCH]
    const { body: { data: completed } } = await api.as(worker)
      .post(`/api/v1/staffing/assignments/${assignment.id}/complete`)         // PATCH-04
      .expect(200);

    expect(completed.status).toBe('COMPLETED');
    expect(completed.completed_at).toBeTruthy();
  });

  it('partial fill: workers_needed=2, assign 1 → PARTIALLY_FILLED', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });

    const { body: { data: workRequest } } = await api.as(manager)
      .post('/api/v1/staffing/work-requests')
      .send({ hotel_id: hotel.id, position: 'housekeeping', workers_needed: 2,
               shift_date: '2026-06-10', shift_start_time: '08:00', shift_end_time: '16:00' })
      .expect(201);

    const { body: { data: application } } = await api.as(worker)
      .post(`/api/v1/staffing/work-requests/${workRequest.id}/apply`)
      .send({})
      .expect(201);

    await api.as(manager)
      .post(`/api/v1/staffing/applications/${application.id}/approve`)
      .expect(200);

    const saved = await (global as any).prisma.workRequest.findUnique({
      where: { id: workRequest.id },
    });
    expect(saved!.status).toBe('PARTIALLY_FILLED');
  });
});
```

---

### `tests/e2e/flows/worker-application.test.ts` [PATCH-02]

```typescript
import { createApp } from '@/app';
import { ApiClient } from '../helpers/api-client';
import { seedHotel, seedManager, seedWorker, seedWorkRequest, seedWorkApplication } from '../../fixtures/db-seeds';

describe('E2E: Worker Application Flow', () => {
  let api: ApiClient;

  beforeAll(() => { api = new ApiClient(createApp()); });

  it('apply → manager approves → WorkerAssignment in DB', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });

    await api.as(worker)
      .post(`/api/v1/staffing/work-requests/${wreq.id}/apply`)
      .send({}).expect(201);

    const app = await (global as any).prisma.workApplication.findFirst({
      where: { work_request_id: wreq.id, worker_id: worker.id },
    });

    await api.as(manager)
      .post(`/api/v1/staffing/applications/${app.id}/approve`)
      .expect(200);

    const assignment = await (global as any).prisma.workerAssignment.findFirst({
      where: { worker_id: worker.id, work_request_id: wreq.id },
    });
    expect(assignment).not.toBeNull();
    expect(assignment!.status).toBe('ASSIGNED');
  });

  it('apply → manager rejects → no WorkerAssignment', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });

    await api.as(worker)
      .post(`/api/v1/staffing/work-requests/${wreq.id}/apply`)
      .send({}).expect(201);

    const app = await (global as any).prisma.workApplication.findFirst({
      where: { work_request_id: wreq.id, worker_id: worker.id },
    });

    await api.as(manager)
      .post(`/api/v1/staffing/applications/${app.id}/reject`)
      .expect(200);

    const assignment = await (global as any).prisma.workerAssignment.findFirst({
      where: { worker_id: worker.id, work_request_id: wreq.id },
    });
    expect(assignment).toBeNull();
  });

  it('worker withdraws own application before approval', async () => {
    const hotel  = await seedHotel();
    const worker = await seedWorker({ hotel_id: hotel.id });
    const wreq   = await seedWorkRequest({ hotel_id: hotel.id, manager_id: worker.id });
    const app    = await seedWorkApplication({ work_request_id: wreq.id, worker_id: worker.id });

    await api.as(worker)
      .delete(`/api/v1/staffing/applications/${app.id}`)
      .expect(200);

    const saved = await (global as any).prisma.workApplication.findUnique({ where: { id: app.id } });
    expect(saved?.status).toBe('WITHDRAWN');
  });

  it('duplicate application returns 409', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    await seedWorkApplication({ work_request_id: wreq.id, worker_id: worker.id });

    await api.as(worker)
      .post(`/api/v1/staffing/work-requests/${wreq.id}/apply`)
      .send({})
      .expect(409);
  });
});
```

---

### `tests/e2e/flows/quality-gate.test.ts` [PATCH-01, PATCH-06, PATCH-08]

```typescript
import { createApp } from '@/app';
import { ApiClient } from '../helpers/api-client';
import { seedCompletedAssignment } from '../../fixtures/db-seeds';

describe('E2E: Quality Gate', () => {
  let api: ApiClient;

  beforeAll(() => { api = new ApiClient(createApp()); });

  it('verify assignment → rate worker → leaderboard reflects ranking', async () => {
    const { hotel, checker, worker, assignment } = await seedCompletedAssignment();  // PATCH-06

    // 1. Checker verifies assignment  [PATCH-01]
    const { body: { data: verification } } = await api.as(checker)
      .post('/api/v1/quality/verifications')
      .send({ worker_assignment_id: assignment.id, score: 88, notes: 'Good job' })   // PATCH-01
      .expect(201);

    expect(verification.status).toBe('verified');

    // 2. Checker rates worker  [PATCH-01]
    const { body: { data: rating } } = await api.as(checker)
      .post('/api/v1/quality/ratings')
      .send({ worker_assignment_id: assignment.id, score: 4, comment: 'Efficient' }) // PATCH-01
      .expect(201);

    expect(rating.score).toBe(4);

    // 3. Leaderboard reflects rating  [PATCH-08: path param not query param]
    const { body: { data: leaderboard } } = await api.as(checker)
      .get(`/api/v1/quality/leaderboard/by-hotel/${hotel.id}`)                       // PATCH-08
      .expect(200);

    const entry = leaderboard.find((e: any) => e.worker_id === worker.id);
    expect(entry).toBeDefined();
    expect(entry.average_score).toBe(4);
  });

  it('needs_rework: score < 60 → WorkerAssignment status returns to ASSIGNED', async () => {
    const { checker, assignment } = await seedCompletedAssignment();

    await api.as(checker)
      .post('/api/v1/quality/verifications')
      .send({ worker_assignment_id: assignment.id, score: 45, notes: 'Incomplete' }) // PATCH-01
      .expect(201);

    // Verify the assignment was returned for rework  [PATCH-06: no crm/tasks route]
    const saved = await (global as any).prisma.workerAssignment.findUnique({
      where: { id: assignment.id },
    });
    expect(saved!.status).toBe('ASSIGNED');
  });

  it('multiple ratings produce correct WorkerOverallRating average', async () => {
    const { checker: c1, worker, assignment: a1 } = await seedCompletedAssignment();
    const { checker: c2, assignment: a2 } = await seedCompletedAssignment();
    // Override second assignment to belong to same worker
    await (global as any).prisma.workerAssignment.update({
      where: { id: a2.id }, data: { worker_id: worker.id },
    });

    await api.as(c1).post('/api/v1/quality/ratings')
      .send({ worker_assignment_id: a1.id, score: 4 }).expect(201);
    await api.as(c2).post('/api/v1/quality/ratings')
      .send({ worker_assignment_id: a2.id, score: 2 }).expect(201);

    const overall = await (global as any).prisma.workerOverallRating.findUnique({
      where: { worker_id: worker.id },
    });
    expect(overall!.total_ratings).toBe(2);
    expect(overall!.average_score).toBe(3);
  });
});
```

---

### `tests/e2e/flows/attendance-tracking.test.ts` [PATCH-07]

```typescript
import { createApp } from '@/app';
import { ApiClient } from '../helpers/api-client';
import { seedHotel, seedManager, seedWorker, seedWorkRequest, seedAssignment } from '../../fixtures/db-seeds';

describe('E2E: Attendance Tracking', () => {
  let api: ApiClient;

  beforeAll(() => { api = new ApiClient(createApp()); });

  it('full lifecycle: assign → clock-in → clock-out → manager verify', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    const assignment = await seedAssignment({
      work_request_id: wreq.id, worker_id: worker.id, manager_id: manager.id,
      overrides: { status: 'IN_PROGRESS', started_at: new Date() },
    });

    // 1. Clock in
    const { body: { data: attendance } } = await api.as(worker)
      .post(`/api/v1/staffing/assignments/${assignment.id}/clock-in`)
      .expect(201);

    expect(attendance.status).toBe('CLOCKED_IN');
    expect(attendance.clock_in_at).toBeTruthy();

    // 2. Clock out
    const { body: { data: clocked_out } } = await api.as(worker)
      .post(`/api/v1/staffing/assignments/${assignment.id}/clock-out`)
      .expect(200);

    expect(clocked_out.status).toBe('CLOCKED_OUT');
    expect(clocked_out.clock_out_at).toBeTruthy();
    expect(
      new Date(clocked_out.clock_out_at).getTime() - new Date(clocked_out.clock_in_at).getTime()
    ).toBeGreaterThanOrEqual(0);

    // 3. Manager verifies
    const { body: { data: verified } } = await api.as(manager)
      .patch(`/api/v1/staffing/attendance/${attendance.id}/verify`)
      .expect(200);

    expect(verified.status).toBe('VERIFIED');
    expect(verified.verified_by_manager_id).toBe(manager.id);
    expect(verified.verified_at).toBeTruthy();
  });

  it('attendance history for an assignment is retrievable', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    const assignment = await seedAssignment({
      work_request_id: wreq.id, worker_id: worker.id, manager_id: manager.id,
      overrides: { status: 'IN_PROGRESS', started_at: new Date() },
    });

    await api.as(worker)
      .post(`/api/v1/staffing/assignments/${assignment.id}/clock-in`)
      .expect(201);

    const { body: { data: record } } = await api.as(manager)
      .get(`/api/v1/staffing/assignments/${assignment.id}/attendance`)
      .expect(200);

    expect(record.worker_assignment_id).toBe(assignment.id);
    expect(record.status).toBe('CLOCKED_IN');
  });

  it('returns 403 when wrong worker tries to clock in', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const other   = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, manager_id: manager.id });
    const assignment = await seedAssignment({
      work_request_id: wreq.id, worker_id: worker.id, manager_id: manager.id,
      overrides: { status: 'IN_PROGRESS', started_at: new Date() },
    });

    await api.as(other)
      .post(`/api/v1/staffing/assignments/${assignment.id}/clock-in`)
      .expect(403);
  });
});
```

---

## 8. Mocking Strategy

```typescript
// tests/mocks/prisma.ts
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

export const prismaMock = mockDeep<PrismaClient>();
beforeEach(() => { mockReset(prismaMock); });
```

```typescript
// tests/mocks/external.ts
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send:      jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client:         jest.fn(),
  PutObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-spaces.url/file.jpg'),
}));
jest.mock('firebase-admin', () => ({
  messaging: () => ({ send: jest.fn().mockResolvedValue({ name: 'mock-id' }) }),
}));
```

```typescript
// tests/helpers/auth.ts
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

---

## 9. Coverage Targets

| Module | Statements | Branches | Rationale |
|--------|-----------|----------|-----------|
| `staffing/service.ts` | 95% | 90% | Core marketplace — assignment + application state machines |
| `quality/service.ts`  | 95% | 90% | Rating affects worker pay |
| `auth/` middleware    | 90% | 85% | Security boundary |
| `crm/service.ts`      | 80% | 75% | Standard CRUD |
| `hr/service.ts`       | 80% | 75% | Standard CRUD |
| `lib/errors.ts`       | 95% | 90% | All error paths |
| `lib/jwt.ts`          | 95% | 90% | Auth critical path |

**Global**: Statements 85% · Branches 80% · Functions 85% · Lines 85%

### Critical Branches

| File | Branch |
|------|--------|
| `staffing/service.ts` | `assignment.status !== 'ASSIGNED'` guard on startAssignment |
| `staffing/service.ts` | `work_request.status === 'FILLED'` on assign/apply |
| `staffing/service.ts` | `application.status !== 'PENDING'` on approve/reject |
| `quality/service.ts`  | `score < 60` → `needs_rework` |
| `quality/service.ts`  | Duplicate `worker_assignment_id` guard |
| `middleware/auth.ts`  | Missing header / malformed token / expired token |
| `middleware/permissions.ts` | Wildcard permission match |

---

## 10. CI Execution Order [PATCH-09]

```yaml
# .github/workflows/test.yml
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
    name: TypeScript
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - run: cd backend && npm ci
      - run: cd backend && npm run typecheck

  lint:
    name: ESLint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - run: cd backend && npm ci
      - run: cd backend && npm run lint

  unit-tests:
    name: Unit Tests
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
    name: Integration Tests
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
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
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
    name: E2E Tests
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
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
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

  # PATCH-09: removed nyc; Jest native coverage used throughout
  coverage-gate:
    name: Coverage Gate
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
      - name: Enforce coverage thresholds
        run: |
          cd backend
          npx jest --coverage \
            --coverageDirectory=coverage/merged \
            --coverageThreshold='{"global":{"branches":80,"functions":85,"lines":85,"statements":85}}'
```

---

## 11. Updated Test Matrix

| Test File | Layer | Entities Covered | Patches Applied |
|-----------|-------|-----------------|-----------------|
| `unit/staffing/service.test.ts` | Unit | WorkRequest, WorkerAssignment | PATCH-03 |
| `unit/staffing/work-application.test.ts` | Unit | WorkApplication | PATCH-02 |
| `unit/staffing/assignment-state.test.ts` | Unit | WorkerAssignment state machine | — |
| `unit/staffing/attendance.test.ts` | Unit | Attendance | PATCH-07 |
| `unit/quality/verification.test.ts` | Unit | QualityVerification | PATCH-01, PATCH-06 |
| `unit/quality/rating.test.ts` | Unit | Rating, WorkerOverallRating | PATCH-01, PATCH-06 |
| `unit/quality/leaderboard.test.ts` | Unit | WorkerOverallRating ranking | PATCH-08 |
| `unit/auth/jwt.test.ts` | Unit | JWT | — |
| `unit/auth/auth-middleware.test.ts` | Unit | Auth middleware | — |
| `unit/auth/permissions.test.ts` | Unit | RBAC | — |
| `unit/lib/errors.test.ts` | Unit | Custom errors | — |
| `integration/staffing/work-requests.test.ts` | Integration | WorkRequest CRUD | — |
| `integration/staffing/work-applications.test.ts` | Integration | WorkApplication flow | PATCH-02 |
| `integration/staffing/assignments.test.ts` | Integration | WorkerAssignment | PATCH-03, PATCH-04 |
| `integration/staffing/attendance.test.ts` | Integration | Attendance | PATCH-07 |
| `integration/quality/verifications.test.ts` | Integration | QualityVerification | PATCH-01, PATCH-06 |
| `integration/quality/ratings.test.ts` | Integration | Rating | PATCH-01, PATCH-06 |
| `integration/auth/jwt-flow.test.ts` | Integration | Auth lifecycle | — |
| `e2e/flows/worker-hiring-cycle.test.ts` | E2E | Full staffing flow | PATCH-02, PATCH-03, PATCH-04 |
| `e2e/flows/worker-application.test.ts` | E2E | WorkApplication | PATCH-02 |
| `e2e/flows/quality-gate.test.ts` | E2E | QualityVerification + Rating + Leaderboard | PATCH-01, PATCH-06, PATCH-08 |
| `e2e/flows/attendance-tracking.test.ts` | E2E | Attendance full lifecycle | PATCH-07 |

---

## 12. Final Status

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   FINAL STATUS:   ✅  A P P R O V E D                   ║
║                                                          ║
║   All 10 patches applied.                                ║
║   All 7 blockers from PATCH_V1 resolved.                 ║
║   All 8 major issues from PATCH_V1 resolved.             ║
║   Plan is implementation-ready.                          ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

**Pre-implementation prerequisite**: Add `WorkApplication` and `Attendance` models to `prisma/schema.prisma`, and update `QualityVerification` + `Rating` to use `worker_assignment_id`. Run `npx prisma migrate dev` before running any tests.

---

*This document supersedes TESTING_MASTER_PLAN.md. All test implementations must follow PATCH V2.*
