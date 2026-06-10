# SPRINT 1 SALVAGE AND REFACTOR PLAN

**Date:** 2026-06-10
**Branch:** `claude/epic-hawking-t190p5`
**Based on:** SPRINT_1_COMPLIANCE_REPORT.md, direct code inspection, README.md, DOCUMENTATION_AUDIT_REPORT.md, INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md

---

## ESCALATION: MISSING REFERENCE DOCUMENTS

The following documents were specified as mandatory context for this plan. **None exist in the repository.**

| Document requested | Repository path checked | Status |
|---|---|---|
| PRISMA_SCHEMA_V2_FREEZE.md | `/home/user/hotel-crm/` | **NOT FOUND** |
| API_SPEC_V1_PATCH_V2.md | `/home/user/hotel-crm/` | **NOT FOUND** |
| MARKETPLACE_REFACTOR_MASTER_PLAN.md | `/home/user/hotel-crm/` | **NOT FOUND** |
| SCHEMA_RECONCILIATION_DECISION.md | `/home/user/hotel-crm/` | **NOT FOUND** |
| PR2_ARCHITECTURE_COMPLIANCE_AUDIT.md | `/home/user/hotel-crm/` | **NOT FOUND** |

The DOCUMENTATION_AUDIT_REPORT.md (2026-06-01) confirms that `MASTER_ARCHITECTURE_v2.0.md` exists in Google Drive but is not committed to the repository. The "marketplace architecture" referenced in the task goal has no canonical written specification in any accessible file.

**Consequence for this document:** Every "marketplace architecture" classification below is derived exclusively from:
1. The violations sections of `SPRINT_1_COMPLIANCE_REPORT.md`
2. DOCUMENTATION_AUDIT_REPORT.md references to MASTER_ARCHITECTURE_v2.0
3. Direct inspection of the implemented code
4. What the README.md states as Phase 2 microservice migration intent

Any decision that requires reading the missing documents — particularly schema column decisions in PRISMA_SCHEMA_V2_FREEZE.md, API contract shapes in API_SPEC_V1_PATCH_V2.md, and migration sequencing in MARKETPLACE_REFACTOR_MASTER_PLAN.md — **cannot be finalised until those documents are made available.** Those decisions are flagged below with `⚠ BLOCKED`.

---

## CLASSIFICATION KEY

| Symbol | Meaning |
|---|---|
| `KEEP_AS_IS` | No changes required regardless of target architecture |
| `KEEP_WITH_PATCHES` | Functionally correct; targeted changes needed for specific fields or checks |
| `REWRITE` | Core logic is structurally misaligned; new implementation required |
| `REMOVE` | File has no place in the target architecture |

---

## PART 1: FILE-LEVEL INVENTORY

### Infrastructure and Framework

| File | Classification | Reason | Architecture conflict | Effort | Depends on |
|---|---|---|---|---|---|
| `src/server.ts` | `KEEP_AS_IS` | Entry point; framework setup only | None | 0 | — |
| `src/app.ts` | `KEEP_AS_IS` | Express wiring; no business logic | None | 0 | — |
| `src/config/env.ts` | `KEEP_WITH_PATCHES` | Missing `JWT_REFRESH_SECRET` already added; if Session strategy changes to Redis or IdP, remove `SESSION_*` vars; if permissions leave DB, remove `ROLE_PERMISSIONS` reference | Low: env vars will change when Session and permission strategies are decided | 1–2h | Session strategy decision |
| `src/config/constants.ts` | `KEEP_WITH_PATCHES` | `ROLE_PERMISSIONS` map is functional but bakes permissions into a static file; `BCRYPT_ROUNDS` and `ROLE_HIERARCHY` are architecture-neutral; `super_admin` role referenced in permissions middleware but absent here and absent from schema | `ROLE_PERMISSIONS` is incompatible with dynamic/database-driven permissions; `super_admin` phantom role must be added to `UserRole` enum or removed everywhere | 2–4h | RBAC redesign decision |
| `src/lib/db.ts` | `KEEP_AS_IS` | Prisma singleton; no business logic | None | 0 | — |
| `src/lib/errors.ts` | `KEEP_AS_IS` | Error class hierarchy is architecture-neutral | None | 0 | — |
| `src/lib/logger.ts` | `KEEP_AS_IS` | Winston structured logging; architecture-neutral | None | 0 | — |
| `src/lib/utils.ts` | `KEEP_AS_IS` | ID generation, pagination parsing; architecture-neutral | None | 0 | — |
| `src/lib/types.ts` | `KEEP_WITH_PATCHES` | `AuthContext` interface carries `hotel_ids: string[]` and `permissions: string[]` directly from JWT payload; both fields must be removed or replaced when JWT payload is redesigned | `hotel_ids` on `AuthContext` is the downstream propagation point for the stale-array problem; all middleware and services that read `req.auth.hotel_ids` or `req.auth.permissions` break when these fields are removed | 1h | JWT payload redesign |
| `src/lib/jwt.ts` | `REWRITE` | `signTokens` embeds `hotel_ids` (stale array) and `permissions` (stale array) directly into the access token payload; both fields must be removed; `signRefreshToken` is structurally correct but its caller (`signTokens`) will change signature; `expiresIn: ... as any` cast indicates type mismatch with installed version of `@types/jsonwebtoken` | Embedding stale `hotel_ids` and `permissions` in the JWT is the root cause of all access-control staleness issues; removing them requires coordinated changes across auth service, auth middleware, permissions middleware, and all consumers of `req.auth` | 3–4h | JWT payload decision ⚠ BLOCKED on API_SPEC_V1_PATCH_V2.md |
| `src/lib/base-service.ts` | `KEEP_WITH_PATCHES` | `logAudit` signature and storage are correct; gaps: no `hotel_id`/tenant scoping column on `AuditLog`, no `organization_id` if marketplace requires per-tenant audit isolation | If marketplace AuditLog requires `hotel_id` or `org_id` column, `logAudit` signature must add that parameter and all 16 call-sites must pass it | 2–3h | AuditLog schema decision ⚠ BLOCKED |

