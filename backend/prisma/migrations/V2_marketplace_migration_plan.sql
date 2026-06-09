-- =============================================================================
-- Hotel CRM — V2 Marketplace Migration Plan  (PATCH_V1 applied)
-- MP-1 through MP-10 applied over original V2 migration.
-- Run inside a single transaction. Rolls back entirely on any error.
-- Requires PostgreSQL 15+.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 0 — Lock strategy
-- ADD COLUMN with a non-volatile DEFAULT does not rewrite the table on PG 11+.
-- RENAME COLUMN acquires ACCESS EXCLUSIVE but is instantaneous.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- STEP 1 — ENUMs  (idempotent via DO blocks)
-- MP-4: HotelWorkerStatus corrected to frozen lifecycle: INVITED→ACTIVE→SUSPENDED/REMOVED
-- SP-6: AttendanceStatus gains EXPECTED as the initial pre-shift state
-- SP-8: NotificationType added — Notification.type promoted from String to enum
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('WORKER','CHECKER','MANAGER','ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MP-4: was ('ACTIVE','INACTIVE','SUSPENDED') — INACTIVE removed, INVITED+REMOVED added
DO $$ BEGIN
  CREATE TYPE "HotelWorkerStatus" AS ENUM ('INVITED','ACTIVE','SUSPENDED','REMOVED');
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

-- SP-6: EXPECTED added as first value (initial pre-shift state)
DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM
    ('EXPECTED','PRESENT','ABSENT','LATE','PARTIAL','EXCUSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VerificationStatus" AS ENUM ('PASSED','FAILED','NEEDS_REWORK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP','EMAIL','PUSH','SMS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SP-8: new enum — all notification types are domain events, not free strings
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'WORK_REQUEST_PUBLISHED',
    'WORK_REQUEST_CANCELLED',
    'WORK_REQUEST_EXPIRING_SOON',
    'APPLICATION_RECEIVED',
    'APPLICATION_ACCEPTED',
    'APPLICATION_REJECTED',
    'APPLICATION_WITHDRAWN',
    'ASSIGNMENT_CONFIRMED',
    'ASSIGNMENT_CANCELLED',
    'SHIFT_REMINDER',
    'CHECK_IN_REMINDER',
    'ATTENDANCE_VERIFIED',
    'WORKER_NO_SHOW',
    'QUALITY_VERIFICATION_SUBMITTED',
    'RATING_RECEIVED',
    'REWORK_REQUIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- STEP 2 — User: add columns, drop V1 hotel_ids array
-- ---------------------------------------------------------------------------

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "phone_verified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_login_at"     TIMESTAMPTZ;

-- phone unique — skip if duplicates exist in data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"User"'::regclass AND conname = 'User_phone_key'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_phone_key" UNIQUE (phone);
  END IF;
END $$;

-- Drop V1 hotel_ids array (superseded by HotelWorker join table)
ALTER TABLE "User" DROP COLUMN IF EXISTS "hotel_ids";

-- ---------------------------------------------------------------------------
-- STEP 3 — Hotel: add contact columns
-- ---------------------------------------------------------------------------

ALTER TABLE "Hotel"
  ADD COLUMN IF NOT EXISTS "contact_email" TEXT,
  ADD COLUMN IF NOT EXISTS "contact_phone" TEXT;

-- ---------------------------------------------------------------------------
-- STEP 4 — Create HotelWorker
-- MP-4: enum corrected to INVITED/ACTIVE/SUSPENDED/REMOVED
-- SP-2: invited_at NOT NULL; joined_at nullable (set on INVITED→ACTIVE only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "HotelWorker" (
  "id"          TEXT               NOT NULL PRIMARY KEY,
  "hotel_id"    TEXT               NOT NULL REFERENCES "Hotel"("id") ON DELETE CASCADE,
  "worker_id"   TEXT               NOT NULL REFERENCES "User"("id")  ON DELETE CASCADE,
  "position"    TEXT               NOT NULL,
  -- MP-4: default INVITED (not ACTIVE) — worker starts in invitation state
  "status"      "HotelWorkerStatus" NOT NULL DEFAULT 'INVITED',
  "hourly_rate" NUMERIC(10,2),
  "currency"    TEXT               NOT NULL DEFAULT 'EUR',
  "notes"       TEXT,
  -- SP-2: invited_at is the row-creation timestamp; joined_at is NULL until acceptance
  "invited_at"  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "joined_at"   TIMESTAMPTZ,
  "left_at"     TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT "HotelWorker_hotel_id_worker_id_key" UNIQUE ("hotel_id","worker_id")
);

CREATE INDEX IF NOT EXISTS "HotelWorker_hotel_id_idx"  ON "HotelWorker" ("hotel_id");
CREATE INDEX IF NOT EXISTS "HotelWorker_worker_id_idx" ON "HotelWorker" ("worker_id");
CREATE INDEX IF NOT EXISTS "HotelWorker_status_idx"    ON "HotelWorker" ("status");
CREATE INDEX IF NOT EXISTS "HotelWorker_position_idx"  ON "HotelWorker" ("position");

-- ---------------------------------------------------------------------------
-- STEP 5 — WorkRequest: add columns, migrate status TEXT → enum
-- MP-2: rename guarded by DO block (idempotent); ADD COLUMN uses IF NOT EXISTS
-- SP-9: version column added for optimistic locking
-- ---------------------------------------------------------------------------

-- Idempotent rename: only rename if status column is still TEXT type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WorkRequest'
      AND column_name = 'status'
      AND udt_name    = 'text'
  ) THEN
    ALTER TABLE "WorkRequest" RENAME COLUMN "status" TO "status_v1";
  END IF;
END $$;

-- MP-2: IF NOT EXISTS makes this safe on re-run
ALTER TABLE "WorkRequest"
  ADD COLUMN IF NOT EXISTS "status" "WorkRequestStatus" NOT NULL DEFAULT 'OPEN';

-- Migrate values — only runs while status_v1 exists (first run)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WorkRequest' AND column_name = 'status_v1'
  ) THEN
    UPDATE "WorkRequest" SET "status" =
      CASE "status_v1"
        WHEN 'OPEN'             THEN 'OPEN'::"WorkRequestStatus"
        WHEN 'PARTIALLY_FILLED' THEN 'PARTIALLY_FILLED'::"WorkRequestStatus"
        WHEN 'FILLED'           THEN 'FILLED'::"WorkRequestStatus"
        WHEN 'CANCELLED'        THEN 'CANCELLED'::"WorkRequestStatus"
        ELSE 'OPEN'::"WorkRequestStatus"
      END;
    ALTER TABLE "WorkRequest" DROP COLUMN "status_v1";
  END IF;
END $$;

ALTER TABLE "WorkRequest"
  ADD COLUMN IF NOT EXISTS "workers_confirmed"   INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "version"             INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hourly_rate"         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS "currency"            TEXT         NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "description"         TEXT,
  ADD COLUMN IF NOT EXISTS "requirements"        TEXT,
  ADD COLUMN IF NOT EXISTS "published_at"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "expires_at"          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

-- Rename FK column (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WorkRequest' AND column_name = 'created_by_manager_id'
  ) THEN
    ALTER TABLE "WorkRequest" RENAME COLUMN "created_by_manager_id" TO "created_by_id";
  END IF;
END $$;

-- Constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"WorkRequest"'::regclass
      AND conname = 'WorkRequest_confirmed_lte_needed'
  ) THEN
    ALTER TABLE "WorkRequest"
      ADD CONSTRAINT "WorkRequest_confirmed_lte_needed"
      CHECK ("workers_confirmed" <= "workers_needed");
  END IF;
