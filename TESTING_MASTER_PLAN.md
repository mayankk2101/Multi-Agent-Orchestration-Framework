# TESTING MASTER PLAN

> **⚠️ NOTE (2026-06-19).** Any references to mocking "DigitalOcean Spaces" in integration tests predate the migration to **AWS S3**. Mock the S3 client instead (the storage abstraction is unchanged). All other testing guidance remains valid.
## Hotel CRM — Marketplace Architecture

**Status**: Implementation-Ready  
**Scope**: HotelWorker · WorkApplication · WorkerAssignment · Attendance · QualityVerification · Rating  
**Stack**: Express.js · TypeScript · Prisma · PostgreSQL · Jest · Supertest

---

## 0. Test Framework Setup

### Install (backend)

```bash
cd backend
npm install --save-dev \
  jest @types/jest ts-jest \
  supertest @types/supertest \
  @prisma/client \
  jest-mock-extended \
  @faker-js/faker \
  dotenv-cli
```

### `backend/jest.config.ts`

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/tests/**/*.test.ts',
    '**/tests/**/*.integration.ts',
    '**/tests/**/*.e2e.ts',
  ],
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
  globalSetup: '<rootDir>/tests/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.ts',
  setupFilesAfterFramework: ['<rootDir>/tests/setup/testEnv.ts'],
  projects: [
    { displayName: 'unit',        testMatch: ['**/tests/unit/**/*.test.ts'] },
    { displayName: 'integration', testMatch: ['**/tests/integration/**/*.test.ts'] },
    { displayName: 'e2e',         testMatch: ['**/tests/e2e/**/*.test.ts'] },
  ],
};

