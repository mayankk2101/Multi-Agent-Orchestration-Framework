# Merge Conflict Resolution Report
**PR #2:** feat: complete auth module + repair Prisma schema relations
**Base branch:** `main` (SHA: bd9e14f7)
**Head branch:** `fix/backend-blockers` (SHA: f676ac60)
**Mergeable state:** dirty (confirmed conflicts)
**Analysis date:** 2026-06-10

---

## Summary of Conflicting Files

| File | Conflict Type | Recommendation |
|------|--------------|----------------|
| `backend/package.json` | Test runner + hash library swap | **Keep theirs (PR)** |
| `backend/prisma/schema.prisma` | Entirely different data models | **Manual merge** |
| `backend/src/lib/jwt.ts` | SignOptions typing + refresh secret scope | **Manual merge** |
| `backend/src/middleware/auth.ts` | No conflict (identical SHA) | N/A — identical |
| `backend/src/middleware/permissions.ts` | No conflict (identical SHA) | N/A — identical |
| `backend/src/modules/auth/service.ts` | Hash library, audit log, extra endpoints | **Manual merge** |
| `backend/src/modules/auth/controller.ts` | 2 new endpoints, method style, import path | **Keep theirs (PR)** |
| `backend/src/modules/auth/routes.ts` | 2 new routes, RBAC on signup, validation location | **Manual merge** |
| `backend/src/modules/auth/types.ts` | Schemas moved to validation.ts | **Keep theirs (PR)** |

---

## File-by-File Analysis

---

### 1. `backend/package.json`

#### Base version (main)
```json
{
  "scripts": {
    "test": "jest --forceExit",
    "test:coverage": "jest --coverage --forceExit"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/jest": "^29.5.12",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.4",
    "ts-jest": "^29.1.4"
  }
}
```