END $$;

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
  "id"                     TEXT                NOT NULL PRIMARY KEY,
  "work_request_id"        TEXT                NOT NULL REFERENCES "WorkRequest"("id") ON DELETE CASCADE,
  "worker_id"              TEXT                NOT NULL REFERENCES "User"("id")        ON DELETE CASCADE,
  "reviewed_by_id"         TEXT                         REFERENCES "User"("id")        ON DELETE SET NULL,
  "status"                 "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "cover_note"             TEXT,
  "worker_rating_snapshot" DOUBLE PRECISION,
  "reviewed_at"            TIMESTAMPTZ,
  "rejection_reason"       TEXT,
  "applied_at"             TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  CONSTRAINT "WorkApplication_work_request_id_worker_id_key"
    UNIQUE ("work_request_id","worker_id")
);

CREATE INDEX IF NOT EXISTS "WorkApplication_work_request_id_idx" ON "WorkApplication" ("work_request_id");
CREATE INDEX IF NOT EXISTS "WorkApplication_worker_id_idx"       ON "WorkApplication" ("worker_id");
CREATE INDEX IF NOT EXISTS "WorkApplication_status_idx"          ON "WorkApplication" ("status");
CREATE INDEX IF NOT EXISTS "WorkApplication_applied_at_idx"      ON "WorkApplication" ("applied_at");

