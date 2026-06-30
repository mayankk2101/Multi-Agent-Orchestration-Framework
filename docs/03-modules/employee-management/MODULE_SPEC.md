# Employee Management Module — Engineering Specification

**Document type:** Module Engineering Specification (implementation-ready)
**Module:** `employee-management`
**Platform:** Workforce Operations Platform (Hotel CRM) — Marketplace architecture
**Architecture:** Modular monolith (Express.js + TypeScript + Prisma + PostgreSQL)
**Status:** Draft for implementation
**Authoritative sources:** `PRISMA_SCHEMA_V2_FREEZE` (canonical), `MARKETPLACE_REFACTOR_MASTER_PLAN` (pivot design), `SCHEMA_RECONCILIATION_DECISION`, `FINAL_DECISIONS_SUMMARY`, `backend/prisma/schema.prisma`

> **How to read this document.** This is the complete design specification developers implement against. It is not an implementation guide and does not prescribe step-by-step code. Where behaviour is fixed by a confirmed business rule, this document references that rule rather than inventing new behaviour. Where behaviour depends on one of the three known open product questions, it is marked `[OPEN]` and **no answer is invented**. See §30 for the canonical list of the three open questions (OPQ-1, OPQ-2, OPQ-3).

---

## 1. Module Overview

The Employee Management Module owns the **identity, profile, hotel-roster membership, and lifecycle** of the people who perform work on the platform — primarily users with the `WORKER` role, and secondarily `CHECKER` users where they appear on a hotel roster. In the marketplace architecture, an "employee" is modelled by two complementary entities that this module is responsible for:

| Entity | Role in this module | Owning table |
|---|---|---|
| `User` (role `WORKER`/`CHECKER`) | The **global person** — a single platform identity, profile, and credentials, independent of any hotel. | `User` |
| `HotelWorker` | The **employment/roster relationship** — a person's affiliation with a specific hotel, at a position and pay rate, with a lifecycle status. | `HotelWorker` |

A worker exists once globally (`User`) and may appear on the roster of one or more hotels (`HotelWorker`, unique per `(hotel_id, worker_id)`). The Employee Management Module is the single source of truth for **who a worker is** and **which hotels they are an active member of**, and exposes that truth to every downstream module (Marketplace, Attendance, Quality, Onboarding, Contracts).

This module does **not** own the marketplace shift-matching flow (`WorkRequest` → `WorkApplication` → `WorkerAssignment`); that is the Marketplace/Staffing module. Employee Management provides the *eligibility gate* (a worker must be `ACTIVE` on a hotel's roster to be eligible for that hotel's `WorkRequest`s) and the *profile/history surface* the marketplace and worker apps read from.

---

## 2. Purpose

1. Maintain a single, authoritative **worker profile** (name, contact, photo, verification flags, aggregate rating) per platform identity.
2. Maintain the **hotel roster** (`HotelWorker`) — the set of workers affiliated with each hotel, their `position`, `hourly_rate`, and roster `status`.
3. Enforce the **worker/roster lifecycle** (`INVITED → ACTIVE ↔ SUSPENDED → REMOVED`) with guarded, audited state transitions.
4. Provide the **eligibility signal** consumed by the Marketplace module: a worker is eligible for a hotel's shifts only while `HotelWorker.status = ACTIVE`.
5. Surface **worker history and standing** (assignments, attendance outcomes, ratings/`WorkerOverallRating`) for manager decisions and worker self-view.
6. Honour platform-wide **GDPR, audit, and RBAC** obligations for personal data (soft delete, export, PII nulling, scoped access).

---

## 3. Scope

In scope for this module (MVP, marketplace architecture):

- Worker `User` profile read and update (self and manager-scoped).
- Hotel roster management: invite a worker to a hotel, list a hotel's roster, and transition roster status.
- The `HotelWorker` lifecycle state machine and all its transition guards (§16).
- Roster-derived **eligibility** evaluation used by the Marketplace module.
- Read-only **worker history** aggregation (assignments, attendance, ratings) for profile/standing views.
- Maintenance of the denormalised `User.hotel_ids` scoping array on roster changes (MVP behaviour, see §11.4).
- GDPR operations on the worker identity: soft delete (`User.deleted_at`), PII nulling, and data export of employee-owned records.
- Emission of worker-lifecycle domain events and notifications.

---

## 4. Out of Scope

- **Marketplace flow** (`WorkRequest`, `WorkApplication`, `WorkerAssignment`) — owned by Marketplace/Staffing. (`MARKETPLACE_REFACTOR_MASTER_PLAN` Part 4.)
- **Attendance capture** (check-in/out, `Attendance` rows) — owned by Attendance. Employee Management only provides the worker identity these rows reference.
- **Quality verification & rating writes** — owned by Quality. Employee Management only *reads* `WorkerOverallRating` for the profile.
- **HR compliance** — `Contract`, `ContractTemplate`, `ContractLineItem`, `WorkerDocument`, `RequiredDocument`, `Payroll`, `PayrollLineItem` are **Phase 2** and out of MVP scope. (`SCHEMA_RECONCILIATION_DECISION` §2, rows 18–24.)
- **Onboarding workflow** (invitation acceptance UX, document collection) — owned by Onboarding; Employee Management exposes the `INVITED → ACTIVE` transition it drives.
- **Authentication & session issuance** (signup, login, refresh, JWT minting) — owned by Auth. (`README` API Standards; `SCHEMA_RECONCILIATION_DECISION` §7.1.)
- **Legacy task-based concepts** — `Room`, `Task`, `TaskPhoto`, `DailyOperation` are permanently removed and must not be reintroduced. (`SCHEMA_RECONCILIATION_DECISION` §4.3.)
- **Manager and Admin user administration** beyond their relationship to a worker roster.

---

## 5. Responsibilities

| # | Responsibility | Notes |
|---|---|---|
| R1 | Own the worker `User` profile read/update surface | Excludes credentials/auth (Auth module). |
| R2 | Own `HotelWorker` CRUD and lifecycle transitions | The roster is this module's primary aggregate. |
| R3 | Enforce roster lifecycle guards and invariants | §11, §14, §16. |
| R4 | Provide eligibility evaluation to Marketplace | "Is worker X `ACTIVE` on hotel Y?" |
| R5 | Maintain `User.hotel_ids` denormalisation | On every roster status change that affects active membership (§11.4). MVP only. |
| R6 | Aggregate and expose worker history | Reads from `WorkerAssignment`, `Attendance`, `Rating`, `WorkerOverallRating`. |
| R7 | Emit worker-lifecycle domain events & notifications | §18, §20. |
| R8 | Write audit log entries for every roster/profile mutation | §23. |
| R9 | Execute GDPR operations on worker identity | §22. |

---

## 6. Employee Lifecycle

There are two distinct but linked lifecycles. The **roster lifecycle** (`HotelWorker.status`) is the primary employment-relationship lifecycle and is frozen. The **account lifecycle** (`User.is_active` / `User.deleted_at`) is the global identity lifecycle.

### 6.1 Roster lifecycle (`HotelWorker.status`) — frozen

```
INVITED ──accept──▶ ACTIVE ──suspend──▶ SUSPENDED
                      ▲                     │
                      └──────reactivate─────┘
   │                  │                     │
   └──── (decline /   ▼                     ▼
        rescind) ──▶ REMOVED ◀── remove ── (terminal)
```

Canonical lifecycle (`PRISMA_SCHEMA_V2_FREEZE` §2 `HotelWorkerStatus`):
`INVITED → ACTIVE ↔ SUSPENDED → REMOVED (terminal)`.

