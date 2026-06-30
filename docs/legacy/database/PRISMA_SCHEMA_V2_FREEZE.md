# PRISMA_SCHEMA_V2_FREEZE

**Status:** `APPROVED_WITH_MINOR_FOLLOWUPS`  
**Canonical source of truth for all V2 implementation work.**

| Field | Value |
|---|---|
| Schema file | `backend/prisma/schema.prisma` |
| Migration file | `backend/prisma/migrations/V2_marketplace_migration_plan.sql` |
| Patches applied | SP-1 through SP-9, MP-1 through MP-10 |
| Prisma version | 5.x |
| Target database | PostgreSQL 15+ |
| Architecture | Marketplace — hotels post shifts, workers apply |

---

## 1. Final Entity List

| Entity | Module | Description |
|---|---|---|
| `User` | Auth | Platform user; roles: WORKER, CHECKER, MANAGER, ADMIN |
| `Session` | Auth | Refresh-token session per user device |
| `Hotel` | Hotel | A hotel property; the operator on the marketplace |
| `HotelWorker` | Hotel | Roster join — a worker's affiliation with a hotel |
| `WorkRequest` | Marketplace | A hotel's posted shift need |
| `WorkApplication` | Marketplace | A worker's application to a WorkRequest |
| `WorkerAssignment` | Marketplace | Confirmed assignment created from an accepted application |
| `Attendance` | Attendance | Check-in/out record; 1-to-1 with WorkerAssignment |
| `QualityVerification` | Quality | Checker's verification of completed work; 1-to-1 with WorkerAssignment |
| `Rating` | Quality | Score given to a worker after a completed assignment; 1-to-1 with WorkerAssignment |
| `WorkerOverallRating` | Quality | Materialised aggregate of all ratings per worker |
| `Notification` | Notifications | In-app / push / email / SMS notification per user |
| `AuditLog` | Compliance | Append-only action log; actor FK is SetNull on deletion |

**Removed from V1:** `Room`, `Task`, `TaskPhoto`, `DailyOperation`

---

## 2. Final Enums

### `UserRole`
```
WORKER  CHECKER  MANAGER  ADMIN
```

### `HotelWorkerStatus`
Frozen lifecycle: `INVITED → ACTIVE ↔ SUSPENDED → REMOVED`
```
INVITED   — initial state; row created, acceptance pending
ACTIVE    — worker accepted and eligible for shifts
SUSPENDED — temporarily blocked; reversible
REMOVED   — terminal; worker has left the hotel's roster
```

### `WorkRequestStatus`
Frozen lifecycle: `DRAFT → OPEN → PARTIALLY_FILLED → FILLED → CANCELLED / EXPIRED`
```
DRAFT             — created, not yet published
OPEN              — published, accepting applications (workers_confirmed = 0)
PARTIALLY_FILLED  — one or more slots confirmed, not all filled
FILLED            — all slots confirmed (workers_confirmed = workers_needed)
CANCELLED         — cancelled by hotel; terminal
EXPIRED           — passed expires_at without being filled; terminal
```
Status is maintained automatically by the `sync_workers_confirmed` DB trigger.

### `ApplicationStatus`
```
PENDING   — submitted, awaiting manager review
ACCEPTED  — manager approved; WorkerAssignment created
REJECTED  — manager declined
WITHDRAWN — worker self-withdrew
EXPIRED   — auto-expired when WorkRequest expired or was cancelled
```

### `AssignmentStatus`
```
CONFIRMED   — assignment created from accepted application
IN_PROGRESS — worker has checked in / shift started
COMPLETED   — shift completed successfully
NO_SHOW     — worker did not arrive; manager-set terminal state
CANCELLED   — cancelled before or during shift
REASSIGNED  — this leg replaced by a new assignment (terminal for this leg)
```

### `AttendanceStatus`
Lifecycle: `EXPECTED → PRESENT / LATE / PARTIAL / ABSENT / EXCUSED`
```
EXPECTED  — record created pre-shift; worker not yet checked in (default)
PRESENT   — checked in on time and completed shift
ABSENT    — did not arrive and no excuse
LATE      — checked in after expected_start
PARTIAL   — checked in but left early
EXCUSED   — absent with approved reason
```