-- ---------------------------------------------------------------------------
-- STEP 7 — WorkerAssignment: migrate status TEXT → enum, add columns
-- MP-2: rename guarded by DO block
-- MP-3: full unique constraint REMOVED — only partial index enforces active-slot rule
-- MP-9: application_id FK references WorkApplication with ON DELETE RESTRICT
-- ---------------------------------------------------------------------------

-- Idempotent rename: only if status is still TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WorkerAssignment'
      AND column_name = 'status'
      AND udt_name    = 'text'
  ) THEN
    ALTER TABLE "WorkerAssignment" RENAME COLUMN "status" TO "status_v1";
  END IF;
END $$;

-- MP-2: IF NOT EXISTS
ALTER TABLE "WorkerAssignment"
  ADD COLUMN IF NOT EXISTS "status" "AssignmentStatus" NOT NULL DEFAULT 'CONFIRMED';

-- Migrate values — only while status_v1 exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WorkerAssignment' AND column_name = 'status_v1'
  ) THEN
    UPDATE "WorkerAssignment" SET "status" =
      CASE "status_v1"
        WHEN 'ASSIGNED'    THEN 'CONFIRMED'::"AssignmentStatus"
        WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"AssignmentStatus"
        WHEN 'COMPLETED'   THEN 'COMPLETED'::"AssignmentStatus"
        WHEN 'CANCELLED'   THEN 'CANCELLED'::"AssignmentStatus"
        WHEN 'REASSIGNED'  THEN 'REASSIGNED'::"AssignmentStatus"
        ELSE 'CONFIRMED'::"AssignmentStatus"
      END;
    ALTER TABLE "WorkerAssignment" DROP COLUMN "status_v1";
  END IF;
END $$;

ALTER TABLE "WorkerAssignment"
  ADD COLUMN IF NOT EXISTS "hotel_id"               TEXT        REFERENCES "Hotel"("id")        ON DELETE CASCADE,
  -- MP-9: FK to WorkApplication with RESTRICT — no orphaned assignments
  ADD COLUMN IF NOT EXISTS "application_id"         TEXT UNIQUE REFERENCES "WorkApplication"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "cancelled_at"           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancellation_reason"    TEXT,
  ADD COLUMN IF NOT EXISTS "previous_assignment_id" TEXT        REFERENCES "WorkerAssignment"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Back-fill hotel_id from WorkRequest
UPDATE "WorkerAssignment" wa
SET    "hotel_id" = wr."hotel_id"
FROM   "WorkRequest" wr
WHERE  wa."work_request_id" = wr."id"
  AND  wa."hotel_id" IS NULL;

ALTER TABLE "WorkerAssignment"
  ALTER COLUMN "hotel_id" SET NOT NULL;

-- Rename manager FK (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WorkerAssignment' AND column_name = 'assigned_by_manager_id'
  ) THEN
    ALTER TABLE "WorkerAssignment" RENAME COLUMN "assigned_by_manager_id" TO "assigned_by_id";
  END IF;
END $$;

-- MP-3: full unique constraint NOT added here.
-- Rationale: @@unique([work_request_id, worker_id]) would prevent a worker being
-- re-assigned to the same request after cancellation (reassignment chain).
-- Active-slot double-booking is prevented exclusively by the partial index below.

-- Partial unique index: a worker can hold at most one active slot per request.
-- H-m1: explicit enum casts in WHERE predicate for correctness.
CREATE UNIQUE INDEX IF NOT EXISTS "WorkerAssignment_worker_active_per_request_uidx"
  ON "WorkerAssignment" ("work_request_id", "worker_id")
  WHERE "status" IN (
    'CONFIRMED'::"AssignmentStatus",
    'IN_PROGRESS'::"AssignmentStatus"
  );

CREATE INDEX IF NOT EXISTS "WorkerAssignment_hotel_id_idx"     ON "WorkerAssignment" ("hotel_id");
CREATE INDEX IF NOT EXISTS "WorkerAssignment_confirmed_at_idx" ON "WorkerAssignment" ("confirmed_at");