| Status | Meaning | Timestamp set |
|---|---|---|
| `INVITED` | Roster row created; worker has been invited but has not yet accepted. Default on creation. | `invited_at` (at row creation, SP-2) |
| `ACTIVE` | Worker accepted and is eligible for this hotel's `WorkRequest`s. | `joined_at` (only on `INVITED → ACTIVE`, SP-2) |
| `SUSPENDED` | Temporarily blocked; reversible. Not eligible while suspended. | — |
| `REMOVED` | Worker has left the hotel's roster. Terminal. | `left_at` (on `→ REMOVED`) |

### 6.2 Account lifecycle (`User`)

- A worker `User` is created via Auth signup (open registration in MVP — `SCHEMA_RECONCILIATION_DECISION` §6.3) with `is_active = true`.
- `is_active = false` administratively disables the global identity (login blocked) without removing roster history.
- `deleted_at` (GDPR soft delete) marks the identity for PII nulling by a separate job (§22). The row is retained for referential integrity (`User ──< AuditLog` is `SetNull`; many relations are `Cascade`).

### 6.3 Relationship between the two lifecycles

- A single `User` may be `INVITED`/`ACTIVE`/`SUSPENDED`/`REMOVED` independently on each hotel roster.
- Disabling the account (`is_active = false`) or soft-deleting (`deleted_at`) the `User` overrides all roster eligibility: the worker is ineligible everywhere regardless of `HotelWorker.status`.

---

## 7. Employee Status Model

### 7.1 `HotelWorkerStatus` enum (frozen — adding a value requires a migration)

```
INVITED    — initial state; row created, acceptance pending  (DEFAULT)
ACTIVE     — accepted and eligible for shifts
SUSPENDED  — temporarily blocked; reversible
REMOVED    — terminal; worker has left the hotel's roster
```

> Note: V1 `INACTIVE` was removed and `INVITED` + `REMOVED` added (schema comment SP-1). Do not reference `INACTIVE`.

### 7.2 Derived eligibility flag

`isEligible(worker, hotel) = (HotelWorker.status == ACTIVE) AND User.is_active AND User.deleted_at IS NULL`.

This is the single predicate the Marketplace module must consult before allowing a `WorkApplication` from a worker to a hotel's `WorkRequest`.

### 7.3 `UserRole` (frozen)

`WORKER`, `CHECKER`, `MANAGER`, `ADMIN`. Role is a **capability**, roster membership is a **relationship** — they are independent (`MARKETPLACE_REFACTOR_MASTER_PLAN` Decision Log D3 = option B: keep `WORKER` + `HotelWorker` join; no `HOTEL_WORKER` role). Employee Management manages roster rows for `WORKER` and `CHECKER` identities.

---

## 8. Employee Profile Structure

The profile is the union of the global `User` fields this module exposes and the per-hotel `HotelWorker` fields.

### 8.1 Global identity — `User` (subset owned/exposed here)

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK. |
| `email` | `String` unique | Owned by Auth for writes; read here. |
| `first_name`, `last_name` | `String` | Editable via this module. |
| `phone` | `String?` unique | Editable; uniqueness enforced by DB. |
| `profile_photo_url` | `String?` | Object-storage URL (S3). |
| `role` | `UserRole` | Read-only here (role changes are an Auth/Admin concern). |
| `permissions` | `String[]` | Granular permission codes; read-only here. |
| `is_active` | `Boolean` | Account enable/disable. |
| `email_verified_at`, `phone_verified_at` | `DateTime?` | Verification flags (set by Auth). |
| `last_login_at` | `DateTime?` | Read-only. |
| `deleted_at` | `DateTime?` | GDPR soft delete (§22). |
| `hotel_ids` | `String[]` | MVP denormalised scope array (§11.4). Maintained by this module. |
| `created_at`, `updated_at` | `DateTime` | Audit timestamps. |

### 8.2 Roster membership — `HotelWorker`

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK. |
| `hotel_id` | `String` | FK → `Hotel` (`onDelete: Cascade`). |
| `worker_id` | `String` | FK → `User` (`onDelete: Cascade`). |
| `position` | `String` | Free-text role at this hotel (`"cleaner" | "checker" | "housekeeper" | "supervisor"`). **Taxonomy is `[OPEN]` — see OPQ-2.** |
| `status` | `HotelWorkerStatus` | Default `INVITED` (SP-1/SP-2). |
| `hourly_rate` | `Decimal(10,2)?` | Per-hotel pay rate. |
| `currency` | `String` | Default `"EUR"`. |
| `notes` | `String?` | Free-text manager notes. |
| `invited_at` | `DateTime` | Set at row creation. |
| `joined_at` | `DateTime?` | Set only on `INVITED → ACTIVE`. |
| `left_at` | `DateTime?` | Set on `→ REMOVED`. |
| `created_at`, `updated_at` | `DateTime` | |

Constraint: `@@unique([hotel_id, worker_id])` — a worker appears on a hotel's roster exactly once. Indexes: `hotel_id`, `worker_id`, `status`, `position`.

### 8.3 Aggregate standing — `WorkerOverallRating` (read-only here)

Exposed on the profile, owned/maintained by Quality:
`average_score`, `total_ratings`, `total_assignments`, `completion_rate`, `on_time_rate`, `last_worked_at`.

> **Known data-integrity caveat (FU-2):** `total_assignments`, `completion_rate`, `on_time_rate`, `last_worked_at` are currently populated by backfill only; the live trigger maintains only `average_score` and `total_ratings`. Until FU-2 is implemented, the profile must label these four fields as potentially stale or compute them on read. Do not present them as authoritative without that caveat.

### 8.4 Skills

The presence, representation, and ownership of a worker **skills** attribute is `[OPEN]` — see **OPQ-1**. See §9.

---

## 9. Skills

The marketplace pivot draft (`MARKETPLACE_REFACTOR_MASTER_PLAN`, "Full New Schema Definitions") proposed `HotelWorker.skills String[] @default([])`. The **frozen canonical schema (`PRISMA_SCHEMA_V2_FREEZE`) does not include a `skills` field** on `HotelWorker` or `User`; the only capability descriptor that survived the freeze is the single free-text `position` on `HotelWorker` and the free-text `WorkRequest.requirements` string.

Consequently:

- There is **no confirmed storage location, type, or matching semantics for skills**. This is the substance of **OPQ-1** (§30).
- `[OPEN]` Until OPQ-1 is resolved, this module **must not** invent a skills field, a skills table, or skills-based matching. Shift matching in MVP is by `position` string equality plus the free-text `WorkRequest.requirements` (human-read), per the frozen schema.
- `[OPEN]` If/when skills are confirmed, the design must specify: (a) global (`User`) vs per-hotel (`HotelWorker`) ownership; (b) free-text array vs controlled vocabulary; (c) whether marketplace matching uses them. None of these may be assumed here.

Implementation directive: build the profile read/write surface so that a future `skills` attribute can be added additively (e.g. an optional, separately versioned profile sub-resource) without breaking existing consumers.

---

## 10. Worker History

Worker history is a **read-only aggregation** this module composes from records owned by downstream modules. It does not create or mutate these rows.