---

### Middleware

| File | Classification | Reason | Architecture conflict | Effort | Depends on |
|---|---|---|---|---|---|
| `src/middleware/auth.ts` | `KEEP_WITH_PATCHES` | Token extraction and verification is correct; populates `req.auth` from JWT payload; the stale-data problem is in the JWT payload itself, not in this file; once JWT payload is redesigned, `req.auth` population here changes to match | `req.auth.hotel_ids` and `req.auth.permissions` are populated from JWT here; when those fields are removed from the JWT payload, the corresponding lines in this file must be removed or replaced | 1h | Depends on `lib/jwt.ts` rewrite |
| `src/middleware/errorHandler.ts` | `KEEP_AS_IS` | Generic error-to-HTTP mapping; architecture-neutral | None | 0 | — |
| `src/middleware/permissions.ts` | `REWRITE` | Three distinct problems: (1) `requirePermission` reads `req.auth.permissions` from stale JWT array — must read from DB or derived from role at request time; (2) `checkHotelAccess` reads `req.auth.hotel_ids` from stale JWT — must query the HotelMembership junction table; (3) `super_admin` bypass in `requirePermission` references a role that does not exist in the `UserRole` enum — currently unreachable dead code | This file is the enforcement point for all three architectural violations: stale permissions, stale hotel access, and phantom role. It cannot be patched incrementally; all three issues interact. | 4–6h | JWT redesign + HotelMembership table + RBAC spec ⚠ BLOCKED on MARKETPLACE_REFACTOR_MASTER_PLAN.md |
| `src/middleware/requestLogger.ts` | `KEEP_AS_IS` | Request ID assignment and logging; architecture-neutral | None | 0 | — |
| `src/middleware/validation.ts` | `KEEP_AS_IS` | Zod schema validation middleware; architecture-neutral | None | 0 | — |

---

### Auth Module

| File | Classification | Reason | Architecture conflict | Effort | Depends on |
|---|---|---|---|---|---|
| `src/modules/auth/types.ts` | `KEEP_WITH_PATCHES` | `SignupSchema` accepts `role` as optional field including `admin` — must be restricted or removed for marketplace; `AuthUser` interface carries `hotel_ids` and `permissions` — both must change; `AuthResponse` shape is otherwise compatible | `role` at signup allows self-elevating to `admin`; `hotel_ids` and `permissions` in the response type will break consumers when payload changes | 1–2h | JWT payload decision |
| `src/modules/auth/service.ts` | `REWRITE` | Five structural problems: (1) `Session` stored in PostgreSQL — ⚠ BLOCKED on session strategy decision; (2) `permissions` array written to `User.permissions` column at signup/login and embedded in JWT; (3) `hotel_ids` embedded in JWT at login; (4) `signup` accepts `role: admin` from untrusted input; (5) `refreshToken` has no unit test and no audit log entry | Session storage, JWT payload, User.permissions column, and hotel_ids column are all decisions that have not been made in available documents. Rewriting without the frozen documents risks implementing the wrong model again. | 6–8h | ⚠ BLOCKED on Session strategy, PRISMA_SCHEMA_V2_FREEZE.md, API_SPEC_V1_PATCH_V2.md |
| `src/modules/auth/controller.ts` | `KEEP_WITH_PATCHES` | Thin HTTP layer; delegates to service; Zod validation is wired correctly; controller shape is compatible with most JWT payload redesigns | No structural conflict; patches needed if response shape changes (removal of `hotel_ids`, `permissions` from `AuthResponse`) | 1h | Depends on service rewrite |
| `src/modules/auth/routes.ts` | `KEEP_AS_IS` | Route registration is architecture-neutral; HTTP verbs and paths are correct | None | 0 | — |

---

### User Module