### `VerificationStatus`
```
PASSED        — quality acceptable
FAILED        — quality unacceptable; no rework requested
NEEDS_REWORK  — rework requested; rework_required = true
```

### `NotificationChannel`
```
IN_APP  EMAIL  PUSH  SMS
```

### `NotificationType`
All notification types are domain events. Adding a type requires a schema migration.
```
-- WorkRequest events
WORK_REQUEST_PUBLISHED
WORK_REQUEST_CANCELLED
WORK_REQUEST_EXPIRING_SOON

-- WorkApplication events
APPLICATION_RECEIVED        — to manager: a worker applied
APPLICATION_ACCEPTED        — to worker: approved
APPLICATION_REJECTED        — to worker: declined
APPLICATION_WITHDRAWN       — to manager: worker withdrew

-- WorkerAssignment events
ASSIGNMENT_CONFIRMED
ASSIGNMENT_CANCELLED
SHIFT_REMINDER              — pre-shift reminder to worker
CHECK_IN_REMINDER           — sent when shift start passes with no check-in

-- Attendance events
ATTENDANCE_VERIFIED         — to worker: manager has verified
WORKER_NO_SHOW              — to manager: worker did not check in

-- Quality & Rating events
QUALITY_VERIFICATION_SUBMITTED
RATING_RECEIVED
REWORK_REQUIRED             — to worker: verification failed, rework needed
```

---

## 3. Final Relationship Map

### Ownership and cascade rules

```
User ──< Session                          [Cascade]
User ──< HotelWorker                      [Cascade]  worker deleted → roster row deleted
User ──< WorkApplication (applicant)      [Cascade]  worker deleted → applications deleted
User ──< WorkApplication (reviewer)       [SetNull]  reviewer deleted → reviewed_by_id nulled
User ──< WorkerAssignment (worker)        [Cascade]  worker deleted → assignments deleted
User ──< WorkerAssignment (manager)       [Restrict] manager cannot be deleted while assignments exist
User ──< Attendance (attendee)            [Cascade]
User ──< Attendance (verifier)            [SetNull]  verifier deleted → verified_by_id nulled
User ──< QualityVerification (verifier)   [Restrict] checker with QV records cannot be deleted
User ──< Rating (rated_worker)            [Cascade]
User ──< Rating (rater)                   [Restrict] rater with rating records cannot be deleted
User ──< WorkerOverallRating              [Cascade]
User ──< Notification                     [Cascade]
User ──< WorkRequest (creator)            [Restrict] creator cannot be deleted while requests exist
User ──< AuditLog (actor)                 [SetNull]  audit trail preserved after actor deletion

Hotel ──< HotelWorker                     [Cascade]
Hotel ──< WorkRequest                     [Cascade]
Hotel ──< WorkerAssignment                [Cascade]
Hotel ──< Attendance                      [Cascade]
Hotel ──< QualityVerification             [Cascade]
Hotel ──< Rating                          [Cascade]
Hotel ──< Notification                    [SetNull]  notification survives hotel deletion

WorkRequest ──< WorkApplication           [Cascade]  request deleted → all applications deleted
WorkRequest ──< WorkerAssignment          [Cascade]  request deleted → all assignments deleted

WorkApplication ──| WorkerAssignment      [Restrict] application cannot be deleted while an
                                                     assignment references it

WorkerAssignment ──| Attendance           [Cascade]  1-to-1
WorkerAssignment ──| QualityVerification  [Cascade]  1-to-1
WorkerAssignment ──| Rating               [Cascade]  1-to-1
WorkerAssignment ──< WorkerAssignment     [SetNull]  self-ref reassignment chain; parent
  (previous_assignment_id)                           deletion breaks chain link, child survives
```

### Mandatory marketplace flow
```
WorkRequest → WorkApplication → WorkerAssignment
```
`WorkerAssignment.application_id` is non-nullable with a FK to `WorkApplication`. There is no bypass path. Every assignment must trace back to an accepted application.

### Reassignment chain
A new `WorkerAssignment` is created with `previous_assignment_id` pointing to the old leg. The old leg transitions to `REASSIGNED`. The new leg opens as `CONFIRMED`. A worker can be re-assigned to the same request only if a new `WorkApplication` exists (original unique constraint `@@unique([work_request_id, worker_id])` on `WorkApplication` is a known boundary — see FU-8).

