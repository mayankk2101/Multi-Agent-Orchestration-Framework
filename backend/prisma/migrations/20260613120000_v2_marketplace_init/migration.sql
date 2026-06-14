-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('WORKER', 'CHECKER', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "HotelWorkerStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "WorkRequestStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('EXPECTED', 'PRESENT', 'ABSENT', 'LATE', 'PARTIAL', 'EXCUSED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PASSED', 'FAILED', 'NEEDS_REWORK');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WORK_REQUEST_PUBLISHED', 'WORK_REQUEST_CANCELLED', 'WORK_REQUEST_EXPIRING_SOON', 'APPLICATION_RECEIVED', 'APPLICATION_ACCEPTED', 'APPLICATION_REJECTED', 'APPLICATION_WITHDRAWN', 'ASSIGNMENT_CONFIRMED', 'ASSIGNMENT_CANCELLED', 'SHIFT_REMINDER', 'CHECK_IN_REMINDER', 'ATTENDANCE_VERIFIED', 'WORKER_NO_SHOW', 'QUALITY_VERIFICATION_SUBMITTED', 'RATING_RECEIVED', 'REWORK_REQUIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "profile_photo_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'WORKER',
    "permissions" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified_at" TIMESTAMP(3),
    "phone_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Germany',
    "address" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelWorker" (
    "id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "status" "HotelWorkerStatus" NOT NULL DEFAULT 'INVITED',
    "hourly_rate" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3),
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkRequest" (
    "id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "workers_needed" INTEGER NOT NULL DEFAULT 1,
    "workers_confirmed" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "shift_date" DATE NOT NULL,
    "shift_start_time" TEXT NOT NULL,
    "shift_end_time" TEXT NOT NULL,
    "hourly_rate" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT,
    "requirements" TEXT,
    "status" "WorkRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "filled_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkApplication" (
    "id" TEXT NOT NULL,
    "work_request_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "cover_note" TEXT,
    "worker_rating_snapshot" DOUBLE PRECISION,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerAssignment" (
    "id" TEXT NOT NULL,
    "work_request_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "previous_assignment_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'EXPECTED',
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "expected_start" TIMESTAMP(3),
    "expected_end" TIMESTAMP(3),
    "minutes_late" INTEGER,
    "minutes_worked" INTEGER,
    "notes" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityVerification" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "verified_by_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PASSED',
    "notes" TEXT,
    "photo_urls" TEXT[],
    "rework_required" BOOLEAN NOT NULL DEFAULT false,
    "rework_notes" TEXT,
    "rework_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "rated_by_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "criteria_scores" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerOverallRating" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "average_score" DOUBLE PRECISION NOT NULL,
    "total_ratings" INTEGER NOT NULL DEFAULT 0,
    "total_assignments" INTEGER NOT NULL DEFAULT 0,
    "completion_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "on_time_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "last_worked_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerOverallRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hotel_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" "UserRole",
    "action" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_is_active_idx" ON "User"("is_active");

-- CreateIndex
CREATE INDEX "User_deleted_at_idx" ON "User"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refresh_token_key" ON "Session"("refresh_token");

-- CreateIndex
CREATE INDEX "Session_user_id_idx" ON "Session"("user_id");

-- CreateIndex
CREATE INDEX "Session_expires_at_idx" ON "Session"("expires_at");

-- CreateIndex
CREATE INDEX "Hotel_country_idx" ON "Hotel"("country");

-- CreateIndex
CREATE INDEX "Hotel_is_active_idx" ON "Hotel"("is_active");

-- CreateIndex
CREATE INDEX "Hotel_city_country_idx" ON "Hotel"("city", "country");

-- CreateIndex
CREATE INDEX "HotelWorker_hotel_id_idx" ON "HotelWorker"("hotel_id");

-- CreateIndex
CREATE INDEX "HotelWorker_worker_id_idx" ON "HotelWorker"("worker_id");

-- CreateIndex
CREATE INDEX "HotelWorker_status_idx" ON "HotelWorker"("status");

-- CreateIndex
CREATE INDEX "HotelWorker_position_idx" ON "HotelWorker"("position");

-- CreateIndex
CREATE UNIQUE INDEX "HotelWorker_hotel_id_worker_id_key" ON "HotelWorker"("hotel_id", "worker_id");

-- CreateIndex
CREATE INDEX "WorkRequest_hotel_id_idx" ON "WorkRequest"("hotel_id");

-- CreateIndex
CREATE INDEX "WorkRequest_created_by_id_idx" ON "WorkRequest"("created_by_id");

