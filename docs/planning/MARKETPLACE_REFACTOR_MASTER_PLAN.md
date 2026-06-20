# MARKETPLACE REFACTOR MASTER PLAN

**Status:** FROZEN — Architecture is non-negotiable  
**Date:** 2026-06-09  
**Branch:** `claude/loving-brahmagupta-n70p9z`

---

## SOURCE OF TRUTH — Marketplace Entity Chain

```
Admin
└── Hotel
    ├── Manager          (User with MANAGER role, explicit hotel membership)
    ├── HotelWorker      (Worker enrolled at this hotel)
    ├── WorkRequest      (Shift/job posted by Manager)
    │   └── WorkApplication  (Worker applies; Manager approves/rejects)
    │       └── WorkerAssignment  (Approved application becomes assignment)
    │           ├── Attendance       (Clock-in / clock-out record)
    │           ├── QualityVerification  (Checker scores the work)
    │           └── Rating           (Checker rates the worker)
```

---

## LEGEND

| Symbol | Meaning |
|--------|---------|
| `REMOVE` | Delete entirely — no trace in final codebase |
| `KEEP` | Unchanged — survives as-is |
| `MODIFY` | Exists but requires changes |
| `ADD` | Does not exist — must be created |

---

## PART 1 — Schema Migration Order

All schema work is done in a single Prisma migration named `marketplace-refactor`.  
Order within the migration is dictated by foreign-key dependencies.

### Phase 1-A: Remove legacy FK references FIRST (unblock table drops)

| Step | Action | Classification | File |
|------|--------|----------------|------|
| 1 | Drop `QualityVerification.task_id` FK and column | `MODIFY` | `schema.prisma` |
| 2 | Drop `Rating.task_id` FK and column | `MODIFY` | `schema.prisma` |
| 3 | Drop `WorkerAssignment.daily_operations` relation | `MODIFY` | `schema.prisma` |
| 4 | Drop `Hotel.rooms`, `Hotel.tasks`, `Hotel.daily_operations` relations | `MODIFY` | `schema.prisma` |
| 5 | Drop `User.created_tasks`, `User.assigned_tasks`, `User.created_operations` relations | `MODIFY` | `schema.prisma` |

### Phase 1-B: Drop legacy tables (dependency order)

| Step | Table | Classification | Blocked by |
|------|-------|----------------|-----------|
| 6 | Drop `daily_operations` | `REMOVE` | Step 3 |
| 7 | Drop `task_photos` | `REMOVE` | No external FKs |
| 8 | Drop `tasks` | `REMOVE` | Steps 1, 2, 7 |
| 9 | Drop `rooms` | `REMOVE` | Steps 6, 8 |

### Phase 1-C: Add new columns to surviving tables

| Step | Action | Classification | Table |
|------|--------|----------------|-------|
| 10 | Add `assignment_id TEXT NOT NULL` to `quality_verifications` | `MODIFY` | quality_verifications |
| 11 | Add FK: `quality_verifications.assignment_id → worker_assignments.id` | `MODIFY` | quality_verifications |
| 12 | Add `assignment_id TEXT NOT NULL` to `ratings` | `MODIFY` | ratings |
| 13 | Add FK: `ratings.assignment_id → worker_assignments.id` | `MODIFY` | ratings |
| 14 | Add `application_id TEXT` to `worker_assignments` | `MODIFY` | worker_assignments |
| 15 | Add FK: `worker_assignments.application_id → work_applications.id` | `MODIFY` (blocked by Step 16) | worker_assignments |

### Phase 1-D: Create new tables

| Step | Table | Classification | FK Dependencies |
|------|-------|----------------|----------------|
| 16 | Create `work_applications` | `ADD` | `work_requests`, `users` |
| 17 | Create `hotel_workers` | `ADD` | `hotels`, `users` |
| 18 | Create `attendances` | `ADD` | `worker_assignments`, `users` |
| 19 | Apply FK in Step 15 now that `work_applications` exists | `MODIFY` | Step 16 |

### Phase 1-E: Clean up User model

| Step | Action | Classification | Note |
|------|--------|----------------|------|
| 20 | Drop `User.hotel_ids String[]` column | `MODIFY` | Replaced by `hotel_workers` and `Manager` join |
| 21 | Rename `UserRole.CHECKER` → keep; evaluate `HOTEL_WORKER` role addition | `MODIFY` | See Decision Log |

