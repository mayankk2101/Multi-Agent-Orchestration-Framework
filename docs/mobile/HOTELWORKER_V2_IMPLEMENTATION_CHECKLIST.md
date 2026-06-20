# HOTELWORKER V2 IMPLEMENTATION CHECKLIST

**Branch:** `feat/hotelworker-v2` (from `main`, after Phase 1 merged)  
**Authority:** PRISMA_SCHEMA_V2_FREEZE (L0) · MARKETPLACE_REFACTOR_MASTER_PLAN (L1) · API_SPEC_V1_PATCH_V2 (L2)  
**Scope:** `modules/hotel-workers/` + `checkHotelAccess` RBAC middleware only. No new entities.

---

## 1. Schema Requirements

### `hotel_workers` table (ADD — already in V2 freeze)

| Column | Type | Constraint |
|--------|------|------------|
| `id` | TEXT PK | `cuid()` |
| `hotel_id` | TEXT NOT NULL | FK → `hotels.id` CASCADE |
| `worker_id` | TEXT NOT NULL | FK → `users.id` CASCADE |
| `status` | `HotelWorkerStatus` NOT NULL | default `INVITED` |
| `position` | TEXT | nullable |
| `skills` | TEXT[] | default `{}` |
| `enrolled_at` | TIMESTAMPTZ NOT NULL | default `now()` |

**Unique:** `(hotel_id, worker_id)` — one roster row per worker per hotel.

**Indexes:** `hotel_id`, `worker_id`, `status`, `position`

### `HotelWorkerStatus` enum (freeze-authoritative)

```
INVITED → ACTIVE ↔ SUSPENDED → REMOVED
```

### `User` model change (PATCH-04)

- Drop `hotel_ids String[]` column — replaced entirely by `hotel_workers` join.
- Stop writing `permissions` to `User` row.
- All `hotel_ids: { has }` array filters must be replaced with `HotelWorker` join queries.

### Surviving constraints that gate this work

- `@@unique([hotel_id, worker_id])` on `HotelWorker` — enforced at DB level; upsert logic must handle the conflict.
- `HotelWorker` FK to `hotels.id` is `CASCADE` — hotel deletion removes all roster rows automatically.
- `HotelWorker` FK to `users.id` is `CASCADE` — user deletion removes all roster rows automatically.

---

## 2. Endpoints

All under `/api/v1`. Prefix `/crm/hotels` per canonical route mount.

| Method | Route | Roles | Notes |
|--------|-------|-------|-------|
| `GET` | `/hotels/:id/workers` | ADMIN, MANAGER | List all `HotelWorker` rows for hotel; support `?status=` filter |
| `POST` | `/hotels/:id/workers` | ADMIN, MANAGER | Enroll worker → creates row with `status=INVITED`; body: `{ worker_id, position?, skills? }` |
| `DELETE` | `/hotels/:id/workers/:worker_id` | ADMIN, MANAGER | Remove enrollment |

**HotelWorker Response DTO** (per PATCH-05e):

```json
{
  "id": "string",
  "hotel_id": "string",
  "worker_id": "string",
  "status": "INVITED | ACTIVE | SUSPENDED | REMOVED",
  "position": "string | null",
  "skills": ["string"],
  "enrolled_at": "string"
}
```

