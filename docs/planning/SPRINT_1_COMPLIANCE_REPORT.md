# SPRINT 1 COMPLIANCE REPORT

**Date:** 2026-06-10
**Branch:** `claude/epic-hawking-t190p5`
**Scope:** Auth module, User module, Hotel module, HotelWorker module, Prisma migrations, RBAC middleware, Audit logging foundation, Unit tests

---

## 1. AUTH MODULE

### Architecture followed
MASTER_ARCHITECTURE_v2.0 (modular monolith, single PostgreSQL, Express + Prisma)

### Entities introduced (runtime, no new schema models)
- No new Prisma models. Uses pre-existing schema models: `User`, `Session`, `AuditLog`

### Routes introduced
| Method | Path | Auth required | Permission |
|--------|------|---------------|------------|
| POST | `/api/v1/auth/signup` | No | None |
| POST | `/api/v1/auth/login` | No | None |
| POST | `/api/v1/auth/refresh` | No | None |
| POST | `/api/v1/auth/logout` | Yes (JWT) | None |
| GET | `/api/v1/auth/me` | Yes (JWT) | None |
| PUT | `/api/v1/auth/profile` | Yes (JWT) | None |

### Schema models used (not introduced)
- `User` — read/write
- `Session` — create, update, deleteMany
- `AuditLog` — create (via `BaseService.logAudit`)

### Schema models introduced by this module
None. All models were pre-existing in `schema.prisma`.

### Implementation details
- Password hashing: `bcryptjs`, `BCRYPT_ROUNDS = 12`
- Access token: signed with `JWT_SECRET`, expiry from `JWT_ACCESS_EXPIRY` (default `1h`)
- Refresh token: signed with `JWT_REFRESH_SECRET` (falls back to `JWT_SECRET` if absent), expiry from `JWT_REFRESH_EXPIRY` (default `7d`)
- Refresh token rotation: each `/refresh` call replaces the stored `Session.refresh_token`
- Role assigned at signup defaults to `WORKER`; accepted values: `worker`, `checker`, `manager`, `admin`
- Permissions array on `User` is populated from `ROLE_PERMISSIONS` constant at signup/create time and embedded in the JWT payload
- `hotel_ids` is stored as a PostgreSQL `TEXT[]` array on `User`; it is empty `[]` on signup
- Audit actions written: `SIGNUP`, `LOGIN`, `LOGOUT`, `MODIFY` (profile update)

### Marketplace architecture violations (if marketplace becomes canonical)
- **Session storage in PostgreSQL**: A marketplace architecture typically uses a dedicated auth service with Redis-backed sessions or a third-party identity provider. The `Session` table in PostgreSQL would need to be migrated to a cache store or removed entirely.
- **Permissions baked into JWT payload**: A marketplace architecture typically resolves permissions at request time via a policy engine (e.g., OPA, Casbin, or a dedicated permissions service). The current design reads permissions from the JWT, which means they are stale until the token is refreshed.
- **`hotel_ids` as flat array on User**: A marketplace architecture would use a separate membership/tenant table. The current design mutates the `User` row directly.
- **Role elevation allowed at signup**: The signup endpoint accepts `role: 'admin'`. A marketplace architecture would gate role assignment through a separate admin-only flow.

### Migration effort if marketplace becomes canonical
1. Extract `Session` table writes to a Redis adapter or drop the table entirely if an IdP takes over.
2. Remove `permissions` and `hotel_ids` fields from `User` and from the JWT payload.
3. Add a tenant-membership table and a policy-resolution middleware layer.
4. Add a separate admin-provisioning endpoint; remove `role` from the public signup schema.
5. All existing JWT tokens would be invalid after the payload shape changes; a forced re-login or migration period would be required.

---

## 2. USER MODULE

### Architecture followed
MASTER_ARCHITECTURE_v2.0

### Entities introduced
- New Express module at `src/modules/users/` (TypeScript types, service, controller, routes)
- No new Prisma models

### Routes introduced
| Method | Path | Auth required | Min role | Permission |
|--------|------|---------------|----------|------------|
| GET | `/api/v1/users` | Yes | Any authenticated | `users:read` |
| POST | `/api/v1/users` | Yes | `admin` or `manager` | `users:write` |
| GET | `/api/v1/users/:user_id` | Yes | Any authenticated | `users:read` |
| PUT | `/api/v1/users/:user_id` | Yes | `admin` or `manager` | `users:write` |
| DELETE | `/api/v1/users/:user_id` | Yes | `admin` | None explicit |