---

## 4. Final Constraint List

### CHECK constraints (DB-enforced)

| Constraint | Table | Expression |
|---|---|---|
| `WorkRequest_confirmed_lte_needed` | WorkRequest | `workers_confirmed <= workers_needed` |
| `Attendance_checkout_after_checkin` | Attendance | `check_out_at > check_in_at` when both non-null |
| `Attendance_minutes_worked_positive` | Attendance | `minutes_worked >= 0` when non-null |
| `Attendance_minutes_late_positive` | Attendance | `minutes_late >= 0` when non-null |
| `Attendance_verification_pair` | Attendance | `verified_by_id` and `verified_at` must be set together or both null |
| `QualityVerification_score_range` | QualityVerification | `score BETWEEN 0 AND 100` |
| `Rating_score_range` | Rating | `score BETWEEN 1 AND 5` |

### UNIQUE constraints (schema-level)

| Constraint | Table | Columns |
|---|---|---|
| Primary unique | HotelWorker | `(hotel_id, worker_id)` — one roster row per worker per hotel |
| Primary unique | WorkApplication | `(work_request_id, worker_id)` — one application per worker per request |
| Foreign unique | WorkerAssignment | `application_id` — one assignment per application (1-to-1 with WorkApplication) |
| Foreign unique | Attendance | `assignment_id` — one attendance record per assignment |
| Foreign unique | QualityVerification | `assignment_id` — one verification per assignment |
| Foreign unique | Rating | `assignment_id` — one rating per assignment |
| Identity unique | User | `email`, `phone` |
| Identity unique | Session | `refresh_token` |

### UNIQUE partial index (migration-only, cannot be expressed in Prisma)

| Index | Table | Columns | Predicate |
|---|---|---|---|
| `WorkerAssignment_worker_active_per_request_uidx` | WorkerAssignment | `(work_request_id, worker_id)` | `WHERE status IN ('CONFIRMED'::"AssignmentStatus", 'IN_PROGRESS'::"AssignmentStatus")` |

A worker can hold at most one active slot per request. Multiple rows with terminal statuses (`CANCELLED`, `COMPLETED`, `REASSIGNED`) are permitted, enabling the reassignment chain.

### Standard indexes

| Table | Indexed columns |
|---|---|
| User | `role`, `is_active`, `deleted_at` |
| Hotel | `country`, `is_active`, `(city, country)` |
| HotelWorker | `hotel_id`, `worker_id`, `status`, `position` |
| WorkRequest | `hotel_id`, `created_by_id`, `status`, `shift_date`, `position`, `(hotel_id, status, shift_date)`, `published_at` |
| WorkApplication | `work_request_id`, `worker_id`, `status`, `applied_at` |
| WorkerAssignment | `work_request_id`, `worker_id`, `hotel_id`, `status`, `confirmed_at` |
| Attendance | `worker_id`, `hotel_id`, `status`, `check_in_at`, `(worker_id, check_in_at)`, `(hotel_id, is_verified)` |
| QualityVerification | `hotel_id`, `verified_by_id`, `status`, `score` |
| Rating | `hotel_id`, `worker_id`, `rated_by_id`, `score`, `created_at` |
| WorkerOverallRating | `average_score`, `total_ratings` |
| Notification | `user_id`, `hotel_id`, `type`, `created_at`, `(user_id, is_read)` |
| AuditLog | `actor_id`, `action`, `resource_type`, `resource_id`, `timestamp`, `(resource_type, resource_id)` |
| Session | `user_id`, `expires_at` |

---

## 5. Final Concurrency Controls

### Control 1 — Slot-ceiling trigger (MP-10)
**Trigger:** `trg_assignment_check_slot` — `BEFORE INSERT` on `WorkerAssignment`  
**Function:** `check_slot_availability()`  
**Mechanism:** Acquires `SELECT ... FOR UPDATE` row-level lock on the target `WorkRequest` row. Concurrent INSERT attempts on the same request queue behind the lock. Rejects if `workers_confirmed >= workers_needed` or if request status is not `OPEN` or `PARTIALLY_FILLED`.  
**Effect:** Serialises all slot-fill operations for a single WorkRequest; prevents over-filling under concurrent manager load.