| File | Classification | Reason | Architecture conflict | Effort | Depends on |
|---|---|---|---|---|---|
| `src/modules/users/types.ts` | `KEEP_WITH_PATCHES` | `CreateUserSchema` and `UpdateUserSchema` both carry `hotel_ids` as an array field; `ListUsersQuerySchema` filters by `hotel_id` using array containment; both must change when `hotel_ids` is removed from `User` | Removing `hotel_ids` from these schemas is mechanical but breaks the `hotel_id` filter in `listUsers` which must be replaced with a join on the HotelMembership table | 1–2h | HotelMembership table |
| `src/modules/users/service.ts` | `REWRITE` | Three structural problems: (1) `listUsers` filters via `hotel_ids: { has: hotel_id }` — PostgreSQL array containment, not a join; (2) `createUser` and `updateUser` write `hotel_ids` and `permissions` directly to the `User` row; (3) `listUsers` has no tenant/hotel scoping — any authenticated user can enumerate all users | The `hotel_ids` array write in `updateUser` is a dual-write conflict with `HotelWorkerService.assignWorker`; both modules mutate the same column independently, creating race conditions | 4–6h | HotelMembership table, PRISMA_SCHEMA_V2_FREEZE.md ⚠ BLOCKED |
| `src/modules/users/controller.ts` | `KEEP_WITH_PATCHES` | Thin HTTP layer; patches needed if request/response shapes change (removal of `hotel_ids`) | No structural conflict | 1h | Depends on service rewrite |
| `src/modules/users/routes.ts` | `KEEP_WITH_PATCHES` | Route paths and permission guards are correct; `DELETE` route lacks explicit `requirePermission('users:delete')` call (role-only guard) | Minor gap; not a structural conflict | 0.5h | — |

---

### Hotel Module (CRM)

| File | Classification | Reason | Architecture conflict | Effort | Depends on |
|---|---|---|---|---|---|
| `src/modules/crm/types.ts` | `KEEP_WITH_PATCHES` | Hotel and Room Zod schemas are functionally sound; two stub entries (`CreateTaskRequest`, old CRM types) were replaced; task/photo types are missing entirely since those endpoints return 501; if `Task`, `TaskPhoto`, `DailyOperation` are removed from scope, no types needed here | If the marketplace schema removes `Room`, `Task`, `TaskPhoto`, `DailyOperation` entirely from this module, these types would move or be removed ⚠ BLOCKED on PRISMA_SCHEMA_V2_FREEZE.md | 1h | Schema freeze decision |
| `src/modules/crm/service.ts` | `KEEP_WITH_PATCHES` | Hotel and Room CRUD is functionally correct; three gaps: (1) Hotel delete uses `is_active = false` but `Hotel` has no `deleted_at` column so GDPR hard-delete is not possible; (2) `listHotels` visibility logic (admin/manager vs others) duplicates RBAC that should be in middleware; (3) `checkHotelAccess` is called by routes but the underlying check reads stale JWT `hotel_ids` | Hotel service itself is clean; the access control problem lives in the middleware, not in the service; no Hotel service logic depends on `hotel_ids` array directly | 2–3h | Hotel.deleted_at schema decision, checkHotelAccess rewrite |
| `src/modules/crm/controller.ts` | `KEEP_WITH_PATCHES` | Hotel and Room handlers are correct; two 501 stub handlers (`uploadPhoto` used for both task creation and photo upload) should be removed when those endpoints move to dedicated modules | Task and photo routes should not live in the CRM controller | 1h | Task module ownership decision |
| `src/modules/crm/routes.ts` | `KEEP_WITH_PATCHES` | Hotel and Room routes are correct; two routes (`POST /hotels/:hotel_id/tasks` and `POST /tasks/:task_id/photos`) return 501 and should either move to a task module or be removed until Sprint 2 | Route namespace `/crm/hotels` may conflict with marketplace expectation if hotel routes are moved to a top-level namespace ⚠ BLOCKED on API_SPEC_V1_PATCH_V2.md | 1–2h | Task module decision, API spec |

---

### HotelWorker Module