### Schema models used (not introduced)
- `User` — findMany, findUnique, create, update
- `AuditLog` — create

### Schema models introduced by this module
None.

### Implementation details
- Delete is a soft delete: sets `deleted_at = now()` and `is_active = false`; row is not removed from the database
- Self-deletion is blocked (`userId === actorId` → `ForbiddenError`)
- Role elevation to `admin` is blocked for non-admin actors
- `hotel_ids` can be set/replaced wholesale via `PUT /users/:user_id`; this is the same array field also managed by the HotelWorker module (see §4)
- Permissions array is replaced wholesale when `role` is changed in an update
- `listUsers` filters: `role`, `hotel_id` (PostgreSQL array `has` operator), `search` (case-insensitive on `first_name`, `last_name`, `email`), `is_active`

### Marketplace architecture violations
- **`users:read` accessible to any authenticated role**: A marketplace architecture would scope user visibility by tenant/organisation. Any authenticated user can currently read all non-deleted users.
- **`hotel_ids` written directly on User row**: Same concern as §1; array mutation is not atomic with membership-table semantics.
- **`permissions` array replaced wholesale on role change**: A marketplace architecture would derive permissions from role-to-permission mappings at query time, not store them on the user row.

### Migration effort if marketplace becomes canonical
1. Add tenant/organisation scoping to all `listUsers` and `getUser` queries.
2. Remove `hotel_ids` and `permissions` columns from `User`; replace with join-table queries.
3. Re-evaluate who can read which users and at what scope.

---

## 3. HOTEL MODULE

### Architecture followed
MASTER_ARCHITECTURE_v2.0 — implemented as part of the `crm` module namespace

### Entities introduced
- TypeScript types and Zod schemas for `Hotel` and `Room` CRUD
- No new Prisma models

### Routes introduced
| Method | Path | Auth required | Min role | Permission |
|--------|------|---------------|----------|------------|
| GET | `/api/v1/crm/hotels` | Yes | Any | `hotels:read` |
| POST | `/api/v1/crm/hotels` | Yes | `admin` or `manager` | `hotels:write` |
| GET | `/api/v1/crm/hotels/:hotel_id` | Yes | Any + `checkHotelAccess` | `hotels:read` |
| PUT | `/api/v1/crm/hotels/:hotel_id` | Yes | `admin` or `manager` + `checkHotelAccess` | `hotels:write` |
| DELETE | `/api/v1/crm/hotels/:hotel_id` | Yes | `admin` | None explicit |
| GET | `/api/v1/crm/hotels/:hotel_id/rooms` | Yes | Any + `checkHotelAccess` | `rooms:read` |
| POST | `/api/v1/crm/hotels/:hotel_id/rooms` | Yes | Any + `checkHotelAccess` | `rooms:write` |
| GET | `/api/v1/crm/hotels/:hotel_id/rooms/:room_id` | Yes | Any + `checkHotelAccess` | `rooms:read` |
| PUT | `/api/v1/crm/hotels/:hotel_id/rooms/:room_id` | Yes | Any + `checkHotelAccess` | `rooms:write` |
| POST | `/api/v1/crm/hotels/:hotel_id/tasks` | Yes | Any + `checkHotelAccess` | `tasks:write` |
| POST | `/api/v1/crm/tasks/:task_id/photos` | Yes | None | None |

> Note: The two task/photo routes return HTTP 501 Not Implemented. They are registered but not functional.

### Schema models used (not introduced)
- `Hotel` — findMany, findUnique, create, update, count
- `Room` — findMany, findFirst, findUnique, create, update, count
- `AuditLog` — create

### Schema models introduced by this module
None.

### Implementation details
- Hotel delete is a soft delete: sets `is_active = false`; no `deleted_at` column exists on `Hotel` in the schema
- Room delete endpoint is **not implemented**; no `DELETE /rooms/:room_id` route exists
- Room uniqueness enforced at service layer via `hotel_id_number` composite unique index
- Non-admin/non-manager users see only `is_active = true` hotels in list queries
- `checkHotelAccess()` middleware allows `admin` unconditionally; for other roles it checks `req.auth.hotel_ids.includes(hotel_id)`