### Control 2 — Active-slot double-booking prevention (SP-5, Step 7)
**Index:** `WorkerAssignment_worker_active_per_request_uidx`  
**Type:** Partial unique index  
**Predicate:** `status IN ('CONFIRMED', 'IN_PROGRESS')`  
**Effect:** A worker cannot hold two active slots on the same request simultaneously. Historical terminal rows (CANCELLED, COMPLETED, REASSIGNED) are exempt, enabling the reassignment chain.

### Control 3 — Optimistic locking field (SP-9)
**Column:** `WorkRequest.version INT DEFAULT 0`  
**Mechanism:** Application layer must issue:
```sql
UPDATE "WorkRequest"
SET    ..., version = version + 1
WHERE  id      = $id
  AND  version = $known_version
```
If zero rows are updated, a concurrent write occurred and the operation must be retried.  
**Note (FU-1):** No DB trigger auto-increments `version`. Application-layer discipline is mandatory. See FU-1.

### Control 4 — Duplicate application prevention
**Constraint:** `@@unique([work_request_id, worker_id])` on `WorkApplication`  
**Effect:** A worker cannot submit two applications for the same request. Second INSERT raises a unique violation immediately.

### Control 5 — WorkRequest status sync trigger (Step 17)
**Trigger:** `trg_assignment_sync_confirmed` — `AFTER INSERT OR UPDATE OF status OR DELETE` on `WorkerAssignment`  
**Function:** `sync_workers_confirmed()`  
**Effect:** Keeps `workers_confirmed` counter and `WorkRequest.status` consistent with assignment row count. Guards against writing to `DRAFT`, `CANCELLED`, or `EXPIRED` requests. Stamps `filled_at` on first `FILLED` transition.

### Control 6 — Verification atomicity
**Constraint:** `Attendance_verification_pair` CHECK  
**Effect:** `verified_by_id` and `verified_at` must be written together atomically or both remain null. Prevents partial verification state.

---

## 6. Migration Status

### Migration file
`backend/prisma/migrations/V2_marketplace_migration_plan.sql`

All 18 steps run inside a single `BEGIN / COMMIT` transaction. The file is idempotent: all DDL uses `IF NOT EXISTS` or DO-block guards; all column renames check `information_schema.columns` before executing.

### Step summary

| Step | Operation |
|---|---|
| 1 | Create all ENUMs (8 types + NotificationType) |
| 2 | User: add `email_verified_at`, `phone_verified_at`, `last_login_at`; drop `hotel_ids` |
| 3 | Hotel: add `contact_email`, `contact_phone` |
| 4 | Create `HotelWorker` table |
| 5 | WorkRequest: migrate `status` TEXT→enum; add `workers_confirmed`, `version`, `hourly_rate`, `currency`, `description`, `requirements`, `published_at`, `expires_at`, `cancellation_reason` |
| 6 | Create `WorkApplication` table |
| 7 | WorkerAssignment: migrate `status` TEXT→enum; add `hotel_id`, `application_id` (FK to WorkApplication), `cancelled_at`, `cancellation_reason`, `previous_assignment_id`, `updated_at`; create partial unique index |
| 8 | Create `Attendance` table with all CHECK constraints |
| 9 | QualityVerification: rename status TEXT→enum (rename pattern); add `assignment_id`, `photo_urls`, `rework_required`, `rework_notes`, `rework_completed_at` |
| 10 | Rating: add `assignment_id`, `criteria_scores`, `updated_at`; add score CHECK |
| 11 | WorkerOverallRating: add `total_assignments`, `completion_rate`, `on_time_rate`, `last_worked_at`; fix FK to CASCADE |
| 12 | Notification: add `hotel_id`, `channel`, `sent_at`, `expires_at`; migrate `type` TEXT→NotificationType enum |
| 13 | AuditLog: add `old_values`, `new_values`, `user_agent`, `actor_role` |
| 14 | Drop V1 tables (commented stubs — run post-cutover) |
| 15 | Create `set_updated_at()` function and triggers on all 10 mutable tables |
| 16 | Create `refresh_worker_overall_rating()` trigger on Rating |
| 17 | Create `sync_workers_confirmed()` trigger on WorkerAssignment |
| 18 | Create `check_slot_availability()` BEFORE INSERT trigger on WorkerAssignment |

### Post-migration steps (tracked separately as `V2_post_backfill.sql`)