| File | Classification | Reason | Architecture conflict | Effort | Depends on |
|---|---|---|---|---|---|
| `src/modules/hotel-workers/types.ts` | `REWRITE` | `AssignWorkerSchema` (`{ worker_id }`) and `ListHotelWorkersQuerySchema` are correct for the current array model; once the HotelMembership junction table exists, the types will need `assigned_at`, `status`, `role_override` fields; the `ListHotelWorkersQuery` type will remain largely compatible but `is_active` filter semantics change | The types are not reusable across the storage model change because the response shape of a membership table record differs from a `User` row | 2h | HotelMembership schema ⚠ BLOCKED |
| `src/modules/hotel-workers/service.ts` | `REWRITE` | Entire storage model is wrong for marketplace architecture: assignment is stored as a mutation to `User.hotel_ids` (PostgreSQL array `push`); removal is a read-modify-write of the same array; `listHotelWorkers` queries `User` with `hotel_ids: { has: hotelId }` array containment (no index); no assignment history, no `assigned_by`, no `assigned_at`, no status; concurrent assign/remove not protected by unique constraint or transaction | This service must be completely rewritten to operate against a `HotelMembership` table; zero of its three methods can be patched — all three perform the wrong database operation | 6–8h | HotelMembership table creation, PRISMA_SCHEMA_V2_FREEZE.md ⚠ BLOCKED |
| `src/modules/hotel-workers/controller.ts` | `KEEP_WITH_PATCHES` | Thin HTTP layer; request parsing and response shaping are correct at the HTTP level; patches needed when response shape includes membership fields (`assigned_at`, `status`) | No structural conflict in the controller itself | 1–2h | Depends on service rewrite |
| `src/modules/hotel-workers/routes.ts` | `KEEP_WITH_PATCHES` | Route shapes (`GET /`, `POST /`, `DELETE /:worker_id`) are correct; `DELETE` route missing explicit permission guard `requirePermission('hotel_workers:write')`; `mergeParams: true` is correct for nested router | No structural conflict | 0.5h | — |

---

### Prisma Migration

| File | Classification | Reason | Architecture conflict | Effort | Depends on |
|---|---|---|---|---|---|
| `prisma/schema.prisma` | `REWRITE` | Seven schema problems: (1) `User.hotel_ids TEXT[]` — must be removed and replaced by HotelMembership table; (2) `User.permissions TEXT[]` — must be removed if permissions are derived from role at runtime; (3) `Hotel` has no `deleted_at` — GDPR soft delete gap; (4) `WorkerAssignment` partial unique index present in schema but absent from migration SQL; (5) `DataRetentionLog` FK `onDelete: Restrict` blocks GDPR user anonymisation; (6) `WorkerOverallRating` relation to `User` not declared on `User` model; (7) `DataRetentionLog`, `ConsentLog` relations not declared on `User` model | Two columns (`hotel_ids`, `permissions`) that are load-bearing for the entire Sprint 1 implementation must be removed; this is a non-trivial migration that invalidates all Sprint 1 code that touches those columns | 4–8h | ⚠ BLOCKED on PRISMA_SCHEMA_V2_FREEZE.md |
| `prisma/migrations/20260610000000_init/migration.sql` | `REWRITE` | The SQL file is a complete initial migration for all 24 tables; it is not wrong per se but: (1) creates `User.hotel_ids` and `User.permissions` which must be removed; (2) missing `Hotel.deleted_at`; (3) missing `WorkerAssignment` partial unique index; (4) missing `HotelMembership` table; (5) if the schema freeze introduces new columns or removes existing ones, this migration must be regenerated or patched with a follow-on migration | If this migration has been applied to a live database, the removal of `hotel_ids` and `permissions` requires a data migration (back-fill `HotelMembership`) before the columns can be dropped | 4–6h | ⚠ BLOCKED on PRISMA_SCHEMA_V2_FREEZE.md |
| `prisma/migrations/migration_lock.toml` | `KEEP_AS_IS` | PostgreSQL provider declaration; architecture-neutral | None | 0 | — |

---

### RBAC Middleware and Constants

| File | Classification | Reason | Architecture conflict | Effort | Depends on |
|---|---|---|---|---|---|
| `src/config/constants.ts` (ROLE_PERMISSIONS section) | `KEEP_WITH_PATCHES` | `ROLE_PERMISSIONS` map is a static role-to-permission string array; it is a valid interim implementation if runtime permission derivation is not required; must be updated to (1) remove `users:delete` from MANAGER (currently only ADMIN should have it, consistent with routes, but MANAGER does not have it in the map — this is already correct); (2) remove `hotel_workers:*` if those permissions are replaced by membership-table-derived checks; (3) add `super_admin` if that role is to be formalised | If marketplace RBAC requires dynamic per-hotel permission scoping (e.g., a MANAGER can only `tasks:write` for their assigned hotels), the flat string model is insufficient and this entire map must be replaced | 2–4h | RBAC spec ⚠ BLOCKED on MARKETPLACE_REFACTOR_MASTER_PLAN.md |

---

### Audit Logging

| File | Classification | Reason | Architecture conflict | Effort | Depends on |
|---|---|---|---|---|---|
| `src/lib/base-service.ts` (logAudit) | `KEEP_WITH_PATCHES` | Function signature and `AuditLog.create` call are correct; three gaps: (1) no `hotel_id`/tenant scoping on the `AuditLog` record — if marketplace requires per-tenant audit isolation, a `hotel_id` column must be added; (2) `actor_role` is a free-text string, not validated against the enum; (3) no `organization_id` field | Schema-level gap, not a service logic gap | 2h | AuditLog schema decision ⚠ BLOCKED |

---

### Unit Tests