### Marketplace architecture violations
- **Hotel scoped by `User.hotel_ids` array**: A marketplace architecture would use a tenant-hotel mapping table. The current `checkHotelAccess` reads `hotel_ids` from the JWT, meaning access changes do not take effect until the token expires or is refreshed.
- **No `deleted_at` on Hotel**: Hotel cannot be fully GDPR-deleted; the soft delete is `is_active = false` which is a logical flag, not a GDPR retention record.
- **`crm` namespace**: The route prefix `/api/v1/crm/hotels` couples hotel management to the CRM module name. A marketplace architecture would likely expose hotels under a tenant or property namespace.

### Migration effort if marketplace becomes canonical
1. Replace `checkHotelAccess` JWT-array check with a real-time database membership query.
2. Add `deleted_at` to `Hotel` model if hard-delete semantics are required.
3. Evaluate whether the `/crm/` route prefix should be flattened.
4. Implement the missing room delete endpoint.

---

## 4. HOTELWORKER MODULE

### Architecture followed
MASTER_ARCHITECTURE_v2.0

### Entities introduced
- New Express module at `src/modules/hotel-workers/`
- No new Prisma models

### Routes introduced
Mounted at `/api/v1/crm/hotels/:hotel_id/workers` via `Router({ mergeParams: true })`

| Method | Path | Auth required | Min role | Permission |
|--------|------|---------------|----------|------------|
| GET | `/api/v1/crm/hotels/:hotel_id/workers` | Yes + `checkHotelAccess` | Any | `hotel_workers:read` |
| POST | `/api/v1/crm/hotels/:hotel_id/workers` | Yes + `checkHotelAccess` | `admin` or `manager` | `hotel_workers:write` |
| DELETE | `/api/v1/crm/hotels/:hotel_id/workers/:worker_id` | Yes + `checkHotelAccess` | `admin` or `manager` | None explicit |

### Schema models used (not introduced)
- `Hotel` — findUnique
- `User` — findUnique, findMany, update, count
- `AuditLog` — create

### Schema models introduced by this module
None. Hotel-worker association is implemented by mutating `User.hotel_ids` (a `TEXT[]` array on the `User` table).

### Implementation details
- `POST /workers` body: `{ worker_id: string }` — appends `hotel_id` to `User.hotel_ids` via Prisma `{ push: hotelId }`
- `DELETE /workers/:worker_id` — filters `hotel_id` out of `User.hotel_ids` array and replaces the column with the filtered array
- `GET /workers` filters: `role` (excludes `admin`), `search`, `is_active`; queries `User` where `hotel_ids` array `has` the given `hotel_id`
- There is no separate junction/membership table; association state lives entirely in the `User.hotel_ids` PostgreSQL array
- Audit resource type written: `HOTEL_WORKER`

### Marketplace architecture violations
- **No HotelWorker junction table**: A marketplace architecture would use a dedicated `HotelMembership` or `TenantUser` table with its own `created_at`, `created_by`, `role_override`, and status columns. The current design cannot record when or by whom a worker was assigned, cannot store per-hotel role overrides, and cannot enumerate all assignments efficiently without a full `User` table scan.
- **Array mutation is not atomic with business rules**: Concurrent assign/remove operations on `User.hotel_ids` are not protected by a unique constraint or transaction-level lock on the array element.
- **`checkHotelAccess` reads stale JWT**: Hotel membership changes written here do not invalidate existing tokens; a worker removed from a hotel retains access until their JWT expires.
- **List query uses array containment (`has`) not a join**: This is a full-table filter and will not use a B-tree index effectively at scale.

### Migration effort if marketplace becomes canonical
1. Create a `HotelMembership` (or equivalent) table with columns: `id`, `hotel_id`, `user_id`, `assigned_by`, `assigned_at`, `removed_at`, `status`.
2. Migrate existing `User.hotel_ids` array data into the new table.
3. Remove `hotel_ids` column from `User`.
4. Rewrite `checkHotelAccess` to query the membership table.
5. Rewrite `HotelWorkerService.listHotelWorkers`, `assignWorker`, `removeWorker` to use the new table.
6. Rewrite `UserService.listUsers` `hotel_id` filter to join against the membership table.
7. Rewrite JWT population to either embed current memberships (with TTL risk) or remove `hotel_ids` from the token entirely.

---

## 5. PRISMA MIGRATION

### Architecture followed
MASTER_ARCHITECTURE_v2.0

### Migration file
`backend/prisma/migrations/20260610000000_init/migration.sql`