-- ---------------------------------------------------------------------------
-- STEP 8 — Create Attendance
-- SP-6: default EXPECTED (not PRESENT) — record exists before worker arrives
-- SP-7: is_verified column + compound index for manager dashboard
-- New: verification-pair CHECK constraint (verified_by and verified_at must both be set or both null)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Attendance" (
  "id"             TEXT               NOT NULL PRIMARY KEY,
  "assignment_id"  TEXT               NOT NULL UNIQUE REFERENCES "WorkerAssignment"("id") ON DELETE CASCADE,
  "worker_id"      TEXT               NOT NULL REFERENCES "User"("id")  ON DELETE CASCADE,
  "hotel_id"       TEXT               NOT NULL REFERENCES "Hotel"("id") ON DELETE CASCADE,
  -- SP-6: EXPECTED is the initial state; transitions to PRESENT/LATE/ABSENT on check-in or shift end
  "status"         "AttendanceStatus" NOT NULL DEFAULT 'EXPECTED',
  "check_in_at"    TIMESTAMPTZ,
  "check_out_at"   TIMESTAMPTZ,
  "expected_start" TIMESTAMPTZ,
  "expected_end"   TIMESTAMPTZ,
  "minutes_late"   INT,
  "minutes_worked" INT,
  "notes"          TEXT,
  -- SP-7: explicit boolean flag for dashboard queries; set true atomically with verified_by/at
  "is_verified"    BOOLEAN            NOT NULL DEFAULT FALSE,
  "verified_by_id" TEXT               REFERENCES "User"("id") ON DELETE SET NULL,
  "verified_at"    TIMESTAMPTZ,
  "created_at"     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT "Attendance_checkout_after_checkin"
    CHECK ("check_out_at" IS NULL OR "check_in_at" IS NULL OR "check_out_at" > "check_in_at"),
  CONSTRAINT "Attendance_minutes_worked_positive"
    CHECK ("minutes_worked" IS NULL OR "minutes_worked" >= 0),
  CONSTRAINT "Attendance_minutes_late_positive"
    CHECK ("minutes_late"   IS NULL OR "minutes_late"   >= 0),
  -- New: verified_by_id and verified_at must be set together or not at all
  CONSTRAINT "Attendance_verification_pair"
    CHECK (
      ("verified_by_id" IS NULL AND "verified_at" IS NULL) OR
      ("verified_by_id" IS NOT NULL AND "verified_at" IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS "Attendance_worker_id_idx"      ON "Attendance" ("worker_id");
CREATE INDEX IF NOT EXISTS "Attendance_hotel_id_idx"       ON "Attendance" ("hotel_id");
CREATE INDEX IF NOT EXISTS "Attendance_status_idx"         ON "Attendance" ("status");
CREATE INDEX IF NOT EXISTS "Attendance_check_in_at_idx"    ON "Attendance" ("check_in_at");
CREATE INDEX IF NOT EXISTS "Attendance_worker_checkin_idx" ON "Attendance" ("worker_id", "check_in_at");
-- SP-7: hot path — manager dashboard "unverified attendance at this hotel"
CREATE INDEX IF NOT EXISTS "Attendance_hotel_verified_idx" ON "Attendance" ("hotel_id", "is_verified");

-- ---------------------------------------------------------------------------
-- STEP 9 — QualityVerification: re-anchor task_id → assignment_id
-- MP-1 (BLOCKER): V1 has status TEXT column — apply rename pattern, not ADD COLUMN
--                 without rename (which would silently skip due to IF NOT EXISTS,
--                 then crash on enum cast of TEXT column)
-- MP-8: assignment_id promoted to NOT NULL after data backfill (see post-migration)
-- ---------------------------------------------------------------------------

-- MP-1: rename existing TEXT status → status_v1 (idempotent guard)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'QualityVerification'
      AND column_name = 'status'
      AND udt_name    = 'text'
  ) THEN
    ALTER TABLE "QualityVerification" RENAME COLUMN "status" TO "status_v1";
  END IF;
END $$;

ALTER TABLE "QualityVerification"
  ADD COLUMN IF NOT EXISTS "assignment_id"      TEXT      UNIQUE REFERENCES "WorkerAssignment"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "photo_urls"         TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "rework_required"    BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "rework_notes"       TEXT,
  ADD COLUMN IF NOT EXISTS "rework_completed_at" TIMESTAMPTZ,
  -- MP-1: add enum column only after rename; IF NOT EXISTS is safe here
  ADD COLUMN IF NOT EXISTS "status"             "VerificationStatus" NOT NULL DEFAULT 'PASSED';

-- MP-1: migrate V1 string values → enum (only while status_v1 exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'QualityVerification' AND column_name = 'status_v1'
  ) THEN
    UPDATE "QualityVerification"
    SET "status" = CASE
      WHEN "status_v1" = 'needs_rework' THEN 'NEEDS_REWORK'::"VerificationStatus"
      WHEN "status_v1" = 'verified'     THEN 'PASSED'::"VerificationStatus"
      ELSE                                   'PASSED'::"VerificationStatus"
    END;
    ALTER TABLE "QualityVerification" DROP COLUMN "status_v1";
  END IF;
END $$;

-- Rename verifier FK (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'QualityVerification' AND column_name = 'verified_by_checker_id'
  ) THEN
    ALTER TABLE "QualityVerification"
      RENAME COLUMN "verified_by_checker_id" TO "verified_by_id";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"QualityVerification"'::regclass
      AND conname = 'QualityVerification_score_range'
  ) THEN
    ALTER TABLE "QualityVerification"
      ADD CONSTRAINT "QualityVerification_score_range"
      CHECK ("score" BETWEEN 0 AND 100);
  END IF;