| History element | Source table | Owning module | Key fields surfaced |
|---|---|---|---|
| Assignments | `WorkerAssignment` (relation `assigned_worker`) | Marketplace | `status`, `confirmed_at`, `started_at`, `completed_at`, `cancellation_reason`, reassignment chain |
| Attendance outcomes | `Attendance` (relation `attendee`) | Attendance | `status` (`PRESENT/LATE/PARTIAL/ABSENT/EXCUSED`), `check_in_at`, `check_out_at`, `minutes_late`, `minutes_worked`, `is_verified` |
| Ratings received | `Rating` (relation `rated_worker`) | Quality | `score` (1–5), `criteria_scores`, `created_at` |
| Quality verifications | `QualityVerification` via assignment | Quality | `score` (0–100), `status`, `rework_required` |
| Aggregate standing | `WorkerOverallRating` | Quality | see §8.3 |
| Roster history | `HotelWorker` | This module | per-hotel `status`, `invited_at`, `joined_at`, `left_at` |

Query path notes (from frozen indexes, `PRISMA_SCHEMA_V2_FREEZE` §4):
- "Worker's shifts in a date range" → `Attendance(worker_id, check_in_at)` composite index.
- "Worker's assignments" → `WorkerAssignment.worker_id` index.
- "Worker's ratings" → `Rating.worker_id` index.

History reads must respect data-access scoping (§13): a manager sees history only for workers on a hotel they have access to; a worker sees only their own.

---

## 11. Employment Rules

These are confirmed business rules. Where a rule is fixed by schema/constraints it is cited.

### 11.1 Single roster row per worker per hotel
`@@unique([hotel_id, worker_id])`. A second enrolment attempt for the same pair must be rejected (`409`/`EMPLOYEE_ALREADY_ON_ROSTER`) — the correct action on an existing row is a status transition, not a new row.

### 11.2 Eligibility requires `ACTIVE`
A worker must be `ACTIVE` on a hotel's roster to be eligible for that hotel's `WorkRequest`s (`schema.prisma` `HotelWorker` comment; §7.2). `INVITED`, `SUSPENDED`, and `REMOVED` workers are ineligible.

### 11.3 Lifecycle timestamps are write-once per transition
`invited_at` set at creation; `joined_at` set **only** on the `INVITED → ACTIVE` transition (SP-2); `left_at` set on `→ REMOVED`. Re-activation from `SUSPENDED → ACTIVE` does **not** rewrite `joined_at`.

### 11.4 `User.hotel_ids` denormalisation (MVP)
`User.hotel_ids` is the scope array read by `permissions.ts::checkHotelAccess()` and embedded into the JWT (`jwt.ts::AccessTokenPayload`) at sign-in (`SCHEMA_RECONCILIATION_DECISION` §3.1). This module must keep it consistent with roster membership:
- On `INVITED → ACTIVE`: add `hotel_id` to the worker's `hotel_ids` if absent.
- On `→ REMOVED`: remove `hotel_id` from `hotel_ids`.
- `[OPEN-adjacent / confirmed rule]` On `→ SUSPENDED`: membership for scope purposes is retained or removed per the suspension semantics defined in §16; the spec's default (§16) is to **retain** `hotel_ids` during suspension and rely on the `status != ACTIVE` eligibility check, because suspension is reversible.
- The cleaner derived model (`hotel_ids` computed from `HotelWorker WHERE status = ACTIVE`) is explicitly a **Phase 2 refactor** (`SCHEMA_RECONCILIATION_DECISION` §3.1). Do not implement derivation in MVP.
- Because Postgres cannot FK an array element, referential integrity of `hotel_ids ⊆ Hotel.id` is an application-layer obligation (`SCHEMA_RECONCILIATION_DECISION` §5.1.3).

### 11.5 Manager deletion is restricted by downstream FKs
A `MANAGER` who created `WorkRequest`s or `WorkerAssignment`s cannot be hard-deleted (`onDelete: Restrict` on `WorkRequest.created_by`, `WorkerAssignment.assigned_by`). This constrains admin operations that touch manager identities (§24).

### 11.6 Removing a worker does not destroy operational history
`REMOVED` is a roster status, not a deletion. Assignments, attendance, and ratings remain. Hard deletion of a `User` cascades to many child rows (§12) and is reserved for GDPR erasure executed by the dedicated job, not roster management.

### 11.7 Position taxonomy
`position` is a free `String` in the frozen schema; exact string equality drives matching. Case drift/typos silently produce zero matches (FU-5). Enumerating `position` is **OPQ-2** `[OPEN]`.

---

## 12. Relationships with Other Modules

### 12.1 Data-model relationships (from `PRISMA_SCHEMA_V2_FREEZE` §3)

```
User ──< HotelWorker            [Cascade]   worker deleted → roster rows deleted
User ──< WorkerAssignment(worker)[Cascade]
User ──< Attendance(attendee)    [Cascade]
User ──< Rating(rated_worker)    [Cascade]
User ──< WorkerOverallRating     [Cascade]
User ──< Notification            [Cascade]
User ──< AuditLog(actor)         [SetNull]  audit trail preserved after actor deletion
User ──< WorkRequest(creator)    [Restrict] (managers)
User ──< WorkerAssignment(mgr)   [Restrict] (managers)
Hotel ──< HotelWorker            [Cascade]
```

### 12.2 Integration points (required by platform)

| Module | Direction | Integration |
|---|---|---|
| **Marketplace/Staffing** | EM → MP | Provides eligibility (`status == ACTIVE`) gate before `WorkApplication`. MP reads `position`, `hourly_rate`. EM consumes `ApplicationAccepted`/`AssignmentCompleted` for history/standing. |
| **Attendance** | EM → ATT | `Attendance` rows reference the worker identity EM owns. EM consumes attendance outcomes for history; ATT relies on EM eligibility at shift time. |
| **Onboarding** | ONB → EM | Onboarding drives the `INVITED → ACTIVE` acceptance handshake and (Phase 2) document collection; EM exposes the transition endpoint Onboarding calls. See §12.3. |
| **Quality** | QUA → EM | Quality writes `Rating`/`QualityVerification` → `WorkerOverallRating`; EM reads the aggregate for the profile (subject to FU-2 caveat). |
| **Notifications** | EM → NOTIF | EM emits worker-lifecycle notifications via the typed `NotificationType` dispatch (§20). |
| **Contracts (HR)** | EM ↔ HR (Phase 2) | A future `Contract` anchors on the `(worker, hotel)` roster relationship EM owns. **Deferred — out of MVP scope** (`SCHEMA_RECONCILIATION_DECISION` §2). See §12.4. |
| **Calendar** | EM → CAL (forward-looking) | A future Calendar/availability module would consume roster membership and assignment data. **The legacy Calendar module is removed in the pivot** (`MARKETPLACE_REFACTOR_MASTER_PLAN` Part 4: `calendar/` = REMOVE). See §12.5. |
| **Auth** | AUTH → EM | Auth owns identity creation, credentials, JWT; EM owns profile/roster. EM never mints tokens. |
| **Compliance/Audit** | EM → AUDIT | Every mutation writes `AuditLog` (§23). |

### 12.3 Onboarding integration detail
The `INVITED → ACTIVE` transition is the onboarding completion signal. Whether Onboarding *gates* activation on document/consent completion is a Phase 2 / Onboarding-module concern; in MVP, EM exposes an idempotent activation endpoint and emits `EmployeeActivated`. `[OPEN-adjacent]` Any document-collection precondition belongs to Onboarding and is not modelled here.

### 12.4 Contracts integration detail
`Contract`, `ContractTemplate`, `ContractLineItem` are **Phase 2** (`SCHEMA_RECONCILIATION_DECISION` rows 18–20), to be normalised to a `ContractStatus`/`EmploymentType` enum on introduction (§4.1 of that doc). EM's roster row is the join these will reference. MVP exposes no contract endpoints and stores no contract data.