| File | Classification | Reason | Architecture conflict | Effort | Depends on |
|---|---|---|---|---|---|
| `src/__tests__/auth.test.ts` | `KEEP_WITH_PATCHES` | 13 test cases; all pass; missing: `refreshToken`, `updateProfile` coverage; mock data includes `hotel_ids: []` and `permissions: [...]` which will become invalid after JWT redesign; test for `ROLE_PERMISSIONS` assignment is coupled to static constant | Mock data shape will change; two service methods are untested | 2–3h | JWT payload redesign |
| `src/__tests__/hotel.test.ts` | `KEEP_WITH_PATCHES` | 9 test cases; all pass; tests do not touch `hotel_ids` or `permissions` directly; missing: `updateHotel`, `listRooms`, `getRoom`, `updateRoom` coverage; `deleteHotel` test correctly asserts `is_active: false` | Lowest coupling to the storage model change; most durable tests in the suite | 2h | — |
| `src/__tests__/hotel-workers.test.ts` | `REWRITE` | 8 test cases; all pass against the current array model; every mock includes `hotel_ids: ['h1']` or `hotel_ids: []`; every assertion checks `result.hotel_ids.includes('h1')`; `mockPrisma.user.update` is called with `{ hotel_ids: { push: hotelId } }` — all of this becomes invalid when the service is rewritten to use a HotelMembership table | No portion of this test file survives the service rewrite; it must be rewritten from scratch against new mock objects | 3–4h | HotelWorkerService rewrite |
| `src/__tests__/users.test.ts` | `KEEP_WITH_PATCHES` | 8 test cases; all pass; `listUsers` filter test asserts `where.role === 'MANAGER'` but does not test `hotel_id` filter (which will change); `createUser` test does not assert `hotel_ids` or `permissions` column writes (these will be removed); otherwise sound | Low coupling to storage model change; `hotel_id` filter test must be added then updated | 2h | UserService rewrite |
| `src/__tests__/rbac.test.ts` | `KEEP_WITH_PATCHES` | 12 test cases; all pass; `checkHotelAccess` is tested against JWT `hotel_ids` array; when `checkHotelAccess` is rewritten to query the database, the mock must change from array data to a database mock; `super_admin` bypass path is not tested (unreachable dead code) | 4 of 12 tests for `checkHotelAccess` will require mock changes; `requireRole` and `requirePermission` tests will survive if those functions retain their current signatures | 2–3h | checkHotelAccess rewrite |

---

## PART 2: MODULE-LEVEL INVENTORY

| Module | Classification | Files affected | Core conflict | Blocked by missing docs? |
|---|---|---|---|---|
| **Auth** | `REWRITE` | service.ts, types.ts (partial) | Session strategy, JWT payload (hotel_ids + permissions), role-at-signup | Yes — PRISMA_SCHEMA_V2_FREEZE.md, API_SPEC_V1_PATCH_V2.md |
| **User** | `REWRITE` | service.ts, types.ts (partial) | hotel_ids array ops → HotelMembership join; permissions column → derived; tenant scoping missing | Yes — PRISMA_SCHEMA_V2_FREEZE.md |
| **Hotel (CRM)** | `KEEP_WITH_PATCHES` | service.ts, routes.ts, controller.ts | Hotel.deleted_at missing; /crm/ prefix may be wrong; task stub routes | Yes — API_SPEC_V1_PATCH_V2.md (prefix), schema freeze (deleted_at) |
| **HotelWorker** | `REWRITE` | service.ts, types.ts | Entire storage model: User.hotel_ids array → HotelMembership table | Yes — PRISMA_SCHEMA_V2_FREEZE.md, MARKETPLACE_REFACTOR_MASTER_PLAN.md |
| **Prisma Migration** | `REWRITE` | schema.prisma, migration SQL | User.hotel_ids and User.permissions must be removed; HotelMembership must be added; Hotel.deleted_at missing | Yes — PRISMA_SCHEMA_V2_FREEZE.md |
| **RBAC Middleware** | `REWRITE` | permissions.ts, constants.ts (partial) | checkHotelAccess reads stale JWT array; requirePermission reads stale JWT permissions; super_admin phantom role | Yes — MARKETPLACE_REFACTOR_MASTER_PLAN.md |
| **Audit Foundation** | `KEEP_WITH_PATCHES` | base-service.ts | Missing hotel_id/tenant scoping on AuditLog; actor_role is free-text; no read endpoint | Yes — schema freeze (AuditLog.hotel_id) |
| **Unit Tests** | Mixed | hotel-workers tests REWRITE; others KEEP_WITH_PATCHES | Coupled to wrong storage model (hotel_ids array mocks) | Indirectly — tests will change when services change |

---

## PART 3: MIGRATION ORDER

Migration order is constrained by foreign key and data dependency. Steps marked ⚠ BLOCKED cannot proceed until the missing documents are available.

