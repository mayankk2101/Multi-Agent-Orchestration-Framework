# PRISMA_IMPLEMENTATION_CHECKLIST

**Status:** `READY_FOR_IMPLEMENTATION`  
**Schema reference:** `docs/PRISMA_SCHEMA_V2_FREEZE.md`  
**Migration file:** `backend/prisma/migrations/V2_marketplace_migration_plan.sql`

This document is the execution runbook for deploying Schema V2 to production.  
The frozen schema is treated as immutable. No schema changes are made here.

---

## Document structure

| Section | Purpose |
|---|---|
| [1. Pre-flight checks](#1-pre-flight-checks) | Verify environment before touching production |
| [2. Migration execution order](#2-migration-execution-order) | Steps 1–18 with per-step verification |
| [3. Backfill execution order](#3-backfill-execution-order) | Post-migration data population and NOT NULL promotions |
| [4. Production cutover checklist](#4-production-cutover-checklist) | Traffic switch, sequencing, go/no-go gates |
| [5. Rollback procedure](#5-rollback-procedure) | Decision tree and reversal SQL |
| [6. Validation queries](#6-validation-queries) | Structural checks: enums, indexes, triggers, constraints |
| [7. Data integrity checks](#7-data-integrity-checks) | Row-level checks: orphans, nulls, range violations, cascades |
| [8. Post-migration smoke tests](#8-post-migration-smoke-tests) | End-to-end flow verification |

---

## Conventions

```
[ ] — checkbox; mark complete before proceeding
⛔ — hard stop; do not proceed past this point until resolved
⚠️  — warning; investigate before continuing
✅ — expected passing output
```

All SQL in this document runs as the application DB user unless otherwise noted.  
Replace `$VAR` placeholders with environment-specific values before executing.

---

## 1. Pre-flight Checks

Complete every check before opening a maintenance window.

### 1.1 PostgreSQL version

```sql
SELECT version();
```

✅ Expected: PostgreSQL 15.x or higher  
⛔ If below 15: upgrade before proceeding — migration uses `gen_random_uuid()` built-in and partial index enum casts that require PG 15+.

### 1.2 Disk space

```sql
SELECT pg_size_pretty(pg_database_size(current_database())) AS current_db_size;
```

⚠️ Ensure at least **3× current database size** of free disk space is available.  
The migration rewrites enum columns and adds multiple indexes. A 1 GB database should have at least 3 GB free.

### 1.3 Active connections

```sql
SELECT count(*) AS active_connections
FROM pg_stat_activity
WHERE state = 'active'
  AND datname = current_database();
```

⚠️ If active connections > 5 outside the migration session: investigate before proceeding.  
⛔ Do not run the migration while application servers are writing to the database.

### 1.4 Long-running transactions

```sql
SELECT pid, now() - xact_start AS duration, query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
  AND datname = current_database()
ORDER BY duration DESC;
```

⛔ If any transaction has been running longer than 5 minutes: wait for it to complete or terminate it (`SELECT pg_terminate_backend(pid)`) before proceeding. The migration acquires ACCESS EXCLUSIVE locks; long transactions will cause it to queue indefinitely.

### 1.5 Existing V1 tables confirmed

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('User','Hotel','WorkRequest','WorkerAssignment',
                     'QualityVerification','Rating','WorkerOverallRating',
                     'Notification','AuditLog','Session')
ORDER BY table_name;
```

✅ Expected: all 10 rows returned  
⛔ If any V1 table is missing: the database is not in expected V1 state. Stop.

### 1.6 V1-only tables confirmed (will be dropped post-cutover)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('Room','Task','TaskPhoto','DailyOperation')
ORDER BY table_name;
```

✅ Note current count. These will be dropped in backfill step 11 after V2 cutover.

### 1.7 Full database backup

```bash
pg_dump \
  --format=custom \
  --file="hotel_crm_v1_backup_$(date +%Y%m%d_%H%M%S).dump" \
  $DATABASE_URL
```

⛔ Confirm backup file exists and is non-zero before proceeding:
```bash
ls -lh hotel_crm_v1_backup_*.dump
```

- [ ] Backup file exists
- [ ] Backup file size > 0
- [ ] Backup file copied to secondary storage (S3, external volume)

### 1.8 Prisma client compatibility

```bash
cd backend && ./node_modules/.bin/prisma validate
```

✅ Expected: `The schema at backend/prisma/schema.prisma is valid 🚀`

### 1.9 Migration file checksum

```bash
sha256sum backend/prisma/migrations/V2_marketplace_migration_plan.sql
```

Record the checksum. Verify it matches the value committed to version control:
```bash
git show HEAD:backend/prisma/migrations/V2_marketplace_migration_plan.sql | sha256sum
```

✅ Both checksums must match. If not: the migration file has been modified outside of version control.

### 1.10 Maintenance window confirmed

- [ ] Application servers taken offline or set to read-only mode
- [ ] Cron jobs and background workers paused
- [ ] On-call engineer present
- [ ] Rollback decision time agreed (recommended: 30 minutes from migration start)

---

## 2. Migration Execution Order

The migration is a single `BEGIN / COMMIT` transaction. If any step fails, Postgres rolls back the entire transaction automatically. No partial state can be committed.

### Execute the migration

```bash
psql $DATABASE_URL \
  --file=backend/prisma/migrations/V2_marketplace_migration_plan.sql \
  --echo-all \
  2>&1 | tee migration_$(date +%Y%m%d_%H%M%S).log
```

Monitor the log for `ERROR`. A successful run ends with:
```
COMMIT
```

⛔ If the log contains `ERROR` before `COMMIT`: the transaction was rolled back. The database is in its original V1 state. Diagnose from the log and retry. Do not proceed to backfill.

### Per-step verification queries

Run these after the migration commits, before proceeding to backfill.

#### Step 1 — ENUMs created

```sql
SELECT typname, array_agg(enumlabel ORDER BY enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE typname IN (
  'UserRole','HotelWorkerStatus','WorkRequestStatus','ApplicationStatus',
  'AssignmentStatus','AttendanceStatus','VerificationStatus',
  'NotificationChannel','NotificationType'
)
GROUP BY typname
ORDER BY typname;
```

✅ Expected: 9 rows, each with the correct value set from the freeze document.

```sql
-- Spot-check three critical enums
SELECT typname, enumlabel
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE typname = 'HotelWorkerStatus'
ORDER BY enumsortorder;
```

✅ Expected rows in order: `INVITED`, `ACTIVE`, `SUSPENDED`, `REMOVED`

#### Step 2 — User columns added

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'User'
  AND column_name  IN ('email_verified_at','phone_verified_at','last_login_at')
ORDER BY column_name;
```

✅ Expected: 3 rows, all `timestamp with time zone`

```sql
-- hotel_ids column must be gone
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'hotel_ids';
```

✅ Expected: 0 rows

#### Step 4 — HotelWorker table created

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'HotelWorker'
ORDER BY ordinal_position;
```

✅ Expected: `invited_at` NOT NULL with default, `joined_at` nullable, `status` with default `INVITED`.

#### Step 5 — WorkRequest status column is enum, version column exists

```sql
SELECT column_name, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'WorkRequest'
  AND column_name  IN ('status','version','workers_confirmed')
ORDER BY column_name;
```

✅ Expected: `status` udt_name = `WorkRequestStatus`; `version` integer NOT NULL; `workers_confirmed` integer NOT NULL.

#### Step 6 — WorkApplication table created

```sql
SELECT COUNT(*) AS constraint_count
FROM information_schema.table_constraints
WHERE table_schema  = 'public'
  AND table_name    = 'WorkApplication'
  AND constraint_type IN ('PRIMARY KEY','UNIQUE','FOREIGN KEY');
```

✅ Expected: ≥ 3 constraints (PK + 2 FKs + 1 UNIQUE)

#### Step 7 — WorkerAssignment: enum column, partial index, application_id FK

```sql
-- Status is enum type
SELECT udt_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'WorkerAssignment' AND column_name = 'status';
```

✅ Expected: `AssignmentStatus`

```sql
-- Partial unique index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'WorkerAssignment'
  AND indexname = 'WorkerAssignment_worker_active_per_request_uidx';
```

✅ Expected: 1 row; `indexdef` contains `WHERE` clause with `CONFIRMED` and `IN_PROGRESS`

```sql
-- Full unique constraint does NOT exist (was intentionally removed)
SELECT conname FROM pg_constraint
WHERE conrelid = '"WorkerAssignment"'::regclass
  AND conname  = 'WorkerAssignment_work_request_id_worker_id_key';
```

✅ Expected: 0 rows

```sql
-- application_id FK to WorkApplication exists
SELECT conname, confdeltype
FROM pg_constraint
WHERE conrelid  = '"WorkerAssignment"'::regclass
  AND conname LIKE '%application_id%';
```

✅ Expected: 1 row; `confdeltype` = `r` (RESTRICT)

#### Step 8 — Attendance table with all CHECK constraints

```sql
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = '"Attendance"'::regclass
ORDER BY conname;
```

✅ Expected: constraints including `Attendance_checkout_after_checkin`, `Attendance_minutes_late_positive`, `Attendance_minutes_worked_positive`, `Attendance_verification_pair`

```sql
-- is_verified column exists with default false
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Attendance' AND column_name = 'is_verified';
```

✅ Expected: `column_default` = `false`, `is_nullable` = `NO`

#### Step 9 — QualityVerification status is enum

```sql
SELECT udt_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'QualityVerification'
  AND column_name  = 'status';
```

✅ Expected: `VerificationStatus`

```sql
-- Old TEXT status_v1 column is gone
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'QualityVerification'
  AND column_name  = 'status_v1';
```

✅ Expected: 0 rows

```sql
-- Score range constraint exists
SELECT conname FROM pg_constraint
WHERE conrelid = '"QualityVerification"'::regclass
  AND conname  = 'QualityVerification_score_range';
```

✅ Expected: 1 row

#### Step 12 — Notification type is enum

```sql
SELECT udt_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'Notification'
  AND column_name  = 'type';
```

✅ Expected: `NotificationType`

```sql
-- No unmapped NULL type values remain
SELECT COUNT(*) AS null_type_count FROM "Notification" WHERE type IS NULL;
```

✅ Expected: 0

#### Steps 15–18 — All triggers created

```sql
SELECT tgname, tgrelid::regclass AS table_name, tgenabled
FROM pg_trigger
WHERE tgname IN (
  'trg_user_updated_at',
  'trg_hotel_updated_at',
  'trg_hotelworker_updated_at',
  'trg_workrequest_updated_at',
  'trg_workapplication_updated_at',
  'trg_workerassignment_updated_at',
  'trg_attendance_updated_at',
  'trg_qualityverification_updated_at',
  'trg_rating_updated_at',
  'trg_workeroverallrating_updated_at',
  'trg_rating_refresh_overall',
  'trg_assignment_sync_confirmed',
  'trg_assignment_check_slot'
)
ORDER BY tgname;
```

✅ Expected: 13 rows, all `tgenabled = 'O'` (enabled)

---

## 3. Backfill Execution Order

Run these steps **outside the migration transaction**, one at a time, in sequence.  
Each step has a verification query that must pass before proceeding to the next.

Create the backfill script file for tracking:
```bash
touch backend/prisma/migrations/V2_post_backfill.sql
```

### Step B-1 — Create synthetic WorkApplication rows for historic assignments

Historic `WorkerAssignment` rows have no matching `WorkApplication` (the V2 marketplace flow did not exist). Create a synthetic `ACCEPTED` application for each to satisfy the non-nullable FK that will be enforced in B-3.

```sql
-- Dry run first: count assignments that need a synthetic application
SELECT COUNT(*)
FROM "WorkerAssignment" wa
WHERE wa.application_id IS NULL;
```

⚠️ If 0: no historic data to backfill. Skip to B-3 stub below.

```sql
-- Insert synthetic applications for each historic assignment
-- Uses the assignment's work_request_id and worker_id
INSERT INTO "WorkApplication" (
  id,
  work_request_id,
  worker_id,
  reviewed_by_id,
  status,
  cover_note,
  applied_at,
  updated_at
)
SELECT
  gen_random_uuid()::TEXT,
  wa.work_request_id,
  wa.worker_id,
  wa.assigned_by_id,                    -- manager who created the assignment is the reviewer
  'ACCEPTED'::"ApplicationStatus",
  'Synthetic application created during V2 migration backfill.',
  wa.confirmed_at,                       -- backdate to assignment confirmation time
  NOW()
FROM "WorkerAssignment" wa
WHERE wa.application_id IS NULL
ON CONFLICT ("work_request_id","worker_id") DO NOTHING;  -- idempotent
```

**Verify B-1:**
```sql
SELECT COUNT(*) AS synthetic_apps_created
FROM "WorkApplication"
WHERE cover_note = 'Synthetic application created during V2 migration backfill.';
```

✅ Expected: count matches the dry-run count above (or close — ON CONFLICT may skip some)

### Step B-2 — Link WorkerAssignment rows to their synthetic applications

```sql
UPDATE "WorkerAssignment" wa
SET application_id = app.id
FROM "WorkApplication" app
WHERE app.work_request_id = wa.work_request_id
  AND app.worker_id       = wa.worker_id
  AND app.status          = 'ACCEPTED'::"ApplicationStatus"
  AND wa.application_id   IS NULL;
```

**Verify B-2:**
```sql
-- Zero NULL application_ids must remain
SELECT COUNT(*) AS null_application_ids
FROM "WorkerAssignment"
WHERE application_id IS NULL;
```

✅ Expected: 0  
⛔ If > 0: do not proceed to B-3. Investigate which assignments could not be matched (worker or request may have been deleted).

### Step B-3 — Promote WorkerAssignment.application_id to NOT NULL

```sql
ALTER TABLE "WorkerAssignment"
  ALTER COLUMN "application_id" SET NOT NULL;
```

**Verify B-3:**
```sql
SELECT is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'WorkerAssignment'
  AND column_name  = 'application_id';
```

✅ Expected: `is_nullable = NO`

### Step B-4 — Map QualityVerification rows to assignments

V1 QualityVerification rows reference `task_id`. Map each to its corresponding `WorkerAssignment` via the Task → WorkerAssignment relationship.

```sql
-- Dry run: count QV rows still needing assignment_id
SELECT COUNT(*) AS qv_needing_backfill
FROM "QualityVerification"
WHERE assignment_id IS NULL;
```

```sql
-- Map via the task's assigned_to_worker_id and hotel_id to find the assignment
-- Adjust the JOIN path to match your actual V1 data shape
UPDATE "QualityVerification" qv
SET assignment_id = wa.id
FROM "WorkerAssignment" wa
JOIN "WorkRequest" wr ON wr.id = wa.work_request_id
WHERE qv.assignment_id IS NULL
  AND qv.hotel_id       = wr.hotel_id
  AND qv.verified_by_id IS NOT NULL;
  -- NOTE: Refine this JOIN for your actual task→assignment mapping.
  -- If a direct task_id→assignment_id map was captured during V1 operation,
  -- use that map here instead.
```

⚠️ If the Task table has not yet been dropped, join via:
```sql
-- Alternative: join through Task if it still exists
UPDATE "QualityVerification" qv
SET assignment_id = wa.id
FROM "Task" t
JOIN "WorkerAssignment" wa ON wa.work_request_id IN (
  SELECT id FROM "WorkRequest"
  WHERE hotel_id = t.hotel_id
  AND shift_date = t.created_at::date
)
WHERE qv.task_id = t.id
  AND qv.assignment_id IS NULL;
```

**Verify B-4:**
```sql
SELECT COUNT(*) AS qv_null_assignment FROM "QualityVerification" WHERE assignment_id IS NULL;
```

✅ Expected: 0 (or document acceptable orphan count if some V1 tasks had no assignment equivalent)

### Step B-5 — Promote QualityVerification.assignment_id to NOT NULL

```sql
ALTER TABLE "QualityVerification"
  ALTER COLUMN "assignment_id" SET NOT NULL;
```

**Verify B-5:**
```sql
SELECT is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'QualityVerification' AND column_name = 'assignment_id';
```

✅ Expected: `NO`

### Step B-6 — Drop QualityVerification.task_id (V1 column)

```sql
ALTER TABLE "QualityVerification" DROP COLUMN IF EXISTS "task_id";
```

**Verify B-6:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'QualityVerification' AND column_name = 'task_id';
```

✅ Expected: 0 rows

### Step B-7 — Map Rating rows to assignments

```sql
-- Dry run
SELECT COUNT(*) AS ratings_needing_backfill FROM "Rating" WHERE assignment_id IS NULL;
```

```sql
UPDATE "Rating" r
SET assignment_id = wa.id
FROM "WorkerAssignment" wa
WHERE r.worker_id     = wa.worker_id
  AND r.hotel_id      = wa.hotel_id
  AND r.assignment_id IS NULL;
  -- Refine if worker/hotel combination is not unique per time window.
```

**Verify B-7:**
```sql
SELECT COUNT(*) AS rating_null_assignment FROM "Rating" WHERE assignment_id IS NULL;
```

✅ Expected: 0

### Step B-8 — Promote Rating.assignment_id to NOT NULL

```sql
ALTER TABLE "Rating" ALTER COLUMN "assignment_id" SET NOT NULL;
```

**Verify B-8:**
```sql
SELECT is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Rating' AND column_name = 'assignment_id';
```

✅ Expected: `NO`

### Step B-9 — Drop Rating.task_id (V1 column)

```sql
ALTER TABLE "Rating" DROP COLUMN IF EXISTS "task_id";
```

**Verify B-9:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Rating' AND column_name = 'task_id';
```

✅ Expected: 0 rows

### Step B-10 — Back-fill WorkerOverallRating aggregates

```sql
INSERT INTO "WorkerOverallRating" (
  id, worker_id, average_score, total_ratings,
  total_assignments, completion_rate, on_time_rate, last_worked_at, updated_at
)
SELECT
  gen_random_uuid()::TEXT,
  r.worker_id,
  COALESCE(AVG(r.score), 0)                                         AS average_score,
  COUNT(r.id)                                                        AS total_ratings,
  COUNT(DISTINCT wa.id)                                              AS total_assignments,
  ROUND(
    COUNT(DISTINCT wa.id) FILTER (WHERE wa.status = 'COMPLETED'::"AssignmentStatus")::NUMERIC
    / NULLIF(COUNT(DISTINCT wa.id), 0) * 100, 2
  )                                                                  AS completion_rate,
  ROUND(
    COUNT(a.id) FILTER (WHERE a.status != 'LATE'::"AttendanceStatus"
                          AND a.status != 'ABSENT'::"AttendanceStatus")::NUMERIC
    / NULLIF(COUNT(a.id), 0) * 100, 2
  )                                                                  AS on_time_rate,
  MAX(wa.completed_at)                                               AS last_worked_at,
  NOW()                                                              AS updated_at
FROM "Rating" r
JOIN "WorkerAssignment" wa ON wa.worker_id = r.worker_id
LEFT JOIN "Attendance" a   ON a.assignment_id = wa.id
GROUP BY r.worker_id
ON CONFLICT ("worker_id") DO UPDATE SET
  average_score     = EXCLUDED.average_score,
  total_ratings     = EXCLUDED.total_ratings,
  total_assignments = EXCLUDED.total_assignments,
  completion_rate   = EXCLUDED.completion_rate,
  on_time_rate      = EXCLUDED.on_time_rate,
  last_worked_at    = EXCLUDED.last_worked_at,
  updated_at        = NOW();
```

**Verify B-10:**
```sql
-- Every worker with ratings has an aggregate row
SELECT COUNT(*) AS workers_with_ratings_no_aggregate
FROM (SELECT DISTINCT worker_id FROM "Rating") r
LEFT JOIN "WorkerOverallRating" wor ON wor.worker_id = r.worker_id
WHERE wor.worker_id IS NULL;
```

✅ Expected: 0

```sql
-- Sanity check: no impossible values
SELECT COUNT(*) AS invalid_scores
FROM "WorkerOverallRating"
WHERE average_score < 1 OR average_score > 5
   OR completion_rate < 0 OR completion_rate > 100
   OR on_time_rate < 0 OR on_time_rate > 100;
```

✅ Expected: 0

### Step B-11 — Populate Attendance rows from historic assignments

```sql
-- Create EXPECTED Attendance rows for all assignments that have no attendance record
INSERT INTO "Attendance" (
  id, assignment_id, worker_id, hotel_id, status,
  expected_start, expected_end, is_verified, created_at, updated_at
)
SELECT
  gen_random_uuid()::TEXT,
  wa.id,
  wa.worker_id,
  wa.hotel_id,
  CASE wa.status
    WHEN 'COMPLETED'::"AssignmentStatus"   THEN 'PRESENT'::"AttendanceStatus"
    WHEN 'NO_SHOW'::"AssignmentStatus"     THEN 'ABSENT'::"AttendanceStatus"
    WHEN 'CANCELLED'::"AssignmentStatus"   THEN 'ABSENT'::"AttendanceStatus"
    ELSE 'EXPECTED'::"AttendanceStatus"
  END,
  (wr.shift_date + wr.shift_start_time::TIME)::TIMESTAMPTZ,
  (wr.shift_date + wr.shift_end_time::TIME)::TIMESTAMPTZ,
  FALSE,
  wa.confirmed_at,
  NOW()
FROM "WorkerAssignment" wa
JOIN "WorkRequest" wr ON wr.id = wa.work_request_id
WHERE NOT EXISTS (
  SELECT 1 FROM "Attendance" a WHERE a.assignment_id = wa.id
);
```

**Verify B-11:**
```sql
-- Every assignment has exactly one attendance record
SELECT COUNT(*) AS assignments_without_attendance
FROM "WorkerAssignment" wa
LEFT JOIN "Attendance" a ON a.assignment_id = wa.id
WHERE a.id IS NULL;
```

✅ Expected: 0

### Step B-12 — ANALYZE all modified tables

```sql
ANALYZE "User";
ANALYZE "Hotel";
ANALYZE "HotelWorker";
ANALYZE "WorkRequest";
ANALYZE "WorkApplication";
ANALYZE "WorkerAssignment";
ANALYZE "Attendance";
ANALYZE "QualityVerification";
ANALYZE "Rating";
ANALYZE "WorkerOverallRating";
ANALYZE "Notification";
ANALYZE "AuditLog";
```

### Step B-13 — Drop V1 tables (final gate — after V2 code is live and stable)

⛔ **Do not run until:** V2 application code is deployed, smoke tests pass, and V1 code paths are fully removed. This step is irreversible without a backup restore.

```sql
-- Must run in FK dependency order
DROP TABLE IF EXISTS "DailyOperation";
DROP TABLE IF EXISTS "TaskPhoto";
DROP TABLE IF EXISTS "Task";
DROP TABLE IF EXISTS "Room";
```

**Verify B-13:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('Room','Task','TaskPhoto','DailyOperation');
```

✅ Expected: 0 rows

---

## 4. Production Cutover Checklist

### Phase 1 — Pre-cutover (T-60 minutes)

- [ ] Pre-flight checks (Section 1) all passed
- [ ] Database backup confirmed in secondary storage
- [ ] Staging environment migration completed successfully
- [ ] Staging smoke tests (Section 8) passed on staging
- [ ] All application servers identified and listed
- [ ] Rollback decision time set: `T + 30 minutes` from migration start
- [ ] On-call engineer confirmed available for 4 hours post-cutover

### Phase 2 — Migration window (T-0)

- [ ] Alert stakeholders: maintenance window open
- [ ] Application servers set to maintenance mode (return 503 to API clients)
- [ ] Verify zero active write connections (Section 1.3)
- [ ] Verify zero long-running transactions (Section 1.4)
- [ ] Execute migration (Section 2)
- [ ] Review migration log for any `WARNING` messages
- [ ] Run per-step verification queries (Section 2)
- [ ] All 13 verification queries pass

### Phase 3 — Backfill window (T+15 minutes)

- [ ] Execute B-1 through B-12 in sequence
- [ ] Each backfill step verified before proceeding to next
- [ ] Zero NULL violations on promoted NOT NULL columns (B-3, B-5, B-8)
- [ ] WorkerOverallRating aggregates verified (B-10)
- [ ] All Attendance rows created (B-11)
- [ ] ANALYZE complete (B-12)

### Phase 4 — Code deployment

- [ ] V2 application build deployed to staging
- [ ] V2 staging connected to production database replica (read-only verify)
- [ ] V2 application deployed to production app servers
- [ ] Health check endpoints returning 200

### Phase 5 — Traffic cutover

- [ ] Remove maintenance mode from one app server (canary)
- [ ] Monitor error rate for 5 minutes
- [ ] If error rate < 0.1%: remove maintenance mode from all servers
- [ ] If error rate ≥ 0.1%: execute rollback procedure (Section 5)

### Phase 6 — Post-cutover stabilisation (T+60 minutes)

- [ ] Run full validation queries (Section 6)
- [ ] Run full data integrity checks (Section 7)
- [ ] Run post-migration smoke tests (Section 8)
- [ ] Monitor application error logs for 1 hour
- [ ] Confirm DB trigger performance (no query time regressions > 2×)

### Phase 7 — V1 table drop (T+72 hours minimum)

⚠️ Only after: V2 is stable in production, V1 code paths confirmed removed, no rollbacks occurred.

- [ ] Confirm V1 tables have had zero writes in preceding 48 hours:

```sql
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('Room','Task','TaskPhoto','DailyOperation');
```

✅ Expected: `n_tup_ins`, `n_tup_upd`, `n_tup_del` all zero since cutover timestamp

- [ ] Execute B-13 (V1 table drop)
- [ ] Maintenance window closed

---

## 5. Rollback Procedure

### Decision tree

```
Migration fails (error before COMMIT)
  └── Postgres auto-rolled back entire transaction
  └── Database is in original V1 state
  └── ACTION: Diagnose log, fix, retry migration

Migration commits, backfill fails at step B-N
  └── ACTION: Fix the failing backfill step and re-run from B-N
  └── All backfill steps are idempotent (ON CONFLICT / IF NOT EXISTS)
  └── B-1 through B-12 can be re-run safely

Migration commits, V2 app fails in production
  └── Error rate exceeds threshold during canary
  └── ACTION: Immediate rollback (below)

Migration commits, V2 stable, V1 tables dropped (B-13)
  └── Rollback requires full backup restore
  └── ACTION: restore from pre-migration backup
```

### Immediate rollback (before B-13)

If V1 tables are still present, rollback is reversible without restoring from backup.

#### Step R-1 — Switch traffic back to V1 application

- [ ] Redeploy V1 application build to all servers
- [ ] Remove maintenance mode
- [ ] Verify V1 health check endpoints returning 200

V1 code can still read from the V1 tables (`Room`, `Task`, etc.) because they have not been dropped. The V2 columns added to V1 tables are additive and do not break V1 reads.

#### Step R-2 — Verify V1 data is intact

```sql
-- V1 tables still accessible
SELECT COUNT(*) FROM "Room";
SELECT COUNT(*) FROM "Task";
SELECT COUNT(*) FROM "DailyOperation";
```

✅ Expected: counts match pre-migration values recorded in pre-flight check.

#### Step R-3 — Record rollback for post-mortem

- [ ] Capture migration log
- [ ] Capture application error logs from canary window
- [ ] Document which smoke test or validation failed
- [ ] Schedule post-mortem within 24 hours

#### Notes on V2 schema additions

The migration is **additive** with respect to V1 tables. It does not drop V1 columns or tables (only adds new ones). V1 application code running against the migrated database will:
- Continue to read V1 columns without error
- Ignore the new V2 columns
- Continue to write to V1 tables normally

The only irreversible actions before B-13 are:
- Enum type creation (harmless; types can coexist)
- New table creation (HotelWorker, WorkApplication, Attendance — V1 code ignores these)
- Column renames on V1 tables (`status` → enum type on WorkRequest and WorkerAssignment)

#### Step R-4 — Reverse column renames if V1 code breaks on enum columns

If V1 application code breaks on the renamed `status` columns (now enum types instead of TEXT):

```sql
-- Revert WorkRequest.status to TEXT (only if strictly necessary)
ALTER TABLE "WorkRequest"   ADD COLUMN "status_text" TEXT;
UPDATE "WorkRequest"        SET "status_text" = "status"::TEXT;

ALTER TABLE "WorkerAssignment" ADD COLUMN "status_text" TEXT;
UPDATE "WorkerAssignment"      SET "status_text" = "status"::TEXT;
```

⚠️ This is a last resort. Enum→TEXT implicit cast works in most ORM queries. Test V1 code against migrated DB on staging before assuming this step is needed.

### Full restore (after B-13 or if immediate rollback fails)

```bash
# Drop and recreate the database, then restore from backup
dropdb $DB_NAME
createdb $DB_NAME

pg_restore \
  --format=custom \
  --dbname=$DATABASE_URL \
  hotel_crm_v1_backup_YYYYMMDD_HHMMSS.dump
```

⛔ This destroys all data written since the backup was taken. Coordinate with data team to assess data loss window before executing.

---

## 6. Validation Queries

Run after migration commits and after each backfill phase. All queries should return the expected result before production traffic is enabled.

### 6.1 All expected tables exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'User','Session','Hotel','HotelWorker',
    'WorkRequest','WorkApplication','WorkerAssignment',
    'Attendance','QualityVerification','Rating',
    'WorkerOverallRating','Notification','AuditLog'
  )
ORDER BY table_name;
```

✅ Expected: 13 rows

### 6.2 All enum types have correct value counts

```sql
SELECT typname, COUNT(*) AS value_count
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE typname IN (
  'UserRole','HotelWorkerStatus','WorkRequestStatus','ApplicationStatus',
  'AssignmentStatus','AttendanceStatus','VerificationStatus',
  'NotificationChannel','NotificationType'
)
GROUP BY typname
ORDER BY typname;
```

✅ Expected counts:

| typname | value_count |
|---|---|
| ApplicationStatus | 5 |
| AssignmentStatus | 6 |
| AttendanceStatus | 6 |
| HotelWorkerStatus | 4 |
| NotificationChannel | 4 |
| NotificationType | 16 |
| UserRole | 4 |
| VerificationStatus | 3 |
| WorkRequestStatus | 6 |

### 6.3 All CHECK constraints exist

```sql
SELECT conrelid::regclass AS table_name, conname
FROM pg_constraint
WHERE contype = 'c'
  AND conname IN (
    'WorkRequest_confirmed_lte_needed',
    'Attendance_checkout_after_checkin',
    'Attendance_minutes_worked_positive',
    'Attendance_minutes_late_positive',
    'Attendance_verification_pair',
    'QualityVerification_score_range',
    'Rating_score_range'
  )
ORDER BY table_name, conname;
```

✅ Expected: 7 rows

### 6.4 Partial unique index on WorkerAssignment

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'WorkerAssignment'
  AND indexname = 'WorkerAssignment_worker_active_per_request_uidx';
```

✅ Expected: 1 row with `WHERE` clause containing both enum casts

### 6.5 All 13 triggers are enabled

```sql
SELECT tgname, tgrelid::regclass AS on_table, tgenabled
FROM pg_trigger
WHERE tgname IN (
  'trg_user_updated_at',
  'trg_hotel_updated_at',
  'trg_hotelworker_updated_at',
  'trg_workrequest_updated_at',
  'trg_workapplication_updated_at',
  'trg_workerassignment_updated_at',
  'trg_attendance_updated_at',
  'trg_qualityverification_updated_at',
  'trg_rating_updated_at',
  'trg_workeroverallrating_updated_at',
  'trg_rating_refresh_overall',
  'trg_assignment_sync_confirmed',
  'trg_assignment_check_slot'
)
ORDER BY tgname;
```

✅ Expected: 13 rows, all `tgenabled = 'O'`

### 6.6 All FK relationships exist

```sql
SELECT
  conrelid::regclass  AS from_table,
  conname,
  confrelid::regclass AS to_table,
  CASE confdeltype
    WHEN 'a' THEN 'NoAction'
    WHEN 'r' THEN 'Restrict'
    WHEN 'c' THEN 'Cascade'
    WHEN 'n' THEN 'SetNull'
    WHEN 'd' THEN 'SetDefault'
  END AS on_delete
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid::regclass::text IN (
    '"HotelWorker"','"WorkRequest"','"WorkApplication"',
    '"WorkerAssignment"','"Attendance"','"QualityVerification"',
    '"Rating"','"WorkerOverallRating"','"Notification"','"AuditLog"'
  )
ORDER BY from_table, conname;
```

Cross-reference each row's `on_delete` against Section 3 of the freeze document.

### 6.7 Critical NOT NULL columns are not nullable (post-backfill)

```sql
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('WorkerAssignment',    'application_id'),
    ('QualityVerification', 'assignment_id'),
    ('Rating',              'assignment_id'),
    ('Attendance',          'assignment_id'),
    ('WorkerAssignment',    'hotel_id'),
    ('HotelWorker',         'invited_at'),
    ('WorkRequest',         'version')
  )
ORDER BY table_name, column_name;
```

✅ Expected: all rows show `is_nullable = NO`

### 6.8 WorkerAssignment.application_id has no duplicates

```sql
SELECT application_id, COUNT(*) AS occurrences
FROM "WorkerAssignment"
WHERE application_id IS NOT NULL
GROUP BY application_id
HAVING COUNT(*) > 1;
```

✅ Expected: 0 rows

### 6.9 Key indexes exist on hot-path tables

```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('WorkRequest','WorkApplication','WorkerAssignment','Attendance','Notification')
  AND indexname IN (
    'WorkRequest_hotel_status_date_idx',
    'WorkApplication_work_request_id_idx',
    'WorkApplication_worker_id_idx',
    'WorkerAssignment_hotel_id_idx',
    'Attendance_hotel_verified_idx',
    'Notification_user_read_idx'
  )
ORDER BY tablename, indexname;
```

✅ Expected: 6 rows

---

## 7. Data Integrity Checks

Run after backfill is complete. Zero violations required before production cutover.

### 7.1 WorkRequest: workers_confirmed never exceeds workers_needed

```sql
SELECT id, workers_needed, workers_confirmed
FROM "WorkRequest"
WHERE workers_confirmed > workers_needed;
```

✅ Expected: 0 rows

### 7.2 WorkerAssignment: no active double-booking (partial index sanity check)

```sql
-- Two CONFIRMED or IN_PROGRESS rows for the same (work_request_id, worker_id)
SELECT work_request_id, worker_id, COUNT(*) AS active_slots
FROM "WorkerAssignment"
WHERE status IN (
  'CONFIRMED'::"AssignmentStatus",
  'IN_PROGRESS'::"AssignmentStatus"
)
GROUP BY work_request_id, worker_id
HAVING COUNT(*) > 1;
```

✅ Expected: 0 rows

### 7.3 WorkApplication → WorkerAssignment referential integrity

```sql
-- Assignments referencing non-existent applications
SELECT wa.id AS assignment_id, wa.application_id
FROM "WorkerAssignment" wa
LEFT JOIN "WorkApplication" app ON app.id = wa.application_id
WHERE wa.application_id IS NOT NULL
  AND app.id IS NULL;
```

✅ Expected: 0 rows

### 7.4 Attendance: checkout always after check-in

```sql
SELECT id, check_in_at, check_out_at
FROM "Attendance"
WHERE check_in_at  IS NOT NULL
  AND check_out_at IS NOT NULL
  AND check_out_at <= check_in_at;
```

✅ Expected: 0 rows

### 7.5 Attendance: verification pair consistency

```sql
SELECT id, verified_by_id, verified_at
FROM "Attendance"
WHERE (verified_by_id IS NULL AND verified_at IS NOT NULL)
   OR (verified_by_id IS NOT NULL AND verified_at IS NULL);
```

✅ Expected: 0 rows

### 7.6 QualityVerification: score within 0–100

```sql
SELECT id, score FROM "QualityVerification" WHERE score < 0 OR score > 100;
```

✅ Expected: 0 rows

### 7.7 Rating: score within 1–5

```sql
SELECT id, score FROM "Rating" WHERE score < 1 OR score > 5;
```

✅ Expected: 0 rows

### 7.8 WorkRequest FILLED status matches workers_confirmed

```sql
-- FILLED requests where confirmed count does not match needed count
SELECT id, workers_needed, workers_confirmed, status
FROM "WorkRequest"
WHERE status = 'FILLED'::"WorkRequestStatus"
  AND workers_confirmed <> workers_needed;
```

✅ Expected: 0 rows

```sql
-- OPEN requests with confirmed workers (trigger should have moved them to PARTIALLY_FILLED)
SELECT id, workers_needed, workers_confirmed, status
FROM "WorkRequest"
WHERE status = 'OPEN'::"WorkRequestStatus"
  AND workers_confirmed > 0;
```

✅ Expected: 0 rows

### 7.9 WorkerOverallRating scores within valid range

```sql
SELECT worker_id, average_score
FROM "WorkerOverallRating"
WHERE average_score < 1.0 OR average_score > 5.0;
```

✅ Expected: 0 rows

### 7.10 Orphan check: HotelWorker without valid User or Hotel

```sql
SELECT hw.id
FROM "HotelWorker" hw
LEFT JOIN "User"  u ON u.id  = hw.worker_id
LEFT JOIN "Hotel" h ON h.id  = hw.hotel_id
WHERE u.id IS NULL OR h.id IS NULL;
```

✅ Expected: 0 rows

### 7.11 Orphan check: Attendance without WorkerAssignment

```sql
SELECT a.id FROM "Attendance" a
LEFT JOIN "WorkerAssignment" wa ON wa.id = a.assignment_id
WHERE wa.id IS NULL;
```

✅ Expected: 0 rows

### 7.12 AuditLog: no rows lost (append-only table sanity)

```sql
-- Confirm no audit rows reference deleted resources with SetNull correctly applied
SELECT COUNT(*) AS logs_with_null_actor,
       COUNT(*) FILTER (WHERE actor_id IS NOT NULL) AS logs_with_actor
FROM "AuditLog";
```

✅ Expected: both columns return non-negative integers; no errors on query execution.

### 7.13 Notification: no NULL type values

```sql
SELECT COUNT(*) AS null_types FROM "Notification" WHERE type IS NULL;
```

✅ Expected: 0

### 7.14 HotelWorker: no REMOVED workers with NULL left_at

```sql
-- REMOVED workers should have a left_at timestamp
SELECT COUNT(*) AS removed_without_left_at
FROM "HotelWorker"
WHERE status = 'REMOVED'::"HotelWorkerStatus"
  AND left_at IS NULL;
```

⚠️ This is a data quality check, not a hard constraint. Historic REMOVED rows created during backfill may have NULL `left_at`. Flag and backfill if count > 0.

---

## 8. Post-Migration Smoke Tests

These tests exercise the full V2 marketplace flow end-to-end against the migrated database. Run via the application's test suite or manually via `psql`.

### Test T-1 — Full marketplace flow (happy path)

```sql
-- 1. Create a hotel
INSERT INTO "Hotel" (id, name, city, country, address, timezone)
VALUES ('smoke-hotel-1', 'Smoke Test Hotel', 'Berlin', 'Germany', '1 Test Str', 'Europe/Berlin');

-- 2. Create a worker user
INSERT INTO "User" (id, email, password_hash, first_name, last_name, role)
VALUES ('smoke-worker-1', 'worker@smoketest.com', 'hash', 'Test', 'Worker', 'WORKER'::"UserRole");

-- 3. Create a manager user
INSERT INTO "User" (id, email, password_hash, first_name, last_name, role)
VALUES ('smoke-manager-1', 'manager@smoketest.com', 'hash', 'Test', 'Manager', 'MANAGER'::"UserRole");

-- 4. Add worker to hotel roster (INVITED state)
INSERT INTO "HotelWorker" (id, hotel_id, worker_id, position, status)
VALUES ('smoke-hw-1', 'smoke-hotel-1', 'smoke-worker-1', 'cleaner', 'INVITED'::"HotelWorkerStatus");

-- 5. Activate worker on roster
UPDATE "HotelWorker" SET status = 'ACTIVE'::"HotelWorkerStatus", joined_at = NOW()
WHERE id = 'smoke-hw-1';

-- 6. Post a WorkRequest (DRAFT)
INSERT INTO "WorkRequest" (id, hotel_id, created_by_id, position, workers_needed, shift_date, shift_start_time, shift_end_time)
VALUES ('smoke-wr-1', 'smoke-hotel-1', 'smoke-manager-1', 'cleaner', 1, CURRENT_DATE + 1, '09:00', '17:00');

-- Verify: status = DRAFT
SELECT status FROM "WorkRequest" WHERE id = 'smoke-wr-1';
-- ✅ Expected: DRAFT

-- 7. Publish request
UPDATE "WorkRequest" SET status = 'OPEN'::"WorkRequestStatus", published_at = NOW()
WHERE id = 'smoke-wr-1';

-- 8. Worker applies
INSERT INTO "WorkApplication" (id, work_request_id, worker_id, status)
VALUES ('smoke-app-1', 'smoke-wr-1', 'smoke-worker-1', 'PENDING'::"ApplicationStatus");

-- 9. Manager accepts application
UPDATE "WorkApplication"
SET status = 'ACCEPTED'::"ApplicationStatus", reviewed_by_id = 'smoke-manager-1', reviewed_at = NOW()
WHERE id = 'smoke-app-1';

-- 10. Create assignment from accepted application
INSERT INTO "WorkerAssignment" (
  id, work_request_id, worker_id, hotel_id, assigned_by_id, application_id, status
) VALUES (
  'smoke-wa-1', 'smoke-wr-1', 'smoke-worker-1', 'smoke-hotel-1',
  'smoke-manager-1', 'smoke-app-1', 'CONFIRMED'::"AssignmentStatus"
);

-- 11. Verify: WorkRequest auto-updated to FILLED by trigger
SELECT status, workers_confirmed, filled_at FROM "WorkRequest" WHERE id = 'smoke-wr-1';
-- ✅ Expected: FILLED, workers_confirmed = 1, filled_at IS NOT NULL

-- 12. Create attendance record (pre-shift)
INSERT INTO "Attendance" (id, assignment_id, worker_id, hotel_id, status)
VALUES ('smoke-att-1', 'smoke-wa-1', 'smoke-worker-1', 'smoke-hotel-1', 'EXPECTED'::"AttendanceStatus");

-- 13. Worker checks in
UPDATE "Attendance" SET status = 'PRESENT'::"AttendanceStatus", check_in_at = NOW()
WHERE id = 'smoke-att-1';

-- 14. Worker checks out
UPDATE "Attendance"
SET check_out_at = NOW() + INTERVAL '8 hours', minutes_worked = 480
WHERE id = 'smoke-att-1';

-- 15. Manager verifies attendance
UPDATE "Attendance"
SET is_verified = TRUE, verified_by_id = 'smoke-manager-1', verified_at = NOW()
WHERE id = 'smoke-att-1';

-- 16. Complete assignment
UPDATE "WorkerAssignment"
SET status = 'COMPLETED'::"AssignmentStatus", completed_at = NOW()
WHERE id = 'smoke-wa-1';

-- 17. Create quality verification (by a checker user)
INSERT INTO "User" (id, email, password_hash, first_name, last_name, role)
VALUES ('smoke-checker-1', 'checker@smoketest.com', 'hash', 'Test', 'Checker', 'CHECKER'::"UserRole");

INSERT INTO "QualityVerification" (
  id, assignment_id, hotel_id, verified_by_id, score, status
) VALUES (
  'smoke-qv-1', 'smoke-wa-1', 'smoke-hotel-1', 'smoke-checker-1', 92, 'PASSED'::"VerificationStatus"
);

-- 18. Create rating
INSERT INTO "Rating" (id, assignment_id, hotel_id, worker_id, rated_by_id, score, comment)
VALUES ('smoke-r-1', 'smoke-wa-1', 'smoke-hotel-1', 'smoke-worker-1', 'smoke-checker-1', 5, 'Excellent work.');

-- 19. Verify WorkerOverallRating trigger fired
SELECT average_score, total_ratings FROM "WorkerOverallRating" WHERE worker_id = 'smoke-worker-1';
-- ✅ Expected: average_score = 5.0, total_ratings = 1
```

### Test T-2 — Double-booking prevention

```sql
-- Attempt to insert a second CONFIRMED assignment for the same worker on the same request
-- This must be rejected by the partial unique index

INSERT INTO "WorkApplication" (id, work_request_id, worker_id, status)
VALUES ('smoke-app-2', 'smoke-wr-1', 'smoke-worker-1', 'ACCEPTED'::"ApplicationStatus")
ON CONFLICT DO NOTHING;
-- ✅ Expected: 0 rows inserted (unique constraint fires)

-- If a second application were somehow created, the assignment insert would fail:
-- ERROR: duplicate key value violates unique constraint
--        "WorkerAssignment_worker_active_per_request_uidx"
```

### Test T-3 — Slot-ceiling enforcement

```sql
-- WorkRequest with workers_needed=1 is already FILLED from T-1
-- Attempting to create a second assignment must be rejected by check_slot_availability trigger

INSERT INTO "User" (id, email, password_hash, first_name, last_name, role)
VALUES ('smoke-worker-2', 'worker2@smoketest.com', 'hash', 'Test', 'Worker2', 'WORKER'::"UserRole");

INSERT INTO "WorkApplication" (id, work_request_id, worker_id, status)
VALUES ('smoke-app-3', 'smoke-wr-1', 'smoke-worker-2', 'ACCEPTED'::"ApplicationStatus");

-- This insert should raise an exception from check_slot_availability()
INSERT INTO "WorkerAssignment" (
  id, work_request_id, worker_id, hotel_id, assigned_by_id, application_id, status
) VALUES (
  'smoke-wa-2', 'smoke-wr-1', 'smoke-worker-2', 'smoke-hotel-1',
  'smoke-manager-1', 'smoke-app-3', 'CONFIRMED'::"AssignmentStatus"
);
-- ✅ Expected: ERROR — Cannot assign worker: WorkRequest smoke-wr-1 is already filled
```

### Test T-4 — Attendance verification pair constraint

```sql
-- verified_by_id set without verified_at: must be rejected
UPDATE "Attendance"
SET verified_by_id = 'smoke-manager-1', verified_at = NULL
WHERE id = 'smoke-att-1';
-- ✅ Expected: ERROR — violates check constraint "Attendance_verification_pair"
```

### Test T-5 — Checkout before check-in: must be rejected

```sql
UPDATE "Attendance"
SET check_in_at  = NOW(),
    check_out_at = NOW() - INTERVAL '1 hour'
WHERE id = 'smoke-att-1';
-- ✅ Expected: ERROR — violates check constraint "Attendance_checkout_after_checkin"
```

### Test T-6 — Score range constraints

```sql
INSERT INTO "QualityVerification" (
  id, assignment_id, hotel_id, verified_by_id, score, status
) VALUES (
  'smoke-qv-fail', 'smoke-wa-1', 'smoke-hotel-1', 'smoke-checker-1',
  101, 'PASSED'::"VerificationStatus"
);
-- ✅ Expected: ERROR — violates check constraint "QualityVerification_score_range"

INSERT INTO "Rating" (id, assignment_id, hotel_id, worker_id, rated_by_id, score)
VALUES ('smoke-r-fail', 'smoke-wa-1', 'smoke-hotel-1', 'smoke-worker-1', 'smoke-checker-1', 6);
-- ✅ Expected: ERROR — violates check constraint "Rating_score_range"
```

### Test T-7 — updated_at trigger fires

```sql
-- Record current updated_at
SELECT updated_at AS before_update FROM "WorkRequest" WHERE id = 'smoke-wr-1';

-- Wait 1 second then update
SELECT pg_sleep(1);
UPDATE "WorkRequest" SET description = 'Updated description' WHERE id = 'smoke-wr-1';

-- Verify updated_at changed
SELECT updated_at AS after_update FROM "WorkRequest" WHERE id = 'smoke-wr-1';
-- ✅ Expected: after_update > before_update
```

### Test T-8 — Cleanup smoke test data

```sql
-- Remove all smoke test rows in safe cascade order
DELETE FROM "WorkerOverallRating" WHERE worker_id IN ('smoke-worker-1','smoke-worker-2');
DELETE FROM "Rating"              WHERE id IN ('smoke-r-1');
DELETE FROM "QualityVerification" WHERE id IN ('smoke-qv-1');
DELETE FROM "Attendance"          WHERE id IN ('smoke-att-1');
DELETE FROM "WorkerAssignment"    WHERE id LIKE 'smoke-%';
DELETE FROM "WorkApplication"     WHERE id LIKE 'smoke-%';
DELETE FROM "WorkRequest"         WHERE id LIKE 'smoke-%';
DELETE FROM "HotelWorker"         WHERE id LIKE 'smoke-%';
DELETE FROM "User"                WHERE id LIKE 'smoke-%';
DELETE FROM "Hotel"               WHERE id LIKE 'smoke-%';

-- Verify clean
SELECT COUNT(*) FROM "User"  WHERE id LIKE 'smoke-%';  -- ✅ 0
SELECT COUNT(*) FROM "Hotel" WHERE id LIKE 'smoke-%';  -- ✅ 0
```

---

## Final sign-off

| Gate | Status | Signed off by | Timestamp |
|---|---|---|---|
| Pre-flight checks | [ ] | | |
| Migration executed and verified | [ ] | | |
| Backfill B-1 through B-12 complete | [ ] | | |
| All validation queries passed | [ ] | | |
| All data integrity checks passed | [ ] | | |
| All smoke tests T-1 through T-8 passed | [ ] | | |
| Production traffic restored | [ ] | | |
| V1 table drop (B-13) | [ ] | | |

---

**Status:** `READY_FOR_IMPLEMENTATION`  
**Schema source of truth:** `docs/PRISMA_SCHEMA_V2_FREEZE.md`  
**Schema changes require:** `PRISMA_SCHEMA_V2_PATCH_V2` + freeze review cycle