### 12.5 Calendar integration detail
The marketplace pivot deletes the legacy `calendar/` module (it depended on the removed `DailyOperation`). Per-shift scheduling is now expressed through `WorkRequest`/`WorkerAssignment`. Any worker-availability/calendar feature (shift swap, external sync) is **Phase 2** (`FINAL_DECISIONS_SUMMARY`, deferred list). EM exposes roster membership a future Calendar module could read; EM does not implement scheduling.

---

## 13. Permissions

All endpoints enforce JWT auth + RBAC (`README` API Standards; permissions via `middleware/permissions.ts`). Two enforcement layers apply:

1. **Role/permission check** — `requireRole(...)` and/or granular permission codes on `User.permissions` (e.g. `employee:read`, `employee:write`, `roster:manage`).
2. **Hotel scoping** — `checkHotelAccess()` validates the actor's `hotel_ids` (managers) against the target `hotel_id`. Admins bypass hotel scoping.

| Action | WORKER (self) | WORKER (other) | CHECKER | MANAGER (own hotels) | ADMIN |
|---|---|---|---|---|---|
| Read own profile | ✅ | — | ✅(self) | ✅(self) | ✅ |
| Read another worker's profile | ❌ | ❌ | ❌ | ✅ (roster member of accessible hotel) | ✅ |
| Update own profile (name, phone, photo) | ✅ | ❌ | ✅(self) | ✅(self) | ✅ |
| Update another worker's profile | ❌ | ❌ | ❌ | ⚠️ limited roster fields only (`position`, `hourly_rate`, `notes`) | ✅ |
| List a hotel's roster | ❌ | ❌ | ❌ | ✅ (accessible hotel) | ✅ |
| Invite worker to hotel (`create HotelWorker`) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Activate / suspend / reactivate / remove roster member | ❌ | ❌ | ❌ | ✅ | ✅ |
| View any worker's full history | ✅(self) | ❌ | ❌ | ✅ (accessible hotel) | ✅ |
| Disable account (`is_active`) | ❌ | ❌ | ❌ | ❌ | ✅ |
| GDPR export / erasure | ✅(self request) | ❌ | — | ❌ | ✅ (execute) |

> The granular permission-code vocabulary above is consistent with `User.permissions String[]` and `getDefaultPermissions`/`ROLE_PERMISSIONS` in `config/constants.ts` (`SCHEMA_RECONCILIATION_DECISION` §7.1). Final code strings must be sourced from that constants file, not redefined here.

---

## 14. Business Rules

| ID | Rule | Source |
|---|---|---|
| BR-1 | A worker has exactly one roster row per hotel. | `@@unique([hotel_id, worker_id])` |
| BR-2 | Roster rows are created in `INVITED`. | `HotelWorker.status @default(INVITED)` (SP-1/SP-2) |
| BR-3 | Only `ACTIVE` roster members are eligible for that hotel's shifts. | schema comment; §7.2 |
| BR-4 | `joined_at` is set once, on `INVITED → ACTIVE`. | SP-2 |
| BR-5 | `left_at` is set on `→ REMOVED`; `REMOVED` is terminal. | §6.1, schema comment |
| BR-6 | `SUSPENDED ↔ ACTIVE` is the only reversible pair. | frozen lifecycle |
| BR-7 | `User.hotel_ids` reflects active membership (MVP denormalisation). | `SCHEMA_RECONCILIATION_DECISION` §3.1 |
| BR-8 | Role and roster membership are independent. | Decision Log D3 = B |
| BR-9 | Removing a worker preserves operational history. | §11.6 |
| BR-10 | Managers cannot be hard-deleted while owning requests/assignments. | `onDelete: Restrict` |
| BR-11 | Payroll/contract data is not handled in MVP. | `SCHEMA_RECONCILIATION_DECISION` §2 |
| BR-12 | Skills are not modelled until OPQ-1 is resolved. | §9 `[OPEN]` |
| BR-13 | `position` matching is exact string equality (taxonomy unresolved). | FU-5; OPQ-2 `[OPEN]` |

---

## 15. Validation Rules

Validation uses **Zod** for all request bodies (`README` API Standards). All writes additionally rely on DB constraints as the final guard.

### 15.1 Profile update (`User` subset)
- `first_name`, `last_name`: non-empty, trimmed, length 1–100.
- `phone`: optional; E.164-style format; uniqueness enforced by DB (`User.phone @unique`) → map violation to `409 PHONE_TAKEN`.
- `profile_photo_url`: optional; must be a URL in the platform object-storage namespace (S3 bucket).
- `email`, `role`, `permissions`, `is_active`, verification flags: **not** accepted on this module's profile-update endpoint (Auth/Admin only).

### 15.2 Roster create (`HotelWorker`)
- `hotel_id`: required; must reference an existing, non-deleted `Hotel`; actor must have hotel access.
- `worker_id`: required; must reference an existing `User` with `is_active = true`, `deleted_at IS NULL`, and `role IN (WORKER, CHECKER)`.
- `position`: required, non-empty string. `[OPEN]` (OPQ-2) — if a `WorkerPosition` enum/lookup is later confirmed, this becomes an enum/FK check; until then validate as non-empty trimmed string. Recommend normalising case to avoid FU-5 drift, but normalisation policy itself is part of OPQ-2.
- `hourly_rate`: optional `Decimal(10,2)`, `>= 0`.
- `currency`: ISO-4217; default `EUR`.
- Reject if a roster row already exists for `(hotel_id, worker_id)` → `409 EMPLOYEE_ALREADY_ON_ROSTER` (BR-1).

### 15.3 Status transition requests
- Target status must be a legal successor of current status (§16); otherwise `422 INVALID_STATE_TRANSITION`.
- Transition endpoints are idempotent where the target equals the current legal end-state (e.g. re-activating an already-`ACTIVE` member is a no-op `200`, not an error) — except transitions out of the terminal `REMOVED` state, which are always rejected.

### 15.4 Cross-field/lifecycle invariants (enforced in service + DB)
- `joined_at` must be null while `status = INVITED`; non-null once `ACTIVE` has been reached.
- `left_at` non-null iff `status = REMOVED`.
- A `WorkRequest`-eligibility check must re-read `HotelWorker.status` at evaluation time, never trust a cached flag.

---

## 16. State Transitions

### 16.1 `HotelWorker.status` transition table

| From | Event / endpoint | To | Guard | Side effects |
|---|---|---|---|---|
| — | `inviteWorker` (POST roster) | `INVITED` | worker eligible to be invited (§15.2); no existing row | set `invited_at`; emit `EmployeeInvited`; audit `CREATE`; notify `[OPEN]` (no `NotificationType` for invite — see §20) |
| `INVITED` | `activate` (accept) | `ACTIVE` | actor authorised (Onboarding/Manager/Admin) | set `joined_at`; add `hotel_id` to `User.hotel_ids`; emit `EmployeeActivated`; audit `UPDATE` |
| `INVITED` | `rescind` / `decline` | `REMOVED` | — | set `left_at`; emit `EmployeeRemoved`; audit `UPDATE` |
| `ACTIVE` | `suspend` | `SUSPENDED` | manager/admin | retain `hotel_ids` (§11.4); emit `EmployeeSuspended`; audit `UPDATE` |
| `SUSPENDED` | `reactivate` | `ACTIVE` | manager/admin | **do not** rewrite `joined_at` (BR-4); emit `EmployeeReactivated`; audit `UPDATE` |
| `ACTIVE` | `remove` | `REMOVED` | manager/admin | set `left_at`; remove `hotel_id` from `User.hotel_ids`; emit `EmployeeRemoved`; audit `UPDATE` |
| `SUSPENDED` | `remove` | `REMOVED` | manager/admin | set `left_at`; remove `hotel_id` from `User.hotel_ids`; emit `EmployeeRemoved`; audit `UPDATE` |
| `REMOVED` | any | — | **rejected** `422` (terminal) | — |

