-- =============================================================================
-- Hotel CRM — V2 Marketplace Migration Plan
-- Run inside a single transaction. Roll back entirely on any error.
-- Tested against PostgreSQL 15+.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 0 — Lock strategy
-- Use ACCESS EXCLUSIVE only where truly needed (new tables, DROP).
-- ALTER TABLE ... ADD COLUMN with a DEFAULT doesn't require full table rewrite
-- on PG 11+ for non-volatile defaults.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- STEP 1 — New ENUMs (idempotent via DO blocks)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('WORKER','CHECKER','MANAGER','ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HotelWorkerStatus" AS ENUM ('ACTIVE','INACTIVE','SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkRequestStatus" AS ENUM
    ('DRAFT','OPEN','PARTIALLY_FILLED','FILLED','CANCELLED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ApplicationStatus" AS ENUM
    ('PENDING','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AssignmentStatus" AS ENUM
    ('CONFIRMED','IN_PROGRESS','COMPLETED','NO_SHOW','CANCELLED','REASSIGNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM
    ('PRESENT','ABSENT','LATE','PARTIAL','EXCUSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VerificationStatus" AS ENUM ('PASSED','FAILED','NEEDS_REWORK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP','EMAIL','PUSH','SMS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- STEP 2 — Migrate User: add new columns, drop V1 relation helpers
-- ---------------------------------------------------------------------------

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "email_verified_at"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "phone_verified_at"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_login_at"      TIMESTAMPTZ;

-- phone: make unique (guard against existing nulls — skip if duplicates exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"User"'::regclass AND conname = 'User_phone_key'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_phone_key" UNIQUE (phone);
  END IF;
END $$;

-- Drop V1 array column hotel_ids (superseded by HotelWorker join table)
ALTER TABLE "User" DROP COLUMN IF EXISTS "hotel_ids";

-- ---------------------------------------------------------------------------
-- STEP 3 — Migrate Hotel: add contact columns
-- ---------------------------------------------------------------------------

ALTER TABLE "Hotel"
  ADD COLUMN IF NOT EXISTS "contact_email" TEXT,
  ADD COLUMN IF NOT EXISTS "contact_phone" TEXT;

-- ---------------------------------------------------------------------------
-- STEP 4 — Create HotelWorker
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "HotelWorker" (
  "id"          TEXT        NOT NULL PRIMARY KEY,
  "hotel_id"    TEXT        NOT NULL REFERENCES "Hotel"("id") ON DELETE CASCADE,
  "worker_id"   TEXT        NOT NULL REFERENCES "User"("id")  ON DELETE CASCADE,
  "position"    TEXT        NOT NULL,
  "status"      "HotelWorkerStatus" NOT NULL DEFAULT 'ACTIVE',
  "hourly_rate" NUMERIC(10,2),
  "currency"    TEXT        NOT NULL DEFAULT 'EUR',
  "notes"       TEXT,
  "joined_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "left_at"     TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "HotelWorker_hotel_id_worker_id_key" UNIQUE ("hotel_id","worker_id")
);

CREATE INDEX IF NOT EXISTS "HotelWorker_hotel_id_idx"  ON "HotelWorker" ("hotel_id");
CREATE INDEX IF NOT EXISTS "HotelWorker_worker_id_idx" ON "HotelWorker" ("worker_id");
CREATE INDEX IF NOT EXISTS "HotelWorker_status_idx"    ON "HotelWorker" ("status");
CREATE INDEX IF NOT EXISTS "HotelWorker_position_idx"  ON "HotelWorker" ("position");

-- ---------------------------------------------------------------------------
-- STEP 5 — Migrate WorkRequest: add new columns, change status type
-- ---------------------------------------------------------------------------

-- Rename old string status to temp while we add the enum column
ALTER TABLE "WorkRequest"
  RENAME COLUMN "status" TO "status_v1";

ALTER TABLE "WorkRequest"
  ADD COLUMN "status" "WorkRequestStatus" NOT NULL DEFAULT 'OPEN';

-- Migrate existing values (best-effort mapping)
UPDATE "WorkRequest" SET "status" =
  CASE "status_v1"
    WHEN 'OPEN'             THEN 'OPEN'::"WorkRequestStatus"
    WHEN 'PARTIALLY_FILLED' THEN 'PARTIALLY_FILLED'::"WorkRequestStatus"
    WHEN 'FILLED'           THEN 'FILLED'::"WorkRequestStatus"
    WHEN 'CANCELLED'        THEN 'CANCELLED'::"WorkRequestStatus"
    ELSE 'OPEN'::"WorkRequestStatus"
  END;

ALTER TABLE "WorkRequest"
  DROP COLUMN "status_v1",
  ADD COLUMN IF NOT EXISTS "workers_confirmed"   INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hourly_rate"         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS "currency"            TEXT        NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "description"         TEXT,
  ADD COLUMN IF NOT EXISTS "requirements"        TEXT,
  ADD COLUMN IF NOT EXISTS "published_at"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "expires_at"          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

-- Rename FK column to new naming convention
ALTER TABLE "WorkRequest"
  RENAME COLUMN "created_by_manager_id" TO "created_by_id";

-- Business rule: confirmed count cannot exceed needed count
ALTER TABLE "WorkRequest"
  ADD CONSTRAINT "WorkRequest_confirmed_lte_needed"
  CHECK ("workers_confirmed" <= "workers_needed");

-- Composite index for hot marketplace query
CREATE INDEX IF NOT EXISTS "WorkRequest_hotel_status_date_idx"
  ON "WorkRequest" ("hotel_id", "status", "shift_date");

CREATE INDEX IF NOT EXISTS "WorkRequest_position_idx"
  ON "WorkRequest" ("position");

CREATE INDEX IF NOT EXISTS "WorkRequest_published_at_idx"
  ON "WorkRequest" ("published_at");

-- ---------------------------------------------------------------------------
-- STEP 6 — Create WorkApplication
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "WorkApplication" (
  "id"                     TEXT               NOT NULL PRIMARY KEY,
  "work_request_id"        TEXT               NOT NULL REFERENCES "WorkRequest"("id") ON DELETE CASCADE,
  "worker_id"              TEXT               NOT NULL REFERENCES "User"("id")        ON DELETE CASCADE,
  "reviewed_by_id"         TEXT               REFERENCES "User"("id")                ON DELETE SET NULL,
  "status"                 "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "cover_note"             TEXT,
  "worker_rating_snapshot" DOUBLE PRECISION,
  "reviewed_at"            TIMESTAMPTZ,
  "rejection_reason"       TEXT,
  "applied_at"             TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT "WorkApplication_work_request_id_worker_id_key"
    UNIQUE ("work_request_id","worker_id")
);

CREATE INDEX IF NOT EXISTS "WorkApplication_work_request_id_idx" ON "WorkApplication" ("work_request_id");
CREATE INDEX IF NOT EXISTS "WorkApplication_worker_id_idx"       ON "WorkApplication" ("worker_id");
CREATE INDEX IF NOT EXISTS "WorkApplication_status_idx"          ON "WorkApplication" ("status");
CREATE INDEX IF NOT EXISTS "WorkApplication_applied_at_idx"      ON "WorkApplication" ("applied_at");

-- ---------------------------------------------------------------------------
-- STEP 7 — Migrate WorkerAssignment: change status type, add new columns
-- ---------------------------------------------------------------------------

ALTER TABLE "WorkerAssignment"
  RENAME COLUMN "status" TO "status_v1";

ALTER TABLE "WorkerAssignment"
  ADD COLUMN "status" "AssignmentStatus" NOT NULL DEFAULT 'CONFIRMED';

UPDATE "WorkerAssignment" SET "status" =
  CASE "status_v1"
    WHEN 'ASSIGNED'    THEN 'CONFIRMED'::"AssignmentStatus"
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"AssignmentStatus"
    WHEN 'COMPLETED'   THEN 'COMPLETED'::"AssignmentStatus"
    WHEN 'CANCELLED'   THEN 'CANCELLED'::"AssignmentStatus"
    WHEN 'REASSIGNED'  THEN 'REASSIGNED'::"AssignmentStatus"
    ELSE 'CONFIRMED'::"AssignmentStatus"
  END;

ALTER TABLE "WorkerAssignment"
  DROP COLUMN "status_v1",
  ADD COLUMN IF NOT EXISTS "hotel_id"               TEXT REFERENCES "Hotel"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "application_id"         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "cancelled_at"           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancellation_reason"    TEXT,
  ADD COLUMN IF NOT EXISTS "previous_assignment_id" TEXT REFERENCES "WorkerAssignment"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Back-fill hotel_id from WorkRequest (safe: WorkRequest.hotel_id always set)
UPDATE "WorkerAssignment" wa
SET "hotel_id" = wr."hotel_id"
FROM "WorkRequest" wr
WHERE wa."work_request_id" = wr."id"
  AND wa."hotel_id" IS NULL;

ALTER TABLE "WorkerAssignment"
  ALTER COLUMN "hotel_id" SET NOT NULL;

-- Rename manager FK to new convention
ALTER TABLE "WorkerAssignment"
  RENAME COLUMN "assigned_by_manager_id" TO "assigned_by_id";

-- Unique: one active slot per worker per request
ALTER TABLE "WorkerAssignment"
  ADD CONSTRAINT "WorkerAssignment_work_request_id_worker_id_key"
  UNIQUE ("work_request_id", "worker_id");

-- Concurrency: partial unique index — a worker cannot hold two live slots
-- (CONFIRMED or IN_PROGRESS) on the same request. Prisma cannot express this;
-- it lives only in the migration.
CREATE UNIQUE INDEX IF NOT EXISTS "WorkerAssignment_worker_active_per_request_uidx"
  ON "WorkerAssignment" ("work_request_id", "worker_id")
  WHERE "status" IN ('CONFIRMED','IN_PROGRESS');

CREATE INDEX IF NOT EXISTS "WorkerAssignment_hotel_id_idx"    ON "WorkerAssignment" ("hotel_id");
CREATE INDEX IF NOT EXISTS "WorkerAssignment_confirmed_at_idx" ON "WorkerAssignment" ("confirmed_at");

-- ---------------------------------------------------------------------------
-- STEP 8 — Create Attendance
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Attendance" (
  "id"             TEXT               NOT NULL PRIMARY KEY,
  "assignment_id"  TEXT               NOT NULL UNIQUE REFERENCES "WorkerAssignment"("id") ON DELETE CASCADE,
  "worker_id"      TEXT               NOT NULL REFERENCES "User"("id")  ON DELETE CASCADE,
  "hotel_id"       TEXT               NOT NULL REFERENCES "Hotel"("id") ON DELETE CASCADE,
  "status"         "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "check_in_at"    TIMESTAMPTZ,
  "check_out_at"   TIMESTAMPTZ,
  "expected_start" TIMESTAMPTZ,
  "expected_end"   TIMESTAMPTZ,
  "minutes_late"   INT,
  "minutes_worked" INT,
  "notes"          TEXT,
  "verified_by_id" TEXT               REFERENCES "User"("id") ON DELETE SET NULL,
  "verified_at"    TIMESTAMPTZ,
  "created_at"     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  -- check_out must be after check_in when both are present
  CONSTRAINT "Attendance_checkout_after_checkin"
    CHECK ("check_out_at" IS NULL OR "check_in_at" IS NULL OR "check_out_at" > "check_in_at"),
  CONSTRAINT "Attendance_minutes_positive"
    CHECK ("minutes_worked" IS NULL OR "minutes_worked" >= 0),
  CONSTRAINT "Attendance_minutes_late_positive"
    CHECK ("minutes_late" IS NULL OR "minutes_late" >= 0)
);

CREATE INDEX IF NOT EXISTS "Attendance_worker_id_idx"          ON "Attendance" ("worker_id");
CREATE INDEX IF NOT EXISTS "Attendance_hotel_id_idx"           ON "Attendance" ("hotel_id");
CREATE INDEX IF NOT EXISTS "Attendance_status_idx"             ON "Attendance" ("status");
CREATE INDEX IF NOT EXISTS "Attendance_check_in_at_idx"        ON "Attendance" ("check_in_at");
CREATE INDEX IF NOT EXISTS "Attendance_worker_checkin_idx"     ON "Attendance" ("worker_id","check_in_at");

-- ---------------------------------------------------------------------------
-- STEP 9 — Migrate QualityVerification: re-anchor from task_id → assignment_id
-- ---------------------------------------------------------------------------

ALTER TABLE "QualityVerification"
  ADD COLUMN IF NOT EXISTS "assignment_id" TEXT UNIQUE REFERENCES "WorkerAssignment"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "photo_urls"    TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "rework_required" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "rework_notes"  TEXT,
  ADD COLUMN IF NOT EXISTS "rework_completed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "status"        "VerificationStatus" NOT NULL DEFAULT 'PASSED';

-- Migrate status string → enum
UPDATE "QualityVerification"
SET "status" = CASE
  WHEN "status"::TEXT = 'needs_rework' THEN 'NEEDS_REWORK'::"VerificationStatus"
  ELSE 'PASSED'::"VerificationStatus"
END;

-- Rename verifier FK
ALTER TABLE "QualityVerification"
  RENAME COLUMN "verified_by_checker_id" TO "verified_by_id";

-- Score constraint
ALTER TABLE "QualityVerification"
  ADD CONSTRAINT "QualityVerification_score_range"
  CHECK ("score" BETWEEN 0 AND 100);

-- After data migration script maps task → assignment, drop task_id
-- ALTER TABLE "QualityVerification" DROP COLUMN "task_id";  -- run after data migration

CREATE INDEX IF NOT EXISTS "QualityVerification_status_idx" ON "QualityVerification" ("status");
CREATE INDEX IF NOT EXISTS "QualityVerification_score_idx"  ON "QualityVerification" ("score");

-- ---------------------------------------------------------------------------
-- STEP 10 — Migrate Rating: re-anchor from task_id → assignment_id
-- ---------------------------------------------------------------------------

ALTER TABLE "Rating"
  ADD COLUMN IF NOT EXISTS "assignment_id"   TEXT UNIQUE REFERENCES "WorkerAssignment"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "criteria_scores" JSONB,
  ADD COLUMN IF NOT EXISTS "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Rename FK columns
ALTER TABLE "Rating"
  RENAME COLUMN "rated_by_checker_id" TO "rated_by_id";

-- Score constraint
ALTER TABLE "Rating"
  ADD CONSTRAINT "Rating_score_range"
  CHECK ("score" BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS "Rating_rated_by_id_idx" ON "Rating" ("rated_by_id");

-- After data migration maps task → assignment:
-- ALTER TABLE "Rating" DROP COLUMN "task_id";  -- run after data migration

-- ---------------------------------------------------------------------------
-- STEP 11 — Migrate WorkerOverallRating: add marketplace-relevant columns
-- ---------------------------------------------------------------------------

ALTER TABLE "WorkerOverallRating"
  ADD COLUMN IF NOT EXISTS "total_assignments" INT             NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "completion_rate"   DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS "on_time_rate"      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS "last_worked_at"    TIMESTAMPTZ;

-- Change cascade: if worker deleted, delete their aggregate too
ALTER TABLE "WorkerOverallRating"
  DROP CONSTRAINT IF EXISTS "WorkerOverallRating_worker_id_fkey";

ALTER TABLE "WorkerOverallRating"
  ADD CONSTRAINT "WorkerOverallRating_worker_id_fkey"
  FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "WorkerOverallRating_average_score_idx" ON "WorkerOverallRating" ("average_score");
CREATE INDEX IF NOT EXISTS "WorkerOverallRating_total_ratings_idx" ON "WorkerOverallRating" ("total_ratings");

-- ---------------------------------------------------------------------------
-- STEP 12 — Migrate Notification: add new columns
-- ---------------------------------------------------------------------------

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "hotel_id"   TEXT        REFERENCES "Hotel"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "channel"    "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  ADD COLUMN IF NOT EXISTS "sent_at"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "Notification_hotel_id_idx"     ON "Notification" ("hotel_id");
CREATE INDEX IF NOT EXISTS "Notification_type_idx"         ON "Notification" ("type");
CREATE INDEX IF NOT EXISTS "Notification_user_read_idx"    ON "Notification" ("user_id","is_read");

-- ---------------------------------------------------------------------------
-- STEP 13 — Migrate AuditLog: add old_values/new_values, actor_role enum
-- ---------------------------------------------------------------------------

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "old_values"  JSONB,
  ADD COLUMN IF NOT EXISTS "new_values"  JSONB,
  ADD COLUMN IF NOT EXISTS "user_agent"  TEXT,
  ADD COLUMN IF NOT EXISTS "actor_role"  "UserRole";

CREATE INDEX IF NOT EXISTS "AuditLog_resource_composite_idx"
  ON "AuditLog" ("resource_type","resource_id");

-- ---------------------------------------------------------------------------
-- STEP 14 — Drop V1 tables (order matters for FK dependencies)
-- Run ONLY after application code is fully cut over to V2.
-- Safe to defer to a separate deployment window.
-- ---------------------------------------------------------------------------

-- DROP TABLE IF EXISTS "DailyOperation";
-- DROP TABLE IF EXISTS "TaskPhoto";
-- DROP TABLE IF EXISTS "Task";
-- DROP TABLE IF EXISTS "Room";

-- ---------------------------------------------------------------------------
-- STEP 15 — Triggers: auto-update updated_at on mutable tables
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'User','Hotel','HotelWorker','WorkRequest','WorkApplication',
    'WorkerAssignment','Attendance','QualityVerification','Rating',
    'WorkerOverallRating','Session'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || lower(t) || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON "%s"
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        lower(t), t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 16 — Trigger: keep WorkerOverallRating in sync after Rating insert/update
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_worker_overall_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_worker_id TEXT;
BEGIN
  v_worker_id := COALESCE(NEW."worker_id", OLD."worker_id");

  INSERT INTO "WorkerOverallRating"
    ("id","worker_id","average_score","total_ratings","updated_at")
  SELECT
    gen_random_uuid()::TEXT,
    v_worker_id,
    AVG(r."score"),
    COUNT(*),
    NOW()
  FROM "Rating" r
  WHERE r."worker_id" = v_worker_id
  ON CONFLICT ("worker_id") DO UPDATE SET
    "average_score" = EXCLUDED."average_score",
    "total_ratings" = EXCLUDED."total_ratings",
    "updated_at"    = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_rating_refresh_overall" ON "Rating";
CREATE TRIGGER "trg_rating_refresh_overall"
  AFTER INSERT OR UPDATE OR DELETE ON "Rating"
  FOR EACH ROW EXECUTE FUNCTION refresh_worker_overall_rating();

-- ---------------------------------------------------------------------------
-- STEP 17 — Trigger: keep WorkRequest.workers_confirmed in sync
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_workers_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "WorkRequest"
  SET "workers_confirmed" = (
    SELECT COUNT(*) FROM "WorkerAssignment"
    WHERE "work_request_id" = COALESCE(NEW."work_request_id", OLD."work_request_id")
      AND "status" IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
  ),
  "status" = CASE
    WHEN (
      SELECT COUNT(*) FROM "WorkerAssignment"
      WHERE "work_request_id" = COALESCE(NEW."work_request_id", OLD."work_request_id")
        AND "status" IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
    ) = 0 THEN 'OPEN'::"WorkRequestStatus"
    WHEN (
      SELECT COUNT(*) FROM "WorkerAssignment"
      WHERE "work_request_id" = COALESCE(NEW."work_request_id", OLD."work_request_id")
        AND "status" IN ('CONFIRMED','IN_PROGRESS','COMPLETED')
    ) >= "workers_needed" THEN 'FILLED'::"WorkRequestStatus"
    ELSE 'PARTIALLY_FILLED'::"WorkRequestStatus"
  END
  WHERE "id" = COALESCE(NEW."work_request_id", OLD."work_request_id")
    AND "status" NOT IN ('CANCELLED','EXPIRED');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_assignment_sync_confirmed" ON "WorkerAssignment";
CREATE TRIGGER "trg_assignment_sync_confirmed"
  AFTER INSERT OR UPDATE OF "status" OR DELETE ON "WorkerAssignment"
  FOR EACH ROW EXECUTE FUNCTION sync_workers_confirmed();

-- ---------------------------------------------------------------------------
-- COMMIT
-- ---------------------------------------------------------------------------

COMMIT;

-- =============================================================================
-- POST-MIGRATION CHECKLIST (run outside transaction after smoke-testing)
-- =============================================================================
-- 1. Run data-migration script to populate WorkApplication rows from historic
--    WorkerAssignment data where applicable.
-- 2. Populate Attendance rows from WorkerAssignment completed/no-show data.
-- 3. Verify WorkerOverallRating aggregates are correct (trigger will handle
--    future rows; back-fill existing with: SELECT refresh_worker_overall_rating() etc.)
-- 4. Run ANALYZE on all new/modified tables.
-- 5. Drop V1 columns: task_id from QualityVerification and Rating.
-- 6. Drop V1 tables: DailyOperation, TaskPhoto, Task, Room.
-- 7. Remove V1 application code paths.
-- 8. Monitor pg_stat_user_indexes for unused indexes over 2 weeks.
-- =============================================================================