**Removed from User DTOs** (all 7 affected endpoints per PATCH-04):
`hotel_ids` array is stripped from `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `POST /users`, `GET /users`, `GET /users/:id`, `PATCH /users/:id` responses.

---

## 3. Services

### `HotelWorkerService`

| Method | Behaviour |
|--------|-----------|
| `enroll(hotelId, workerId, data)` | `upsert` on `(hotel_id, worker_id)`; if existing row is `REMOVED`, reset to `INVITED`; else create. Throws `ConflictError` if already `ACTIVE` or `INVITED`. |
| `listByHotel(hotelId, filters)` | `findMany` with optional `status`, `position` filters; scoped to `hotel_id`. |
| `updateStatus(hotelId, workerId, newStatus)` | Validates lifecycle transition (see enum above); throws `InvalidStateTransitionError` on illegal moves. |
| `remove(hotelId, workerId)` | Removes enrollment. Behavior (hard delete vs. status transition to `REMOVED`) is an open implementation decision not specified by source documents. |
| `checkMembership(userId, hotelId)` | Returns `HotelWorker` row where `worker_id = userId AND hotel_id = hotelId AND status = ACTIVE`, or `null`. Used by RBAC middleware. |

### `UserService` patches (Phase 4 dependency — noted here for sequencing)

- Replace all `hotel_ids: { has: hotelId }` Prisma filters with `HotelWorker` join (`where: { hotel_workers: { some: { hotel_id: hotelId, status: 'ACTIVE' } } }`).
- Stop writing `permissions` field when creating/updating `User`.
- `listUsers` must add tenant scoping via `HotelWorker` join for MANAGER callers.

---

## 4. RBAC Requirements

### `checkHotelAccess` middleware (rewrite)

**Current (legacy):** reads `user.hotel_ids` from JWT payload — array membership check.

**V2 (required):** queries `HotelWorker` table at request time.

```typescript
// Pseudocode — replace array check entirely
const membership = await db.hotelWorker.findFirst({
  where: { worker_id: req.user.id, hotel_id: hotelId, status: 'ACTIVE' }
});
if (!membership) throw new ForbiddenError('CANNOT_ACCESS_HOTEL');
```

**Bypass rules (per RBAC matrix PATCH-07):**
- `ADMIN` — bypasses all hotel membership checks.
- `MANAGER` — bypasses membership check and has access to all hotels they manage (per RBAC matrix — `API_SPEC_V1_PATCH_V2` PATCH-04 §4c). Implementation mechanism for "hotels they manage" is outside this checklist's scope.
- `CHECKER`, `WORKER` — must have an `ACTIVE` `HotelWorker` row.

### Permission matrix for HotelWorker endpoints

| Action | ADMIN | MANAGER | CHECKER | WORKER |
|--------|-------|---------|---------|--------|
| List workers (`GET /hotels/:id/workers`) | ✓ | ✓ | — | — |
| Enroll worker (`POST /hotels/:id/workers`) | ✓ | ✓ | — | — |
| Remove worker (`DELETE /hotels/:id/workers/:id`) | ✓ | ✓ | — | — |

### JWT payload (transitional — Sprint 1)

- `hotel_ids` **remains in JWT payload for MVP** (S-4 resolution). Drop deferred to Phase 8.
- `permissions.ts` must read role-derived permissions from `ROLE_PERMISSIONS` constants, not from stale JWT arrays or `User.permissions` column.
- `checkHotelAccess` must use the DB query above, not the JWT `hotel_ids` array.

---

## 5. Migration Sequence

Run as a single Prisma migration named `hotelworker-v2`. Execute in this order:

```
Step 1  CREATE TYPE "HotelWorkerStatus" AS ENUM
         ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');
         — must precede table creation (per PRISMA_SCHEMA_V2_FREEZE migration Step 1)

Step 2  CREATE TABLE hotel_workers (id, hotel_id, worker_id,
         status "HotelWorkerStatus" NOT NULL DEFAULT 'INVITED',
         position TEXT, skills TEXT[] DEFAULT '{}',
         enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now())
         with UNIQUE(hotel_id, worker_id) and FK constraints.

Step 3  CREATE INDEX idx_hotel_workers_hotel ON hotel_workers(hotel_id)
Step 4  CREATE INDEX idx_hotel_workers_worker ON hotel_workers(worker_id)
Step 5  CREATE INDEX idx_hotel_workers_status ON hotel_workers(status)

Step 6  Data backfill — run BEFORE dropping hotel_ids:
        INSERT INTO hotel_workers (hotel_id, worker_id, status, enrolled_at)
        SELECT unnest(hotel_ids), id, 'ACTIVE'::"HotelWorkerStatus", now()
        FROM users WHERE hotel_ids <> '{}'
        ON CONFLICT (hotel_id, worker_id) DO NOTHING;