```
Step 0: BLOCKED GATE
  ├── Obtain PRISMA_SCHEMA_V2_FREEZE.md
  ├── Obtain API_SPEC_V1_PATCH_V2.md
  ├── Obtain MARKETPLACE_REFACTOR_MASTER_PLAN.md
  ├── Obtain SCHEMA_RECONCILIATION_DECISION.md
  └── Obtain PR2_ARCHITECTURE_COMPLIANCE_AUDIT.md

Step 1: Schema migration (requires PRISMA_SCHEMA_V2_FREEZE.md)
  ├── 1a. Add HotelMembership table (new; no drop dependencies)
  ├── 1b. Backfill HotelMembership from User.hotel_ids (data migration)
  ├── 1c. Add Hotel.deleted_at column (nullable; no data migration needed)
  ├── 1d. Drop User.hotel_ids column (after 1b is verified)
  ├── 1e. Drop User.permissions column (after RBAC redesign is decided)
  ├── 1f. Add WorkerAssignment partial unique index (currently missing from SQL)
  └── 1g. Revisit DataRetentionLog FK onDelete: Restrict vs Cascade/SetNull

Step 2: JWT redesign (requires API_SPEC_V1_PATCH_V2.md)
  ├── 2a. Decide final JWT payload shape (remove hotel_ids? remove permissions?)
  ├── 2b. Rewrite src/lib/jwt.ts signTokens to new payload shape
  └── 2c. Update src/lib/types.ts AuthContext interface

Step 3: Session strategy decision (requires MARKETPLACE_REFACTOR_MASTER_PLAN.md)
  ├── Option A: Keep PostgreSQL Session table (no migration needed)
  └── Option B: Migrate to Redis / external IdP (requires dropping Session table)

Step 4: RBAC redesign (depends on Step 2, Step 3)
  ├── 4a. Decide: static ROLE_PERMISSIONS map vs dynamic DB-driven permissions
  ├── 4b. Rewrite permissions.ts checkHotelAccess to query HotelMembership (depends on Step 1a)
  ├── 4c. Rewrite permissions.ts requirePermission to not read JWT permissions array
  └── 4d. Resolve or formalise super_admin role

Step 5: Auth module rewrite (depends on Steps 2, 3, 4)
  ├── 5a. Remove hotel_ids and permissions from signup/login token signing
  ├── 5b. Remove role from public signup schema (if marketplace gates role assignment)
  └── 5c. Update Session creation/rotation logic per Step 3 decision

Step 6: HotelWorker module rewrite (depends on Step 1a)
  ├── 6a. Rewrite service to CRUD on HotelMembership table
  ├── 6b. Update types to include membership fields (assigned_at, status, assigned_by)
  └── 6c. Rewrite tests

Step 7: User module rewrite (depends on Steps 1d, 1e, 4)
  ├── 7a. Remove hotel_ids and permissions writes from createUser, updateUser
  ├── 7b. Replace hotel_id array-containment filter with HotelMembership join
  └── 7c. Add tenant scoping to listUsers

Step 8: Hotel (CRM) module patches (depends on Step 1c, Step 2)
  ├── 8a. Update deleteHotel to write Hotel.deleted_at
  ├── 8b. Remove 501 stub routes for task and photo creation
  └── 8c. Verify /crm/ prefix against API spec (⚠ BLOCKED on API_SPEC_V1_PATCH_V2.md)

Step 9: Test suite updates (depends on Steps 5–8)
  ├── 9a. Rewrite hotel-workers tests (full rewrite)
  ├── 9b. Patch auth tests (mock data shape change)
  ├── 9c. Patch users tests (hotel_id filter and column write assertions)
  ├── 9d. Patch rbac tests (checkHotelAccess mock changes)
  └── 9e. Add missing test coverage (refreshToken, updateProfile, updateHotel, etc.)
```

---

## PART 4: REFACTOR ORDER

Refactor order is constrained by interface dependencies (changes to lower layers break higher layers).