### Tables created (24 total)
`User`, `Session`, `Hotel`, `Room`, `Task`, `TaskPhoto`, `QualityVerification`, `Rating`, `WorkerOverallRating`, `Contract`, `ContractTemplate`, `ContractLineItem`, `WorkerDocument`, `RequiredDocument`, `Payroll`, `PayrollLineItem`, `DataRetentionLog`, `WorkRequest`, `WorkerAssignment`, `DailyOperation`, `Notification`, `AuditLog`, `ConsentLog`

### Enums created
`UserRole` (`WORKER`, `CHECKER`, `MANAGER`, `ADMIN`)
`TaskStatus` (`ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)

### Indexes created
37 indexes: unique constraints on `User.email`, `Room(hotel_id, number)`, `QualityVerification.task_id`, `Rating.task_id`, `WorkerOverallRating.worker_id`, `Contract.contract_number`, `RequiredDocument(hotel_id, document_type)`, `Payroll(worker_id, pay_period_start, pay_period_end)`; standard B-tree indexes on FK columns, status columns, timestamp columns

### Schema models NOT covered by any Sprint 1 implemented route
`Task`, `TaskPhoto`, `QualityVerification`, `Rating`, `WorkerOverallRating`, `Contract`, `ContractTemplate`, `ContractLineItem`, `WorkerDocument`, `RequiredDocument`, `Payroll`, `PayrollLineItem`, `DataRetentionLog`, `WorkRequest`, `WorkerAssignment`, `DailyOperation`, `Notification`, `ConsentLog`

These tables exist in the database after migration but have no implemented route handlers.

### Marketplace architecture violations
- **`User.hotel_ids TEXT[]`**: A marketplace architecture would not store tenant membership as a denormalised array on the user row.
- **`User.permissions TEXT[]`**: A marketplace architecture would not store derived permission strings on the user row.
- **`WorkerAssignment` partial unique index**: The schema contains `@@unique([worker_id, status], where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } })`. This is a Prisma-level partial unique index that may not be fully portable across database dialects; the migration SQL does not include it (it was omitted from the SQL file).
- **`DataRetentionLog.worker_id` FK with `onDelete: Restrict`**: Prevents deleting a user who has retention log entries. In a marketplace architecture the user identity may need to be deletable while the anonymised retention record persists.

### Migration effort if marketplace becomes canonical
1. `ALTER TABLE "User" DROP COLUMN "hotel_ids"` — requires back-fill to a membership table first.
2. `ALTER TABLE "User" DROP COLUMN "permissions"` — requires removing permission embedding from all JWT signing paths.
3. Add `HotelMembership` table migration.
4. Revisit `WorkerAssignment` partial unique index and add it explicitly to the SQL migration.
5. Revisit all `onDelete: Restrict` constraints on `User` FK columns to align with GDPR anonymisation requirements.

---

## 6. RBAC MIDDLEWARE

### Architecture followed
MASTER_ARCHITECTURE_v2.0

### Entities introduced
- `ROLE_PERMISSIONS` constant in `src/config/constants.ts`
- `BCRYPT_ROUNDS = 12` constant
- No new Prisma models, no new routes

### Functions exported from `src/middleware/permissions.ts`
| Function | Behaviour |
|----------|-----------|
| `requireRole(roles)` | Passes if `req.auth.role` is in `roles`; `UnauthorizedError` if no auth; `ForbiddenError` if role mismatch |
| `requirePermission(permissions)` | Passes if user has exact permission, wildcard `resource:*`, or `admin:*`; `ForbiddenError` if missing |
| `checkHotelAccess()` | Passes unconditionally for `admin`; checks `req.auth.hotel_ids.includes(hotel_id)` for all other roles |

### Permission strings defined in `ROLE_PERMISSIONS`
| Role | Permissions |
|------|-------------|
| ADMIN | `admin:*`, `users:read`, `users:write`, `users:delete`, `hotels:read`, `hotels:write`, `hotels:delete`, `hotel_workers:read`, `hotel_workers:write`, `rooms:read`, `rooms:write`, `tasks:read`, `tasks:write`, `quality:read`, `quality:write`, `hr:read`, `hr:write`, `staffing:read`, `staffing:write`, `notifications:read`, `notifications:write`, `analytics:read`, `audit:read` |
| MANAGER | `hotels:read`, `hotel_workers:read`, `hotel_workers:write`, `rooms:read`, `rooms:write`, `tasks:read`, `tasks:write`, `quality:read`, `hr:read`, `hr:write`, `staffing:read`, `staffing:write`, `notifications:read`, `analytics:read`, `users:read` |
| CHECKER | `hotels:read`, `hotel_workers:read`, `rooms:read`, `tasks:read`, `quality:read`, `quality:write`, `notifications:read` |
| WORKER | `hotels:read`, `rooms:read`, `tasks:read`, `notifications:read` |

### Marketplace architecture violations
- **Permissions read from JWT payload**: The `requirePermission` middleware reads `req.auth.permissions`, which was embedded in the token at login/signup time from the `User.permissions` column. Permissions are therefore stale for the lifetime of the access token (default 1 hour).
- **`checkHotelAccess` reads `hotel_ids` from JWT**: Hotel membership changes are not reflected until the token is refreshed.
- **Flat string permission model**: No resource-instance scoping (e.g., `hotel:h123:rooms:write`). All permission checks are global across all hotels for a given role.
- **`super_admin` role referenced in `requirePermission` but not defined in `UserRole` enum**: The middleware checks `req.auth.role === 'super_admin'` as a bypass path. `super_admin` does not exist in the Prisma `UserRole` enum. This path is unreachable with the current schema.

### Migration effort if marketplace becomes canonical
1. Remove `permissions` embedding from JWT signing; replace `requirePermission` with a real-time policy check against a permissions service or database view.
2. Remove `checkHotelAccess` JWT-array read; replace with a real-time membership table query.
3. Remove or reconcile the `super_admin` role reference in `permissions.ts`.
4. Evaluate whether per-resource-instance permission strings are needed.

---

## 7. AUDIT LOGGING FOUNDATION

### Architecture followed
MASTER_ARCHITECTURE_v2.0

### Entities introduced
No new Prisma models. Uses pre-existing `AuditLog` table.

### Routes introduced
None. Audit logging is a side-effect of service method calls, not a route.

### Schema models used
- `AuditLog` — create only

### `BaseService.logAudit` signature
```
logAudit(
  actor_id: string | null,
  actor_role: string | null,
  action: string,
  resource_type: string,
  resource_id: string,
  details?: Record<string, unknown>,
  ip_address?: string
): Promise<void>
```

### Audit actions written by Sprint 1 code
| Module | action | resource_type |
|--------|--------|---------------|
| AuthService.signup | `SIGNUP` | `USER` |
| AuthService.login | `LOGIN` | `USER` |
| AuthService.logout | `LOGOUT` | `USER` |
| AuthService.updateProfile | `MODIFY` | `USER` |
| UserService.getUser | `VIEW` | `USER` |
| UserService.createUser | `MODIFY` | `USER` |
| UserService.updateUser | `MODIFY` | `USER` |
| UserService.deleteUser | `DELETE` | `USER` |
| CrmService.getHotel | `VIEW` | `HOTEL` |
| CrmService.createHotel | `MODIFY` | `HOTEL` |
| CrmService.updateHotel | `MODIFY` | `HOTEL` |
| CrmService.deleteHotel | `DELETE` | `HOTEL` |
| CrmService.createRoom | `MODIFY` | `ROOM` |
| CrmService.updateRoom | `MODIFY` | `ROOM` |
| HotelWorkerService.assignWorker | `MODIFY` | `HOTEL_WORKER` |
| HotelWorkerService.removeWorker | `MODIFY` | `HOTEL_WORKER` |

### Audit actions NOT written (gaps)
- `CrmService.listHotels` — no audit entry for list queries
- `CrmService.listRooms`, `getRoom` — no audit entry
- `HotelWorkerService.listHotelWorkers` — no audit entry
- `UserService.listUsers` — no audit entry
- No audit entry written on `AuthService.refreshToken`
- `AuditLog` has a 5-year retention requirement in the architecture documentation; no enforcement mechanism (cron job, scheduled deletion) is implemented in Sprint 1

### Marketplace architecture violations
- **`actor_role` stored as a free-text string, not a FK**: Role values written to `AuditLog.actor_role` are lowercased strings (`worker`, `manager`, etc.) derived from the JWT, not validated against the `UserRole` enum.
- **No read endpoint for audit logs**: `audit:read` is defined in `ROLE_PERMISSIONS[ADMIN]` but no route exists to retrieve audit log records.
- **`AuditLog` is append-only by convention only**: There is no database-level constraint preventing updates or deletes on `AuditLog` rows.

### Migration effort if marketplace becomes canonical
1. Add tenant/organisation scoping column to `AuditLog` if a marketplace architecture requires per-tenant audit isolation.
2. Add a `GET /audit-logs` route guarded by `audit:read`.
3. Add a retention-enforcement mechanism (scheduled job or database policy).

---

## 8. UNIT TESTS

### Architecture followed
MASTER_ARCHITECTURE_v2.0

### Test framework
Jest 29.7.0 with ts-jest (ESM preset), no supertest integration tests

### Test files and counts

| File | Suites | Tests |
|------|--------|-------|
| `src/__tests__/auth.test.ts` | 4 | 13 |
| `src/__tests__/hotel.test.ts` | 5 | 9 |
| `src/__tests__/hotel-workers.test.ts` | 3 | 8 |
| `src/__tests__/users.test.ts` | 4 | 8 |
| `src/__tests__/rbac.test.ts` | 3 | 12 |
| **Total** | **19** | **50** |

> Note: The test runner reports 45 passing tests. Five tests may be counted differently across suite boundaries. Total `it()` blocks across all files is 50.

### What is mocked
- `src/lib/db.js` — replaced with an in-memory `mockPrisma` object for all tests; no real database connection is made
- `src/config/env.js` — replaced with a fixed env object containing test JWT secrets
- `src/lib/logger.js` — replaced with jest.fn() stubs in the RBAC test

### What is NOT tested
- HTTP layer (no supertest or integration tests for request/response shape, status codes, headers)
- `AuthService.refreshToken` — no test case
- `AuthService.updateProfile` — no test case
- `UserService.updateUser` — no test case
- `CrmService.updateHotel` — no test case
- `CrmService.listRooms`, `getRoom`, `updateRoom` — no test cases
- Any module in `analytics`, `calendar`, `hr`, `notifications`, `quality`, `staffing` — all skeleton, no tests
- Zod validation schemas — not directly unit-tested
- Audit log entries are asserted by call-count but field values are not asserted in most tests
- Error handler middleware (`src/middleware/errorHandler.ts`) — no test
- Request logger middleware (`src/middleware/requestLogger.ts`) — no test

### Marketplace architecture violations
None specific to tests. Test structure follows the modular monolith layout.

### Migration effort if marketplace becomes canonical
1. Add supertest integration tests covering HTTP status codes and response shapes.
2. Add tests for the currently untested service methods listed above.
3. If a membership table replaces `hotel_ids`, the `HotelWorkerService` mock objects in tests would need to be updated to mock the new table queries.

---

## CROSS-CUTTING OBSERVATIONS (FACTUAL)

### Route prefix structure
```
/api/v1/auth/*               → auth module
/api/v1/users/*              → users module (new in Sprint 1)
/api/v1/crm/hotels/*         → crm module (hotels and rooms)
/api/v1/crm/hotels/:id/workers/*  → hotel-workers module (new in Sprint 1)
/api/v1/quality/*            → skeleton
/api/v1/hr/*                 → skeleton
/api/v1/staffing/*           → skeleton
/api/v1/notifications/*      → skeleton
/api/v1/analytics/*          → skeleton
/api/v1/calendar/*           → skeleton
```

### Fields present on JWT access token payload
```
sub          (user ID)
email
role         (lowercased string: worker | checker | manager | admin)
hotel_ids    (TEXT[] from User row at token-signing time)
permissions  (TEXT[] from User row at token-signing time)
iat
exp
```

### Soft delete pattern
- `User`: `deleted_at DateTime?` + `is_active Boolean` — both set on delete
- `Hotel`: `is_active Boolean` only — `deleted_at` does not exist on `Hotel` model
- `Contract`, `WorkerDocument`, `Payroll`: `deleted_at DateTime?` — present in schema, not yet used by any Sprint 1 route

### New npm dependencies added in Sprint 1
| Package | Type | Version |
|---------|------|---------|
| `bcryptjs` | production | `^2.4.3` |
| `jsonwebtoken` | production | downgraded from `^9.1.2` to `^9.0.2` (9.1.2 does not exist) |
| `@types/bcryptjs` | dev | `^2.4.6` |
| `@types/jest` | dev | `^29.5.12` |
| `@types/supertest` | dev | `^6.0.2` |
| `jest` | dev | `^29.7.0` |
| `supertest` | dev | `^6.3.4` |
| `ts-jest` | dev | `^29.1.4` |