### Full New Schema Definitions

```prisma
// ADD — Worker enrollment at a hotel
model HotelWorker {
  id          String   @id @default(cuid())
  hotel_id    String
  hotel       Hotel    @relation(fields: [hotel_id], references: [id], onDelete: Cascade)
  worker_id   String
  worker      User     @relation(fields: [worker_id], references: [id], onDelete: Cascade)
  skills      String[] @default([])
  is_active   Boolean  @default(true)
  enrolled_at DateTime @default(now())

  @@unique([hotel_id, worker_id])
  @@index([hotel_id])
  @@index([worker_id])
  @@index([is_active])
}

// ADD — Worker applies to a WorkRequest
model WorkApplication {
  id              String      @id @default(cuid())
  work_request_id String
  work_request    WorkRequest @relation(fields: [work_request_id], references: [id], onDelete: Cascade)
  worker_id       String
  worker          User        @relation(fields: [worker_id], references: [id], onDelete: Cascade)
  status          String      @default("PENDING") // PENDING, APPROVED, REJECTED, WITHDRAWN
  cover_note      String?
  applied_at      DateTime    @default(now())
  reviewed_at     DateTime?
  reviewed_by_id  String?
  reviewed_by     User?       @relation("application_reviewer", fields: [reviewed_by_id], references: [id])

  // Relations
  assignment      WorkerAssignment?

  @@unique([work_request_id, worker_id])
  @@index([work_request_id])
  @@index([worker_id])
  @@index([status])
}

// ADD — Clock-in / clock-out per assignment
model Attendance {
  id             String          @id @default(cuid())
  assignment_id  String
  assignment     WorkerAssignment @relation(fields: [assignment_id], references: [id], onDelete: Cascade)
  worker_id      String
  worker         User            @relation(fields: [worker_id], references: [id], onDelete: Cascade)
  clock_in_at    DateTime?
  clock_out_at   DateTime?
  clock_in_lat   Decimal?        @db.Decimal(9, 6)
  clock_in_lng   Decimal?        @db.Decimal(9, 6)
  clock_out_lat  Decimal?        @db.Decimal(9, 6)
  clock_out_lng  Decimal?        @db.Decimal(9, 6)
  notes          String?
  created_at     DateTime        @default(now())

  @@index([assignment_id])
  @@index([worker_id])
  @@index([clock_in_at])
}
```

---

## PART 2 — Table Removal Order

Strict dependency order. Any deviation will fail with FK constraint violations.

```
Step 1:  daily_operations        (references: worker_assignments, hotels, rooms, users)
Step 2:  task_photos             (references: tasks)
Step 3:  quality_verifications   — DROP task_id column only; table survives
Step 4:  ratings                 — DROP task_id column only; table survives
Step 5:  tasks                   (references: hotels, rooms, users — now cleared)
Step 6:  rooms                   (references: hotels — now cleared)
```

SQL:

```sql
-- Step 1
ALTER TABLE daily_operations DROP CONSTRAINT IF EXISTS daily_operations_worker_assignment_id_fkey;
DROP TABLE daily_operations;

-- Step 2
DROP TABLE task_photos;

-- Step 3
ALTER TABLE quality_verifications DROP CONSTRAINT quality_verifications_task_id_fkey;
ALTER TABLE quality_verifications DROP COLUMN task_id;

-- Step 4
ALTER TABLE ratings DROP CONSTRAINT ratings_task_id_fkey;
ALTER TABLE ratings DROP COLUMN task_id;

-- Step 5
DROP TABLE tasks;

-- Step 6
DROP TABLE rooms;
```

---

## PART 3 — New Entity Creation Order

```
Step 1:  work_applications       (depends on: work_requests [exists], users [exists])
Step 2:  hotel_workers           (depends on: hotels [exists], users [exists])
Step 3:  attendances             (depends on: worker_assignments [exists], users [exists])
Step 4:  ALTER worker_assignments ADD application_id FK → work_applications
Step 5:  ALTER quality_verifications ADD assignment_id FK → worker_assignments
Step 6:  ALTER ratings ADD assignment_id FK → worker_assignments
```

