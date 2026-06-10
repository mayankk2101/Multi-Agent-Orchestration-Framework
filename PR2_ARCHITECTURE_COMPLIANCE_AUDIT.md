# PR #2 Architecture Compliance Audit
**PR:** feat: complete auth module + repair Prisma schema relations  
**Head branch:** `fix/backend-blockers` (SHA: f676ac60)  
**Base branch:** `main` (SHA: bd9e14f7)  
**Audit date:** 2026-06-10  
**Status:** ANALYSIS ONLY — no merge, no code changes

---

## Authoritative Reference Documents

| Document | Status | Role in This Audit |
|---|---|---|
| `MARKETPLACE_REFACTOR_MASTER_PLAN.md` | FROZEN | Entity chain, module removal/keep/modify orders |
| `docs/PRISMA_SCHEMA_V2_FREEZE.md` | APPROVED_WITH_MINOR_FOLLOWUPS | Canonical schema definition, constraints, enums |
| `docs/API_SPEC_V1_PATCH_V2.md` | APPROVED_WITH_PATCHES | Auth endpoint surface, DTOs, RBAC matrix |
| `TESTING_MASTER_PLAN_FREEZE.md` | APPROVED — FROZEN | Test stack, CI config, fixture contracts |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` | APPROVED | JWT secret strategy, deployment, GDPR gates |
| `MERGE_CONFLICT_RESOLUTION_REPORT.md` | Analysis | Per-file conflict inventory |

---

## Summary Verdict Table

| File | Reusable | Architecture Conflicts | Implementation Conflicts | Naming Conflicts | Schema Conflicts | Verdict |
|------|----------|----------------------|------------------------|-----------------|-----------------|---------|
| `backend/prisma/schema.prisma` | Low | CRITICAL — 8 | 3 | 2 | CRITICAL — 12 | **REMOVE** |
| `backend/src/lib/jwt.ts` | Partial | 0 | 1 BLOCKER | 0 | 0 | **MODIFY** |
| `backend/src/modules/auth/service.ts` | Partial | 3 | 4 | 1 | 2 | **MODIFY** |
| `backend/src/modules/auth/controller.ts` | High | 1 | 1 | 0 | 0 | **MODIFY** |
| `backend/src/modules/auth/routes.ts` | Partial | 2 | 1 | 1 | 0 | **MODIFY** |
| `backend/src/modules/auth/types.ts` | High | 1 | 0 | 0 | 0 | **MODIFY** |
| `backend/package.json` | Low | 0 | 1 CRITICAL | 0 | 0 | **REMOVE** |
| `backend/src/app.ts` | High | 0 | 0 | 0 | 0 | **KEEP** |
| `backend/src/modules/crm/*` | Low | CRITICAL — 3 | 2 | 0 | 2 | **REMOVE** |
| `package-lock.json` | N/A | 0 | 1 CRITICAL | 0 | 0 | **REMOVE** |

---

## Overall PR Disposition

**SPLIT — Do not merge as a single PR.**

Three independent streams of work are bundled together in PR #2:
1. **Auth code quality improvements** (argon2, deleteAccount, controller pattern, validation separation) — partially compliant; requires targeted fixes before merge.
2. **Schema** — the PR schema is a pre-V2 CRM schema that directly contradicts every frozen architecture document. The correct schema already exists on `main`. The PR's schema must not be merged.
3. **Test runner change** (vitest) — directly violates `TESTING_MASTER_PLAN_FREEZE` which mandates Jest + Supertest. This is a hard conflict with a frozen document.

Recommended split:
- **Stream A:** Extract auth code improvements (service, controller, routes, types, lib/jwt) into a new PR against main's V2 schema. Apply the MODIFY instructions in this document before merging.
- **Stream B:** Schema PR — no action needed; main already has the correct V2 schema.
- **Stream C:** Test runner decision — open a separate architecture discussion before changing from jest to vitest. The frozen test plan must be superseded with a new freeze if vitest is chosen.

---

## 1. `backend/prisma/schema.prisma`

### Reusable portions
- `User`, `Session`, `Hotel`, `Notification`, `AuditLog`, `WorkerOverallRating` — core field shapes are structurally compatible with V2 after normalization.
- HR/compliance model shapes (`Contract`, `ContractTemplate`, `Payroll`, `WorkerDocument`, `ConsentLog`, `DataRetentionLog`) — these are Phase 2 candidates. Their existence in the PR is ahead of schedule, not wrong in intent.

### Architecture conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| A-1 | `Room`, `Task`, `TaskPhoto`, `DailyOperation` models present | MARKETPLACE_REFACTOR_MASTER_PLAN Part 1-B: explicit `REMOVE` with drop order SQL | CRITICAL |
| A-2 | `WorkApplication` model absent | PRISMA_SCHEMA_V2_FREEZE §1: mandatory marketplace entity; "mandatory marketplace flow" — every assignment must trace back to an accepted application | CRITICAL |
| A-3 | `Attendance` model absent | PRISMA_SCHEMA_V2_FREEZE §1: core MVP entity with full lifecycle enum | CRITICAL |
| A-4 | `QualityVerification` links to `task_id` not `assignment_id` | API_SPEC_V1_PATCH_V2 PATCH-02, MARKETPLACE_REFACTOR_MASTER_PLAN Part 1-C step 10–11 | CRITICAL |
| A-5 | `Rating` links to `task_id` not `assignment_id` | API_SPEC_V1_PATCH_V2 PATCH-02, MARKETPLACE_REFACTOR_MASTER_PLAN Part 1-C step 12–13 | CRITICAL |
| A-6 | `HotelWorker` model absent | PRISMA_SCHEMA_V2_FREEZE §1: core marketplace entity for hotel enrollment | CRITICAL |
| A-7 | `User.hotel_ids String[]` present | PRISMA_SCHEMA_V2_FREEZE migration step 2: explicitly dropped; API_SPEC_V1_PATCH_V2 PATCH-04: hotel_ids removed from all User DTOs; replaced by HotelWorker membership | CRITICAL |
| A-8 | `WorkerAssignment` has no `application_id` FK | PRISMA_SCHEMA_V2_FREEZE §3: "WorkApplication ──| WorkerAssignment [Restrict]"; SP-3 mandates non-nullable FK | CRITICAL |

### Implementation conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| I-1 | `WorkerAssignment.@@unique([worker_id, status])` present — over-constrains | PRISMA_SCHEMA_V2_FREEZE §4: SP-5 removed this; partial unique index (active-status only) replaces it | HIGH |
| I-2 | `Notification.type` is `String` not `NotificationType` enum | PRISMA_SCHEMA_V2_FREEZE §2: NotificationType enum frozen with 17 domain event values; "Adding a type requires a schema migration" | HIGH |
| I-3 | `AuditLog.actor_role` is `String?` not `UserRole?` | PRISMA_SCHEMA_V2_FREEZE schema: typed `UserRole?` | MEDIUM |

### Naming conflicts

| # | Conflict | Canonical Name | Severity |
|---|----------|---------------|----------|
| N-1 | `WorkerAssignment.assigned_by_manager_id` vs canonical `assigned_by_id` | PRISMA_SCHEMA_V2_FREEZE | LOW |
| N-2 | `WorkRequest.created_by_manager_id` vs canonical `created_by_id` | PRISMA_SCHEMA_V2_FREEZE | LOW |

### Schema conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| S-1 | `Session.refresh_token` lacks `@unique` constraint | PRISMA_SCHEMA_V2_FREEZE §4 unique constraint table: `Session.refresh_token` must be unique | CRITICAL |
| S-2 | `WorkRequest.status` is `String @default("OPEN")` not `WorkRequestStatus` enum | PRISMA_SCHEMA_V2_FREEZE §2: `WorkRequestStatus` frozen with 6 values | HIGH |
| S-3 | `WorkerAssignment.status` is `String @default("ASSIGNED")` not `AssignmentStatus` enum | PRISMA_SCHEMA_V2_FREEZE §2: `AssignmentStatus` frozen with 6 values | HIGH |
| S-4 | `HotelWorkerStatus` enum absent | PRISMA_SCHEMA_V2_FREEZE §2: frozen lifecycle INVITED → ACTIVE ↔ SUSPENDED → REMOVED | HIGH |
| S-5 | `AttendanceStatus` enum absent (Attendance model absent entirely) | PRISMA_SCHEMA_V2_FREEZE §2 | HIGH |
| S-6 | `VerificationStatus` enum absent | PRISMA_SCHEMA_V2_FREEZE §2 | MEDIUM |
| S-7 | `WorkerOverallRating.onDelete: Restrict` vs `Cascade` | PRISMA_SCHEMA_V2_FREEZE cascade rules §3 | MEDIUM |
| S-8 | `WorkerOverallRating` missing `total_assignments`, `completion_rate`, `on_time_rate`, `last_worked_at` | PRISMA_SCHEMA_V2_FREEZE migration step 11 | MEDIUM |
| S-9 | `WorkRequest.version` (SP-9 optimistic locking) absent | PRISMA_SCHEMA_V2_FREEZE §5 Control 3 | MEDIUM |
| S-10 | `Attendance.expected_start`, `expected_end`, `is_verified`, `minutes_late`, `minutes_worked` absent | PRISMA_SCHEMA_V2_FREEZE: full Attendance field list | MEDIUM |
| S-11 | `WorkApplication.status` is `String` not `ApplicationStatus` enum | PRISMA_SCHEMA_V2_FREEZE §2: ApplicationStatus frozen | HIGH |
| S-12 | `Hotel` missing `contact_email`, `contact_phone` columns | PRISMA_SCHEMA_V2_FREEZE migration step 3 | LOW |

### Phase 2 candidates in PR schema

| Model | Canonical Status | Notes |
|-------|-----------------|-------|
| `Contract`, `ContractTemplate`, `ContractLineItem` | Phase 2 — HR module | INFRASTRUCTURE_PLAN references ConsentLog as GDPR deployment gate |
| `WorkerDocument`, `RequiredDocument` | Phase 2 — HR compliance | — |
| `Payroll`, `PayrollLineItem` | Phase 2 — Payroll module | INFRASTRUCTURE_PLAN §PATCH-08 retention table |
| `DataRetentionLog` | Phase 2 — GDPR | INFRASTRUCTURE_PLAN references as background job |
| `ConsentLog` | Phase 2 BUT near-MVP — GDPR | INFRASTRUCTURE_PLAN PATCH-08: "Consent tracking live before first registration" is a hard production gate |

**Verdict: REMOVE from merge.** The canonical V2 schema already exists on `main` and has been through a full review and freeze cycle (PRISMA_SCHEMA_V2_FREEZE). The PR schema is incompatible at every architectural layer. The Phase 2 compliance models should be extracted and planned as a separate migration.

---

## 2. `backend/src/lib/jwt.ts`

### Reusable portions
- `SignOptions` typing approach (replacing `as any` with `as SignOptions['expiresIn']`) — strictly better, keep.
- Full token shape: `AccessTokenPayload`, `RefreshTokenPayload`, `JwtTokens` interfaces — compatible with V2.
- `verifyAccessToken`, `extractTokenFromHeader` — functionally identical on both branches; keep PR version.
- `signTokens`, `parseExpiryToSeconds` — logic correct; keep PR's cleaner formatting.

### Architecture conflicts
None. The JWT token structure is architecturally compatible with the V2 entity chain.

### Implementation conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| I-1 | PR uses `env.JWT_SECRET` for both access and refresh token signing/verification. No `JWT_REFRESH_SECRET` support. | INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2 PATCH-06 explicitly mandates "OPTION A — Two Separate Secrets". Rationale: rotating JWT_SECRET should not invalidate refresh tokens. The infrastructure secret table has separate entries for `JWT_SECRET` and `JWT_REFRESH_SECRET` with separate rotation procedures. | BLOCKER |

### Implementation detail: PR vs canonical on refresh secret

```
Canonical (INFRA_PLAN PATCH-06):
  signRefreshToken:   signs with JWT_REFRESH_SECRET
  verifyRefreshToken: verifies with JWT_REFRESH_SECRET
  env.ts Zod schema:  JWT_REFRESH_SECRET: z.string().min(32)

PR:
  signRefreshToken:   signs with JWT_SECRET only
  verifyRefreshToken: verifies with JWT_SECRET only
  (no JWT_REFRESH_SECRET in scope)
```

Rotation procedure in INFRA_PLAN PATCH-06: "rotating the refresh secret forces all users to re-login" and "purge Session table to force immediate re-login". This procedure is only meaningful if refresh tokens use a separate secret. PR makes this rotation mechanism inert.

### Additional implementation note

`parseExpiryToSeconds` is private (not exported) in the PR. Main exports it. Whether other callers need it is determined by usage scanning — mark as **MODIFY** (export it).

**Verdict: MODIFY.**
- Keep PR's `SignOptions` typing.
- Restore `JWT_REFRESH_SECRET ?? JWT_SECRET` fallback on both `signRefreshToken` and `verifyRefreshToken`.
- Export `parseExpiryToSeconds`.

---

## 3. `backend/src/modules/auth/service.ts`

### Reusable portions
- `argon2` for password hashing — security improvement over bcryptjs.
- `deleteAccount()` — soft-delete + session invalidation + AuditLog write. Pattern is correct; schema-independent.
- `formatAuthResponse()`, `formatTokenResponse()`, `formatUserResponse()` private helpers — clean extraction; keep.
- Basic `signup`, `login`, `refreshToken`, `logout`, `getCurrentUser`, `updateProfile` structure — functionally compatible with V2 after targeted fixes.

### Architecture conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| A-1 | `exportUserData()` queries `prisma.task`, `prisma.contract`, `prisma.workerDocument`, `prisma.payroll` | MARKETPLACE_REFACTOR_MASTER_PLAN: Task is `REMOVE`; Contract/Payroll/WorkerDocument are Phase 2 not yet in V2 schema | CRITICAL — compile-time failure against V2 schema |
| A-2 | `hotel_ids` embedded in JWT payload: `signTokens({ ..., hotel_ids: user.hotel_ids, ... })` | API_SPEC_V1_PATCH_V2 PATCH-04: "Remove hotel_ids from all User Response DTOs"; hotel access authorization now uses HotelWorker membership check not hotel_ids in JWT | HIGH |
| A-3 | `signup()` sets `hotel_ids: hotel_ids || []` on user creation | PRISMA_SCHEMA_V2_FREEZE migration step 2: `hotel_ids` column dropped from User; MARKETPLACE_REFACTOR_MASTER_PLAN Phase 1-E step 20: "Drop User.hotel_ids String[] column" | HIGH |

### Implementation conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| I-1 | No IP address tracking on `signup`, `login`, `updateProfile` | `MERGE_CONFLICT_RESOLUTION_REPORT.md` §6: main captures `ip?` for AuditLog; INFRASTRUCTURE_PLAN references GDPR audit obligations; `AuditLog` schema has `ip_address` field | MEDIUM |
| I-2 | Disabled account throws `UnauthorizedError` (401) not `ForbiddenError` (403) | HTTP semantic standard: 401 = not authenticated, 403 = authenticated but not authorized. Disabled account is an authorization decision, not an authentication failure. | MEDIUM |
| I-3 | `getDefaultPermissions()` inlined in service — duplicates `ROLE_PERMISSIONS` constant | TESTING_MASTER_PLAN_FREEZE: `tokenFor()` auth helper uses `user.permissions`; canonical constant source is `config/constants.ts` | LOW |
| I-4 | No `logAudit()` calls on core auth flows (signup, login, logout) | `AuditLog` model in PRISMA_SCHEMA_V2_FREEZE §1 is the compliance record; INFRA_PLAN PATCH-08 "AuditLog rows must never be bulk-deleted — 5 year retention" implies they must be written | MEDIUM |

### Naming conflicts

| # | Conflict | Canonical Name | Severity |
|---|----------|---------------|----------|
| N-1 | `role: user.role` in JWT payload → uppercase enum string (`"WORKER"`) vs `role: user.role.toLowerCase()` in main → lowercase (`"worker"`) | TESTING_MASTER_PLAN_FREEZE auth helper: `tokenFor()` uses `user.role` raw. But `requireRole('admin')` in routes uses lowercase. Mixed casing is latent bug. | HIGH |

### Schema conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| S-1 | `exportUserData()` calls `prisma.task.findMany` — `Task` model removed in V2 | PRISMA_SCHEMA_V2_FREEZE §1: "Removed from V1: Room, Task, TaskPhoto, DailyOperation" | CRITICAL |
| S-2 | `exportUserData()` calls `prisma.contract.findMany`, `prisma.payroll.findMany`, `prisma.workerDocument.findMany` — Phase 2 models not in V2 schema | PRISMA_SCHEMA_V2_FREEZE: not in entity list | HIGH |

### Phase 2 candidates
- `exportUserData()` — the method's intent is correct (GDPR data export; API_SPEC_V1_PATCH_V2 GDPR section: `POST /gdpr/data-export`). Must be rewritten against V2 entities (`WorkApplication`, `WorkerAssignment`, `Attendance`, `Rating`) plus Phase 2 models when available.

**Verdict: MODIFY.**
- Remove `hotel_ids` from `signTokens` payload and user creation (or replace with empty array pending HotelWorker migration).
- Remove `exportUserData()` from MVP scope; stub it or move to Phase 2 backlog.
- Restore IP parameter on compliance-relevant operations.
- Restore `ForbiddenError` for disabled account.
- Restore audit logging on signup/login/logout.
- Standardise role casing in JWT (pick `toLowerCase()` to match `requireRole()` call sites).
- Import permissions from `config/constants.ts`.

---

## 4. `backend/src/modules/auth/controller.ts`

### Reusable portions
- Thin-controller pattern (plain async methods, no embedded validation arrays) — cleaner than main's approach; aligns with route-level validation.
- `signup`, `login`, `refreshToken`, `logout`, `getCurrentUser`, `updateProfile` — all structurally correct.
- `deleteAccount` — compatible with V2 schema.
- `exportUserData` — intent correct; body must be rewritten (see service.ts analysis).

### Architecture conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| A-1 | `exportUserData` routes to `authService.exportUserData()` which queries removed/Phase 2 models | Same as service.ts A-1. The controller itself is structurally fine; the issue is the service method it delegates to. | HIGH |

### Implementation conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| I-1 | `logout()` calls `authService.logout(req.auth.userId)` with no refresh token argument — deletes ALL sessions. Main passes `req.body?.refresh_token` for targeted session deletion. | Targeted logout (single device) vs blanket logout (all devices). The `Session` model exists precisely to support per-device sessions. Blanket logout breaks multi-device scenarios. | MEDIUM |

**Verdict: MODIFY.**
- Restore optional `refresh_token` argument to `logout()` for targeted session deletion.
- Keep `exportUserData` handler but mark dependent service method as Phase 2 pending.

---

## 5. `backend/src/modules/auth/routes.ts`

### Reusable portions
- Route-level validation pattern (explicit `validateBody(Schema)` on each route) — correct and clean.
- Import from `./validation.js` — correct separation.
- 8-route structure — net additions (`DELETE /account`, `GET /account/export`) are legitimate.

### Architecture conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| A-1 | `GET /account/export` path. GDPR export is specified at `POST /gdpr/data-export` in API_SPEC_V1_PATCH_V2 GDPR section, not `GET /auth/account/export`. | API_SPEC_V1_PATCH_V2 Final API Surface §GDPR: "POST /gdpr/data-export — roles: ADMIN, self" | MEDIUM |
| A-2 | `DELETE /account` path. GDPR deletion is specified at `POST /gdpr/data-deletion` in API_SPEC_V1_PATCH_V2, not `DELETE /auth/account`. | API_SPEC_V1_PATCH_V2 Final API Surface §GDPR: "POST /gdpr/data-deletion — roles: ADMIN" | MEDIUM |

### Implementation conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| I-1 | `requireRole('admin')` on `POST /signup`. Per API_SPEC_V1_PATCH_V2 Final API Surface §Auth (5 endpoints), there is no `POST /auth/signup` in the canonical auth API surface. User creation is at `POST /users` (ADMIN only). The auth module's login/refresh/logout/me surface does not include user registration. The `requireRole('admin')` guard is therefore either: (a) a correct access guard if signup = admin-creates-user, or (b) an erroneous guard if signup = self-registration. | API_SPEC_V1_PATCH_V2 §Auth: 5 endpoints — login, refresh, logout, me, password-reset. No signup. | HIGH |

### Naming conflicts

| # | Conflict | Canonical Name | Severity |
|---|----------|---------------|----------|
| N-1 | `requireRole('admin')` passes lowercase string `'admin'`. Role casing in JWT is uppercase `'ADMIN'` per PR's service.ts. If service is fixed to emit lowercase role, the guard is correct. If service emits uppercase, the guard silently never matches. | Depends on role casing decision in service.ts. | HIGH |

**Verdict: MODIFY.**
- Resolve `requireRole('admin')` for signup against the canonical API spec decision: if signup = user creation (admin-only), keep the guard and align with `POST /users` RBAC. If signup = self-registration, remove the guard.
- Move `DELETE /account` → `POST /gdpr/data-deletion` routing.
- Move `GET /account/export` → `POST /gdpr/data-export` routing.
- These belong in a future `gdpr` module router, not auth.

---

## 6. `backend/src/modules/auth/types.ts`

### Reusable portions
- Interfaces-only `types.ts` (runtime validation schemas in `validation.ts`) — correct separation; reusable.
- Enriched `AuthUser` fields (`phone?`, `profile_photo_url?`, `updated_at?`) — additive; compatible.
- `AuthTokens` interface — clean rename from `AuthResponse`.

### Architecture conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| A-1 | `AuthUser.hotel_ids: string[]` present in the interface | API_SPEC_V1_PATCH_V2 PATCH-04: "User Response DTO — After: remove hotel_ids". All endpoints returning User objects must drop hotel_ids. | HIGH |

**Verdict: MODIFY.**
- Remove `hotel_ids` from `AuthUser` interface.
- All other changes are improvements; keep.

---

## 7. `backend/package.json`

### Reusable portions
- `argon2` dependency — security improvement. Compatible with canonical architecture *if* the frozen test plan is revised to use argon2 in fixtures.
- Script structure intent (test watch mode, dev/build/start scripts) — directionally correct.

### Architecture conflicts
None at the architecture level.

### Implementation conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| I-1 | PR replaces Jest + Supertest with Vitest. `TESTING_MASTER_PLAN_FREEZE` mandates: stack = "Express.js · TypeScript · Prisma · PostgreSQL · **Jest · Supertest**". The freeze document includes: `jest.config.ts` (full config), `package.json` scripts (`test:unit`, `test:integration`, `test:e2e`, `test:ci` all reference jest), CI YAML files (`npm run test:unit -- --coverage --coverageReporters=lcov,json` against jest), `jest-mock-extended` for unit mocking, `db-seeds.ts` importing `bcrypt` (not argon2). Switching to vitest invalidates all of this. | TESTING_MASTER_PLAN_FREEZE: status APPROVED — FROZEN. "This document is the canonical testing source of truth. No further audits or patches are required. Implement directly from this document." | CRITICAL |

**Critical note on the argon2/bcrypt interaction:**
`TESTING_MASTER_PLAN_FREEZE` `db-seeds.ts` line: `await bcrypt.hash('Test1234!', 10)` — the test seed hashes passwords with bcrypt. If the production service uses argon2, argon2.verify() on a bcrypt hash will fail. The frozen test suite cannot authenticate test users against a service that uses argon2. This is a systemic test breakage that cannot be patched by just adding a package; the fixture strategy must be updated.

**Verdict: REMOVE from merge.** The test runner change requires a superseding version of `TESTING_MASTER_PLAN_FREEZE` before it can be accepted. This is a governance process, not a code review. Separately:
- `argon2` as a dependency is desirable but requires updating `db-seeds.ts` and all auth test fixtures.
- If the decision is to switch to vitest, a new `TESTING_MASTER_PLAN_V2` document is required.
- If the decision is to keep Jest, the service.ts must switch back to bcryptjs or the fixtures must be updated.

---

## 8. `backend/src/app.ts`

### Change description
The PR makes 1 deletion (0 additions). Based on context, this is a minor import or route cleanup. No architectural concern identified.

### Architecture conflicts
None.

### Implementation conflicts
None at the level visible from the diff summary.

**Verdict: KEEP.** The single-line deletion is likely a cleanup of a legacy import that no longer exists in the PR's module structure. Safe to take.

---

## 9. `backend/src/modules/crm/*`

### Architecture conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| A-1 | CRM module in PR likely still exposes Task/Room CRUD endpoints (`createRoom`, `createTask`, `uploadTaskPhoto` patterns) | MARKETPLACE_REFACTOR_MASTER_PLAN Part 4: these endpoints are `REMOVE`. "Remove task/room methods" from CRM. | CRITICAL |
| A-2 | CRM module missing HotelWorker enrollment endpoints | MARKETPLACE_REFACTOR_MASTER_PLAN Part 4 Additions: `GET /hotels/:id/workers`, `POST /hotels/:id/workers`, `DELETE /hotels/:id/workers/:worker_id`, `GET /hotels/:id/managers` all classified as `ADD` | HIGH |
| A-3 | CRM service queries against `Task`/`Room` models which are removed in V2 | PRISMA_SCHEMA_V2_FREEZE §1: Task, Room, TaskPhoto, DailyOperation all absent from V2 entity list | CRITICAL |

### Implementation conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| I-1 | Hotel controller still passes `hotel_ids` in responses if using PR's User model | API_SPEC_V1_PATCH_V2 PATCH-04: remove hotel_ids from all User responses including `GET /hotels/:id/workers` | MEDIUM |
| I-2 | RBAC on hotel endpoints may include CHECKER role per PR | API_SPEC_V1_PATCH_V2 PATCH-07 §7a–7c: CHECKER removed from `GET /hotels`, `POST /hotels`, `PATCH /hotels/:id` | MEDIUM |

### Schema conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| S-1 | CRM service queries Task/Room/DailyOperation models | PRISMA_SCHEMA_V2_FREEZE: removed | CRITICAL |
| S-2 | CRM service uses `task_id` as join key for QV/Rating queries | API_SPEC_V1_PATCH_V2 PATCH-02: replaced with `worker_assignment_id` | HIGH |

**Verdict: REMOVE from merge.** The CRM module in the PR is built against the pre-V2 schema. Merging it would:
1. Fail to compile against the V2 schema (Task/Room models absent).
2. Expose endpoints that were explicitly removed (`POST /tasks`, `POST /rooms`).
3. Miss the new HotelWorker enrollment endpoints required by the canonical API spec.

The CRM module must be rewritten from scratch against the V2 schema per MARKETPLACE_REFACTOR_MASTER_PLAN Part 3/4 specifications.

---

## 10. `package-lock.json`

### Architecture conflicts
None.

### Implementation conflicts

| # | Conflict | Canonical Source | Severity |
|---|----------|-----------------|----------|
| I-1 | Lock file reflects vitest dependency tree, no jest/ts-jest/supertest | TESTING_MASTER_PLAN_FREEZE mandates jest + supertest; this lock file is incompatible with the frozen test plan | CRITICAL |

**Verdict: REMOVE from merge.** This is a generated file. Its content is entirely determined by `package.json`. If `package.json` is rolled back to jest (per the frozen test plan), the lock file must be regenerated.

---

## Cross-Cutting Compliance Findings

### Finding 1 — `hotel_ids` removal is architecture-wide

`PRISMA_SCHEMA_V2_FREEZE` migration step 2 drops `User.hotel_ids`. `API_SPEC_V1_PATCH_V2` PATCH-04 removes `hotel_ids` from all User DTOs. `MARKETPLACE_REFACTOR_MASTER_PLAN` Phase 1-E step 20 explicitly drops it.

PR touches `hotel_ids` in:
- `prisma/schema.prisma` (present on User)
- `auth/service.ts` (set on create, embedded in JWT payload)
- `auth/types.ts` (present on `AuthUser`)
- `lib/jwt.ts` (`AccessTokenPayload.hotel_ids: string[]` — this interface is shared)

All four must be updated consistently. The JWT `AccessTokenPayload.hotel_ids` field is the trickiest: removing it from JWT means `checkHotelAccess()` middleware must be rewritten to do a DB lookup against `HotelWorker` (per API_SPEC_V1_PATCH_V2 PATCH-04 §4c).

### Finding 2 — Test stack conflict is a governance issue

The PR's vitest switch cannot be evaluated purely as a technical conflict. `TESTING_MASTER_PLAN_FREEZE` is a formally frozen document. Changing the test runner requires:
1. A `TESTING_MASTER_PLAN_V2` document.
2. A freeze review cycle.
3. Updated CI workflow files.
4. Updated fixture strategy (bcrypt → argon2 in `db-seeds.ts`).
5. Updated mock strategy (`jest-mock-extended` → vitest equivalent).

Until these exist, the vitest change is a compliance violation regardless of its technical merits.

### Finding 3 — GDPR routes are in the wrong module

PR adds `DELETE /account` and `GET /account/export` to the auth router. The canonical API spec (`API_SPEC_V1_PATCH_V2` GDPR section) places data export and deletion at `/gdpr/*` (5 dedicated GDPR endpoints). These endpoints belong in a future `gdpr` module, not the auth module.

The GDPR endpoint surface per canonical spec:
```
POST /gdpr/consent          — ADMIN, self
GET  /gdpr/consent/:userId  — ADMIN, self
POST /gdpr/data-export      — ADMIN, self
POST /gdpr/data-deletion    — ADMIN
GET  /gdpr/retention-logs   — ADMIN
```

### Finding 4 — Role casing is a latent cross-module bug

PR emits `role: user.role` (uppercase `"WORKER"`) in the JWT. Canonical `requireRole()` calls in routes use lowercase strings (e.g., `requireRole('admin')`). The middleware compares them with `===`. This means every RBAC check that uses `requireRole()` silently fails for every user. This bug would not be caught by the 78 auth tests if those tests bypass the role check in their JWT fixtures.

The canonical test helper in `TESTING_MASTER_PLAN_FREEZE` (`tests/helpers/auth.ts`) uses `user.role` raw — which, from the DB, is uppercase enum. If `requireRole('admin')` uses lowercase, the entire RBAC layer is broken in the PR's version.

**Resolution:** Standardise on uppercase enum values in JWT AND in `requireRole()` call sites, or standardise on lowercase strings in JWT AND in `requireRole()` call sites. Must be consistent. Both branches of `main` and all the auth documents use lowercase strings in `requireRole()` calls, so `toLowerCase()` in JWT emission is the correct canonical direction.

### Finding 5 — `signup` route endpoint identity

`MARKETPLACE_REFACTOR_MASTER_PLAN` classifies `src/modules/auth/` as `KEEP` with "No changes". The PR substantially changes this module. The KEEP classification refers to the endpoint surface being preserved, not the internal implementation. The `POST /auth/signup` endpoint specifically:

- `API_SPEC_V1_PATCH_V2` Final Auth Surface (5 endpoints): `login`, `refresh`, `logout`, `me`, `password-reset`. **No signup.**
- `Users` surface (5 endpoints): `POST /users` — ADMIN role. This is user creation.
- The PR's `POST /auth/signup` with `requireRole('admin')` is effectively a duplicate of `POST /users` (ADMIN-only user creation) placed in the wrong module.

**Implication:** If signup = admin-creates-user, the correct route is `POST /users` in a users module (ADMIN only). The auth module should only contain login/refresh/logout/me/password-reset. The PR conflates user creation with authentication.

---

## Recommended PR Split Plan

### PR A — Auth Code Quality (extract from PR #2)
**Files to include:**
- `backend/src/modules/auth/service.ts` — with MODIFY instructions applied
- `backend/src/modules/auth/controller.ts` — with MODIFY instructions applied
- `backend/src/modules/auth/routes.ts` — with MODIFY instructions applied (remove GDPR routes)
- `backend/src/modules/auth/types.ts` — with MODIFY instructions applied (remove hotel_ids)
- `backend/src/modules/auth/validation.ts` — new file, take from PR
- `backend/src/lib/jwt.ts` — with MODIFY instructions applied

**Prerequisite:** Schema stays as `main` (V2). JWT `hotel_ids` must be removed from payload before merging.

### PR B — GDPR Module (new work, informed by PR #2)
**Files to create:**
- `backend/src/modules/gdpr/service.ts` — rewrite `exportUserData` and `deleteAccount` against V2 schema + Phase 2 models
- `backend/src/modules/gdpr/controller.ts`
- `backend/src/modules/gdpr/routes.ts` — at `/gdpr/*` paths per canonical API spec

**Dependency:** Phase 2 schema (Contract, Payroll, WorkerDocument, ConsentLog, DataRetentionLog) must exist before full implementation.

### PR C — Test Stack Decision (governance, not code)
**Action:** Open architecture discussion. Either:
1. Produce `TESTING_MASTER_PLAN_V2` superseding the frozen plan with vitest, updated fixtures using argon2, and updated CI. Then implement.
2. Or keep Jest and update `auth/service.ts` to use bcryptjs (or update test seeds to use argon2 while keeping jest).

**This decision blocks PR A if argon2 is kept in service.ts** — because the frozen jest test seeds use bcrypt and will produce passwords that argon2.verify() cannot check.
