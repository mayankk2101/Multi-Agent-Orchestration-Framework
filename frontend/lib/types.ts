/**
 * Shared API types mirroring the backend response contract.
 *
 * The backend wraps every response in an envelope:
 *   success: { status: "success", data, meta }
 *   error:   { status: "error", error: { code, message } }
 */

/** Roles emitted by the backend (always lower-cased on the wire). */
export type Role = "worker" | "checker" | "manager" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  profile_photo_url?: string;
  role: Role;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  /** Access-token lifetime in seconds. */
  expires_in: number;
}

/** Payload of `POST /auth/login`. */
export type LoginResponse = AuthTokens & { user: AuthUser };

/** Payload of `POST /auth/refresh`. */
export type RefreshResponse = AuthTokens;

export interface ApiMeta {
  timestamp: string;
  request_id?: string;
}

export interface ApiSuccess<T> {
  status: "success";
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  status: "error";
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiErrorBody;

/* -------------------------------------------------------------------------- */
/*  Work Requests                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Work request lifecycle. Mirrors the backend `WorkRequestStatus` enum
 * (PRISMA_SCHEMA_V2_FREEZE). DRAFT and OPEN are the only states the UI sets
 * directly; the rest are driven by the assignment pipeline or scheduled jobs
 * and are read-only here.
 */
export type WorkRequestStatus =
  | "DRAFT"
  | "OPEN"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELLED"
  | "EXPIRED";

/** A work request as returned by `GET /work-requests` and `/:id`. */
export interface WorkRequest {
  id: string;
  hotel_id: string;
  created_by_id: string;
  position: string;
  workers_needed: number;
  workers_confirmed: number;
  shift_date: string; // YYYY-MM-DD
  shift_start_time: string; // HH:MM
  shift_end_time: string; // HH:MM
  hourly_rate: number | null;
  currency: string;
  description: string | null;
  requirements: string | null;
  status: WorkRequestStatus;
  published_at: string | null;
  expires_at: string | null;
  filled_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  /** Present only for worker/checker roles on the detail endpoint. */
  my_application?: { id: string; status: string; created_at: string } | null;
}

/** Body of `POST /work-requests`. */
export interface CreateWorkRequestInput {
  hotel_id: string;
  position: string;
  workers_needed: number;
  shift_date: string;
  shift_start_time: string;
  shift_end_time: string;
  hourly_rate?: number;
  currency?: string;
  description?: string;
  requirements?: string;
  /** A request may be created as a DRAFT or published straight to OPEN. */
  status?: "DRAFT" | "OPEN";
  expires_at?: string;
}

/** Body of `PATCH /work-requests/:id`. */
export interface UpdateWorkRequestInput {
  status?: WorkRequestStatus;
  cancellation_reason?: string;
}

/** Query params accepted by `GET /work-requests`. */
export interface ListWorkRequestsQuery {
  hotel_id?: string;
  status?: WorkRequestStatus;
  position?: string;
  shift_date?: string;
  page?: number;
  per_page?: number;
}

/** Minimal hotel shape from `GET /crm/hotels` (used by the create form). */
export interface HotelSummary {
  id: string;
  name: string;
  city: string;
  country: string;
}

/* -------------------------------------------------------------------------- */
/*  Work Applications                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Application lifecycle. Mirrors the backend `ApplicationStatus` enum
 * (prisma/schema.prisma). The review UI only ever transitions a PENDING
 * application to ACCEPTED or REJECTED; WITHDRAWN is worker-driven and
 * EXPIRED is set by scheduled jobs — both are read-only here.
 */
export type ApplicationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "EXPIRED";

/**
 * A work application as returned by
 * `GET /work-requests/:id/applications` and the PATCH review endpoint.
 * Shape mirrors the backend `WorkApplicationDto`.
 */
export interface WorkApplication {
  id: string;
  work_request_id: string;
  worker_id: string;
  reviewed_by_id: string | null;
  status: ApplicationStatus;
  cover_note: string | null;
  worker_rating_snapshot: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  applied_at: string;
  updated_at: string;
}

/** Query params accepted by `GET /work-requests/:id/applications`. */
export interface ListApplicationsQuery {
  status?: ApplicationStatus;
  page?: number;
  per_page?: number;
}

/** Body of `PATCH /work-requests/:id/applications/:applicationId`. */
export interface UpdateApplicationInput {
  status?: "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  rejection_reason?: string;
}

/* -------------------------------------------------------------------------- */
/*  Assignments                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Assignment lifecycle. Mirrors the backend `AssignmentStatus` enum
 * (prisma/schema.prisma). The UI only ever drives the transitions the
 * backend allows: CONFIRMED → IN_PROGRESS/CANCELLED and
 * IN_PROGRESS → COMPLETED/CANCELLED. NO_SHOW and REASSIGNED are produced
 * by other backend flows and are read-only here.
 */
export type AssignmentStatus =
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED"
  | "REASSIGNED";

/**
 * A worker assignment as returned by `GET /assignments` and `/assignments/:id`.
 * Shape mirrors the backend `AssignmentDto`.
 */
export interface Assignment {
  id: string;
  work_request_id: string;
  worker_id: string;
  hotel_id: string;
  assigned_by_id: string;
  application_id: string;
  status: AssignmentStatus;
  confirmed_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  updated_at: string;
}

/** Query params accepted by `GET /assignments`. */
export interface ListAssignmentsQuery {
  hotel_id?: string;
  work_request_id?: string;
  worker_id?: string;
  status?: AssignmentStatus;
  page?: number;
  per_page?: number;
}

/** Body of `PATCH /assignments/:id`. */
export interface UpdateAssignmentInput {
  status?: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  cancellation_reason?: string;
}

/* -------------------------------------------------------------------------- */
/*  Attendance                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Attendance lifecycle. Mirrors the backend `AttendanceStatus` enum
 * (prisma/schema.prisma). EXPECTED is the pre-shift state set when the
 * record is created; check-in moves it to PRESENT or LATE. Managers may
 * additionally set ABSENT, PARTIAL or EXCUSED during verification.
 */
export type AttendanceStatus =
  | "EXPECTED"
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "PARTIAL"
  | "EXCUSED";

/** Statuses a manager may assign during verification (EXPECTED is pre-shift). */
export type AttendanceReviewStatus = Exclude<AttendanceStatus, "EXPECTED">;

/**
 * An attendance record as returned by `GET /attendance` and `/attendance/:id`.
 * Shape mirrors the backend `AttendanceDto`.
 */
export interface Attendance {
  id: string;
  assignment_id: string;
  worker_id: string;
  hotel_id: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  expected_start: string | null;
  expected_end: string | null;
  minutes_late: number | null;
  minutes_worked: number | null;
  notes: string | null;
  is_verified: boolean;
  verified_by_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Query params accepted by `GET /attendance`. */
export interface ListAttendanceQuery {
  hotel_id?: string;
  worker_id?: string;
  assignment_id?: string;
  status?: AttendanceStatus;
  is_verified?: boolean;
  page?: number;
  per_page?: number;
}

/** Body of `POST /attendance` (worker check-in). */
export interface CheckInInput {
  assignment_id: string;
  notes?: string;
}

/**
 * Body of `PATCH /attendance/:id`. Workers may only set `check_out_at` and
 * `notes`; the remaining fields are manager/checker-only verification fields
 * enforced by the backend.
 */
export interface UpdateAttendanceInput {
  check_out_at?: string;
  notes?: string;
  status?: AttendanceReviewStatus;
  minutes_late?: number;
  minutes_worked?: number;
  is_verified?: boolean;
}