Step 7  ALTER TABLE users DROP COLUMN hotel_ids  — only after zero-NULL
        verification on hotel_workers rows and all code paths switched.
        Gated on Phase 4 (feat/users-v2) merged.
```

**Pre-migration:** Tag `git tag pre-hotelworker-baseline` and dump DB.

**Post-migration validation:** Confirm `SELECT COUNT(*) FROM hotel_workers` matches prior `hotel_ids` cardinality. Check for orphan rows (worker or hotel deleted during migration window).

---

## 6. Implementation Order

Phases are hard-sequenced. Work within a phase may be parallelised.

| # | Step | Gate |
|---|------|------|
| 1 | Write and run migration (Steps 1–6 only; keep `hotel_ids` column) | Prisma validate passes |
| 2 | Implement `HotelWorkerService` (all 5 methods) | Migration live |
| 3 | Implement controller + routes (`GET`, `POST`, `DELETE`) | Service done |
| 4 | Rewrite `checkHotelAccess` middleware to use DB query | Service `checkMembership` done |
| 5 | Update `permissions.ts` — load from `ROLE_PERMISSIONS` constants, not JWT arrays | — |
| 6 | Rewrite `hotel-workers.test.ts`; patch `rbac.test.ts` mocks | Steps 2–5 done |
| 7 | Gate: `tsc --noEmit` clean + all auth and hotel-worker tests pass | Step 6 done |
| 8 | Run migration Step 7 (`DROP COLUMN hotel_ids`) — **only after Phase 4 `feat/users-v2` is merged** | Phase 4 done |

---

## 7. Risks

| Severity | Risk | Mitigation |
|----------|------|------------|
| **HIGH** | `hotel_ids` array is the only current membership record. If migration Step 6 (backfill) runs after Step 7 (column drop), hotel access is lost for all workers. | Run backfill (Step 6) and verify row counts **before** dropping the column. Step 7 is gated on Phase 4 merge. |
| **HIGH** | `checkHotelAccess` DB query adds a round-trip on every protected request. Under sustained load this may become a bottleneck. | Flag for performance review before production rollout. Mitigation approach (cache layer, connection pooling, etc.) is outside this checklist's scope and requires its own sign-off. |
| **MEDIUM** | `HotelWorkerStatus` lifecycle transitions are not enforced at DB level — only in the service. A direct `prisma.hotelWorker.update` call bypasses the guard. | All status writes must route through `HotelWorkerService.updateStatus`. Add a DB trigger on `hotel_workers` if the risk is deemed high enough post-MVP. |
| **MEDIUM** | B-2 blocker: `WorkRequestStatus` in the API spec (PATCH-05b) exposes `OPEN\|CLOSED\|CANCELLED` (3 states) but the schema freeze mandates 6 states. This creates a DTO mismatch for any endpoint joining `WorkRequest` to `HotelWorker` queries. | Use the 6-state enum from the schema freeze. The API spec patch is a documentation error (schema L0 governs). No code change needed beyond using the correct enum. |
| **MEDIUM** | `@@unique([hotel_id, worker_id])` prevents re-enrolling a `REMOVED` worker via a plain `create`. | `enroll()` must use `upsert`; detect `REMOVED` status and reset to `INVITED`. Document this explicitly in the service. |
| **LOW** | JWT still carries `hotel_ids` in the token payload during MVP. If `checkHotelAccess` is switched to DB queries but JWT middleware still exposes `hotel_ids` on `req.user`, callers may accidentally use the stale array. | Remove JWT `hotel_ids` reads from all business logic in this phase. Phase 8 drops the JWT field. |
| **LOW** | `position` is a free string — shift-matching will silently fail on case/typo drift. | Acceptable for MVP. FU-5 in the schema freeze tracks the enum fix. |