```
Layer 0 — Schema (must go first; all other layers depend on it)
  → prisma/schema.prisma
  → prisma/migrations/

Layer 1 — Core library (depends only on schema)
  → src/lib/jwt.ts                    (REWRITE)
  → src/lib/types.ts                  (KEEP_WITH_PATCHES)
  → src/lib/base-service.ts           (KEEP_WITH_PATCHES)

Layer 2 — Middleware (depends on Layer 1)
  → src/middleware/auth.ts            (KEEP_WITH_PATCHES — after jwt.ts)
  → src/middleware/permissions.ts     (REWRITE — after jwt.ts + HotelMembership)

Layer 3 — Auth service (depends on Layer 2, schema)
  → src/modules/auth/service.ts       (REWRITE)
  → src/modules/auth/types.ts         (KEEP_WITH_PATCHES)

Layer 4 — HotelWorker service (depends on Layer 2, schema)
  → src/modules/hotel-workers/service.ts   (REWRITE — first beneficiary of HotelMembership)
  → src/modules/hotel-workers/types.ts     (REWRITE)

Layer 5 — User service (depends on Layer 2, 4, schema)
  → src/modules/users/service.ts      (REWRITE — after hotel_ids removed, HotelMembership available)
  → src/modules/users/types.ts        (KEEP_WITH_PATCHES)

Layer 6 — Hotel (CRM) service (depends on Layer 2)
  → src/modules/crm/service.ts        (KEEP_WITH_PATCHES — lower urgency)
  → src/modules/crm/routes.ts         (KEEP_WITH_PATCHES)

Layer 7 — Controllers (depends on Layer 3–6)
  → src/modules/auth/controller.ts         (KEEP_WITH_PATCHES)
  → src/modules/hotel-workers/controller.ts (KEEP_WITH_PATCHES)
  → src/modules/users/controller.ts        (KEEP_WITH_PATCHES)
  → src/modules/crm/controller.ts          (KEEP_WITH_PATCHES)

Layer 8 — Tests (depends on Layers 3–7 being stable)
  → src/__tests__/hotel-workers.test.ts    (REWRITE)
  → src/__tests__/auth.test.ts             (KEEP_WITH_PATCHES)
  → src/__tests__/users.test.ts            (KEEP_WITH_PATCHES)
  → src/__tests__/rbac.test.ts             (KEEP_WITH_PATCHES)
  → src/__tests__/hotel.test.ts            (KEEP_WITH_PATCHES — lowest urgency)

Layer 9 — Routes and index (depends on Layers 3–7)
  → src/routes/v1/index.ts            (KEEP_WITH_PATCHES — last, after all modules stable)
  → src/config/constants.ts           (KEEP_WITH_PATCHES)
  → src/config/env.ts                 (KEEP_WITH_PATCHES)
```

---

## PART 5: ESTIMATED ENGINEERING EFFORT

Effort ranges assume a single engineer familiar with the codebase. Lower bound = minimal changes only; upper bound = full implementation including tests.

| Area | Task | Effort (hours) | Blocked? |
|---|---|---|---|
| Schema | Obtain and review missing documents | 1–2 | Yes — external |
| Schema | Write HotelMembership migration + data backfill | 4–6 | Yes — PRISMA_SCHEMA_V2_FREEZE.md |
| Schema | Drop hotel_ids, permissions columns from User | 1–2 | Yes — after backfill verified |
| Schema | Add Hotel.deleted_at, fix WorkerAssignment index | 1 | Yes — schema freeze |
| Schema | AuditLog tenant scoping column (if required) | 1–2 | Yes — schema freeze |
| JWT | Redesign payload, rewrite jwt.ts | 3–4 | Yes — API_SPEC_V1_PATCH_V2.md |
| JWT | Update AuthContext, auth.ts middleware | 1 | After jwt.ts |
| Session | Decide strategy, implement change if needed | 0 (keep PG) – 8 (Redis/IdP) | Yes — MARKETPLACE_REFACTOR_MASTER_PLAN.md |
| RBAC | Rewrite permissions.ts (all 3 functions) | 4–6 | Yes — MARKETPLACE_REFACTOR_MASTER_PLAN.md |
| RBAC | Update ROLE_PERMISSIONS or replace with DB | 2–4 | Yes — RBAC spec |
| Auth | Rewrite auth service | 6–8 | Yes — multiple docs |
| Auth | Patch auth controller, types | 2 | After service rewrite |
| HotelWorker | Rewrite service + types | 6–8 | Yes — PRISMA_SCHEMA_V2_FREEZE.md |
| HotelWorker | Patch controller, routes | 2 | After service rewrite |
| User | Rewrite service + types patches | 4–6 | Yes — schema freeze |
| User | Patch controller, routes | 1 | After service rewrite |
| Hotel/CRM | Patch service (deleted_at, remove stubs) | 2–3 | Yes — API_SPEC_V1_PATCH_V2.md |
| Tests | Rewrite hotel-workers tests | 3–4 | After HotelWorker rewrite |
| Tests | Patch auth, users, rbac tests | 4–6 | After respective rewrites |
| Tests | Add missing test coverage (13+ untested methods) | 6–8 | After service rewrites |
| **TOTAL (unblocked, available immediately)** | Audit foundation patch, Hotel patches, test gaps in hotel.test.ts, constants.ts cleanup, routes minor fixes | **~8–12h** | No |
| **TOTAL (requires missing documents)** | All schema, JWT, Session, RBAC, Auth, HotelWorker, User rewrites | **~60–90h** | Yes |
| **GRAND TOTAL** | | **~68–102h** | — |

---

## PART 6: SPRINT 1 COMPLETION PERCENTAGE AGAINST MARKETPLACE ARCHITECTURE

**Methodology:** Each of the 8 Sprint 1 deliverables is assessed on two axes:
- **Functional completeness** (does it do what the deliverable requires)
- **Architectural alignment** (does it follow the marketplace architecture)

Since the marketplace architecture is not fully specified (5 of 6 reference documents are missing), architectural alignment is assessed against violations documented in SPRINT_1_COMPLIANCE_REPORT.md.