END $$;

-- After task_id → assignment_id data backfill (see post-migration step 5):
-- ALTER TABLE "QualityVerification" DROP COLUMN "task_id";
-- MP-8: ALTER TABLE "QualityVerification" ALTER COLUMN "assignment_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "QualityVerification_status_idx" ON "QualityVerification" ("status");
CREATE INDEX IF NOT EXISTS "QualityVerification_score_idx"  ON "QualityVerification" ("score");

-- ---------------------------------------------------------------------------
-- STEP 10 — Rating: re-anchor task_id → assignment_id
-- MP-8: assignment_id promoted to NOT NULL after data backfill (see post-migration)
-- ---------------------------------------------------------------------------

ALTER TABLE "Rating"
  ADD COLUMN IF NOT EXISTS "assignment_id"   TEXT UNIQUE REFERENCES "WorkerAssignment"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "criteria_scores" JSONB,
  ADD COLUMN IF NOT EXISTS "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Rename FK column (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Rating' AND column_name = 'rated_by_checker_id'
  ) THEN
    ALTER TABLE "Rating" RENAME COLUMN "rated_by_checker_id" TO "rated_by_id";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"Rating"'::regclass AND conname = 'Rating_score_range'
  ) THEN
    ALTER TABLE "Rating"
      ADD CONSTRAINT "Rating_score_range"
      CHECK ("score" BETWEEN 1 AND 5);
  END IF;
END $$;

-- After task_id → assignment_id data backfill (see post-migration step 5):
-- ALTER TABLE "Rating" DROP COLUMN "task_id";
-- MP-8: ALTER TABLE "Rating" ALTER COLUMN "assignment_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Rating_rated_by_id_idx" ON "Rating" ("rated_by_id");

-- ---------------------------------------------------------------------------
-- STEP 11 — WorkerOverallRating: add marketplace columns, fix cascade
-- ---------------------------------------------------------------------------

ALTER TABLE "WorkerOverallRating"
  ADD COLUMN IF NOT EXISTS "total_assignments" INT              NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "completion_rate"   DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS "on_time_rate"      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS "last_worked_at"    TIMESTAMPTZ;

ALTER TABLE "WorkerOverallRating"
  DROP CONSTRAINT IF EXISTS "WorkerOverallRating_worker_id_fkey";

ALTER TABLE "WorkerOverallRating"
  ADD CONSTRAINT "WorkerOverallRating_worker_id_fkey"
  FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "WorkerOverallRating_average_score_idx" ON "WorkerOverallRating" ("average_score");
CREATE INDEX IF NOT EXISTS "WorkerOverallRating_total_ratings_idx" ON "WorkerOverallRating" ("total_ratings");

-- ---------------------------------------------------------------------------
-- STEP 12 — Notification: add columns, migrate type TEXT → NotificationType enum
-- SP-8: type column promoted from TEXT to NotificationType enum
-- ---------------------------------------------------------------------------

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "hotel_id"   TEXT                REFERENCES "Hotel"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "channel"    "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  ADD COLUMN IF NOT EXISTS "sent_at"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;

-- SP-8: migrate Notification.type TEXT → NotificationType enum
-- Rename existing TEXT column (idempotent guard)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Notification'
      AND column_name = 'type'
      AND udt_name    = 'text'
  ) THEN
    ALTER TABLE "Notification" RENAME COLUMN "type" TO "type_v1";
  END IF;