Illegal transitions (e.g. `INVITED → SUSPENDED`, `REMOVED → ACTIVE`, `ACTIVE → INVITED`) must return `422 INVALID_STATE_TRANSITION`.

### 16.2 Re-engagement of a removed worker
Re-inviting a previously `REMOVED` worker to the **same** hotel is constrained by `@@unique([hotel_id, worker_id])`: the terminal `REMOVED` row already occupies the pair. Whether re-engagement (a) reuses/re-opens the existing row, or (b) requires a successor model, is governed by the same product policy as marketplace re-application (**OPQ-3**, FU-8). `[OPEN]` — do not implement re-engagement of a `REMOVED` roster row until OPQ-3 is resolved. MVP behaviour: re-invite to a hotel where a `REMOVED` row exists returns `409 EMPLOYEE_ALREADY_ON_ROSTER` with an explanatory `details.reason = "removed_member_requires_reengagement_policy"`.

### 16.3 Account-lifecycle transitions (`User`)
| From | Event | To | Effect |
|---|---|---|---|
| `is_active=true` | admin disable | `is_active=false` | login blocked; eligibility false everywhere; audit |
| `is_active=false` | admin enable | `is_active=true` | restore; audit |
| `deleted_at=null` | GDPR erasure request approved | `deleted_at=set` | schedule PII nulling job (§22); audit |

---

## 17. APIs Exposed by the Module

All responses use the platform envelope (`README`):
```json
{ "success": true, "data": { }, "error": null }
```
Errors use:
```json
{ "success": false, "data": null, "error": { "code": "STRING_CODE", "message": "…", "details": {} } }
```
All routes are under `/api/v1`. Auth: `Authorization: Bearer <jwt>`. Validation: Zod. RBAC per §13.

### 17.1 Worker profile