SQL:

```sql
-- Step 1: work_applications
CREATE TABLE work_applications (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  work_request_id TEXT NOT NULL REFERENCES work_requests(id) ON DELETE CASCADE,
  worker_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  cover_note      TEXT,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by_id  TEXT REFERENCES users(id),
  UNIQUE(work_request_id, worker_id)
);
CREATE INDEX idx_work_applications_work_request ON work_applications(work_request_id);
CREATE INDEX idx_work_applications_worker ON work_applications(worker_id);
CREATE INDEX idx_work_applications_status ON work_applications(status);

-- Step 2: hotel_workers
CREATE TABLE hotel_workers (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  hotel_id    TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  worker_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skills      TEXT[] DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, worker_id)
);
CREATE INDEX idx_hotel_workers_hotel ON hotel_workers(hotel_id);
CREATE INDEX idx_hotel_workers_worker ON hotel_workers(worker_id);

-- Step 3: attendances
CREATE TABLE attendances (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  assignment_id  TEXT NOT NULL REFERENCES worker_assignments(id) ON DELETE CASCADE,
  worker_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clock_in_at    TIMESTAMPTZ,
  clock_out_at   TIMESTAMPTZ,
  clock_in_lat   DECIMAL(9,6),
  clock_in_lng   DECIMAL(9,6),
  clock_out_lat  DECIMAL(9,6),
  clock_out_lng  DECIMAL(9,6),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attendances_assignment ON attendances(assignment_id);
CREATE INDEX idx_attendances_worker ON attendances(worker_id);
CREATE INDEX idx_attendances_clock_in ON attendances(clock_in_at);

-- Step 4: wire assignment → application
ALTER TABLE worker_assignments ADD COLUMN application_id TEXT REFERENCES work_applications(id);

-- Step 5: wire verification → assignment
ALTER TABLE quality_verifications ADD COLUMN assignment_id TEXT NOT NULL REFERENCES worker_assignments(id) ON DELETE CASCADE;
CREATE INDEX idx_quality_verifications_assignment ON quality_verifications(assignment_id);

-- Step 6: wire rating → assignment
ALTER TABLE ratings ADD COLUMN assignment_id TEXT NOT NULL REFERENCES worker_assignments(id) ON DELETE CASCADE;
CREATE INDEX idx_ratings_assignment ON ratings(assignment_id);
```

---

## PART 4 — API Migration Order

### Removals

| Endpoint | Method | Classification | Module | Blocked by |
|----------|--------|----------------|--------|-----------|
| `/api/v1/crm/hotels/:id/tasks` | POST | `REMOVE` | crm | Schema Phase 1-B |
| `/api/v1/crm/tasks/:id/photos` | POST | `REMOVE` | crm | Schema Phase 1-B |
| `/api/v1/calendar/hotels/:id/operations` | GET | `REMOVE` | calendar | Schema Phase 1-B |
| `/api/v1/calendar/hotels/:id/operations` | POST | `REMOVE` | calendar | Schema Phase 1-B |

### Modifications

| Endpoint | Method | Classification | Change |
|----------|--------|----------------|--------|
| `POST /api/v1/quality/verifications` | POST | `MODIFY` | Body: replace `task_id` with `assignment_id` |
| `POST /api/v1/quality/ratings` | POST | `MODIFY` | Body: replace `task_id` with `assignment_id` |
| `GET /api/v1/analytics/stats` | GET | `MODIFY` | Replace Task-based counts with WorkRequest/Assignment counts |
| `GET /api/v1/analytics/hotel-summary/:id` | GET | `MODIFY` | Same as above |

### Additions — Staffing module