These steps run outside the transaction after data backfill is validated. They are deployment gate items, not optional.

| Step | SQL | Condition |
|---|---|---|
| 1 | Back-fill `WorkApplication` rows from historic WorkerAssignment data | Before step 2 |
| 2 | `UPDATE "WorkerAssignment" SET application_id = app.id ...` | After step 1 |
| 3 | `ALTER TABLE "WorkerAssignment" ALTER COLUMN "application_id" SET NOT NULL` | After step 2, zero NULLs confirmed |
| 4 | Back-fill `QualityVerification.assignment_id` and `Rating.assignment_id` from task→assignment map | After V1 task data mapped |
| 5 | `ALTER TABLE "QualityVerification" ALTER COLUMN "assignment_id" SET NOT NULL` | After step 4 |
| 6 | `ALTER TABLE "QualityVerification" DROP COLUMN "task_id"` | After step 5 |
| 7 | `ALTER TABLE "Rating" ALTER COLUMN "assignment_id" SET NOT NULL` | After step 4 |
| 8 | `ALTER TABLE "Rating" DROP COLUMN "task_id"` | After step 7 |
| 9 | Back-fill `WorkerOverallRating` aggregates | After Rating rows are final |
| 10 | Populate `Attendance` rows from historic WorkerAssignment completed/no-show data | Before drop |
| 11 | `DROP TABLE "DailyOperation", "TaskPhoto", "Task", "Room"` (in FK order) | After all V1 code paths removed |
| 12 | `ANALYZE` all modified tables | Final step |

### Resolved blockers from audit

| Blocker | Resolution |
|---|---|
| `QualityVerification.status` column collision (H-B1) | Rename pattern with `udt_name = 'text'` guard in Step 9 |
| Non-idempotent `ADD COLUMN status` (H-B2) | All renames in DO blocks; IF NOT EXISTS on ADD COLUMN |
| Full unique constraint on WorkerAssignment broke reassignment (H-B3) | Constraint removed; partial index only |
| `HotelWorkerStatus` enum incorrect (MP-4) | Corrected to `INVITED / ACTIVE / SUSPENDED / REMOVED` |
| `Session` in updated_at trigger loop (MP-5) | Removed; Session has no `updated_at` column |
| Rating DELETE trigger FK violation (MP-6) | Guard: skip upsert when User row no longer exists |
| Sync trigger flipped DRAFT requests (MP-7a) | `DRAFT` added to exclusion list |
| `filled_at` never populated (MP-7b) | Stamped on first FILLED transition in sync trigger |
| `assignment_id` never promoted to NOT NULL (MP-8) | Explicit stubs in post-migration |
| `application_id` had no FK reference (MP-9) | `REFERENCES "WorkApplication"("id") ON DELETE RESTRICT` |
| Slot-fill race condition (MP-10) | `BEFORE INSERT` trigger with `FOR UPDATE` lock |

---

## 7. Known Follow-up Items

These items do not block implementation. All are tracked for a follow-up sprint after initial deployment stabilises. None require a freeze revision.

---

### FU-1 — Wire `WorkRequest.version` increment
**Area:** Concurrency  
**Risk:** `version` column exists but no trigger increments it. Optimistic locking is inert unless the application layer manages it explicitly.  
**Resolution:** Add a `BEFORE UPDATE` trigger that increments `version` when `workers_confirmed` or `status` changes, or document and enforce via a data-access layer wrapper.

```sql
CREATE OR REPLACE FUNCTION increment_work_request_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workers_confirmed <> OLD.workers_confirmed
     OR NEW.status         <> OLD.status THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workrequest_version
  BEFORE UPDATE ON "WorkRequest"
  FOR EACH ROW EXECUTE FUNCTION increment_work_request_version();
```

---

### FU-2 — Maintain `WorkerOverallRating` aggregate fields
**Area:** Data integrity  
**Risk:** `total_assignments`, `completion_rate`, `on_time_rate`, `last_worked_at` are populated by initial backfill only. The existing trigger maintains `average_score` and `total_ratings` but not these fields. Marketplace worker profiles will show stale metrics after deployment.  
**Resolution:** Extend `refresh_worker_overall_rating()` to compute all five aggregate fields, joining `WorkerAssignment` and `Attendance` in addition to `Rating`.