| Method | Path | Description | Permission |
|---|---|---|---|
| `GET` | `/employees/me` | Current worker's full profile + standing | self |
| `GET` | `/employees/:workerId` | A worker's profile | self / manager (accessible hotel) / admin |
| `PATCH` | `/employees/:workerId` | Update editable profile fields (§15.1) | self (own profile) / admin |
| `GET` | `/employees/:workerId/history` | Aggregated work history (§10), paginated, filterable by hotel/date/status | self / manager (accessible hotel) / admin |
| `GET` | `/employees/:workerId/rosters` | All `HotelWorker` rows for the worker (scoped to caller's visibility) | self / manager / admin |

### 17.2 Hotel roster (reuses the marketplace-plan CRM surface)

These align with `MARKETPLACE_REFACTOR_MASTER_PLAN` Part 4 "Additions — CRM module". Path prefix may be `/crm/hotels/...` (per that plan) or `/hotels/...`; the canonical prefix is whatever the Hotels module registers — **reuse it, do not fork a parallel route**.

| Method | Path | Description | Permission |
|---|---|---|---|
| `GET` | `/hotels/:hotelId/workers` | List the hotel's roster (filter by `status`, `position`) | manager (accessible) / admin |
| `POST` | `/hotels/:hotelId/workers` | Invite/enrol a worker → creates `HotelWorker` (`INVITED`) | manager / admin |
| `GET` | `/hotels/:hotelId/workers/:workerId` | Roster row detail | manager / admin |
| `PATCH` | `/hotels/:hotelId/workers/:workerId` | Update roster fields (`position`, `hourly_rate`, `currency`, `notes`) | manager / admin |
| `POST` | `/hotels/:hotelId/workers/:workerId/activate` | `INVITED → ACTIVE` | onboarding / manager / admin |
| `POST` | `/hotels/:hotelId/workers/:workerId/suspend` | `ACTIVE → SUSPENDED` | manager / admin |
| `POST` | `/hotels/:hotelId/workers/:workerId/reactivate` | `SUSPENDED → ACTIVE` | manager / admin |
| `DELETE` | `/hotels/:hotelId/workers/:workerId` | `→ REMOVED` (soft, sets `left_at`) | manager / admin |

> The marketplace plan lists `DELETE /crm/hotels/:id/workers/:worker_id` as "Remove enrollment". This module implements it as the `→ REMOVED` status transition (soft), **not** a hard row delete, per BR-5/BR-9.

### 17.3 Eligibility (internal, in-process)

Exposed as an in-process service function for the Marketplace module (modular monolith — in-process call, not HTTP):
`employeeService.isEligible(workerId, hotelId): Promise<boolean>` and `getActiveRoster(hotelId)`. No public HTTP route required.

### 17.4 GDPR (worker identity)

| Method | Path | Description | Permission |
|---|---|---|---|
| `GET` | `/employees/:workerId/export` | Export employee-owned data (§22) | self / admin |
| `POST` | `/employees/:workerId/erasure` | Request/execute GDPR erasure (§22) | self (request) / admin (execute) |

> Note: a broader `/auth/account/export` exists but is **deferred to Phase 2** because it depends on Phase 2 HR models (`SCHEMA_RECONCILIATION_DECISION` §6.2). The EM export here covers only MVP employee-owned tables.

### 17.5 Pagination, filtering, errors
- List endpoints: cursor or offset pagination, default page size 20, max 100.
- Standard error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `EMPLOYEE_ALREADY_ON_ROSTER`, `INVALID_STATE_TRANSITION`, `PHONE_TAKEN`, `CONFLICT`.

---

## 18. Events Emitted

In the modular monolith these are **in-process domain events** (the platform's internal event bus / EVENT_FLOW convention), each also producing an `AuditLog` row and, where a `NotificationType` exists, a notification.

| Event | When | Payload (key fields) | Downstream consumers |
|---|---|---|---|
| `EmployeeInvited` | `HotelWorker` created (`INVITED`) | `hotelWorkerId`, `hotelId`, `workerId`, `position`, `invitedBy` | Onboarding, Notifications |
| `EmployeeActivated` | `INVITED → ACTIVE` | `hotelWorkerId`, `hotelId`, `workerId`, `joinedAt` | Marketplace (eligibility), Notifications, Analytics |
| `EmployeeSuspended` | `ACTIVE → SUSPENDED` | `hotelWorkerId`, `hotelId`, `workerId`, `reason?` | Marketplace, Notifications |
| `EmployeeReactivated` | `SUSPENDED → ACTIVE` | `hotelWorkerId`, `hotelId`, `workerId` | Marketplace, Notifications |
| `EmployeeRemoved` | `→ REMOVED` | `hotelWorkerId`, `hotelId`, `workerId`, `leftAt`, `reason?` | Marketplace (revoke eligibility), Notifications, Analytics |
| `EmployeeProfileUpdated` | Profile fields changed | `workerId`, changed field set | Notifications (optional), Analytics |
| `EmployeeAccountDisabled` | `is_active → false` | `workerId` | Marketplace, Auth (session revocation), Notifications |
| `EmployeeErasureScheduled` | `deleted_at` set | `workerId` | Compliance, all PII-holding modules |

> `[OPEN]` There is **no `NotificationType` enum value** for worker invitation/activation/suspension/removal in the frozen `NotificationType` set (§20). Emitting an in-app/push notification for these lifecycle events requires adding enum values (a schema migration). See §20.

---

## 19. Events Consumed

| Event | Source module | EM reaction |
|---|---|---|
| `ApplicationAccepted` / `AssignmentConfirmed` | Marketplace | Optionally refresh worker standing cache; no roster mutation (assignment presupposes `ACTIVE`). |
| `AssignmentCompleted` | Marketplace | Trigger/await `WorkerOverallRating` refresh (Quality owns the write); update `last_worked_at` view (FU-2 caveat). |
| `RatingReceived` | Quality | Invalidate any cached profile standing. |
| `AttendanceVerified` / `WorkerNoShow` | Attendance | Feed history/standing views; no automatic roster status change in MVP. |
| `HotelDeleted` | Hotels | `HotelWorker` rows cascade-delete (`Hotel ──< HotelWorker [Cascade]`); EM reconciles affected workers' `hotel_ids`. |
| `WorkerSignedUp` | Auth | New `User`; no roster row until invited. |

> Confirmed rule: a `WorkerAssignment` cannot exist without an accepted `WorkApplication`, which presupposes an `ACTIVE` roster member — so EM never needs to *create* eligibility in response to a marketplace event. (`PRISMA_SCHEMA_V2_FREEZE` §3 "Mandatory marketplace flow".)

---

## 20. Notifications

Notifications use the typed `NotificationType` enum and `NotificationChannel` (`IN_APP`, `EMAIL`, `PUSH`, `SMS`) via the Notifications module's dispatch (SP-8). **Adding a `NotificationType` value requires a schema migration** (frozen enum).

### 20.1 Relevant existing notification types
The frozen `NotificationType` set is oriented to the marketplace flow (`APPLICATION_*`, `ASSIGNMENT_*`, `ATTENDANCE_*`, `QUALITY_*`, `RATING_RECEIVED`, `WORK_REQUEST_*`). EM consumes none of these directly for its own lifecycle.

### 20.2 Gap — worker-lifecycle notifications
`[OPEN]` There is **no** `NotificationType` value for: invitation issued, invitation accepted/activated, suspension, reactivation, or removal. The frozen enum does not cover EM lifecycle events. To notify workers/managers of roster lifecycle changes, the design must add enum values (e.g. `EMPLOYEE_INVITED`, `EMPLOYEE_ACTIVATED`, `EMPLOYEE_SUSPENDED`, `EMPLOYEE_REMOVED`) via migration. This is flagged as a known gap; the channel/recipient matrix below assumes those values exist once added. Until then, EM emits only the in-process domain events (§18) and audit rows, without push/in-app notifications.

### 20.3 Intended notification matrix (pending enum additions)
| Trigger | Recipient | Channels | Locale |
|---|---|---|---|
| Invitation issued | invited worker | `EMAIL` + `PUSH` + `IN_APP` | worker's preferred locale (platform is multi-language; `FINAL_DECISIONS_SUMMARY`) |
| Activation | worker + inviting manager | `IN_APP` (+ `PUSH`) | per recipient |
| Suspension / Reactivation | worker | `IN_APP` (+ `EMAIL`) | worker locale |
| Removal | worker | `IN_APP` (+ `EMAIL`) | worker locale |

> Notification-preference management (quiet hours, per-type opt-out) is **Phase 2 deferred** (`FINAL_DECISIONS_SUMMARY`). MVP sends on all enabled channels.

---

## 21. Security

- **AuthN:** JWT bearer on every endpoint (`README`). No anonymous access except where Auth (not EM) intends it.
- **AuthZ:** RBAC role/permission checks + `checkHotelAccess()` hotel scoping (§13). Permission middleware must never be bypassed (`README` "Never").
- **Hotel-scoped data isolation:** Managers may only read/mutate roster rows and profiles for workers on hotels in their `hotel_ids`. Cross-hotel reads are `403`.
- **Least exposure of PII:** Profile responses exclude `password_hash` (never select it), and exclude another worker's contact details from non-authorised callers.
- **Input validation:** Zod on all bodies; reject unknown fields on profile update (prevent privilege escalation via `role`/`permissions`/`is_active`).
- **Object storage:** `profile_photo_url` writes go to the platform S3 namespace with private ACLs; signed URLs for reads where the asset is non-public.
- **Transport & residency:** TLS in transit; all data resident in EU (`eu-central-1`/Frankfurt) — EU-only deployment is a confirmed platform constraint (`README`, `FINAL_DECISIONS_SUMMARY`).
- **No payroll exposure:** EM never reads/writes payroll (Phase 2 + "Never expose payroll broadly", `README`).

---

## 22. GDPR Considerations

EU-only deployment provides data-residency compliance by construction (`FINAL_DECISIONS_SUMMARY`, `FINAL_CONFIRMED_ARCHITECTURE` §6). EM-specific obligations:

- **Right to erasure (soft delete):** `User.deleted_at` marks the identity; a **separate PII-nulling job** nulls PII fields (name, email, phone, photo) while preserving the row for referential integrity (schema comment on `User.deleted_at`). EM sets `deleted_at` and emits `EmployeeErasureScheduled`; the job performs the nulling. Hard cascade delete (which removes `HotelWorker`, assignments, attendance, ratings via `Cascade`) is used only where full erasure is legally required and operationally safe.
- **Audit-trail preservation under erasure:** `AuditLog.actor` is `SetNull` — erasing a user preserves the audit history with a null actor (`PRISMA_SCHEMA_V2_FREEZE` §3). This is intentional and must not be "fixed" to cascade.
- **Right to access / portability (export):** `/employees/:id/export` returns the worker's EM-owned data (profile, roster rows, assignment/attendance/rating history) as JSON/CSV. The Phase-1 export covers only MVP tables; the full `exportUserData` (incl. contracts/payroll/documents) is **Phase 2** (`SCHEMA_RECONCILIATION_DECISION` §7.1).
- **Right to rectification:** profile-update endpoints (§17.1).
- **Consent:** `ConsentLog` is a **Phase 2** model (`SCHEMA_RECONCILIATION_DECISION` row 26); MVP EM does not record granular consent. Do not assume a consent gate on activation in MVP.
- **Retention:** the confirmed retention schedule (`FINAL_DECISIONS_SUMMARY`: Contracts 3y, Payroll 7y, Documents 1y, Ratings 2y) applies to **Phase 2 HR/Quality data**, executed by the retention job — not by EM directly. EM holds no retention-scheduled data of its own in MVP beyond `Rating` history it merely reads.
- **Encryption:** HR documents/payroll encryption at rest is a platform requirement for Phase 2 data; EM's MVP data is standard at-rest encrypted (AES-256, `FINAL_CONFIRMED_ARCHITECTURE` §6).

---

## 23. Audit Logging

Every state-changing EM operation writes an append-only `AuditLog` row (never mutated; no `updated_at`).

| Field | Value for EM |
|---|---|
| `actor_id` / `actor_role` | the authenticated caller (`SetNull` on later erasure) |
| `action` | `CREATE` / `UPDATE` / `DELETE` / `APPROVE` etc. |
| `resource_type` | `HOTEL_WORKER` for roster ops; `USER` for profile/account ops |
| `resource_id` | the `HotelWorker.id` or `User.id` |
| `old_values` / `new_values` | before/after snapshots (e.g. status change `ACTIVE→SUSPENDED`) |
| `details` | transition reason, source module (e.g. onboarding-driven activation) |
| `ip_address` / `user_agent` | from request |
| `timestamp` | `now()` |

Indexes support "full history of a resource" (`(resource_type, resource_id)`) — used by the history endpoint's audit view. `AuditLog` already supports arbitrary `resource_type` strings; add the `HOTEL_WORKER`/`USER` constants in app code (`SCHEMA_RECONCILIATION_DECISION` §4.2). Sensitive reads of another worker's profile by a manager **should** also be audited (`READ` action) for GDPR traceability.

---

## 24. Error Handling

| Condition | HTTP | `error.code` |
|---|---|---|
| Missing/invalid JWT | 401 | `UNAUTHORIZED` |
| Authenticated but not permitted / wrong hotel scope | 403 | `FORBIDDEN` |
| Worker / hotel / roster row not found | 404 | `NOT_FOUND` |
| Zod validation failure | 422 | `VALIDATION_ERROR` (field details in `error.details`) |
| Duplicate roster row | 409 | `EMPLOYEE_ALREADY_ON_ROSTER` |
| Illegal status transition (incl. any from `REMOVED`) | 422 | `INVALID_STATE_TRANSITION` |
| `phone` uniqueness violation | 409 | `PHONE_TAKEN` |
| Attempt to hard-delete a manager owning requests/assignments | 409 | `CONFLICT` (FK `Restrict`) |
| Re-invite of a `REMOVED` member (pending OPQ-3) | 409 | `EMPLOYEE_ALREADY_ON_ROSTER` (`details.reason`) |
| Unexpected/server | 500 | `INTERNAL_ERROR` (no PII in message) |

Rules:
- All errors use the platform error envelope.
- DB constraint violations are caught and mapped to the codes above — never leaked as raw Postgres errors.
- Mutations run in a transaction; on any guard failure the transaction rolls back and no event/audit/notification is emitted.

---

## 25. Edge Cases

1. **Concurrent activation of the same invite** — two managers click "activate" simultaneously. Wrap the read-modify-write in a transaction; the second sees `status = ACTIVE` and returns the idempotent no-op `200` (§15.3). `joined_at` is written once (BR-4).
2. **Re-inviting a `REMOVED` worker to the same hotel** — blocked by `@@unique`; behaviour pending **OPQ-3** (§16.2).
3. **Worker active on multiple hotels** — fully supported (one `HotelWorker` row per hotel); suspension/removal at one hotel does not affect others; `hotel_ids` reflects the union of active memberships.
4. **Account disabled while `ACTIVE` on rosters** — eligibility becomes false everywhere (§7.2) without changing any `HotelWorker.status`.
5. **GDPR erasure of a worker with completed assignments** — soft delete + PII null preserves operational/audit history; `AuditLog.actor` nulled (§22). Hard delete cascades — use only when legally mandated.
6. **Hotel deleted** — `HotelWorker` rows cascade-delete; EM must reconcile each affected worker's `hotel_ids` (§19).
7. **`position` case/typo drift** — silently zero marketplace matches (FU-5). Mitigation depends on **OPQ-2**; until resolved, surface the raw string and recommend a normalisation step at write time.
8. **Suspended worker with an in-progress assignment** — suspension does not auto-cancel an `IN_PROGRESS` `WorkerAssignment` (owned by Marketplace). EM only blocks *new* eligibility. Cancellation policy is a Marketplace concern.
9. **Stale standing metrics** — `completion_rate`/`on_time_rate`/etc. may be stale pre-FU-2 (§8.3); the profile must not present them as authoritative.
10. **Invite for a `User` whose `role` is `MANAGER`/`ADMIN`** — reject (`422`): only `WORKER`/`CHECKER` identities are roster-eligible (§15.2).
11. **`workers_needed`/marketplace coupling** — EM never writes marketplace counters; it only gates eligibility, avoiding the slot-fill concurrency concerns owned by Marketplace (MP-10 trigger).

---

## 26. Dependencies

### 26.1 Platform / infrastructure
- Node.js + Express.js, TypeScript, Prisma (PostgreSQL 15+), Zod, JWT, Winston logging, Redis (optional cache only — non-critical, `FINAL_DECISIONS_SUMMARY` §3), S3 object storage. (`README`.)

### 26.2 Internal module dependencies
| Depends on | For |
|---|---|
| Auth | identity creation, JWT, `requireRole`, session revocation on disable |
| `middleware/permissions.ts` | `checkHotelAccess()` + permission codes |
| Hotels | `Hotel` existence, hotel-scoped route registration |
| Notifications | typed dispatch (pending §20 enum additions) |
| Compliance/Audit | `AuditLog` writes |
| Marketplace, Attendance, Quality | history reads (consumers of EM eligibility) |

### 26.3 Schema dependencies
`User`, `HotelWorker`, `WorkerOverallRating`, `AuditLog`, `Notification` (frozen V2 schema). Phase 2 additions (`Contract`, `WorkerDocument`, `Payroll`, `ConsentLog`, etc.) are **not** dependencies of MVP EM.

---

## 27. Future Extensibility

- **Skills** — additive once **OPQ-1** resolves (§9); design profile sub-resource to accept it without breaking changes.
- **Position taxonomy** — migrate `position String` → `WorkerPosition` enum or `Position` lookup + FK once **OPQ-2** resolves (FU-5); plan a backfill/normalisation migration.
- **Derived `hotel_ids`** — replace MVP denormalisation with derivation from `HotelWorker WHERE status = ACTIVE` (Phase 2, `SCHEMA_RECONCILIATION_DECISION` §3.1).
- **Contracts/HR** — Phase 2 models anchor on the roster relationship; reserve `Hotel`/`User` back-relations (`SCHEMA_RECONCILIATION_DECISION` §4.2).
- **Consent & retention** — `ConsentLog`/`DataRetentionLog` integration in Phase 2.
- **Worker-lifecycle notification types** — add `NotificationType` enum values (§20).
- **Re-engagement model** — successor `HotelWorker`/`WorkApplication` lifecycle once **OPQ-3** resolves (FU-8): consider a `SUPERSEDED` terminal state to permit a new row for the same pair.
- **Calendar/availability** — a future Calendar module consuming EM roster data (Phase 2).

---

## 28. Testing Requirements

Per platform standards: **80%+ unit coverage**, integration tests against a real database, Jest/Vitest + Supertest (`README`; `SCHEMA_RECONCILIATION_DECISION` §8 uses vitest/argon2 for auth).

### 28.1 Unit tests (service layer)
- Status machine: every legal transition (§16.1) and a representative set of illegal ones → `INVALID_STATE_TRANSITION`.
- `joined_at` written once on `INVITED→ACTIVE`; not rewritten on `SUSPENDED→ACTIVE` (BR-4).
- `left_at` set on `→REMOVED`; `REMOVED` rejects all further transitions.
- `hotel_ids` maintenance: add on activate, remove on remove, retain on suspend (§11.4).
- Eligibility predicate: ACTIVE + active account + not deleted (§7.2) — table-driven across all status × account-state combinations.
- Validation: profile update rejects `role`/`permissions`/`is_active`/`email`; roster create rejects non-`WORKER/CHECKER`, duplicate pair, missing hotel access.

### 28.2 Integration tests (DB)
- `@@unique([hotel_id, worker_id])` enforced (duplicate → `409`).
- Cascade behaviour: deleting a `Hotel` removes its `HotelWorker` rows and EM reconciles `hotel_ids`.
- `User.phone @unique` → `PHONE_TAKEN`.
- Soft delete + PII nulling preserves `AuditLog` with null actor.
- Audit row written for every mutation with correct `resource_type`/`old_values`/`new_values`.

### 28.3 Permission/RBAC tests
- `checkHotelAccess()`: manager cannot read/mutate a worker on a non-accessible hotel (`403`).
- Worker cannot read another worker's profile/history.
- Admin bypasses hotel scoping.

### 28.4 Contract/eligibility consumer test
- Marketplace cannot create a `WorkApplication` for a worker who is not `ACTIVE` on the target hotel (integration with the eligibility service).

### 28.5 `[OPEN]`-guarded tests
- Skills (OPQ-1), position taxonomy (OPQ-2), and re-engagement (OPQ-3) behaviours are **not** asserted beyond the documented placeholder behaviour (e.g. re-invite of `REMOVED` → `409` with `details.reason`). Add tests when the open questions resolve.

---

## 29. Refactoring Impact from Marketplace Architecture

The platform pivoted from a **task-push** model (managers create `Task`s and assign workers) to a **marketplace** model (hotels post `WorkRequest`s, workers apply). This reshapes the employee concept:

### 29.1 What changed
- The worker's relationship to a hotel moved from the ad-hoc `User.hotel_ids[]` array + task assignment into a first-class **`HotelWorker` roster row** with a real lifecycle (`INVITED→ACTIVE↔SUSPENDED→REMOVED`). (`MARKETPLACE_REFACTOR_MASTER_PLAN` Part 1; `PRISMA_SCHEMA_V2_FREEZE` §1.)
- Legacy `Room`, `Task`, `TaskPhoto`, `DailyOperation` were **removed** (`SCHEMA_RECONCILIATION_DECISION` §1–2). Any prior "worker is assigned to a Task" notion is gone; worker work now flows `WorkRequest → WorkApplication → WorkerAssignment`.
- `HotelWorkerStatus` replaced the V1 `INACTIVE` with `INVITED` + `REMOVED` (SP-1), introducing the invite/onboarding handshake EM now owns.
- `User.hotel_ids` was slated for removal in the pivot (Part 1-E Step 20) but **retained for MVP** as a denormalised scope array (`SCHEMA_RECONCILIATION_DECISION` §3.1); its derivation from the roster is a Phase 2 refactor.
- `position`/`skills`: the pivot draft put `skills String[]` on `HotelWorker`; the **freeze dropped it**, leaving free-text `position` only — creating OPQ-1/OPQ-2.

### 29.2 Reusable code vs new functionality

**Reusable (do not rewrite):**
- `User` model, Auth module, `Session`, JWT (`jwt.ts`), `middleware/permissions.ts` (`checkHotelAccess`, `requireRole`), `config/constants.ts` `ROLE_PERMISSIONS`/`getDefaultPermissions` (`SCHEMA_RECONCILIATION_DECISION` §7.1).
- `HotelWorker` table and enum (already in frozen schema — created by the marketplace migration `V2_marketplace_init`).
- `AuditLog` infrastructure and `Notification` typed-dispatch.
- `WorkerOverallRating` aggregate (read-only consumer).
- Platform response/error envelope, Zod validation conventions, shared `db`/`logger`/`cache`.
- The CRM "hotel workers" endpoints scaffolded in `MARKETPLACE_REFACTOR_MASTER_PLAN` Part 4 (`GET/POST/DELETE /hotels/:id/workers`).

**New functionality (build for this module):**
- The `HotelWorker` **lifecycle state machine** with guards, idempotency, and `joined_at`/`left_at`/`hotel_ids` side-effects (no prior implementation existed for the frozen 4-state lifecycle).
- Worker **profile** read/update surface distinct from Auth credential management.
- Worker **history aggregation** endpoint across marketplace/attendance/quality reads.
- **Eligibility service** consumed in-process by Marketplace.
- EM **domain-event** emission and (pending enum) lifecycle notifications.
- EM-scoped **GDPR export/erasure** for MVP tables.

### 29.3 Modules deleted/rewritten by the pivot that EM must account for
- `calendar/` = **REMOVE** (`MARKETPLACE_REFACTOR_MASTER_PLAN` Part 4); EM exposes roster data a future Calendar module would consume (§12.5).
- `crm/` (room/task CRUD) = **delete**; worker enrolment endpoints are the surviving CRM surface EM/Hotels reuse (`SCHEMA_RECONCILIATION_DECISION` §7.2).
- `hr/` stubs = **Phase 2 backlog** (§4).

---

## 30. Open Questions

There are **three known open product questions** that affect this module. Each is genuinely undecided in the authoritative sources; this document marks every dependent behaviour `[OPEN]` and **invents no answer**.

### OPQ-1 — Skills: existence, ownership, and representation
**Question:** Should a worker have a first-class **skills** attribute, and if so, does it live on the global profile (`User`) or the per-hotel roster (`HotelWorker`), and is it a free-text array or a controlled vocabulary used for marketplace matching?
**Why open:** The pivot draft proposed `HotelWorker.skills String[]` (`MARKETPLACE_REFACTOR_MASTER_PLAN`), but the **frozen canonical schema removed it**, leaving only free-text `position` and `WorkRequest.requirements`. No confirmed decision exists.
**Dependent sections:** §8.4, §9, §27. **No skills field, table, or matching is to be built until this resolves.**

### OPQ-2 — `position` taxonomy
**Question:** Is `position` (on `HotelWorker` and `WorkRequest`) a **free string** or a **controlled `WorkerPosition` enum / lookup table** with referential integrity?
**Why open:** Flagged as unresolved follow-up **FU-5** (`PRISMA_SCHEMA_V2_FREEZE` §7): free strings make matching fragile (case drift/typos → zero matches), but enumerating positions forces a migration on every new role. No decision recorded.
**Dependent sections:** §8.2, §11.7, §15.2, §25(7), §27. **MVP validates `position` as a non-empty string; matching is exact equality.**

### OPQ-3 — Same-worker re-engagement boundary
**Question:** May a worker who left a hotel roster (`REMOVED`) — or whose marketplace application reached a terminal state — be **re-engaged/re-applied** for the same hotel/request, given the `@@unique([hotel_id, worker_id])` (roster) and `@@unique([work_request_id, worker_id])` (application) constraints?
**Why open:** Flagged as unresolved follow-up **FU-8** (`PRISMA_SCHEMA_V2_FREEZE` §7): the unique constraints block a successor row; the resolution (reuse the row, or add a `SUPERSEDED` terminal state to permit a successor) is undecided.
**Dependent sections:** §16.2, §24, §25(2), §27. **MVP returns `409 EMPLOYEE_ALREADY_ON_ROSTER` with `details.reason = "removed_member_requires_reengagement_policy"`; no re-engagement path is implemented until this resolves.**

---

### Appendix A — Cross-reference to authoritative sources

| Topic | Source |
|---|---|
| Canonical schema, enums, constraints, FU-1..FU-8 | `PRISMA_SCHEMA_V2_FREEZE` |
| Pivot design, entity chain, module classification, decision log | `MARKETPLACE_REFACTOR_MASTER_PLAN` |
| MVP vs Phase 2 model split, `hotel_ids` decision, route/service/test impact | `SCHEMA_RECONCILIATION_DECISION` |
| Confirmed product decisions (timeline, GDPR framework, retention, scope lock, multi-language) | `FINAL_DECISIONS_SUMMARY` |
| Live schema | `backend/prisma/schema.prisma` (V2, SP-1..SP-9) |
| Platform standards (envelope, RBAC, GDPR "Required/Never", testing) | `README.md` |

> All behaviour in this document either cites one of the above or is explicitly marked `[OPEN]`. Where a follow-up item (FU-n) is referenced, it is a known, tracked boundary — not an invented behaviour.