| Endpoint | Method | Classification | Description |
|----------|--------|----------------|-------------|
| `/api/v1/staffing/work-requests` | GET | `ADD` | List open requests (worker browse) |
| `/api/v1/staffing/work-requests/:id` | GET | `ADD` | Get single request detail |
| `/api/v1/staffing/work-requests/:id` | PUT | `ADD` | Update / cancel request |
| `/api/v1/staffing/work-requests/:id/applications` | POST | `ADD` | Worker applies |
| `/api/v1/staffing/work-requests/:id/applications` | GET | `ADD` | Manager views applicants |
| `/api/v1/staffing/applications/:id/approve` | POST | `ADD` | Manager approves → creates WorkerAssignment |
| `/api/v1/staffing/applications/:id/reject` | POST | `ADD` | Manager rejects |
| `/api/v1/staffing/applications/:id/withdraw` | POST | `ADD` | Worker withdraws |
| `/api/v1/staffing/assignments/:id/clock-in` | POST | `ADD` | Worker clocks in → creates Attendance |
| `/api/v1/staffing/assignments/:id/clock-out` | POST | `ADD` | Worker clocks out |
| `/api/v1/staffing/assignments/:id/attendance` | GET | `ADD` | Get attendance record |

### Additions — CRM module

| Endpoint | Method | Classification | Description |
|----------|--------|----------------|-------------|
| `/api/v1/crm/hotels/:id/workers` | GET | `ADD` | List enrolled workers |
| `/api/v1/crm/hotels/:id/workers` | POST | `ADD` | Enroll worker at hotel |
| `/api/v1/crm/hotels/:id/workers/:worker_id` | DELETE | `ADD` | Remove enrollment |
| `/api/v1/crm/hotels/:id/managers` | GET | `ADD` | List hotel managers |

### Keeps — no change

| Endpoint | Method | Classification |
|----------|--------|----------------|
| `/api/v1/auth/*` (all 6) | * | `KEEP` |
| `/api/v1/crm/hotels` | GET | `KEEP` |
| `/api/v1/crm/hotels` | POST | `KEEP` |
| `/api/v1/crm/hotels/:id` | GET | `KEEP` |
| `/api/v1/staffing/work-requests` | POST | `KEEP` |
| `/api/v1/staffing/available-workers` | GET | `KEEP` |
| `/api/v1/staffing/assignments/:id/start` | POST | `KEEP` |
| `/api/v1/staffing/assignments/:id/complete` | POST | `KEEP` |
| `/api/v1/quality/leaderboard` | GET | `KEEP` |
| `/api/v1/quality/leaderboard/by-hotel/:id` | GET | `KEEP` |
| `/api/v1/hr/*` (all 5) | * | `KEEP` |
| `/api/v1/notifications/*` (all 2) | * | `KEEP` |
| `/api/v1/status` | GET | `KEEP` |

### Module-level classification

| Module directory | Classification | Action |
|-----------------|----------------|--------|
| `src/modules/auth/` | `KEEP` | No changes |
| `src/modules/crm/` | `MODIFY` | Remove task/room methods; add enrollment methods |
| `src/modules/staffing/` | `MODIFY` | Add application + attendance flows |
| `src/modules/quality/` | `MODIFY` | Swap task_id → assignment_id in service + validation |
| `src/modules/hr/` | `KEEP` | No changes |
| `src/modules/analytics/` | `MODIFY` | Rewrite stat queries |
| `src/modules/notifications/` | `MODIFY` | Rename type constants only |
| `src/modules/calendar/` | `REMOVE` | Delete entire directory |

---

## PART 5 — Mobile Migration Order

Both apps are **bare Expo boilerplates** — no domain logic exists to remove. All work is additive.

### Prerequisite decision (blocks all mobile work)

The mobile apps have `@supabase/supabase-js` installed but the backend is a custom Express JWT API.  
**Decision required:** Use backend JWT auth OR replace with Supabase Auth.  
**Recommendation:** Remove Supabase dependency; use backend JWT + `SecureStore`. Simpler, no vendor lock-in.

### Shared infrastructure (both apps)

| Item | Classification | Description |
|------|----------------|-------------|
| `@supabase/supabase-js` dependency | `REMOVE` | Replace with native fetch/axios |
| API client module (`src/lib/api.ts`) | `ADD` | Base URL config, JWT inject, error handling |
| Auth token store (`src/stores/auth.ts`) | `ADD` | Zustand store + `expo-secure-store` |
| Push notification handler | `ADD` | `expo-notifications` + FCM/APNs token registration |
| Theme system (`ThemedText`, `ThemedView`, etc.) | `KEEP` | Solid boilerplate |
| Navigation layout (`src/app/_layout.tsx`) | `MODIFY` | Add auth guard (redirect unauthenticated to login) |

### Worker App — screen build order

Build in this sequence to unblock each layer:

| Priority | Screen | Classification | API Dependency |
|----------|--------|----------------|----------------|
| 1 | `(auth)/login.tsx` | `ADD` | `POST /auth/login` |
| 2 | `(auth)/register.tsx` | `ADD` | `POST /auth/signup` |
| 3 | `(tabs)/requests/index.tsx` — Browse open WorkRequests | `ADD` | `GET /staffing/work-requests` |
| 4 | `(tabs)/requests/[id].tsx` — Request detail + Apply button | `ADD` | `GET /staffing/work-requests/:id`, `POST .../applications` |
| 5 | `(tabs)/applications/index.tsx` — My applications list | `ADD` | `GET /staffing/work-requests/:id/applications` (own) |
| 6 | `(tabs)/assignments/index.tsx` — My assignments | `ADD` | `GET /staffing/assignments` (own) |
| 7 | `(tabs)/assignments/[id].tsx` — Clock in / clock out | `ADD` | `POST /staffing/assignments/:id/clock-in|out` |
| 8 | `(tabs)/profile/index.tsx` — Ratings, history, rank | `ADD` | `GET /quality/leaderboard`, `GET /auth/me` |

### Checker App — screen build order

| Priority | Screen | Classification | API Dependency |
|----------|--------|----------------|----------------|
| 1 | `(auth)/login.tsx` | `ADD` | `POST /auth/login` |
| 2 | `(tabs)/verify/index.tsx` — Assignments pending verification | `ADD` | `GET /staffing/assignments` (completed, unverified) |
| 3 | `(tabs)/verify/[id].tsx` — Submit QualityVerification | `ADD` | `POST /quality/verifications` |
| 4 | `(tabs)/verify/[id]/rate.tsx` — Submit Rating | `ADD` | `POST /quality/ratings` |
| 5 | `(tabs)/leaderboard/index.tsx` — Worker rankings | `ADD` | `GET /quality/leaderboard` |

---

## PART 6 — Rollback Strategy

### Strategy: Schema versioning via Prisma Migrate

Since the project currently has **no migrations directory** (uses `prisma db push`), the first step of the refactor is to establish a migration baseline before making any changes.

#### Pre-refactor checkpoint

```bash
# 1. Create baseline migration from current schema
cd backend
npx prisma migrate dev --name baseline-pre-marketplace

# 2. Tag the git commit
git tag pre-marketplace-baseline
git push origin pre-marketplace-baseline
```

This creates `prisma/migrations/[timestamp]_baseline-pre-marketplace/migration.sql` — the rollback target.

#### Rollback procedure (if refactor must be aborted)

```bash
# Option A: Schema rollback only (no data loss on dev)
git checkout pre-marketplace-baseline -- backend/prisma/schema.prisma
npx prisma migrate reset   # drops and recreates from baseline

# Option B: Full branch rollback
git reset --hard pre-marketplace-baseline
```

#### Production rollback policy

| Scenario | Action |
|----------|--------|
| Migration fails mid-run | Postgres transaction wraps the migration — auto-rolled back |
| Migration succeeds but app is broken | Run the down-migration SQL (see below); redeploy previous image |
| Data was written to new tables | Manual inspection required before drop |

#### Down-migration SQL (keep this file in repo at `backend/prisma/rollback-marketplace.sql`)

```sql
-- Rollback: restore legacy tables, remove new ones
-- Run in reverse order of the forward migration

-- Remove new FK columns from surviving tables
ALTER TABLE worker_assignments DROP COLUMN IF EXISTS application_id;
ALTER TABLE quality_verifications DROP COLUMN IF EXISTS assignment_id;
ALTER TABLE ratings DROP COLUMN IF EXISTS assignment_id;

-- Drop new marketplace tables
DROP TABLE IF EXISTS attendances;
DROP TABLE IF EXISTS work_applications;
DROP TABLE IF EXISTS hotel_workers;

-- Restore user column
ALTER TABLE users ADD COLUMN IF NOT EXISTS hotel_ids TEXT[] DEFAULT '{}';

-- NOTE: rooms, tasks, task_photos, daily_operations cannot be auto-restored
-- if they were dropped. Restore from DB backup taken before migration.
```

> **Critical:** Take a full PostgreSQL dump before running the forward migration in any non-dev environment.