END $$;

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "type" "NotificationType";

-- Map V1 string values to enum values; unmapped values fall to NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Notification' AND column_name = 'type_v1'
  ) THEN
    UPDATE "Notification" SET "type" = CASE "type_v1"
      WHEN 'WORK_REQUEST_PUBLISHED'          THEN 'WORK_REQUEST_PUBLISHED'::"NotificationType"
      WHEN 'WORK_REQUEST_CANCELLED'          THEN 'WORK_REQUEST_CANCELLED'::"NotificationType"
      WHEN 'WORK_REQUEST_EXPIRING_SOON'      THEN 'WORK_REQUEST_EXPIRING_SOON'::"NotificationType"
      WHEN 'APPLICATION_RECEIVED'            THEN 'APPLICATION_RECEIVED'::"NotificationType"
      WHEN 'APPLICATION_ACCEPTED'            THEN 'APPLICATION_ACCEPTED'::"NotificationType"
      WHEN 'APPLICATION_REJECTED'            THEN 'APPLICATION_REJECTED'::"NotificationType"
      WHEN 'APPLICATION_WITHDRAWN'           THEN 'APPLICATION_WITHDRAWN'::"NotificationType"
      WHEN 'ASSIGNMENT_CONFIRMED'            THEN 'ASSIGNMENT_CONFIRMED'::"NotificationType"
      WHEN 'ASSIGNMENT_CANCELLED'            THEN 'ASSIGNMENT_CANCELLED'::"NotificationType"
      WHEN 'SHIFT_REMINDER'                  THEN 'SHIFT_REMINDER'::"NotificationType"
      WHEN 'CHECK_IN_REMINDER'               THEN 'CHECK_IN_REMINDER'::"NotificationType"
      WHEN 'ATTENDANCE_VERIFIED'             THEN 'ATTENDANCE_VERIFIED'::"NotificationType"
      WHEN 'WORKER_NO_SHOW'                  THEN 'WORKER_NO_SHOW'::"NotificationType"
      WHEN 'QUALITY_VERIFICATION_SUBMITTED'  THEN 'QUALITY_VERIFICATION_SUBMITTED'::"NotificationType"
      WHEN 'RATING_RECEIVED'                 THEN 'RATING_RECEIVED'::"NotificationType"
      WHEN 'REWORK_REQUIRED'                 THEN 'REWORK_REQUIRED'::"NotificationType"
      -- V1 legacy aliases
      WHEN 'TASK_ASSIGNED'                   THEN 'ASSIGNMENT_CONFIRMED'::"NotificationType"
      WHEN 'QUALITY_VERIFIED'                THEN 'QUALITY_VERIFICATION_SUBMITTED'::"NotificationType"
      ELSE NULL  -- unknown types: review before setting NOT NULL below
    END;

    -- Fail fast if any rows could not be mapped — prevents silent data loss
    IF EXISTS (SELECT 1 FROM "Notification" WHERE "type" IS NULL) THEN
      RAISE EXCEPTION
        'Notification rows with unmapped type_v1 values exist. '
        'Resolve mappings before continuing. '
        'Query: SELECT DISTINCT type_v1 FROM "Notification" WHERE type IS NULL';
    END IF;

    ALTER TABLE "Notification"
      ALTER COLUMN "type" SET NOT NULL,
      DROP COLUMN "type_v1";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_hotel_id_idx"  ON "Notification" ("hotel_id");
CREATE INDEX IF NOT EXISTS "Notification_type_idx"      ON "Notification" ("type");
CREATE INDEX IF NOT EXISTS "Notification_user_read_idx" ON "Notification" ("user_id", "is_read");

-- ---------------------------------------------------------------------------
-- STEP 13 — AuditLog: add snapshot columns and actor_role enum
-- ---------------------------------------------------------------------------

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "old_values" JSONB,
  ADD COLUMN IF NOT EXISTS "new_values" JSONB,
  ADD COLUMN IF NOT EXISTS "user_agent" TEXT,
  ADD COLUMN IF NOT EXISTS "actor_role" "UserRole";

CREATE INDEX IF NOT EXISTS "AuditLog_resource_composite_idx"
  ON "AuditLog" ("resource_type", "resource_id");

-- ---------------------------------------------------------------------------
-- STEP 14 — Drop V1 tables
-- Deferred: run after application code is fully on V2 and data backfill is done.
-- ---------------------------------------------------------------------------