---

### FU-3 — Promote post-migration NOT NULL steps to a tracked migration file
**Area:** Migration safety  
**Risk:** Post-migration steps for `WorkerAssignment.application_id`, `QualityVerification.assignment_id`, and `Rating.assignment_id` NOT NULL promotion are currently comments in the main migration plan. If skipped, the DB schema diverges from the Prisma schema silently.  
**Resolution:** Extract into a standalone `V2_post_backfill.sql` tracked in version control. Add a deployment gate (CI check or runbook checklist item) that blocks V2 production traffic until these columns are promoted.

---

### FU-4 — Add `table_schema` filter to `information_schema.columns` lookups
**Area:** Migration safety  
**Risk:** Six `information_schema.columns` queries in the migration filter on `table_name` only. In a multi-schema database, the same table name in a different schema would cause a false positive, suppressing a required rename.  
**Resolution:** Add `AND table_schema = 'public'` to each of the six lookups in Steps 5, 7, 9, 12.

---

### FU-5 — Enumerate `position` as a typed value
**Area:** Data quality  
**Risk:** `position` on `HotelWorker` and `WorkRequest` is a free `String`. Marketplace shift-matching depends on exact string equality. Case drift (`"Cleaner"` vs `"cleaner"`) or typos silently produce zero matches.  
**Resolution:** Define a `WorkerPosition` enum or a `Position` lookup table, and add a FK on both `HotelWorker.position` and `WorkRequest.position`. If an enum is chosen, note that adding new positions requires a schema migration.

```prisma
enum WorkerPosition {
  CLEANER
  CHECKER
  HOUSEKEEPER
  SUPERVISOR
}
```

---

### FU-6 — Add `workers_needed >= 1` CHECK constraint
**Area:** Constraints  
**Risk:** A `WorkRequest` with `workers_needed = 0` passes all constraints. The sync trigger would mark it `FILLED` immediately upon any assignment, because `v_count >= 0` is always true.  
**Resolution:**
```sql
ALTER TABLE "WorkRequest"
  ADD CONSTRAINT "WorkRequest_workers_needed_positive"
  CHECK ("workers_needed" >= 1);
```

---

### FU-7 — Add soft-delete or deletion guard on `WorkRequest`
**Area:** Referential integrity  
**Risk:** A hard `DELETE` on a `WorkRequest` cascades through `WorkApplication` → `WorkerAssignment` → `Attendance` + `QualityVerification` + `Rating`, destroying all historical operational data. There is no DB-level guard against this.  
**Resolution:** Add `deleted_at DateTime?` to `WorkRequest` (consistent with `User`) and implement soft-delete in the application layer. Alternatively, add a `BEFORE DELETE` trigger that raises an exception if any related `WorkerAssignment` with status `COMPLETED` exists.

---

### FU-8 — Document same-worker reassignment boundary
**Area:** Design documentation  
**Risk:** `@@unique([work_request_id, worker_id])` on `WorkApplication` prevents a second application from the same worker for the same request, even after their prior application reached a terminal state (`WITHDRAWN`, `REJECTED`). This blocks manager-initiated "same worker, new slot" scenarios at the DB level.  
**Resolution:** No schema change required at this time. Add a code comment on `WorkApplication` and an entry in the API layer documentation:
> Re-application by the same worker to the same request is intentionally blocked. If a second application cycle is required (e.g., original assignment was cancelled and manager wants to re-engage the same worker), the application_id FK must point to the original accepted application, or the `ApplicationStatus` lifecycle must be extended with a `SUPERSEDED` terminal state to permit a successor application row.

---

## Approval Record

| Field | Value |
|---|---|
| Status | `APPROVED_WITH_MINOR_FOLLOWUPS` |
| Schema validated | Prisma 5.12 — `The schema at backend/prisma/schema.prisma is valid 🚀` |
| Audit performed | PRISMA_SCHEMA_V2_FREEZE_REVIEW |
| Blockers at freeze | 0 |
| Open follow-up items | 8 (FU-1 through FU-8) |
| Blocking follow-ups | 0 |
| Implementation may begin | Yes |

This document is the canonical reference for all V2 implementation work. Schema changes after this point require a new patch document (`PRISMA_SCHEMA_V2_PATCH_V2`) and a new freeze review cycle.