```bash
pg_dump $DATABASE_URL > backup-pre-marketplace-$(date +%Y%m%d%H%M%S).sql
```

---

## PART 7 — Data Migration Strategy

### Development environment

No production data exists. Strategy: **schema reset**.

```bash
npx prisma migrate reset --force  # drops all tables, re-runs all migrations, seeds
```

### Staging / Production environment

If a staging database has test data:

#### Legacy data that cannot be migrated

| Table | Reason | Action |
|-------|--------|--------|
| `rooms` | No marketplace equivalent | Archive to `_archived_rooms` then drop |
| `tasks` | No marketplace equivalent | Archive to `_archived_tasks` then drop |
| `task_photos` | No marketplace equivalent | Archive URLs; delete S3 objects after 30 days |
| `daily_operations` | No marketplace equivalent | Archive then drop |

#### Archival procedure

```sql
-- Run BEFORE the forward migration
CREATE TABLE _archived_rooms AS SELECT * FROM rooms;
CREATE TABLE _archived_tasks AS SELECT * FROM tasks;
CREATE TABLE _archived_task_photos AS SELECT * FROM task_photos;
CREATE TABLE _archived_daily_operations AS SELECT * FROM daily_operations;
-- Drop archive tables after 30-day observation window
```

#### Surviving data that needs transformation

| Data | Transformation |
|------|---------------|
| `User.hotel_ids[]` | For each `(user_id, hotel_id)` pair: INSERT into `hotel_workers` if user role is `WORKER`, or derive Manager record if role is `MANAGER` |
| `QualityVerification` rows | If linked via `task_id` to a `WorkerAssignment` (via task.work_request), backfill `assignment_id`; rows with no path are archived |
| `Rating` rows | Same backfill logic as QualityVerification |

#### Data migration script (run after schema changes, before app deploy)