#### Incoming version (PR / fix/backend-blockers)
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "argon2": "^0.31.2"
  },
  "devDependencies": {
    "vitest": "^4.1.8"
  }
}
```

#### Architectural differences
- PR replaces the entire test stack (jest + ts-jest + supertest) with vitest.
- PR removes the `jest` configuration block at the bottom of the file entirely.
- PR drops `bcryptjs` as a runtime dependency; there is no jest configuration block.

#### Schema differences
None — this file has no Prisma schema impact.

#### RBAC differences
None directly. Indirect: vitest does not use `@types/jest` globals, so any auth test using `jest.mock()` would need to be ported.

#### JWT differences
None directly. Indirect: `argon2` replaces `bcryptjs` for password hashing, which affects auth security posture but not the JWT surface.

#### Recommendation: **Keep theirs (PR)**
**Rationale:** argon2 is the OWASP-recommended password hashing algorithm (resistant to GPU/ASIC attacks), strictly superior to bcryptjs. The 78 passing tests are already written for vitest; keeping jest would require re-porting them. The PR test suite is complete and passing. The only risk is removing supertest — if any future integration tests need it, re-add it as a devDependency.

---

### 2. `backend/prisma/schema.prisma`

#### Base version (main)
A fully revised **marketplace schema (V2)** with applied patches SP-1 through SP-9. Key models:
- `User`, `Session` — auth only (no `hotel_ids` array field on `User`)
- `Hotel`, `HotelWorker` — hotel roster with lifecycle enums
- `WorkRequest`, `WorkApplication`, `WorkerAssignment` — marketplace flow
- `Attendance`, `QualityVerification`, `Rating`, `WorkerOverallRating` — operations
- `Notification` (typed enum), `AuditLog` (typed enum fields)
- **No** Room, Task, TaskPhoto, DailyOperation, Contract, Payroll, WorkerDocument, ConsentLog, DataRetentionLog

#### Incoming version (PR / fix/backend-blockers)
An older **CRM/HR schema** that retains Task-based architecture. Key models:
- `User` — includes `hotel_ids String[]` field, plus compliance relation fields (`documents`, `data_retention_logs`, `consent_logs`, `assigned_worker_assignments`)
- `Hotel` — includes `contract_templates`, `required_documents`
- `Room`, `Task`, `TaskPhoto`, `DailyOperation` — present
- `Contract`, `ContractTemplate`, `ContractLineItem` — HR module
- `WorkerDocument`, `RequiredDocument` — HR compliance
- `Payroll`, `PayrollLineItem` — payroll module
- `DataRetentionLog`, `ConsentLog` — GDPR module
- `WorkRequest`, `WorkerAssignment` — simpler, no marketplace flow (no `WorkApplication`, no `Attendance`)
- `QualityVerification`, `Rating` — tied to `Task` not `WorkerAssignment`
- `Notification` — type is plain `String`, not enum
- `AuditLog` — `actor_role` is `String?` not `UserRole?`

#### Architectural differences
| Aspect | main (base) | PR (incoming) |
|--------|-------------|---------------|
| Core workflow | Marketplace (workers apply to requests) | Task-assignment (managers push tasks to workers) |
| `User.hotel_ids` | Not present | Present as `String[]` |
| Room/Task models | Removed | Present |
| HR/Payroll/GDPR models | Not present | Present (Contract, Payroll, GDPR) |
| `WorkApplication` model | Present (mandatory pre-assignment step) | Not present |
| `Attendance` model | Present (full lifecycle) | Not present |
| `WorkerOverallRating` | `onDelete: Cascade` | `onDelete: Restrict` |
| `Notification.type` | `NotificationType` enum | `String` |
| `AuditLog.actor_role` | `UserRole?` typed | `String?` untyped |
| `Session.refresh_token` | `@unique` constraint present | No `@unique` on refresh_token |

#### Schema differences (Prisma-level)
- Main's `Session` has `@unique` on `refresh_token`; PR's does not — this is a security-critical difference (see JWT section).
- Main's `WorkRequest` uses typed enums (`WorkRequestStatus`, `AssignmentStatus`, etc.); PR uses plain `String` defaults.
- Main's `QualityVerification` links to `WorkerAssignment`; PR links to `Task`.
- Main has `@@unique([worker_id, status])` removed from `WorkerAssignment` (SP-5); PR retains it (known bug, noted in PR description).

#### RBAC differences
- PR's `User` includes `hotel_ids String[]` used by `checkHotelAccess()` middleware. Main's `User` has no `hotel_ids` field, meaning the existing `checkHotelAccess()` in `permissions.ts` would fail at runtime against main's schema.
- PR's schema supports the compliance-role flow (GDPR export, data retention) via `ConsentLog` and `DataRetentionLog`; main has no equivalent.

#### JWT differences
The `Session.refresh_token` uniqueness constraint directly affects refresh-token rotation security: without `@unique`, concurrent refresh requests can create duplicate sessions. Main enforces this; PR does not.

#### Recommendation: **Manual merge**
**Rationale:** Neither version alone is correct.
- main's schema is architecturally superior for the marketplace workflow and uses proper typed enums.
- PR's schema adds essential compliance models (Contract, Payroll, WorkerDocument, ConsentLog, DataRetentionLog) that main entirely lacks.
- The correct resolution is: **take main as the base**, then surgically add the PR's HR/compliance models (`Contract`, `ContractTemplate`, `ContractLineItem`, `WorkerDocument`, `RequiredDocument`, `Payroll`, `PayrollLineItem`, `DataRetentionLog`, `ConsentLog`) and restore `hotel_ids` on `User`.
- Do NOT bring back Room/Task/TaskPhoto/DailyOperation — these are incompatible with the V2 marketplace architecture.
- Restore `@unique` on `Session.refresh_token` (keep main's version).
- Keep main's `@@unique([worker_id, status])` removal (SP-5).

---

### 3. `backend/src/lib/jwt.ts`

#### Base version (main)
```typescript
// Refresh token uses JWT_REFRESH_SECRET with fallback to JWT_SECRET
export function signRefreshToken(userId: string): string {
  const env = getEnv();
  const secret = env.JWT_REFRESH_SECRET ?? env.JWT_SECRET;  // separate secret support
  return jwt.sign({ sub: userId, type: 'refresh' }, secret, {
    expiresIn: env.JWT_REFRESH_EXPIRY as any,  // "as any" cast
    algorithm: 'HS256',
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  const env = getEnv();
  const secret = env.JWT_REFRESH_SECRET ?? env.JWT_SECRET;  // same fallback on verify
  // ...
}

export function parseExpiryToSeconds(expiryStr: string): number { /* exported */ }
```

#### Incoming version (PR / fix/backend-blockers)
```typescript
// Refresh token always uses JWT_SECRET — no separate refresh secret
export function signRefreshToken(userId: string): string {
  const env = getEnv();
  const options: SignOptions = {  // proper SignOptions typing instead of "as any"
    expiresIn: env.JWT_REFRESH_EXPIRY as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_SECRET, options);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  const env = getEnv();
  // uses env.JWT_SECRET only — no JWT_REFRESH_SECRET
  // ...
}

function parseExpiryToSeconds(expiryStr: string): number { /* private — not exported */ }
```

#### Architectural differences
Both versions implement the same token shape and verification logic. The structural difference is only in how `SignOptions` is typed.

#### Schema differences
None.

#### RBAC differences
None directly. Both embed `hotel_ids` and `permissions` in the access token payload, enabling hotel-scoped RBAC.

#### JWT differences
| Aspect | main (base) | PR (incoming) |
|--------|-------------|---------------|
| Refresh token signing secret | `JWT_REFRESH_SECRET ?? JWT_SECRET` | `JWT_SECRET` only |
| Refresh token verification secret | `JWT_REFRESH_SECRET ?? JWT_SECRET` | `JWT_SECRET` only |
| `expiresIn` casting | `as any` | `as SignOptions['expiresIn']` — type-safe |
| `parseExpiryToSeconds` visibility | `export function` | `function` (private) |

Security note: Using a **separate** `JWT_REFRESH_SECRET` (main's approach) is better practice — it means a leaked access-token secret cannot be used to forge refresh tokens. PR's single-secret approach is weaker.

#### Recommendation: **Manual merge**
Take PR's clean `SignOptions` typing, but restore main's `JWT_REFRESH_SECRET ?? JWT_SECRET` fallback for both `signRefreshToken` and `verifyRefreshToken`. Keep `parseExpiryToSeconds` exported (main) — it is used by other callers.

---

### 4. `backend/src/middleware/auth.ts`

**Both versions are byte-for-byte identical** (SHA: `3de6e7e18023135d4dc0e745db13a3c521d8462a`).

No conflict. No action required.

---

### 5. `backend/src/middleware/permissions.ts`

**Both versions are byte-for-byte identical** (SHA: `60c3d1c5b3f2f4d8f8033141e7012827f0b040d0`).

No conflict. No action required.

---

### 6. `backend/src/modules/auth/service.ts`

#### Base version (main) — key characteristics
```typescript
import bcrypt from 'bcryptjs';
import { ROLE_PERMISSIONS, BCRYPT_ROUNDS } from '../../config/constants.js';
import { ..., ForbiddenError } from '../../lib/errors.js';

// - IP address passed through to audit log on signup/login/updateProfile
// - Explicit ForbiddenError on disabled account (separate from UnauthorizedError)
// - hotel_ids: [] set on user creation
// - ROLE_PERMISSIONS imported from central constants
// - logAudit() called on signup, login, logout, updateProfile
// - No deleteAccount(), no exportUserData()
// - user.hotel_ids passed into JWT payload
```

#### Incoming version (PR / fix/backend-blockers) — key characteristics
```typescript
import * as argon2 from 'argon2';

// - No IP tracking
// - No ForbiddenError — disabled account throws UnauthorizedError
// - hotel_ids: hotel_ids || [] set from request body
// - getDefaultPermissions() defined inline (not imported from constants)
// - No logAudit() calls on core auth flows
// - deleteAccount() added — soft delete + session invalidation + AuditLog.create()
// - exportUserData() added — references Task, Contract, WorkerDocument, Payroll (PR-only schema models)
// - formatAuthResponse(), formatTokenResponse(), formatUserResponse() private helpers
// - role passed raw (uppercase enum) into JWT — not lowercased
```

#### Architectural differences
- Main centralises role-permission mapping in `config/constants.ts`; PR inlines it in the service — a duplication/maintenance risk.
- PR adds `deleteAccount` and `exportUserData` but `exportUserData` directly queries `this.prisma.task`, `this.prisma.contract`, `this.prisma.payroll` — these models exist in PR's schema but not in main's schema. This is a hard dependency on schema resolution.
- Main tracks IP addresses for security/audit compliance; PR drops this.

#### Schema differences
PR's `exportUserData` references `prisma.task`, `prisma.contract`, `prisma.workerDocument`, `prisma.payroll` — none of these exist in main's V2 schema. The method must be updated after schema merge.

#### RBAC differences
- Main: disabled account → `ForbiddenError('Account is disabled')` — semantically correct (authenticated but forbidden).
- PR: disabled account → `UnauthorizedError('Account is disabled')` — semantically incorrect (conflates authentication failure with authorisation denial).
- Main: `ROLE_PERMISSIONS` from constants is the single source of truth; PR duplicates this inline.

#### JWT differences
- Main: emits `role: user.role.toLowerCase()` in token → lowercase string (`"worker"`, `"manager"`, etc.)
- PR: emits `role: user.role` → uppercase enum string (`"WORKER"`, `"MANAGER"`, etc.)
- This is a breaking inconsistency: `requireRole()` in `permissions.ts` compares against whatever the token contains. Both branches use the same `permissions.ts` (identical file), so the role casing used at signup/login must match what `requireRole()` expects.

#### Recommendation: **Manual merge**
- Replace `bcrypt` with `argon2` (take PR).
- Keep `deleteAccount` and `exportUserData` from PR, but update `exportUserData` to query the correct models after schema merge.
- Restore IP parameter on `signup`, `login`, `updateProfile` (take main).
- Restore `ForbiddenError` for disabled accounts (take main — semantically correct).
- Restore `logAudit` calls (take main — compliance requirement).
- Standardise role casing in JWT — pick one convention (`toLowerCase()` is safer for string comparisons) and apply it consistently.
- Source role-permission mapping from `config/constants.ts` (take main pattern) rather than duplicating inline.

---

### 7. `backend/src/modules/auth/controller.ts`

#### Base version (main)
- 6 handlers: `signup`, `login`, `refreshToken`, `logout`, `getCurrentUser`, `updateProfile`
- `signup`, `login`, `refreshToken`, `updateProfile` are **arrays** (middleware chain pattern): `[validateBody(Schema), async handler]`
- Imports schemas from `./types.js`
- `logout` accepts `req.body?.refresh_token` for targeted session invalidation

#### Incoming version (PR / fix/backend-blockers)
- 8 handlers: adds `deleteAccount`, `exportUserData`
- All handlers are plain `async` methods — **no array middleware chain**
- Imports types from `./validation.js`
- `logout` does NOT pass a refresh token — always deletes all sessions for the user

#### Architectural differences
- Main uses controller-level validation arrays (Express middleware chain). PR delegates validation entirely to routes.
- PR's approach (thin controller, validation in routes) is a cleaner separation of concerns.
- PR's `logout` is a more aggressive "logout everywhere" behaviour vs main's targeted single-session logout.

#### Schema differences
None in this file directly, but `deleteAccount` and `exportUserData` depend on schema resolution (see service.ts analysis).

#### RBAC differences
- Main's controller embedding of `validateBody` means validation runs regardless of route definition.
- PR's controller is thinner and relies on routes to apply `validateBody` and `requireRole`.

#### JWT differences
None in this file.

#### Recommendation: **Keep theirs (PR)**
**Rationale:** PR's pattern (plain async methods, validation in routes) is cleaner and more conventional for Express. The two new endpoints (`deleteAccount`, `exportUserData`) are genuine feature additions. The only mandatory fix after taking PR: restore the optional `refresh_token` body parameter in `logout` so targeted session invalidation is preserved (take that single line from main).

---

### 8. `backend/src/modules/auth/routes.ts`

#### Base version (main)
```typescript
import { Router } from 'express';
import { authController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.js';

router.post('/signup', ...authController.signup);   // spread array from controller
router.post('/login', ...authController.login);
router.post('/refresh', ...authController.refreshToken);
router.post('/logout', authMiddleware, handler);
router.get('/me', authMiddleware, handler);
router.put('/profile', authMiddleware, ...authController.updateProfile);
// 6 routes total
```

#### Incoming version (PR / fix/backend-blockers)
```typescript
import { Router } from 'express';
import { authController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/permissions.js';
import { validateBody } from '../../middleware/validation.js';
import { SignupSchema, LoginSchema, RefreshTokenSchema, UpdateProfileSchema } from './validation.js';

router.post('/signup', validateBody(SignupSchema), requireRole('admin'), handler);
// ↑ CRITICAL: signup requires ADMIN role — self-registration is BLOCKED
router.post('/login', validateBody(LoginSchema), handler);
router.post('/refresh', validateBody(RefreshTokenSchema), handler);
router.post('/logout', authMiddleware, handler);
router.get('/me', authMiddleware, handler);
router.put('/profile', authMiddleware, validateBody(UpdateProfileSchema), handler);
router.delete('/account', authMiddleware, handler);
router.get('/account/export', authMiddleware, handler);
// 8 routes total
```

#### Architectural differences
- Validation moves from controller arrays to explicit route-level middleware — cleaner.
- PR adds `DELETE /account` and `GET /account/export` routes.

#### Schema differences
None directly in routing. `GET /account/export` behaviour depends on schema resolution.

#### RBAC differences
**Critical:** PR adds `requireRole('admin')` to `POST /signup`. This means:
- Only an already-authenticated admin can register new users.
- Self-registration (open signup) is completely blocked.
- This is a significant product architecture decision, not just a code preference. It may be intentional (invite-only system matching the `HotelWorkerStatus.INVITED` pattern in main's schema) or an accidental oversight.

#### JWT differences
None in routing.

#### Recommendation: **Manual merge**
- Take PR's route structure (8 routes, validation in routes, imports from `./validation.js`).
- **Remove `requireRole('admin')` from `POST /signup`** unless the product decision to restrict registration to admins-only has been explicitly approved. This single middleware call would break the entire user onboarding flow for open registration. If admin-only registration IS the intended design (aligns with INVITED lifecycle in main's schema), document it explicitly and add a test.
- Keep both new routes (`DELETE /account`, `GET /account/export`).

---

### 9. `backend/src/modules/auth/types.ts`

#### Base version (main)
```typescript
// Contains both Zod schemas AND TypeScript types in one file:
export const SignupSchema = z.object({ ... });
export const LoginSchema = z.object({ ... });
export const RefreshTokenSchema = z.object({ ... });
export const UpdateProfileSchema = z.object({ ... });
export type SignupRequest = z.infer<typeof SignupSchema>;
export type LoginRequest = z.infer<typeof LoginSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;
export interface AuthUser { ... }
export interface AuthResponse { ... }
```

#### Incoming version (PR / fix/backend-blockers)
```typescript
// types.ts is now interfaces-only:
export interface AuthUser {
  // adds phone?, profile_photo_url?, updated_at? fields
}
export interface AuthTokens { ... }  // renamed from AuthResponse (no 'user' field)
// Zod schemas moved to ./validation.ts
```

#### Architectural differences
- PR correctly separates runtime validation schemas (`validation.ts`) from TypeScript type declarations (`types.ts`). This is better architecture — schemas and types serve different purposes.
- PR's `AuthUser` interface adds optional `phone`, `profile_photo_url`, `updated_at` fields that main's version omits.
- PR renames `AuthResponse` to `AuthTokens` and removes the `user` property from it — the full auth response shape is now only in `formatAuthResponse()` in the service.

#### Schema differences
None.

#### RBAC differences
None.

#### JWT differences
None.

#### Recommendation: **Keep theirs (PR)**
**Rationale:** The schema/types separation in PR is correct. The enriched `AuthUser` interface (with `phone`, `profile_photo_url`, `updated_at`) is strictly additive. The rename from `AuthResponse` to `AuthTokens` is a better name. Required follow-up: update all imports in other files that reference `SignupSchema`, `LoginSchema`, etc. from `./types.js` to `./validation.js`.

---

## Cross-Cutting Issues

### Issue 1: role casing in JWT tokens
Main emits `role: user.role.toLowerCase()` (e.g., `"worker"`). PR emits `role: user.role` (e.g., `"WORKER"`). The shared `requireRole()` in `permissions.ts` compares `req.auth.role` against whatever strings are passed. Decide on one convention **before merge** and audit all `requireRole(...)` call sites for consistency.

### Issue 2: `exportUserData` schema dependency
PR's `exportUserData()` in service.ts references `prisma.task`, `prisma.contract`, `prisma.workerDocument`, `prisma.payroll`. If main's V2 schema is taken as the base (recommended), these calls will fail at compile time. The method must be rewritten to export the equivalent V2 models (`WorkApplication`, `WorkerAssignment`, `Attendance`, etc.) after schema merge.

### Issue 3: `User.hotel_ids` field
PR's service.ts sets `hotel_ids: hotel_ids || []` on `prisma.user.create`. Main's V2 schema has no `hotel_ids` field on `User`. If main's schema is taken as base, this field must either be added back or all service/controller code setting it must be removed.

### Issue 4: `Session.refresh_token` uniqueness
Main's schema adds `@unique` to `Session.refresh_token`; PR does not. This must be kept from main — without it, refresh token rotation (which deletes the old session and creates a new one identified by token value) is unsafe under concurrent requests.

### Issue 5: Import path drift
After merge, the following import paths must be audited and updated:
- `from './types.js'` → `from './validation.js'` for Zod schemas (affects controller.ts, any middleware)
- `from '../../config/constants.js'` for `ROLE_PERMISSIONS` (restore in service.ts)

---

## Recommended Merge Order

If a developer proceeds with manual merge, the safest order is:

1. **`backend/prisma/schema.prisma`** — Resolve schema first; everything else depends on it.
2. **`backend/package.json`** — Accept PR version. Run `npm install`.
3. **`backend/src/lib/jwt.ts`** — Apply type fixes from PR, restore refresh secret from main.
4. **`backend/src/modules/auth/types.ts`** — Accept PR version.
5. **`backend/src/modules/auth/service.ts`** — Manual merge per analysis above.
6. **`backend/src/modules/auth/controller.ts`** — Accept PR version + restore logout token param.
7. **`backend/src/modules/auth/routes.ts`** — Accept PR version, decide on `requireRole('admin')` for signup.
8. Run `npx prisma validate && npx prisma generate && npx vitest run` to verify.