| Deliverable | Functional completeness | Architectural alignment | Combined score |
|---|---|---|---|
| Auth Module | 83% (5/6 endpoints work; refreshToken untested; role-at-signup not gated) | 30% (JWT payload carries stale hotel_ids + permissions; Session in PG unresolved; admin signup open) | **57%** |
| User Module | 80% (4/5 methods work; updateUser has no test; tenant scoping absent) | 35% (hotel_ids and permissions written to DB; no tenant scope on list; hotel_id filter uses array not join) | **58%** |
| Hotel Module | 70% (hotels and rooms work; no Room delete; two 501 stubs registered; Hotel.deleted_at missing) | 60% (functionally sound; checkHotelAccess stale JWT problem lives in middleware not here; /crm/ prefix unconfirmed) | **65%** |
| HotelWorker Module | 75% (assign, remove, list work; no test for list pagination; no test for search filter) | 10% (entire storage model is wrong: array not junction table; no assignment history; no atomic constraint; stale JWT access check) | **43%** |
| Prisma Migration | 60% (24 tables created; all FK constraints present; WorkerAssignment partial index missing; 18 tables have no route coverage) | 25% (User.hotel_ids and User.permissions present; HotelMembership absent; Hotel.deleted_at absent; partial index missing) | **43%** |
| RBAC Middleware | 80% (requireRole and requirePermission work correctly for current model; wildcard support present) | 25% (checkHotelAccess reads stale JWT; requirePermission reads stale JWT; super_admin phantom role unreachable; flat permission model cannot do per-hotel scoping) | **53%** |
| Audit Foundation | 85% (logAudit in BaseService works; 16 audit call sites; correct resource types) | 65% (structurally compatible; missing hotel_id scoping; actor_role is free text; no read endpoint; no retention enforcement) | **75%** |
| Unit Tests | 60% (45 passing tests; 13+ untested methods; no HTTP integration tests; Zod schemas untested) | 55% (test structure is sound; hotel-workers tests are coupled to wrong storage model; all tests will need updates after rewrites) | **58%** |

### Weighted average

| Deliverable | Weight (equal) | Score |
|---|---|---|
| Auth Module | 12.5% | 57% |
| User Module | 12.5% | 58% |
| Hotel Module | 12.5% | 65% |
| HotelWorker Module | 12.5% | 43% |
| Prisma Migration | 12.5% | 43% |
| RBAC Middleware | 12.5% | 53% |
| Audit Foundation | 12.5% | 75% |
| Unit Tests | 12.5% | 58% |

**Sprint 1 completion against marketplace architecture: 57%**

### What this means

Sprint 1 has delivered the correct module structure and the correct HTTP surface area. All 8 deliverable areas have working code. The 43% gap is concentrated in three areas:

1. **Storage model** — `User.hotel_ids` and `User.permissions` are denormalised arrays where the marketplace architecture requires a junction table (`HotelMembership`) and runtime-derived permissions. This single decision contaminates Auth, User, HotelWorker, RBAC middleware, Prisma migration, and 4 test files simultaneously.

2. **JWT payload design** — Embedding `hotel_ids` and `permissions` in the token makes the RBAC enforcement layer stale by design. Fixing this requires coordinated changes across `jwt.ts`, `auth.ts`, `permissions.ts`, `AuthContext`, and the auth service's signing logic.

3. **Missing documents** — The schema freeze, API spec, and marketplace refactor plan that would define the correct target state are not in the repository. The 57% figure is an upper bound; if those documents specify additional constraints (e.g., different table names, different JWT claims, different route prefixes), the effective completion percentage could be lower.

---

## APPENDIX: FILES THAT CAN BE ACTIONED IMMEDIATELY (No blocking documents required)

These files have no dependency on the missing documents and can be patched in any sprint:

| File | Action | Effort |
|---|---|---|
| `src/middleware/permissions.ts` | Remove unreachable `super_admin` bypass branch | 0.5h |
| `src/modules/crm/routes.ts` | Remove the two 501 stub routes | 0.5h |
| `src/modules/crm/controller.ts` | Remove `uploadPhoto` stub handler | 0.5h |
| `src/modules/users/routes.ts` | Add `requirePermission('users:delete')` to DELETE route | 0.5h |
| `src/modules/hotel-workers/routes.ts` | Add `requirePermission('hotel_workers:write')` to DELETE route | 0.5h |
| `src/__tests__/auth.test.ts` | Add `refreshToken` and `updateProfile` test cases | 2h |
| `src/__tests__/hotel.test.ts` | Add `updateHotel`, `listRooms`, `getRoom`, `updateRoom` test cases | 2h |
| `src/__tests__/users.test.ts` | Add `updateUser` test case | 1h |
| `src/lib/base-service.ts` | Change `actor_role` write to use validated enum value | 0.5h |
| `backend/.env.example` | Add `JWT_REFRESH_SECRET` and `APNS_PRIVATE_KEY_BASE64` per PATCH_V2 | 0.5h |

**Total immediately actionable work: ~8–9 hours. No architectural decisions required.**