-- DROP TABLE IF EXISTS "DailyOperation";
-- DROP TABLE IF EXISTS "TaskPhoto";
-- DROP TABLE IF EXISTS "Task";
-- DROP TABLE IF EXISTS "Room";

-- ---------------------------------------------------------------------------
-- STEP 15 — updated_at triggers on all mutable tables
-- MP-5: 'Session' removed — Session has no updated_at column
-- H-m2: tgrelid filter added to prevent false-positive on same trigger name
--        in a different schema
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
  -- MP-5: Session excluded — it has no updated_at column
  FOREACH t IN ARRAY ARRAY[
    'User','Hotel','HotelWorker','WorkRequest','WorkApplication',
    'WorkerAssignment','Attendance','QualityVerification','Rating',
    'WorkerOverallRating'
  ] LOOP
    -- H-m2: filter by tgrelid to avoid cross-schema false positives
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname   = 'trg_' || lower(t) || '_updated_at'
        AND tgrelid  = ('"' || t || '"')::regclass
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
-- STEP 16 — Trigger: keep WorkerOverallRating in sync after Rating writes
-- MP-6: DELETE guard added — skip upsert when the worker row is being deleted
--       (avoids FK violation when Rating cascade-fires during User hard-delete)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_worker_overall_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_worker_id TEXT;
BEGIN
  v_worker_id := COALESCE(NEW."worker_id", OLD."worker_id");

  -- MP-6: on DELETE, the User row may already be gone (cascade order is undefined).
  -- Skip the upsert entirely — WorkerOverallRating will be cascade-deleted too.
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = v_worker_id) THEN
      RETURN OLD;
    END IF;
  END IF;

  INSERT INTO "WorkerOverallRating"
    ("id", "worker_id", "average_score", "total_ratings", "updated_at")
  SELECT
    gen_random_uuid()::TEXT,
    v_worker_id,
    COALESCE(AVG(r."score"), 0),
    COUNT(r."id"),
    NOW()
  FROM "Rating" r
  WHERE r."worker_id" = v_worker_id
  ON CONFLICT ("worker_id") DO UPDATE SET
    "average_score" = EXCLUDED."average_score",
    "total_ratings" = EXCLUDED."total_ratings",
    "updated_at"    = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS "trg_rating_refresh_overall" ON "Rating";
CREATE TRIGGER "trg_rating_refresh_overall"
  AFTER INSERT OR UPDATE OR DELETE ON "Rating"
  FOR EACH ROW EXECUTE FUNCTION refresh_worker_overall_rating();

-- ---------------------------------------------------------------------------
-- STEP 17 — Trigger: sync WorkRequest.workers_confirmed and status
-- MP-7a: DRAFT added to the exclusion guard — assignments must not flip DRAFT requests
-- MP-7b: filled_at populated when status transitions to FILLED
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_workers_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_request_id TEXT;
  v_count      BIGINT;
BEGIN
  v_request_id := COALESCE(NEW."work_request_id", OLD."work_request_id");

  SELECT COUNT(*) INTO v_count
  FROM "WorkerAssignment"
  WHERE "work_request_id" = v_request_id
    AND "status" IN (
      'CONFIRMED'::"AssignmentStatus",
      'IN_PROGRESS'::"AssignmentStatus",
      'COMPLETED'::"AssignmentStatus"
    );

  UPDATE "WorkRequest"
  SET
    "workers_confirmed" = v_count,
    "status" = CASE
      WHEN v_count = 0              THEN 'OPEN'::"WorkRequestStatus"
      WHEN v_count >= "workers_needed" THEN 'FILLED'::"WorkRequestStatus"
      ELSE                               'PARTIALLY_FILLED'::"WorkRequestStatus"
    END,
    -- MP-7b: stamp filled_at on first transition to FILLED
    "filled_at" = CASE
      WHEN v_count >= "workers_needed" AND "filled_at" IS NULL THEN NOW()
      ELSE "filled_at"
    END
  WHERE "id" = v_request_id
    -- MP-7a: DRAFT added — assignments must not silently publish a draft request
    AND "status" NOT IN (
      'DRAFT'::"WorkRequestStatus",
      'CANCELLED'::"WorkRequestStatus",
      'EXPIRED'::"WorkRequestStatus"
    );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS "trg_assignment_sync_confirmed" ON "WorkerAssignment";
CREATE TRIGGER "trg_assignment_sync_confirmed"
  AFTER INSERT OR UPDATE OF "status" OR DELETE ON "WorkerAssignment"
  FOR EACH ROW EXECUTE FUNCTION sync_workers_confirmed();