export default config;
```

### `backend/package.json` scripts

```json
{
  "scripts": {
    "test":            "jest",
    "test:unit":       "jest --selectProjects unit",
    "test:integration":"dotenv-cli -e .env.test -- jest --selectProjects integration --runInBand",
    "test:e2e":        "dotenv-cli -e .env.test -- jest --selectProjects e2e --runInBand",
    "test:coverage":   "jest --coverage",
    "test:ci":         "jest --ci --coverage --forceExit"
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

## 1. Unit Testing Strategy

Unit tests cover **pure business logic in isolation** — services, utilities, middleware logic — with all I/O (Prisma, JWT, external APIs) mocked.

### Scope

| Module | Files Under Test |
|--------|-----------------|
| Staffing | `staffing/service.ts` — createWorkRequest, assignWorkers, startAssignment, completeAssignment |
| Quality  | `quality/service.ts` — createVerification, createRating, getLeaderboard |
| Auth     | `lib/jwt.ts`, `middleware/auth.ts`, `middleware/permissions.ts` |
| Base     | `lib/base-service.ts`, `lib/errors.ts`, `lib/utils.ts` |

### Structure

```
tests/unit/
├── staffing/
│   ├── service.test.ts          # WorkApplication + WorkerAssignment logic
│   └── assignment-state.test.ts # State machine: ASSIGNED→IN_PROGRESS→COMPLETED
├── quality/
│   ├── verification.test.ts     # QualityVerification scoring rules
│   ├── rating.test.ts           # Rating 0-5 scale, worker aggregate
│   └── leaderboard.test.ts      # Ranking algorithm
├── auth/
│   ├── jwt.test.ts
│   ├── auth-middleware.test.ts
│   └── permissions.test.ts
└── lib/
    ├── errors.test.ts
    └── utils.test.ts
```

### Key Test Cases

#### `staffing/service.test.ts`

```typescript
// tests/unit/staffing/service.test.ts
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { StaffingService } from '@/modules/staffing/service';
import { workerFixture, workRequestFixture, assignmentFixture } from '../../fixtures';

let prisma: DeepMockProxy<PrismaClient>;
let service: StaffingService;

beforeEach(() => {
  prisma = mockDeep<PrismaClient>();
  service = new StaffingService(prisma);
});

describe('assignWorkers', () => {
  it('assigns an ACTIVE worker to an OPEN work request', async () => {
    const worker = workerFixture({ is_active: true });
    const request = workRequestFixture({ status: 'OPEN', workers_needed: 1 });
    prisma.user.findFirst.mockResolvedValue(worker);
    prisma.workRequest.findFirst.mockResolvedValue(request);
    prisma.workerAssignment.create.mockResolvedValue(
      assignmentFixture({ worker_id: worker.id, work_request_id: request.id, status: 'ASSIGNED' })
    );

    const result = await service.assignWorkers(request.id, [worker.id], 'manager-id');

    expect(prisma.workerAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ASSIGNED' }) })
    );
    expect(result.status).toBe('ASSIGNED');
  });

  it('throws when work request is already FILLED', async () => {
    const request = workRequestFixture({ status: 'FILLED' });
    prisma.workRequest.findFirst.mockResolvedValue(request);

    await expect(service.assignWorkers(request.id, ['worker-id'], 'manager-id'))
      .rejects.toThrow('Work request is already filled');
  });

  it('throws when worker does not belong to the hotel', async () => {
    prisma.user.findFirst.mockResolvedValue(null); // hotel_ids filter returns nothing

    await expect(service.assignWorkers('req-id', ['worker-id'], 'manager-id'))
      .rejects.toThrow();
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

  it('rejects start when assignment is already COMPLETED', async () => {
    prisma.workerAssignment.findFirst.mockResolvedValue(
      assignmentFixture({ status: 'COMPLETED' })
    );

    await expect(service.startAssignment('id', 'worker-id'))
      .rejects.toThrow();
  });
});

describe('completeAssignment', () => {
  it('transitions IN_PROGRESS → COMPLETED and sets completed_at', async () => {
    const assignment = assignmentFixture({ status: 'IN_PROGRESS' });
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
});
```

#### `quality/verification.test.ts`

```typescript
describe('createVerification', () => {
  it('creates verification with score 0-100', async () => {
    const task = taskFixture({ status: 'COMPLETED' });
    prisma.task.findFirst.mockResolvedValue(task);
    prisma.qualityVerification.create.mockResolvedValue(
      verificationFixture({ score: 87, status: 'verified' })
    );

    const result = await service.createVerification({ task_id: task.id, score: 87, notes: '' }, 'checker-id');
    expect(result.score).toBe(87);
    expect(result.status).toBe('verified');
  });

  it('rejects score outside 0-100 range', async () => {
    await expect(service.createVerification({ task_id: 'id', score: 105, notes: '' }, 'checker-id'))
      .rejects.toThrow();
  });

  it('sets status=needs_rework when score < 60', async () => {
    const task = taskFixture({ status: 'COMPLETED' });
    prisma.task.findFirst.mockResolvedValue(task);
    prisma.qualityVerification.create.mockResolvedValue(
      verificationFixture({ score: 45, status: 'needs_rework' })
    );

    const result = await service.createVerification({ task_id: task.id, score: 45, notes: '' }, 'checker-id');
    expect(result.status).toBe('needs_rework');
  });

  it('prevents duplicate verification for same task', async () => {
    prisma.qualityVerification.findUnique.mockResolvedValue(verificationFixture());

    await expect(service.createVerification({ task_id: 'existing-task', score: 80, notes: '' }, 'checker-id'))
      .rejects.toThrow();
  });
});

describe('createRating', () => {
  it('creates rating with 1-5 star score', async () => {
    prisma.rating.create.mockResolvedValue(ratingFixture({ score: 4 }));
    prisma.workerOverallRating.upsert.mockResolvedValue(overallRatingFixture({ average_score: 4.2 }));

    const result = await service.createRating({ task_id: 'id', score: 4 }, 'checker-id');
    expect(result.score).toBe(4);
  });

  it('updates WorkerOverallRating average after new rating', async () => {
    prisma.rating.create.mockResolvedValue(ratingFixture({ score: 5 }));

    await service.createRating({ task_id: 'id', score: 5 }, 'checker-id');

    expect(prisma.workerOverallRating.upsert).toHaveBeenCalled();
  });

  it('rejects score of 0 or above 5', async () => {
    await expect(service.createRating({ task_id: 'id', score: 0 }, 'checker-id')).rejects.toThrow();
    await expect(service.createRating({ task_id: 'id', score: 6 }, 'checker-id')).rejects.toThrow();
  });
});
```

#### `staffing/assignment-state.test.ts` — State machine

```typescript
// Valid transitions
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
    ['IN_PROGRESS', 'COMPLETED',   true],
    ['IN_PROGRESS', 'ASSIGNED',    false],
    ['COMPLETED',   'IN_PROGRESS', false],
    ['CANCELLED',   'ASSIGNED',    false],
  ])('%s → %s is %s', (from, to, valid) => {
    expect(VALID_TRANSITIONS[from]?.includes(to) ?? false).toBe(valid);
  });
});
```

---

## 2. Integration Testing Strategy

Integration tests run against a **real test PostgreSQL database** (seeded fresh per suite). They test the full request→service→database round-trip through the Express app without mocking I/O.

### Setup

```
tests/integration/
├── setup/
│   ├── db.ts           # migrate + seed test DB
│   └── app.ts          # create Express app instance
├── staffing/
│   ├── work-requests.test.ts
│   └── assignments.test.ts
├── quality/
│   ├── verifications.test.ts
│   └── ratings.test.ts
└── auth/
    └── jwt-flow.test.ts
```

### `tests/setup/globalSetup.ts`

```typescript
import { execSync } from 'child_process';

export default async function globalSetup() {
  process.env.DATABASE_URL = process.env.DATABASE_URL!.replace('hotelcrm_dev', 'hotelcrm_test');
  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'inherit' });
}
```

### `tests/setup/globalTeardown.ts`

```typescript
import { PrismaClient } from '@prisma/client';

export default async function globalTeardown() {
  const prisma = new PrismaClient();
  // Truncate in FK-safe order
  await prisma.$executeRaw`TRUNCATE TABLE
    "Rating", "QualityVerification", "WorkerAssignment",
    "WorkRequest", "DailyOperation", "Task", "User", "Hotel"
    CASCADE`;
  await prisma.$disconnect();
}
```

### `tests/setup/testEnv.ts`

```typescript
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient();
  await prisma.$connect();
  (global as any).prisma = prisma;
});

afterEach(async () => {
  // Clean between tests; order respects FK constraints
  await prisma.$executeRaw`TRUNCATE TABLE
    "Rating", "QualityVerification", "WorkerAssignment",
    "WorkRequest", "DailyOperation", "Task", "AuditLog" CASCADE`;
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### Key Integration Test Cases

#### `staffing/assignments.test.ts`

```typescript
import request from 'supertest';
import { createApp } from '../../setup/app';
import { seedHotel, seedManager, seedWorker, seedWorkRequest } from '../../fixtures/db-seeds';
import { generateToken } from '@/lib/jwt';

describe('POST /api/v1/staffing/assign', () => {
  it('manager assigns worker → 201 + assignment in DB', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, workers_needed: 1 });
    const token   = generateToken(manager);

    const res = await request(createApp())
      .post('/api/v1/staffing/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({ work_request_id: wreq.id, worker_ids: [worker.id] })
      .expect(201);

    expect(res.body.data.status).toBe('ASSIGNED');

    const saved = await (global as any).prisma.workerAssignment.findFirst({
      where: { worker_id: worker.id, work_request_id: wreq.id },
    });
    expect(saved).not.toBeNull();
    expect(saved!.status).toBe('ASSIGNED');
  });

  it('returns 403 when non-manager attempts assignment', async () => {
    const hotel  = await seedHotel();
    const worker = await seedWorker({ hotel_id: hotel.id });
    const token  = generateToken(worker); // worker role

    await request(createApp())
      .post('/api/v1/staffing/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({ work_request_id: 'any-id', worker_ids: ['any-id'] })
      .expect(403);
  });

  it('returns 409 when work request is FILLED', async () => {
    const hotel   = await seedHotel();
    const manager = await seedManager({ hotel_id: hotel.id });
    const worker  = await seedWorker({ hotel_id: hotel.id });
    const wreq    = await seedWorkRequest({ hotel_id: hotel.id, status: 'FILLED' });
    const token   = generateToken(manager);

    await request(createApp())
      .post('/api/v1/staffing/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({ work_request_id: wreq.id, worker_ids: [worker.id] })
      .expect(409);
  });
});

describe('PATCH /api/v1/staffing/assignments/:id/start', () => {
  it('worker starts assignment → status IN_PROGRESS + started_at set', async () => {
    const { hotel, worker, assignment } = await seedAssignedWorker();
    const token = generateToken(worker);

    const res = await request(createApp())
      .patch(`/api/v1/staffing/assignments/${assignment.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.started_at).toBeTruthy();
  });
});
```

#### `quality/verifications.test.ts`

```typescript
describe('POST /api/v1/quality/verifications', () => {
  it('checker verifies completed task → verification persisted', async () => {
    const { hotel, checker, task } = await seedCompletedTask();
    const token = generateToken(checker);

    const res = await request(createApp())
      .post('/api/v1/quality/verifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: task.id, score: 92, notes: 'Excellent work' })
      .expect(201);

    expect(res.body.data.score).toBe(92);
    expect(res.body.data.status).toBe('verified');
  });

  it('returns 409 on duplicate verification for same task', async () => {
    const { checker, task, verification } = await seedVerifiedTask();
    const token = generateToken(checker);

    await request(createApp())
      .post('/api/v1/quality/verifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: task.id, score: 88, notes: '' })
      .expect(409);
  });
});

describe('POST /api/v1/quality/ratings', () => {
  it('rating updates WorkerOverallRating average', async () => {
    const { hotel, checker, worker, task } = await seedCompletedTask();
    const token = generateToken(checker);

    await request(createApp())
      .post('/api/v1/quality/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: task.id, worker_id: worker.id, score: 5, comment: 'Great' })
      .expect(201);

    const overall = await (global as any).prisma.workerOverallRating.findUnique({
      where: { worker_id: worker.id },
    });
    expect(overall).not.toBeNull();
    expect(overall!.total_ratings).toBe(1);
    expect(overall!.average_score).toBe(5);
  });
});
```

---

## 3. E2E Testing Strategy

E2E tests exercise **complete user workflows** from HTTP request through to database state. They run against the full Express app with a live test DB and use no mocks whatsoever.

### Scope — Core Marketplace Flows

| Flow | Actors | Steps |
|------|--------|-------|
| Worker Hiring Cycle | Manager + Worker | Create work request → Assign worker → Worker starts → Worker completes |
| Quality Gate | Checker | Verify task → Rate worker → Leaderboard reflects ranking |
| Attendance Tracking | Worker + Manager | Assignment start/complete timestamps form attendance record |
| Worker Application Flow | Worker + Manager | Worker expresses interest → Manager approves/rejects → Assignment created |

### Structure

```
tests/e2e/
├── flows/
│   ├── worker-hiring-cycle.test.ts
│   ├── quality-gate.test.ts
│   ├── attendance-tracking.test.ts
│   └── worker-application.test.ts
└── helpers/
    ├── api-client.ts    # typed wrapper around supertest
    └── scenario.ts      # composite seed helpers
```

### `tests/e2e/flows/worker-hiring-cycle.test.ts`

```typescript
import { ApiClient } from '../helpers/api-client';
import { buildScenario } from '../helpers/scenario';

describe('E2E: Worker Hiring Cycle', () => {
  let api: ApiClient;

  beforeAll(async () => { api = new ApiClient(createApp()); });

  it('full cycle: create request → assign → start → complete', async () => {
    const { hotel, manager, worker } = await buildScenario.hotelWithStaff();

    // 1. Manager creates work request
    const { body: { data: workRequest } } = await api
      .as(manager)
      .post('/api/v1/staffing/work-requests')
      .send({
        hotel_id: hotel.id,
        position: 'housekeeping',
        workers_needed: 1,
        shift_date: '2026-06-10',
        shift_start_time: '08:00',
        shift_end_time: '16:00',
      })
      .expect(201);

    expect(workRequest.status).toBe('OPEN');

    // 2. Manager assigns worker
    const { body: { data: assignment } } = await api
      .as(manager)
      .post('/api/v1/staffing/assign')
      .send({ work_request_id: workRequest.id, worker_ids: [worker.id] })
      .expect(201);

    expect(assignment.status).toBe('ASSIGNED');

    // 3. Work request status transitions to FILLED
    const { body: { data: filledRequest } } = await api
      .as(manager)
      .get(`/api/v1/staffing/work-requests/${workRequest.id}`)
      .expect(200);

    expect(filledRequest.status).toBe('FILLED');

    // 4. Worker starts assignment
    const { body: { data: inProgress } } = await api
      .as(worker)
      .patch(`/api/v1/staffing/assignments/${assignment.id}/start`)
      .expect(200);

    expect(inProgress.status).toBe('IN_PROGRESS');
    expect(inProgress.started_at).toBeTruthy();

    // 5. Worker completes assignment
    const { body: { data: completed } } = await api
      .as(worker)
      .patch(`/api/v1/staffing/assignments/${assignment.id}/complete`)
      .expect(200);

    expect(completed.status).toBe('COMPLETED');
    expect(completed.completed_at).toBeTruthy();

    // 6. Attendance record: started_at + completed_at form the shift record
    expect(
      new Date(completed.completed_at).getTime() - new Date(inProgress.started_at).getTime()
    ).toBeGreaterThan(0);
  });
});
```

### `tests/e2e/flows/quality-gate.test.ts`

```typescript
describe('E2E: Quality Gate', () => {
  it('verify task → rate worker → leaderboard updates', async () => {
    const { hotel, checker, worker, task } = await buildScenario.completedTask();

    // 1. Checker verifies task
    const { body: { data: verification } } = await api
      .as(checker)
      .post('/api/v1/quality/verifications')
      .send({ task_id: task.id, score: 88, notes: 'Good job' })
      .expect(201);

    expect(verification.status).toBe('verified');

    // 2. Checker rates worker
    const { body: { data: rating } } = await api
      .as(checker)
      .post('/api/v1/quality/ratings')
      .send({ task_id: task.id, worker_id: worker.id, score: 4, comment: 'Efficient' })
      .expect(201);

    expect(rating.score).toBe(4);

    // 3. Leaderboard reflects worker's rating
    const { body: { data: leaderboard } } = await api
      .as(checker)
      .get(`/api/v1/quality/leaderboard?hotel_id=${hotel.id}`)
      .expect(200);

    const entry = leaderboard.find((e: any) => e.worker_id === worker.id);
    expect(entry).toBeDefined();
    expect(entry.average_score).toBe(4);
  });

  it('needs_rework flow: score < 60 → task returned to worker', async () => {
    const { checker, worker, task } = await buildScenario.completedTask();

    await api
      .as(checker)
      .post('/api/v1/quality/verifications')
      .send({ task_id: task.id, score: 45, notes: 'Incomplete cleaning' })
      .expect(201);

    const { body: { data: updatedTask } } = await api
      .as(worker)
      .get(`/api/v1/crm/tasks/${task.id}`)
      .expect(200);

    expect(updatedTask.status).toBe('ASSIGNED'); // returned for rework
  });
});
```

---

## 4. Test Fixtures

### `tests/fixtures/index.ts` — In-memory fixtures (unit tests)

```typescript
import { faker } from '@faker-js/faker';
import type {
  User, WorkRequest, WorkerAssignment,
  QualityVerification, Rating, Hotel, Task,
} from '@prisma/client';

export const hotelFixture = (overrides: Partial<Hotel> = {}): Hotel => ({
  id:         faker.string.uuid(),
  name:       faker.company.name() + ' Hotel',
  city:       faker.location.city(),
  country:    faker.location.country(),
  address:    faker.location.streetAddress(),
  timezone:   'Asia/Kolkata',
  is_active:  true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

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

export const managerFixture  = (o: Partial<User> = {}) =>
  workerFixture({ role: 'MANAGER', permissions: ['staffing:*', 'quality:read'], ...o });

export const checkerFixture  = (o: Partial<User> = {}) =>
  workerFixture({ role: 'CHECKER', permissions: ['quality:*'], ...o });

export const workRequestFixture = (overrides: Partial<WorkRequest> = {}): WorkRequest => ({
  id:              faker.string.uuid(),
  hotel_id:        faker.string.uuid(),
  position:        'housekeeping',
  workers_needed:  2,
  shift_date:      new Date('2026-06-10'),
  shift_start_time: '08:00',
  shift_end_time:   '16:00',
  status:          'OPEN',
  created_by_manager_id: faker.string.uuid(),
  created_at:      new Date(),
  updated_at:      new Date(),
  ...overrides,
});

export const assignmentFixture = (overrides: Partial<WorkerAssignment> = {}): WorkerAssignment => ({
  id:                       faker.string.uuid(),
  worker_id:                faker.string.uuid(),
  work_request_id:          faker.string.uuid(),
  assigned_by_manager_id:   faker.string.uuid(),
  status:                   'ASSIGNED',
  assigned_at:              new Date(),
  started_at:               null,
  completed_at:             null,
  previous_assignment_id:   null,
  created_at:               new Date(),
  updated_at:               new Date(),
  ...overrides,
});

export const taskFixture = (overrides: Partial<Task> = {}): Task => ({
  id:                      faker.string.uuid(),
  hotel_id:                faker.string.uuid(),
  room_id:                 faker.string.uuid(),
  assigned_to_worker_id:   faker.string.uuid(),
  created_by_manager_id:   faker.string.uuid(),
  description:             'Clean room thoroughly',
  priority:                'MEDIUM',
  status:                  'COMPLETED',
  scheduled_at:            new Date(),
  started_at:              new Date(),
  completed_at:            new Date(),
  created_at:              new Date(),
  updated_at:              new Date(),
  ...overrides,
});

export const verificationFixture = (overrides: Partial<QualityVerification> = {}): QualityVerification => ({
  id:                    faker.string.uuid(),
  task_id:               faker.string.uuid(),
  hotel_id:              faker.string.uuid(),
  verified_by_checker_id: faker.string.uuid(),
  score:                 85,
  notes:                 'Good work',
  status:                'verified',
  created_at:            new Date(),
  updated_at:            new Date(),
  ...overrides,
});

export const ratingFixture = (overrides: Partial<Rating> = {}): Rating => ({
  id:                   faker.string.uuid(),
  task_id:              faker.string.uuid(),
  hotel_id:             faker.string.uuid(),
  worker_id:            faker.string.uuid(),
  rated_by_checker_id:  faker.string.uuid(),
  score:                4,
  comment:              null,
  created_at:           new Date(),
  updated_at:           new Date(),
  ...overrides,
});

export const overallRatingFixture = (overrides = {}) => ({
  id:            faker.string.uuid(),
  worker_id:     faker.string.uuid(),
  average_score: 4.0,
  total_ratings: 1,
  updated_at:    new Date(),
  ...overrides,
});
```

### `tests/fixtures/db-seeds.ts` — DB fixtures (integration/E2E)

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

const prisma = () => (global as any).prisma as PrismaClient;

const HASHED_PASSWORD = await bcrypt.hash('Test1234!', 10);

export const seedHotel = async (overrides = {}) =>
  prisma().hotel.create({
    data: {
      name: faker.company.name() + ' Hotel',
      city: 'Mumbai',
      country: 'India',
      address: faker.location.streetAddress(),
      timezone: 'Asia/Kolkata',
      is_active: true,
      ...overrides,
    },
  });

export const seedWorker = async ({ hotel_id, ...overrides }: { hotel_id: string } & any = {}) =>
  prisma().user.create({
    data: {
      email:         faker.internet.email(),
      password_hash: HASHED_PASSWORD,
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

export const seedManager = async ({ hotel_id, ...o }: { hotel_id: string } & any) =>
  seedWorker({ hotel_id, role: 'MANAGER', permissions: ['staffing:*', 'quality:read'], ...o });

export const seedChecker = async ({ hotel_id, ...o }: { hotel_id: string } & any) =>
  seedWorker({ hotel_id, role: 'CHECKER', permissions: ['quality:*'], ...o });

export const seedWorkRequest = async (data: any) =>
  prisma().workRequest.create({ data });

export const seedAssignedWorker = async () => {
  const hotel      = await seedHotel();
  const manager    = await seedManager({ hotel_id: hotel.id });
  const worker     = await seedWorker({ hotel_id: hotel.id });
  const workReq    = await seedWorkRequest({
    hotel_id: hotel.id, position: 'housekeeping',
    workers_needed: 1, shift_date: new Date(),
    shift_start_time: '08:00', shift_end_time: '16:00',
    status: 'OPEN', created_by_manager_id: manager.id,
  });
  const assignment = await prisma().workerAssignment.create({
    data: {
      worker_id: worker.id, work_request_id: workReq.id,
      assigned_by_manager_id: manager.id, status: 'ASSIGNED',
      assigned_at: new Date(),
    },
  });
  return { hotel, manager, worker, workReq, assignment };
};

export const seedCompletedTask = async () => {
  const hotel   = await seedHotel();
  const manager = await seedManager({ hotel_id: hotel.id });
  const worker  = await seedWorker({ hotel_id: hotel.id });
  const checker = await seedChecker({ hotel_id: hotel.id });
  const room    = await prisma().room.create({
    data: { hotel_id: hotel.id, room_number: '101', type: 'STANDARD', status: 'dirty' },
  });
  const task = await prisma().task.create({
    data: {
      hotel_id: hotel.id, room_id: room.id,
      assigned_to_worker_id: worker.id,
      created_by_manager_id: manager.id,
      description: 'Deep clean room', priority: 'HIGH',
      status: 'COMPLETED', scheduled_at: new Date(),
      started_at: new Date(), completed_at: new Date(),
    },
  });
  return { hotel, manager, worker, checker, task };
};
```

---

## 5. Mocking Strategy

### Principle: Mock at the boundary, not inside it

| Layer | Approach |
|-------|----------|
| **Unit** | Mock Prisma entirely via `jest-mock-extended`. Never hit the DB. |
| **Integration** | Real Prisma + test DB. Mock only external services (email, push, DO Spaces). |
| **E2E** | Real Prisma + test DB. Mock only third-party HTTP calls. |

### Prisma Mock (unit tests)

```typescript
// tests/mocks/prisma.ts
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

export const prismaMock = mockDeep<PrismaClient>();

beforeEach(() => { mockReset(prismaMock); });
```

Usage in test:
```typescript
import { prismaMock } from '../../mocks/prisma';
prismaMock.workerAssignment.create.mockResolvedValue(assignmentFixture());
```

### JWT Mock (unit tests)

```typescript
// tests/mocks/jwt.ts
import * as jwt from '@/lib/jwt';

export const mockGenerateToken = (user: any) =>
  `mock.jwt.${Buffer.from(JSON.stringify({ sub: user.id, role: user.role })).toString('base64')}`;

jest.mock('@/lib/jwt', () => ({
  generateToken: jest.fn((u) => mockGenerateToken(u)),
  verifyToken:   jest.fn((token) => {
    const payload = JSON.parse(Buffer.from(token.split('.')[2], 'base64').toString());
    return payload;
  }),
}));
```

### External Services Mock (integration/E2E)

```typescript
// tests/mocks/external.ts

// Mock SendGrid / Resend
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send:      jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

// Mock DigitalOcean Spaces
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client:        jest.fn(),
  PutObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-spaces.url/file.jpg'),
}));

// Mock push notifications
jest.mock('firebase-admin', () => ({
  messaging: () => ({ send: jest.fn().mockResolvedValue({ name: 'mock-message-id' }) }),
}));
```

### Auth Token Helper (integration/E2E)

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

### ApiClient (E2E helper)

```typescript
// tests/e2e/helpers/api-client.ts
import request from 'supertest';
import type { Application } from 'express';
import type { User } from '@prisma/client';
import { tokenFor } from '../helpers/auth';

export class ApiClient {
  private app: Application;
  private token?: string;

  constructor(app: Application) { this.app = app; }

  as(user: User): this {
    this.token = tokenFor(user);
    return this;
  }

  post(path: string) {
    const req = request(this.app).post(path);
    if (this.token) req.set('Authorization', `Bearer ${this.token}`);
    return req;
  }

  get(path: string) {
    const req = request(this.app).get(path);
    if (this.token) req.set('Authorization', `Bearer ${this.token}`);
    return req;
  }

  patch(path: string) {
    const req = request(this.app).patch(path);
    if (this.token) req.set('Authorization', `Bearer ${this.token}`);
    return req;
  }
}
```

---

## 6. Coverage Targets

### Global Thresholds

| Metric | Target |
|--------|--------|
| Statements | **85%** |
| Branches   | **80%** |
| Functions  | **85%** |
| Lines      | **85%** |

### Per-Module Targets

| Module | Statements | Branches | Rationale |
|--------|-----------|----------|-----------|
| `staffing/service.ts` | 95% | 90% | Core marketplace logic — assignment state machine |
| `quality/service.ts`  | 95% | 90% | Revenue-impacting — ratings affect worker pay |
| `auth/` middleware    | 90% | 85% | Security boundary — must be thorough |
| `crm/service.ts`      | 80% | 75% | Standard CRUD |
| `hr/service.ts`       | 80% | 75% | Standard CRUD |
| `lib/errors.ts`       | 95% | 90% | Used by all error paths |
| `lib/jwt.ts`          | 95% | 90% | Auth critical path |

### Excluded from Coverage

```typescript
// jest.config.ts — excluded paths
coveragePathIgnorePatterns: [
  '/node_modules/',
  'src/server.ts',        // entry point
  'src/config/env.ts',    // env validation only
  'src/lib/logger.ts',    // Winston setup
  'prisma/',
]
```

### Branch Coverage Notes

Critical branches that MUST have explicit tests:

| Location | Branch |
|----------|--------|
| `staffing/service.ts` | `if assignment.status !== 'ASSIGNED'` (startAssignment guard) |
| `staffing/service.ts` | `if work_request.status === 'FILLED'` |
| `quality/service.ts`  | `score < 60` → `needs_rework` vs `verified` |
| `quality/service.ts`  | Duplicate verification guard |
| `middleware/auth.ts`  | Missing header / malformed token / expired token |
| `middleware/permissions.ts` | Wildcard permission match |

---

## 7. CI Execution Order

### GitHub Actions Workflow

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

  # ── Stage 1: Static checks (parallel, fast) ───────────────────────────────
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

  # ── Stage 2: Unit tests (no DB, very fast) ────────────────────────────────
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: [typecheck, lint]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - run: cd backend && npm ci
      - run: cd backend && npm run test:unit -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: unit-coverage
          path: backend/coverage/

  # ── Stage 3: Integration tests (requires PostgreSQL) ─────────────────────
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
      - name: Run migrations on test DB
        run: cd backend && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://${{ env.POSTGRES_USER }}:${{ env.POSTGRES_PASSWORD }}@localhost:5432/${{ env.POSTGRES_DB }}
      - name: Integration tests
        run: cd backend && npm run test:integration -- --coverage
        env:
          DATABASE_URL: postgresql://${{ env.POSTGRES_USER }}:${{ env.POSTGRES_PASSWORD }}@localhost:5432/${{ env.POSTGRES_DB }}
          JWT_SECRET: ci-test-secret-32-characters-min-x
          NODE_ENV: test
          LOG_LEVEL: silent
      - uses: actions/upload-artifact@v4
        with:
          name: integration-coverage
          path: backend/coverage/

  # ── Stage 4: E2E tests (full app + DB) ───────────────────────────────────
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
      - name: E2E tests
        run: cd backend && npm run test:e2e
        env:
          DATABASE_URL: postgresql://${{ env.POSTGRES_USER }}:${{ env.POSTGRES_PASSWORD }}@localhost:5432/${{ env.POSTGRES_DB }}
          JWT_SECRET: ci-test-secret-32-characters-min-x
          NODE_ENV: test
          LOG_LEVEL: silent

  # ── Stage 5: Coverage gate (merge all reports + enforce thresholds) ───────
  coverage-gate:
    name: Coverage Gate
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: unit-coverage, path: coverage/unit }
      - uses: actions/download-artifact@v4
        with: { name: integration-coverage, path: coverage/integration }
      - name: Enforce thresholds
        run: |
          cd backend
          npm ci
          npx nyc merge coverage/unit coverage/integration coverage/merged.json
          npx nyc report --reporter=text --temp-dir=coverage \
            --branches=80 --functions=85 --lines=85 --statements=85
```

### Execution Order Summary

```
Push / PR
    │
    ├─▶ [Parallel] TypeScript check  +  ESLint
    │            │
    │            ▼ (both pass)
    ├─▶ Unit Tests  (no DB, ~30s)
    │            │
    │            ▼ (pass)
    ├─▶ Integration Tests  (test DB, ~90s)
    │            │
    │            ▼ (pass)
    ├─▶ E2E Tests  (full app + DB, ~2min)
    │            │
    │   [Parallel with Integration]
    └─▶ Coverage Gate  (merge reports + threshold check)
```

### Local Development Commands

```bash
# Fast inner loop — unit only
npm run test:unit --watch

# Before pushing — full suite
npm run test:unit && npm run test:integration && npm run test:e2e

# Coverage report
npm run test:coverage && open coverage/lcov-report/index.html

# Single module (during implementation)
jest --testPathPattern="staffing" --watch
```

---

## Appendix: Test File Manifest

```
backend/
└── tests/
    ├── setup/
    │   ├── globalSetup.ts
    │   ├── globalTeardown.ts
    │   └── testEnv.ts
    ├── fixtures/
    │   ├── index.ts              # In-memory (unit)
    │   └── db-seeds.ts           # DB-backed (integration/E2E)
    ├── mocks/
    │   ├── prisma.ts             # jest-mock-extended Prisma
    │   ├── jwt.ts                # JWT helpers
    │   └── external.ts           # SendGrid, S3, FCM
    ├── helpers/
    │   └── auth.ts               # tokenFor()
    ├── unit/
    │   ├── staffing/
    │   │   ├── service.test.ts
    │   │   └── assignment-state.test.ts
    │   ├── quality/
    │   │   ├── verification.test.ts
    │   │   ├── rating.test.ts
    │   │   └── leaderboard.test.ts
    │   ├── auth/
    │   │   ├── jwt.test.ts
    │   │   ├── auth-middleware.test.ts
    │   │   └── permissions.test.ts
    │   └── lib/
    │       ├── errors.test.ts
    │       └── utils.test.ts
    ├── integration/
    │   ├── staffing/
    │   │   ├── work-requests.test.ts
    │   │   └── assignments.test.ts
    │   ├── quality/
    │   │   ├── verifications.test.ts
    │   │   └── ratings.test.ts
    │   └── auth/
    │       └── jwt-flow.test.ts
    └── e2e/
        ├── helpers/
        │   ├── api-client.ts
        │   └── scenario.ts
        └── flows/
            ├── worker-hiring-cycle.test.ts
            ├── quality-gate.test.ts
            ├── attendance-tracking.test.ts
            └── worker-application.test.ts
```

---

*Architecture frozen. Tests implement against the schema at `backend/prisma/schema.prisma`. Service implementations are the contract — tests define the expected behavior that services must satisfy.*
