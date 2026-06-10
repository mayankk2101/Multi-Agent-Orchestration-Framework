-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('WORKER', 'CHECKER', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

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
    "hotel_ids" TEXT[],
    "permissions" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
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
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'clean',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "assigned_to_worker_id" TEXT NOT NULL,
    "created_by_manager_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" "TaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskPhoto" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityVerification" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "verified_by_checker_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'verified',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "rated_by_checker_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerOverallRating" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "average_score" DOUBLE PRECISION NOT NULL,
    "total_ratings" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerOverallRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "contract_template_id" TEXT NOT NULL,
    "created_by_manager_id" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "employment_type" TEXT NOT NULL DEFAULT 'permanent',
    "position" TEXT NOT NULL,
    "salary_amount" DECIMAL(10,2) NOT NULL,
    "salary_currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'active',
    "document_url" TEXT,
    "document_hash" TEXT,
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template_content" TEXT NOT NULL,
    "required_fields" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractLineItem" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "item_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerDocument" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "document_url" TEXT NOT NULL,
    "document_hash" TEXT,
    "file_size" INTEGER NOT NULL,
    "file_mime_type" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "uploaded_by_manager_id" TEXT,
    "alert_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "WorkerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequiredDocument" (
    "id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "renewal_frequency_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequiredDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "pay_period_start" TIMESTAMP(3) NOT NULL,
    "pay_period_end" TIMESTAMP(3) NOT NULL,
    "gross_salary" DECIMAL(10,2) NOT NULL,
    "gross_currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "encrypted_data" BYTEA,
    "encryption_key_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLineItem" (
    "id" TEXT NOT NULL,
    "payroll_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "amount_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionLog" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "data_category" TEXT NOT NULL,
    "hire_date" TIMESTAMP(3) NOT NULL,
    "retention_end_date" TIMESTAMP(3) NOT NULL,
    "retention_years" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reminder_sent_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deletion_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkRequest" (
    "id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "created_by_manager_id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "workers_needed" INTEGER NOT NULL,
    "shift_date" TIMESTAMP(3) NOT NULL,
    "shift_start_time" TEXT NOT NULL,
    "shift_end_time" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filled_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerAssignment" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "work_request_id" TEXT NOT NULL,
    "assigned_by_manager_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "previous_assignment_id" TEXT,
    "reassigned_at" TIMESTAMP(3),

    CONSTRAINT "WorkerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyOperation" (
    "id" TEXT NOT NULL,
    "worker_assignment_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "room_type" TEXT,
    "tasks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_manager_id" TEXT,

    CONSTRAINT "DailyOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "details" JSONB,
    "ip_address" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL,
    "consent_given" BOOLEAN NOT NULL,
    "consent_version" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "consent_source" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_is_active_idx" ON "User"("is_active");
CREATE INDEX "User_deleted_at_idx" ON "User"("deleted_at");

CREATE INDEX "Session_user_id_idx" ON "Session"("user_id");
CREATE INDEX "Session_expires_at_idx" ON "Session"("expires_at");

CREATE INDEX "Hotel_country_idx" ON "Hotel"("country");
CREATE INDEX "Hotel_is_active_idx" ON "Hotel"("is_active");

CREATE UNIQUE INDEX "Room_hotel_id_number_key" ON "Room"("hotel_id", "number");
CREATE INDEX "Room_hotel_id_idx" ON "Room"("hotel_id");
CREATE INDEX "Room_status_idx" ON "Room"("status");

CREATE INDEX "Task_hotel_id_idx" ON "Task"("hotel_id");
CREATE INDEX "Task_room_id_idx" ON "Task"("room_id");
CREATE INDEX "Task_assigned_to_worker_id_idx" ON "Task"("assigned_to_worker_id");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_created_at_idx" ON "Task"("created_at");

CREATE INDEX "TaskPhoto_task_id_idx" ON "TaskPhoto"("task_id");

CREATE UNIQUE INDEX "QualityVerification_task_id_key" ON "QualityVerification"("task_id");
CREATE INDEX "QualityVerification_task_id_idx" ON "QualityVerification"("task_id");
CREATE INDEX "QualityVerification_hotel_id_idx" ON "QualityVerification"("hotel_id");
CREATE INDEX "QualityVerification_verified_by_checker_id_idx" ON "QualityVerification"("verified_by_checker_id");

CREATE UNIQUE INDEX "Rating_task_id_key" ON "Rating"("task_id");
CREATE INDEX "Rating_hotel_id_idx" ON "Rating"("hotel_id");
CREATE INDEX "Rating_worker_id_idx" ON "Rating"("worker_id");
CREATE INDEX "Rating_created_at_idx" ON "Rating"("created_at");

CREATE UNIQUE INDEX "WorkerOverallRating_worker_id_key" ON "WorkerOverallRating"("worker_id");
CREATE INDEX "WorkerOverallRating_worker_id_idx" ON "WorkerOverallRating"("worker_id");

CREATE UNIQUE INDEX "Contract_contract_number_key" ON "Contract"("contract_number");
CREATE INDEX "Contract_worker_id_idx" ON "Contract"("worker_id");
CREATE INDEX "Contract_hotel_id_idx" ON "Contract"("hotel_id");
CREATE INDEX "Contract_status_idx" ON "Contract"("status");
CREATE INDEX "Contract_deleted_at_idx" ON "Contract"("deleted_at");

CREATE INDEX "ContractTemplate_hotel_id_idx" ON "ContractTemplate"("hotel_id");
CREATE INDEX "ContractLineItem_contract_id_idx" ON "ContractLineItem"("contract_id");

CREATE INDEX "WorkerDocument_worker_id_idx" ON "WorkerDocument"("worker_id");
CREATE INDEX "WorkerDocument_hotel_id_idx" ON "WorkerDocument"("hotel_id");
CREATE INDEX "WorkerDocument_document_type_idx" ON "WorkerDocument"("document_type");
CREATE INDEX "WorkerDocument_expiry_date_idx" ON "WorkerDocument"("expiry_date");
CREATE INDEX "WorkerDocument_deleted_at_idx" ON "WorkerDocument"("deleted_at");

CREATE UNIQUE INDEX "RequiredDocument_hotel_id_document_type_key" ON "RequiredDocument"("hotel_id", "document_type");
CREATE INDEX "RequiredDocument_hotel_id_idx" ON "RequiredDocument"("hotel_id");

CREATE UNIQUE INDEX "Payroll_worker_id_pay_period_start_pay_period_end_key" ON "Payroll"("worker_id", "pay_period_start", "pay_period_end");
CREATE INDEX "Payroll_worker_id_idx" ON "Payroll"("worker_id");
CREATE INDEX "Payroll_hotel_id_idx" ON "Payroll"("hotel_id");
CREATE INDEX "Payroll_status_idx" ON "Payroll"("status");
CREATE INDEX "Payroll_paid_at_idx" ON "Payroll"("paid_at");
CREATE INDEX "Payroll_deleted_at_idx" ON "Payroll"("deleted_at");

CREATE INDEX "PayrollLineItem_payroll_id_idx" ON "PayrollLineItem"("payroll_id");

CREATE INDEX "DataRetentionLog_worker_id_idx" ON "DataRetentionLog"("worker_id");
CREATE INDEX "DataRetentionLog_retention_end_date_idx" ON "DataRetentionLog"("retention_end_date");
CREATE INDEX "DataRetentionLog_status_idx" ON "DataRetentionLog"("status");

CREATE INDEX "WorkRequest_hotel_id_idx" ON "WorkRequest"("hotel_id");
CREATE INDEX "WorkRequest_created_by_manager_id_idx" ON "WorkRequest"("created_by_manager_id");
CREATE INDEX "WorkRequest_status_idx" ON "WorkRequest"("status");
CREATE INDEX "WorkRequest_shift_date_idx" ON "WorkRequest"("shift_date");

CREATE INDEX "WorkerAssignment_worker_id_idx" ON "WorkerAssignment"("worker_id");
CREATE INDEX "WorkerAssignment_work_request_id_idx" ON "WorkerAssignment"("work_request_id");
CREATE INDEX "WorkerAssignment_status_idx" ON "WorkerAssignment"("status");
CREATE INDEX "WorkerAssignment_assigned_at_idx" ON "WorkerAssignment"("assigned_at");

CREATE INDEX "DailyOperation_worker_assignment_id_idx" ON "DailyOperation"("worker_assignment_id");
CREATE INDEX "DailyOperation_hotel_id_idx" ON "DailyOperation"("hotel_id");
CREATE INDEX "DailyOperation_room_id_idx" ON "DailyOperation"("room_id");
CREATE INDEX "DailyOperation_status_idx" ON "DailyOperation"("status");

CREATE INDEX "Notification_user_id_idx" ON "Notification"("user_id");
CREATE INDEX "Notification_is_read_idx" ON "Notification"("is_read");
CREATE INDEX "Notification_created_at_idx" ON "Notification"("created_at");

CREATE INDEX "AuditLog_actor_id_idx" ON "AuditLog"("actor_id");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_resource_type_idx" ON "AuditLog"("resource_type");
CREATE INDEX "AuditLog_resource_id_idx" ON "AuditLog"("resource_id");
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

CREATE INDEX "ConsentLog_user_id_idx" ON "ConsentLog"("user_id");
CREATE INDEX "ConsentLog_consent_type_idx" ON "ConsentLog"("consent_type");
CREATE INDEX "ConsentLog_timestamp_idx" ON "ConsentLog"("timestamp");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigned_to_worker_id_fkey" FOREIGN KEY ("assigned_to_worker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_created_by_manager_id_fkey" FOREIGN KEY ("created_by_manager_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskPhoto" ADD CONSTRAINT "TaskPhoto_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QualityVerification" ADD CONSTRAINT "QualityVerification_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QualityVerification" ADD CONSTRAINT "QualityVerification_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QualityVerification" ADD CONSTRAINT "QualityVerification_verified_by_checker_id_fkey" FOREIGN KEY ("verified_by_checker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_rated_by_checker_id_fkey" FOREIGN KEY ("rated_by_checker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerOverallRating" ADD CONSTRAINT "WorkerOverallRating_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_contract_template_id_fkey" FOREIGN KEY ("contract_template_id") REFERENCES "ContractTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_created_by_manager_id_fkey" FOREIGN KEY ("created_by_manager_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractTemplate" ADD CONSTRAINT "ContractTemplate_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractLineItem" ADD CONSTRAINT "ContractLineItem_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerDocument" ADD CONSTRAINT "WorkerDocument_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerDocument" ADD CONSTRAINT "WorkerDocument_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerDocument" ADD CONSTRAINT "WorkerDocument_uploaded_by_manager_id_fkey" FOREIGN KEY ("uploaded_by_manager_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RequiredDocument" ADD CONSTRAINT "RequiredDocument_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataRetentionLog" ADD CONSTRAINT "DataRetentionLog_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_created_by_manager_id_fkey" FOREIGN KEY ("created_by_manager_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "WorkRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_assigned_by_manager_id_fkey" FOREIGN KEY ("assigned_by_manager_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyOperation" ADD CONSTRAINT "DailyOperation_worker_assignment_id_fkey" FOREIGN KEY ("worker_assignment_id") REFERENCES "WorkerAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyOperation" ADD CONSTRAINT "DailyOperation_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyOperation" ADD CONSTRAINT "DailyOperation_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyOperation" ADD CONSTRAINT "DailyOperation_created_by_manager_id_fkey" FOREIGN KEY ("created_by_manager_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