-- ---------------------------------------------------------------------------
-- STEP 18 — Concurrency: slot-ceiling trigger on WorkerAssignment INSERT
-- MP-10: acquires row-level lock on WorkRequest before inserting to prevent
--        race conditions where multiple managers simultaneously fill the last slot
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_slot_availability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_needed    INT;
  v_confirmed INT;
  v_status    "WorkRequestStatus";
BEGIN
  -- Acquire row-level lock on the WorkRequest row for the duration of this tx.
  -- Concurrent INSERT triggers on the same request will queue here.
  SELECT "workers_needed", "workers_confirmed", "status"
  INTO   v_needed, v_confirmed, v_status
  FROM   "WorkRequest"
  WHERE  "id" = NEW."work_request_id"
  FOR UPDATE;

  -- Reject if the request is not in an assignable state
  IF v_status NOT IN (
    'OPEN'::"WorkRequestStatus",
    'PARTIALLY_FILLED'::"WorkRequestStatus"
  ) THEN
    RAISE EXCEPTION
      'Cannot assign worker: WorkRequest % has status % (must be OPEN or PARTIALLY_FILLED)',
      NEW."work_request_id", v_status;
  END IF;

  -- Reject if already at capacity
  IF v_confirmed >= v_needed THEN
    RAISE EXCEPTION
      'Cannot assign worker: WorkRequest % is already filled (% of % slots taken)',
      NEW."work_request_id", v_confirmed, v_needed;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_assignment_check_slot" ON "WorkerAssignment";
-- Fires BEFORE INSERT so the exception aborts the insert cleanly
CREATE TRIGGER "trg_assignment_check_slot"
  BEFORE INSERT ON "WorkerAssignment"
  FOR EACH ROW EXECUTE FUNCTION check_slot_availability();

-- ---------------------------------------------------------------------------
-- COMMIT
-- ---------------------------------------------------------------------------

COMMIT;

-- =============================================================================
-- POST-MIGRATION STEPS (run outside transaction after smoke-testing)
-- =============================================================================
--
-- 1.  Back-fill WorkApplication rows from historic WorkerAssignment data.
--
-- 2.  Populate WorkerAssignment.application_id from back-filled applications:
--       UPDATE "WorkerAssignment" wa
--       SET application_id = app.id
--       FROM "WorkApplication" app
--       WHERE app.work_request_id = wa.work_request_id
--         AND app.worker_id       = wa.worker_id
--         AND app.status          = 'ACCEPTED'
--         AND wa.application_id IS NULL;
--
-- 3.  Promote WorkerAssignment.application_id to NOT NULL:
--       ALTER TABLE "WorkerAssignment"
--         ALTER COLUMN "application_id" SET NOT NULL;
--
-- 4.  Map task → assignment for QualityVerification and Rating, then:
--       ALTER TABLE "QualityVerification"
--         ALTER COLUMN "assignment_id" SET NOT NULL;
--       ALTER TABLE "QualityVerification" DROP COLUMN "task_id";
--       ALTER TABLE "Rating"
--         ALTER COLUMN "assignment_id" SET NOT NULL;
--       ALTER TABLE "Rating" DROP COLUMN "task_id";
--
-- 5.  Populate Attendance rows from completed/no-show WorkerAssignment data.
--
-- 6.  Back-fill WorkerOverallRating aggregates for existing workers:
--       INSERT INTO "WorkerOverallRating" ("id","worker_id","average_score","total_ratings","updated_at")
--       SELECT gen_random_uuid()::TEXT, worker_id, AVG(score), COUNT(*), NOW()
--       FROM "Rating" GROUP BY worker_id
--       ON CONFLICT ("worker_id") DO UPDATE SET
--         average_score = EXCLUDED.average_score,
--         total_ratings = EXCLUDED.total_ratings,
--         updated_at    = NOW();
--
-- 7.  Run ANALYZE on all modified tables.
--
-- 8.  Drop V1 tables (Step 14 stubs):
--       DROP TABLE IF EXISTS "DailyOperation";
--       DROP TABLE IF EXISTS "TaskPhoto";
--       DROP TABLE IF EXISTS "Task";
--       DROP TABLE IF EXISTS "Room";
--
-- 9.  Remove V1 application code paths.
--
-- 10. Monitor pg_stat_user_indexes for unused indexes over 2 weeks.
-- =============================================================================