-- CreateIndex
CREATE INDEX "WorkRequest_status_idx" ON "WorkRequest"("status");

-- CreateIndex
CREATE INDEX "WorkRequest_shift_date_idx" ON "WorkRequest"("shift_date");

-- CreateIndex
CREATE INDEX "WorkRequest_position_idx" ON "WorkRequest"("position");

-- CreateIndex
CREATE INDEX "WorkRequest_hotel_id_status_shift_date_idx" ON "WorkRequest"("hotel_id", "status", "shift_date");

-- CreateIndex
CREATE INDEX "WorkApplication_work_request_id_idx" ON "WorkApplication"("work_request_id");

-- CreateIndex
CREATE INDEX "WorkApplication_worker_id_idx" ON "WorkApplication"("worker_id");

-- CreateIndex
CREATE INDEX "WorkApplication_status_idx" ON "WorkApplication"("status");

-- CreateIndex
CREATE INDEX "WorkApplication_applied_at_idx" ON "WorkApplication"("applied_at");

-- CreateIndex
CREATE UNIQUE INDEX "WorkApplication_work_request_id_worker_id_key" ON "WorkApplication"("work_request_id", "worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerAssignment_application_id_key" ON "WorkerAssignment"("application_id");

-- CreateIndex
CREATE INDEX "WorkerAssignment_work_request_id_idx" ON "WorkerAssignment"("work_request_id");

-- CreateIndex
CREATE INDEX "WorkerAssignment_worker_id_idx" ON "WorkerAssignment"("worker_id");

-- CreateIndex
CREATE INDEX "WorkerAssignment_hotel_id_idx" ON "WorkerAssignment"("hotel_id");

-- CreateIndex
CREATE INDEX "WorkerAssignment_status_idx" ON "WorkerAssignment"("status");

-- CreateIndex
CREATE INDEX "WorkerAssignment_confirmed_at_idx" ON "WorkerAssignment"("confirmed_at");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_assignment_id_key" ON "Attendance"("assignment_id");

-- CreateIndex
CREATE INDEX "Attendance_worker_id_idx" ON "Attendance"("worker_id");

-- CreateIndex
CREATE INDEX "Attendance_hotel_id_idx" ON "Attendance"("hotel_id");

-- CreateIndex
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- CreateIndex
CREATE INDEX "Attendance_check_in_at_idx" ON "Attendance"("check_in_at");

-- CreateIndex
CREATE INDEX "Attendance_worker_id_check_in_at_idx" ON "Attendance"("worker_id", "check_in_at");

-- CreateIndex
CREATE INDEX "Attendance_hotel_id_is_verified_idx" ON "Attendance"("hotel_id", "is_verified");

-- CreateIndex
CREATE UNIQUE INDEX "QualityVerification_assignment_id_key" ON "QualityVerification"("assignment_id");

-- CreateIndex
CREATE INDEX "QualityVerification_hotel_id_idx" ON "QualityVerification"("hotel_id");

-- CreateIndex
CREATE INDEX "QualityVerification_verified_by_id_idx" ON "QualityVerification"("verified_by_id");

-- CreateIndex
CREATE INDEX "QualityVerification_status_idx" ON "QualityVerification"("status");

-- CreateIndex
CREATE INDEX "QualityVerification_score_idx" ON "QualityVerification"("score");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_assignment_id_key" ON "Rating"("assignment_id");

-- CreateIndex
CREATE INDEX "Rating_hotel_id_idx" ON "Rating"("hotel_id");

-- CreateIndex
CREATE INDEX "Rating_worker_id_idx" ON "Rating"("worker_id");

-- CreateIndex
CREATE INDEX "Rating_rated_by_id_idx" ON "Rating"("rated_by_id");

-- CreateIndex
CREATE INDEX "Rating_score_idx" ON "Rating"("score");

-- CreateIndex
CREATE INDEX "Rating_created_at_idx" ON "Rating"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerOverallRating_worker_id_key" ON "WorkerOverallRating"("worker_id");

-- CreateIndex
CREATE INDEX "WorkerOverallRating_average_score_idx" ON "WorkerOverallRating"("average_score");

-- CreateIndex
CREATE INDEX "WorkerOverallRating_total_ratings_idx" ON "WorkerOverallRating"("total_ratings");

-- CreateIndex
CREATE INDEX "Notification_user_id_idx" ON "Notification"("user_id");

-- CreateIndex
CREATE INDEX "Notification_hotel_id_idx" ON "Notification"("hotel_id");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_created_at_idx" ON "Notification"("created_at");

-- CreateIndex
CREATE INDEX "Notification_user_id_is_read_idx" ON "Notification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "AuditLog_actor_id_idx" ON "AuditLog"("actor_id");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_resource_type_idx" ON "AuditLog"("resource_type");

-- CreateIndex
CREATE INDEX "AuditLog_resource_id_idx" ON "AuditLog"("resource_id");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_resource_type_resource_id_idx" ON "AuditLog"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelWorker" ADD CONSTRAINT "HotelWorker_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelWorker" ADD CONSTRAINT "HotelWorker_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkApplication" ADD CONSTRAINT "WorkApplication_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "WorkRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkApplication" ADD CONSTRAINT "WorkApplication_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkApplication" ADD CONSTRAINT "WorkApplication_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "WorkRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "WorkApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_previous_assignment_id_fkey" FOREIGN KEY ("previous_assignment_id") REFERENCES "WorkerAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "WorkerAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityVerification" ADD CONSTRAINT "QualityVerification_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "WorkerAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityVerification" ADD CONSTRAINT "QualityVerification_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityVerification" ADD CONSTRAINT "QualityVerification_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "WorkerAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_rated_by_id_fkey" FOREIGN KEY ("rated_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerOverallRating" ADD CONSTRAINT "WorkerOverallRating_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =============================================================================
-- V2 INVARIANTS — constraints & objects mandated by schema.prisma comments
-- that `prisma migrate diff` cannot express (CHECKs, partial unique, trigger).
-- =============================================================================

-- WorkRequest: workers_confirmed must never exceed workers_needed (schema L266)
ALTER TABLE "WorkRequest"
  ADD CONSTRAINT "WorkRequest_workers_confirmed_lte_needed"
  CHECK ("workers_confirmed" >= 0 AND "workers_confirmed" <= "workers_needed");

-- QualityVerification: score is 0–100 (schema L403)
ALTER TABLE "QualityVerification"
  ADD CONSTRAINT "QualityVerification_score_range"
  CHECK ("score" >= 0 AND "score" <= 100);

-- Rating: score is 1–5 stars (schema L429)
ALTER TABLE "Rating"
  ADD CONSTRAINT "Rating_score_range"
  CHECK ("score" >= 1 AND "score" <= 5);

-- SP-5: prevent active-slot double-booking. A worker may have many assignment
-- rows per request (CANCELLED + REASSIGNED chains) but at most one ACTIVE one.
CREATE UNIQUE INDEX "WorkerAssignment_active_slot_unique"
  ON "WorkerAssignment"("work_request_id", "worker_id")
  WHERE "status" IN ('CONFIRMED', 'IN_PROGRESS');

-- =============================================================================
-- Leaderboard: maintain WorkerOverallRating as a materialised aggregate,
-- refreshed by trigger after each Rating write (schema L443-444).
-- =============================================================================
CREATE OR REPLACE FUNCTION refresh_worker_overall_rating(p_worker_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_avg   FLOAT;
  v_count INTEGER;
  v_last  TIMESTAMP;
BEGIN
  SELECT AVG("score")::FLOAT, COUNT(*)
    INTO v_avg, v_count
    FROM "Rating"
   WHERE "worker_id" = p_worker_id;

  SELECT MAX(wa."completed_at")
    INTO v_last
    FROM "WorkerAssignment" wa
   WHERE wa."worker_id" = p_worker_id
     AND wa."status" = 'COMPLETED';

  INSERT INTO "WorkerOverallRating" ("id", "worker_id", "average_score", "total_ratings", "last_worked_at", "updated_at")
  VALUES (gen_random_uuid()::TEXT, p_worker_id, COALESCE(v_avg, 0), COALESCE(v_count, 0), v_last, NOW())
  ON CONFLICT ("worker_id") DO UPDATE
    SET "average_score" = COALESCE(v_avg, 0),
        "total_ratings" = COALESCE(v_count, 0),
        "last_worked_at" = v_last,
        "updated_at"     = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_rating_refresh_overall()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM refresh_worker_overall_rating(OLD."worker_id");
    RETURN OLD;
  ELSE
    PERFORM refresh_worker_overall_rating(NEW."worker_id");
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Rating_refresh_overall_rating"
  AFTER INSERT OR UPDATE OR DELETE ON "Rating"
  FOR EACH ROW EXECUTE FUNCTION trg_rating_refresh_overall();