```typescript
// backend/prisma/scripts/migrate-marketplace-data.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Migrate User.hotel_ids → hotel_workers
  const users = await prisma.user.findMany({
    where: { hotel_ids: { isEmpty: false } }
  });

  for (const user of users) {
    for (const hotelId of user.hotel_ids) {
      await prisma.hotelWorker.upsert({
        where: { hotel_id_worker_id: { hotel_id: hotelId, worker_id: user.id } },
        update: {},
        create: {
          hotel_id: hotelId,
          worker_id: user.id,
          is_active: user.is_active,
        },
      });
    }
  }

  console.log(`Migrated hotel_ids for ${users.length} users`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

Run as:
```bash
npx tsx backend/prisma/scripts/migrate-marketplace-data.ts
```

---

## PART 8 — Risk Analysis

### HIGH RISK

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `QualityVerification` and `Rating` have `task_id @unique` — dropping this column loses the ability to know which task was verified | Data integrity | Archive tables before drop; verify there are 0 rows with production data before migration |
| `User.hotel_ids` array is the only record of which hotels a manager/worker belongs to | Access control breaks if not migrated first | Run data migration script in Step 7 BEFORE dropping the column |
| `WorkerAssignment` has a partial unique index: `@@unique([worker_id, status], where: { status: { in: ["ASSIGNED","IN_PROGRESS"] } })` — this syntax may not be supported in all Prisma versions | Migration failure | Test on dev first; Prisma 5.12+ supports filtered unique indexes |
| No existing migration history — `prisma db push` leaves no audit trail | Cannot reproduce schema state | Establish baseline migration as first commit on this branch |

### MEDIUM RISK

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Mobile apps use `@supabase/supabase-js` but there is no Supabase project configured | Auth will silently fail if Supabase calls are made | Remove the dependency before writing any auth code |
| `WorkApplication` approval flow is undefined — does approval auto-create `WorkerAssignment`? | API contract ambiguity | Codify in service layer: `approveApplication()` atomically creates `WorkerAssignment` in same transaction |
| Analytics module queries Task counts — removing Task breaks the dashboard | Dashboard shows 0s or errors | Rewrite analytics queries in same PR as schema migration |
| `DailyOperation` is referenced from `WorkerAssignment.daily_operations` relation — if missed, schema migration fails | Build failure | Checklist: grep for `DailyOperation` and `Room` references before running migration |

### LOW RISK

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Calendar module routes left in router after module deletion | 404 responses | Delete route registration in `src/routes/v1/index.ts` same PR |
| `TaskStatus` enum orphaned in schema after Task removal | Prisma warning | Delete enum definition with the Task model |
| Notification type constants reference `"TASK_ASSIGNED"` | Misleading but functional | Rename constants to `"WORK_REQUEST_PUBLISHED"`, `"APPLICATION_APPROVED"` in same PR |

---

## EXECUTION CHECKLIST

### Phase 0 — Baseline (Day 0, 1 hour)
- [ ] Run `npx prisma migrate dev --name baseline-pre-marketplace`
- [ ] Commit and tag `pre-marketplace-baseline`
- [ ] Take DB dump if any non-trivial data exists

### Phase 1 — Schema (Day 1, 4 hours)
- [ ] Edit `schema.prisma`: remove Room, Task, TaskPhoto, DailyOperation, TaskStatus
- [ ] Edit `schema.prisma`: add HotelWorker, WorkApplication, Attendance
- [ ] Edit `schema.prisma`: modify QualityVerification, Rating (swap FK)
- [ ] Edit `schema.prisma`: modify WorkerAssignment (add application_id)
- [ ] Edit `schema.prisma`: modify User (remove hotel_ids, remove legacy relations)
- [ ] Edit `schema.prisma`: modify Hotel (remove rooms, tasks, daily_operations relations)
- [ ] Run `npx prisma migrate dev --name marketplace-refactor`
- [ ] Verify `prisma studio` shows correct tables
- [ ] Run data migration script (hotel_ids backfill)

### Phase 2 — Backend Removals (Day 1-2, 2 hours)
- [ ] Delete `src/modules/calendar/` (entire directory)
- [ ] Remove calendar route from `src/routes/v1/index.ts`
- [ ] Remove `createRoom`, `createTask`, `uploadTaskPhoto` from `src/modules/crm/`
- [ ] Remove task/room routes from `src/modules/crm/routes.ts`
- [ ] Delete `TaskStatus` enum references from `src/modules/crm/types.ts`
- [ ] Run `npx tsc --noEmit` — must pass with 0 errors

### Phase 3 — Backend Additions (Days 2-5, 4-5 days)
- [ ] Implement `StaffingService`: work request CRUD, application flow, attendance
- [ ] Implement `CrmService`: hotel worker enrollment
- [ ] Implement `QualityService`: verification + rating against assignment_id
- [ ] Implement `AnalyticsService`: rewrite queries for marketplace entities
- [ ] Update notification type constants
- [ ] Run `npx tsc --noEmit` — must pass

### Phase 4 — Mobile (Days 5-10, 5-6 days)
- [ ] Remove `@supabase/supabase-js` from both apps
- [ ] Add `src/lib/api.ts` to both apps
- [ ] Add auth store + SecureStore token handling
- [ ] Build Worker App screens (priority order from Part 5)
- [ ] Build Checker App screens (priority order from Part 5)
- [ ] Test on iOS simulator and Android emulator

### Phase 5 — QA (Days 10-12, 2 days)
- [ ] End-to-end: Worker applies → Manager approves → Worker clocks in → Checker verifies
- [ ] Leaderboard reflects new Rating.assignment_id data
- [ ] Analytics dashboard shows correct counts
- [ ] Rollback drill: verify `rollback-marketplace.sql` executes cleanly on a copy

---

## DECISION LOG

Decisions that must be made before development begins:

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| D1 | Auth layer for mobile | (A) Backend JWT · (B) Supabase Auth | **A** — keeps auth in one place |
| D2 | WorkApplication approval | (A) Manual approve creates assignment · (B) Auto-assign on open requests | **A** — marketplace model requires explicit approval |
| D3 | HOTEL_WORKER role | (A) New `HOTEL_WORKER` UserRole enum value · (B) Keep `WORKER` + use HotelWorker join table | **B** — role = capability, enrollment = relationship |
| D4 | Attendance GPS | (A) Required, validated server-side · (B) Optional, client-provided | **B** for MVP — make optional, add validation later |
| D5 | QualityVerification scope | (A) One verification per assignment · (B) Multiple allowed | **A** — matches current `@unique` constraint pattern |
