# PR #2 Salvage Plan
**PR:** feat: complete auth module + repair Prisma schema relations  
**Head branch:** `fix/backend-blockers` (SHA: f676ac60)  
**Base branch:** `main` (SHA: bd9e14f7)  
**Plan date:** 2026-06-10  
**Status:** ANALYSIS ONLY — no code changes, no patches, no conflict resolution

**Input documents:**
- `PR2_ARCHITECTURE_COMPLIANCE_AUDIT.md`
- `SCHEMA_RECONCILIATION_DECISION.md`
- `MERGE_CONFLICT_RESOLUTION_REPORT.md`
- Live file reads from `fix/backend-blockers` HEAD and `main` HEAD

---

## Salvage Classification Legend

| Class | Meaning |
|-------|---------|
| **MERGE_NOW** | Take the PR file as-is into Stream A; zero pre-merge edits required |
| **CHERRY_PICK_PARTIAL** | Take identified functions/blocks only; exact keep/discard/fix list provided below |
| **REWRITE** | Concept from PR is valid; file must be authored from scratch against V2 schema |
| **DISCARD** | Do not bring forward; incompatible or superseded at architecture level |

---

## Section 1 — File-by-File Salvage Table

| File | Class | Blocker before merge? | Target stream |
|------|----|---|---|
| `backend/src/app.ts` | **MERGE_NOW** | None | Stream A |
| `backend/src/modules/auth/validation.ts` | **MERGE_NOW** | 1 field review (hotel_ids in SignupSchema) | Stream A |
| `backend/src/modules/auth/types.ts` | **CHERRY_PICK_PARTIAL** | Remove `hotel_ids` from `AuthUser` | Stream A |
| `backend/src/lib/jwt.ts` | **CHERRY_PICK_PARTIAL** | Restore `JWT_REFRESH_SECRET` (BLOCKER per INFRA PATCH-06) | Stream A |
| `backend/src/modules/auth/controller.ts` | **CHERRY_PICK_PARTIAL** | Fix `logout()` refresh_token arg | Stream A |
| `backend/src/modules/auth/routes.ts` | **CHERRY_PICK_PARTIAL** | Remove `requireRole('admin')` from signup; remove GDPR routes | Stream A |
| `backend/src/modules/auth/service.ts` | **CHERRY_PICK_PARTIAL** | 7 targeted fixes required | Stream A |
| `backend/src/modules/gdpr/` *(new module implied by PR)* | **REWRITE** | Phase 2 schema must exist first | Stream B |
| `backend/prisma/schema.prisma` | **DISCARD** | Incompatible with V2 at every layer | — |
| `backend/package.json` | **DISCARD** | Vitest violates TESTING_MASTER_PLAN_FREEZE (FROZEN) | Stream C (governance) |
| `backend/src/modules/crm/*` | **DISCARD** | Queries removed models (Task/Room); missing HotelWorker endpoints | — |
| `package-lock.json` | **DISCARD** | Generated artefact; reflects discarded vitest dep tree | — |

---

## Section 2 — CHERRY_PICK_PARTIAL Detail

### 2.1 `backend/src/lib/jwt.ts`

**What the PR improves over main:**
- Imports `SignOptions` from `jsonwebtoken` and uses `as SignOptions['expiresIn']` instead of `as any` in both `signAccessToken` and `signRefreshToken`. This is a strictly better type.
- Adds `expiresIn` as a named `options` object (more readable).

**What the PR breaks vs main:**
- `signRefreshToken` uses `env.JWT_SECRET` instead of `env.JWT_REFRESH_SECRET ?? env.JWT_SECRET`.
- `verifyRefreshToken` uses `env.JWT_SECRET` instead of `env.JWT_REFRESH_SECRET ?? env.JWT_SECRET`.
- `parseExpiryToSeconds` is a private `function` — main exports it. Other callers depend on the export.

#### Functions to keep (from PR)

| Function | Keep from PR? | Notes |
|----------|--------------|-------|
| `AccessTokenPayload` interface | **KEEP** — with modification | Remove `hotel_ids: string[]` per API_SPEC PATCH-04 |
| `RefreshTokenPayload` interface | **KEEP as-is** | Identical on both branches |
| `JwtTokens` interface | **KEEP as-is** | Identical |
| `signAccessToken` | **KEEP** — PR's SignOptions typing | Replace `as any` with `as SignOptions['expiresIn']` |
| `signRefreshToken` | **KEEP** — PR's SignOptions typing, **FIX secret** | Use `const secret = env.JWT_REFRESH_SECRET ?? env.JWT_SECRET` |
| `signTokens` | **KEEP as-is from PR** | No changes needed |
| `verifyAccessToken` | **KEEP as-is from PR** | Logic identical; PR's code is cleaner |
| `verifyRefreshToken` | **KEEP** — PR's structure, **FIX secret** | Use `const secret = env.JWT_REFRESH_SECRET ?? env.JWT_SECRET` |
| `extractTokenFromHeader` | **KEEP as-is from PR** | Identical on both branches |
| `parseExpiryToSeconds` | **KEEP** — change visibility | Change `function` → `export function` |

#### Imports to keep (from PR)
```typescript
import jwt, { SignOptions } from 'jsonwebtoken';   // PR adds SignOptions — keep
import { getEnv } from '../config/env.js';
import { logger } from './logger.js';
```

#### Schema references to remove
None in this file. The `hotel_ids` is an interface field on `AccessTokenPayload`, handled in the interface modification above.

#### Net edit count
- 2 lines changed in `signRefreshToken` (secret variable)
- 2 lines changed in `verifyRefreshToken` (secret variable)
- 1 line changed in `parseExpiryToSeconds` (add `export`)
- 1 line changed in `AccessTokenPayload` (remove `hotel_ids: string[]`)

---

### 2.2 `backend/src/modules/auth/types.ts`

PR correctly separates runtime schemas (validation.ts) from TypeScript type declarations (types.ts). This is a structural improvement over main which colocated Zod schemas and TS interfaces.

#### Functions/declarations to keep (from PR)

| Declaration | Keep? | Notes |
|-------------|-------|-------|
| `AuthUser` interface | **KEEP** — with modification | Remove `hotel_ids: string[]`; keep `phone?`, `profile_photo_url?`, `updated_at?` additions |
| `AuthTokens` interface | **KEEP as-is** | Better name than main's `AuthResponse`; removing the `user` field is correct — full auth response shape lives in `formatAuthResponse()` in service |

#### Imports to keep
```typescript
// No imports in this file — it is interfaces only. Keep it that way.
```

#### Schema references to remove
```typescript
// REMOVE this field from AuthUser:
hotel_ids: string[];
```

#### Callers that must be updated after this change
Any file that reads `authUser.hotel_ids` from the AuthUser type. Primary callers: any test fixture that constructs an `AuthUser` object. Scan for `hotel_ids` in test files before merge.

---

### 2.3 `backend/src/modules/auth/validation.ts`

**New file — does not exist on main.** The separation of Zod schemas into a dedicated `validation.ts` is the correct architectural pattern.

The file is clean. One field requires a decision before merge:

```typescript
// SignupSchema contains:
hotel_ids: z
  .array(z.string().uuid('Invalid hotel ID'))
  .optional()
  .default([]),
```

**Decision required:** `API_SPEC_V1_PATCH_V2 PATCH-04` removes `hotel_ids` from all User DTOs. If that decision is final, remove this field from `SignupSchema` and `SignupRequest`. If `hotel_ids` is kept on User for MVP (per `SCHEMA_RECONCILIATION_DECISION.md §3.1`), this field may remain as an input to seed hotel scoping at creation time. **This is the only open question. All other fields are clean.**

#### Functions to keep
Entire file. All four schemas and their exported types.

#### Imports to keep
```typescript
import { z } from 'zod';
```

#### Validation improvements vs main
| Field | Main (in types.ts) | PR (in validation.ts) | Better |
|-------|--------------------|-----------------------|--------|
| `email` | `z.string().email()` | + `.toLowerCase()` | PR |
| `password` | min 8 | + uppercase + digit regex rules | PR |
| `first_name` / `last_name` | Not validated | min 2, max 50 | PR |
| `phone` | Not validated | regex E.164 + optional refine | PR |
| `profile_photo_url` | Not validated | `.url()` | PR |

---

### 2.4 `backend/src/modules/auth/controller.ts`

The PR's thin-controller pattern (plain `async` methods, no embedded validation arrays) is the correct Express architecture. Main's approach of embedding `[validateBody(Schema), handler]` arrays in controller methods mixes concerns. Take the PR version.

#### Functions to keep (from PR)

| Handler | Keep? | Fix required |
|---------|-------|-------------|
| `signup` | **KEEP as-is** | None in controller; fixes are in service and routes |
| `login` | **KEEP as-is** | None in controller |
| `refreshToken` | **KEEP as-is** | None in controller |
| `logout` | **KEEP** — **FIX required** | Must pass `req.body?.refresh_token` to `authService.logout()` for targeted session deletion |
| `getCurrentUser` | **KEEP as-is** | None |
| `updateProfile` | **KEEP as-is** | None |
| `deleteAccount` | **KEEP as-is** | None; delegates to service which is V2-compatible |
| `exportUserData` | **KEEP handler, STUB service call** | Handler itself is correct; the service method it calls is Phase 2 pending |

#### Exact fix for `logout`

Current PR code:
```typescript
await authService.logout(req.auth.userId);
```

Required change (restore targeted session deletion):
```typescript
await authService.logout(req.auth.userId, req.body?.refresh_token);
```

The `AuthService.logout()` signature must accept an optional second parameter (already the case on main's service.ts). One-line change.

#### Imports to keep (from PR — all correct)
```typescript
import { Request, Response, NextFunction } from 'express';
import { authService } from './service.js';
import { UnauthorizedError } from '../../lib/errors.js';
import {
  SignupRequest, LoginRequest, RefreshTokenRequest, UpdateProfileRequest,
} from './validation.js';     // ← correct: import from validation.js not types.js
```

#### Schema references to remove
None in this file.

---

### 2.5 `backend/src/modules/auth/routes.ts`

The PR's route-level validation pattern (`validateBody(Schema)` on each route) is correct. Import from `./validation.js` is correct.

#### Routes to keep

| Route | Keep? | Fix required |
|-------|-------|-------------|
| `POST /signup` | **KEEP** — **FIX required** | Remove `requireRole('admin')` middleware entirely. See note below. |
| `POST /login` | **KEEP as-is** | Correct |
| `POST /refresh` | **KEEP as-is** | Correct |
| `POST /logout` | **KEEP as-is** | Correct |
| `GET /me` | **KEEP as-is** | Correct |
| `PUT /profile` | **KEEP as-is** | Correct |
| `DELETE /account` | **MOVE to Stream B** | Belongs at `POST /gdpr/data-deletion` per API_SPEC_V1_PATCH_V2 GDPR surface |
| `GET /account/export` | **MOVE to Stream B** | Belongs at `POST /gdpr/data-export` per API_SPEC_V1_PATCH_V2 GDPR surface |

**Stream A routes.ts = 6 routes** (remove 2 GDPR routes for now).

#### Signup guard removal justification

The PR has:
```typescript
router.post('/signup', validateBody(SignupSchema), requireRole('admin'), handler);
```

`requireRole()` reads `req.auth.role` from the JWT. There is no `authMiddleware` before this route. On an unauthenticated request, `req.auth` is undefined, and `requireRole('admin')` will throw an `UnauthorizedError` or silently fail — effectively making `POST /signup` unreachable for any unauthenticated caller.

Even if `authMiddleware` were added, per `API_SPEC_V1_PATCH_V2` the canonical auth surface has no `POST /auth/signup` at all (user creation is `POST /users` — ADMIN only). For MVP, if open self-registration is intended, remove the guard entirely. If admin-only user creation is intended, this route should move to `POST /users` in the users module.

**Recommended for Stream A:** Remove `requireRole('admin')` from signup. Open registration is the assumption for MVP (workers register themselves). Add an explicit test asserting no auth required on `POST /auth/signup`.

#### Imports to keep (from PR — all correct)
```typescript
import { Router } from 'express';
import { authController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/permissions.js';
import { validateBody } from '../../middleware/validation.js';
import { SignupSchema, LoginSchema, RefreshTokenSchema, UpdateProfileSchema } from './validation.js';
```

Note: `requireRole` import can be removed if signup guard is removed and no other route on this file uses it. Confirm by scanning after edit.

#### Schema references to remove
None in routes.ts.

---

### 2.6 `backend/src/modules/auth/service.ts`

This is the most complex cherry-pick. The PR adds real value (`deleteAccount`, format helpers, argon2) but also introduces multiple defects against the V2 architecture.

#### Functions to keep, discard, and fix

| Function | Decision | Action |
|----------|----------|--------|
| `signup` | **KEEP — 5 fixes** | See detail below |
| `login` | **KEEP — 4 fixes** | See detail below |
| `refreshToken` | **KEEP — 1 fix** | Remove `hotel_ids` from `signTokens` call |
| `logout` | **KEEP — 2 fixes** | Add optional `refreshToken?: string` param; add `logAudit` call |
| `getCurrentUser` | **KEEP — 1 fix** | See note below |
| `updateProfile` | **KEEP — 2 fixes** | Add IP param; add `logAudit` call |
| `deleteAccount` | **KEEP as-is** | V2-compatible; no fixes needed |
| `exportUserData` | **DISCARD entirely** | Queries 4 removed/Phase 2 models; will not compile against V2 schema |
| `getDefaultPermissions` | **DISCARD** | Replace with import from `config/constants.ts::ROLE_PERMISSIONS` |
| `formatAuthResponse` | **KEEP — 1 fix** | Remove `hotel_ids: user.hotel_ids` from returned object |
| `formatTokenResponse` | **KEEP as-is** | Clean; no issues |
| `formatUserResponse` | **KEEP — 1 fix** | Remove `hotel_ids: user.hotel_ids` from returned object |

#### Per-function fix detail

**`signup` — 5 fixes:**

1. Remove `hotel_ids` from destructuring: `const { email, password, first_name, last_name, phone, role } = data;`
2. Remove `hotel_ids: hotel_ids || []` from `prisma.user.create` call (V2 User has no hotel_ids column, or set `hotel_ids: []` if MVP keeps the field)
3. Remove `hotel_ids: user.hotel_ids` from `signTokens({...})` call
4. Change `role: user.role` → `role: user.role.toLowerCase()` in `signTokens` call (prevent uppercase RBAC mismatch)
5. Add `ip?: string` parameter; add `logAudit` call after session creation

**`login` — 4 fixes:**

1. Change `throw new UnauthorizedError('Account is disabled')` → `throw new ForbiddenError('Account is disabled')` (HTTP 403 = authenticated but forbidden, not 401)
2. Remove `hotel_ids: user.hotel_ids` from `signTokens({...})` call
3. Change `role: user.role` → `role: user.role.toLowerCase()` in `signTokens` call
4. Add `ip?: string` parameter; add `logAudit` call after session creation

**`refreshToken` — 1 fix:**

Remove `hotel_ids: user.hotel_ids` from `signTokens({...})` call. (3 instances in this method across signup/login/refresh — all must be purged for consistent JWT payload.)

**`logout` — 2 fixes:**

1. Add `refreshToken?: string` parameter: targeted deletion path (matches main's behaviour)
2. Add `logAudit` call for compliance record

Current PR:
```typescript
async logout(userId: string) {
  await this.prisma.session.deleteMany({ where: { user_id: userId } });
  logger.info('User logged out', { user_id: userId });
}
```

Required shape:
```typescript
async logout(userId: string, refreshToken?: string) {
  if (refreshToken) {
    await this.prisma.session.deleteMany({ where: { user_id: userId, refresh_token: refreshToken } });
  } else {
    await this.prisma.session.deleteMany({ where: { user_id: userId } });
  }
  await this.logAudit(userId, null, 'LOGOUT', 'USER', userId);
  logger.info('User logged out', { user_id: userId });
}
```

**`getCurrentUser` — 1 fix:**

PR does `findUnique` then `formatUserResponse(user)`. Main does `findUnique` with an explicit `select` block. For V2 compatibility, either approach works. The PR's approach is acceptable; however, `formatUserResponse` returns `hotel_ids: user.hotel_ids` — that field must be removed from `formatUserResponse` (covered above under format helpers).

**`updateProfile` — 2 fixes:**

1. Add `ip?: string` parameter
2. Add `logAudit` call after update

**`deleteAccount` — no changes:**

```typescript
// This method is clean and V2-compatible:
// - prisma.user.update (soft delete) ✓
// - prisma.session.deleteMany ✓
// - prisma.auditLog.create ✓
// - actor_role: user.role.toLowerCase() ✓
// All models exist in V2 schema.
```

**`getDefaultPermissions` — discard and replace:**

The inline permission map in PR uses legacy permission strings (`rooms:read:own`, `tasks:read:own`, `tasks:complete:own`, `contracts:read:own`, `payroll:read:own`) that reference removed or Phase 2 models. Replace the entire private method with:

```typescript
// Remove getDefaultPermissions() entirely.
// In signup(), replace:
this.getDefaultPermissions(role || 'worker')
// with:
ROLE_PERMISSIONS[(role?.toUpperCase() || 'WORKER') as keyof typeof ROLE_PERMISSIONS] ?? ROLE_PERMISSIONS['WORKER']
```

Where `ROLE_PERMISSIONS` is imported from `../../config/constants.js`.

#### Imports to keep (from PR)
```typescript
import * as argon2 from 'argon2';          // KEEP — security improvement (test governance blocker noted)
import { BaseService } from '../../lib/base-service.js';
import { signTokens, verifyRefreshToken } from '../../lib/jwt.js';
import { UnauthorizedError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { SignupRequest, LoginRequest, RefreshTokenRequest, UpdateProfileRequest } from './validation.js';
```

#### Imports to add (restore from main)
```typescript
import { ForbiddenError } from '../../lib/errors.js';   // restore for disabled-account 403
import { ROLE_PERMISSIONS } from '../../config/constants.js';   // replace inline getDefaultPermissions
```

Remove `BCRYPT_ROUNDS` (no longer needed with argon2). Remove the `argon2` import if the governance decision (Stream C) reverts to bcryptjs.

#### Exact schema references to remove

| Reference | Location | Why |
|-----------|----------|-----|
| `const { ..., hotel_ids, ... } = data` | `signup()` | hotel_ids not in V2 User DTO |
| `hotel_ids: hotel_ids \|\| []` | `signup()` prisma.user.create | hotel_ids column absent from V2 User |
| `hotel_ids: user.hotel_ids` | `signup()` signTokens call | hotel_ids removed from JWT payload |
| `hotel_ids: user.hotel_ids` | `login()` signTokens call | same |
| `hotel_ids: user.hotel_ids` | `refreshToken()` signTokens call | same |
| `hotel_ids: user.hotel_ids` | `formatAuthResponse()` | hotel_ids removed from User response DTO |
| `hotel_ids: user.hotel_ids` | `formatUserResponse()` | same |
| `await this.prisma.task.findMany(...)` | `exportUserData()` | entire method discarded |
| `await this.prisma.contract.findMany(...)` | `exportUserData()` | entire method discarded |
| `await this.prisma.workerDocument.findMany(...)` | `exportUserData()` | entire method discarded |
| `await this.prisma.payroll.findMany(...)` | `exportUserData()` | entire method discarded |
| `where: { id: { in: user.hotel_ids } }` | `exportUserData()` hotel query | entire method discarded |
| `getDefaultPermissions()` method body | private method | entire method discarded |
| `this.getDefaultPermissions(...)` call | `signup()` | replaced with ROLE_PERMISSIONS import |

**Total removals from service.ts:** 1 full method (`exportUserData` — ~90 lines), 1 full method (`getDefaultPermissions` — ~35 lines), 7 schema field references.

---

## Section 3 — Merge-Ready Auth Inventory

This is the authoritative checklist for Stream A. Each item must be done before the Stream A PR is opened.

### `backend/src/lib/jwt.ts`

| Item | Status | Action |
|------|--------|--------|
| `import jwt, { SignOptions }` | ✅ Take from PR | Improves type safety |
| `signAccessToken` — SignOptions typing | ✅ Take from PR | Replaces `as any` |
| `signRefreshToken` — secret | ❌ Must fix | Use `JWT_REFRESH_SECRET ?? JWT_SECRET` |
| `verifyRefreshToken` — secret | ❌ Must fix | Use `JWT_REFRESH_SECRET ?? JWT_SECRET` |
| `parseExpiryToSeconds` — exported | ❌ Must fix | Change from private to `export function` |
| `AccessTokenPayload.hotel_ids` | ❌ Must remove | Remove field per PATCH-04 |
| All other functions | ✅ Take from PR | Equivalent or better than main |

### `backend/src/modules/auth/service.ts`

| Item | Status | Action |
|------|--------|--------|
| argon2 import | ✅ Take from PR | Security improvement; blocked by Stream C governance |
| `signup` structure | ✅ Take from PR | — |
| `signup` — hotel_ids references (3x) | ❌ Must remove | Remove from destructure, user.create, signTokens |
| `signup` — role casing in JWT | ❌ Must fix | `role: user.role.toLowerCase()` |
| `signup` — IP param + logAudit | ❌ Must restore | From main |
| `signup` — permissions source | ❌ Must fix | Import ROLE_PERMISSIONS, remove getDefaultPermissions() |
| `login` structure | ✅ Take from PR | — |
| `login` — ForbiddenError for disabled | ❌ Must restore | Replace UnauthorizedError with ForbiddenError |
| `login` — hotel_ids in signTokens | ❌ Must remove | — |
| `login` — role casing in JWT | ❌ Must fix | `.toLowerCase()` |
| `login` — IP param + logAudit | ❌ Must restore | From main |
| `refreshToken` structure | ✅ Take from PR | Better session validation order |
| `refreshToken` — hotel_ids in signTokens | ❌ Must remove | — |
| `logout` — optional refreshToken param | ❌ Must restore | From main |
| `logout` — logAudit | ❌ Must restore | From main |
| `getCurrentUser` | ✅ Take from PR | Acceptable; format helper is cleaner |
| `updateProfile` structure | ✅ Take from PR | — |
| `updateProfile` — IP param + logAudit | ❌ Must restore | From main |
| `deleteAccount` | ✅ Take from PR entire method | V2-compatible; no changes |
| `exportUserData` | ❌ Must discard | Queries removed/Phase 2 models; compile-time failure |
| `getDefaultPermissions` | ❌ Must discard | Legacy permissions; replace with ROLE_PERMISSIONS import |
| `formatAuthResponse` — hotel_ids | ❌ Must remove | Remove from returned object |
| `formatTokenResponse` | ✅ Take as-is | Clean |
| `formatUserResponse` — hotel_ids | ❌ Must remove | Remove from returned object |

### `backend/src/modules/auth/controller.ts`

| Item | Status | Action |
|------|--------|--------|
| All 8 handler methods | ✅ Take from PR | Thin-controller pattern is correct |
| `logout` — refresh_token arg | ❌ Must fix | Pass `req.body?.refresh_token` to service |
| `exportUserData` handler | ✅ Keep but stub | Handler is correct; service method is Phase 2 pending |
| All imports | ✅ Take from PR | Correct paths (from validation.js) |

### `backend/src/modules/auth/routes.ts`

| Item | Status | Action |
|------|--------|--------|
| Route-level validation pattern | ✅ Take from PR | Correct separation |
| Import from `./validation.js` | ✅ Take from PR | Correct |
| `POST /login` | ✅ Take as-is | — |
| `POST /refresh` | ✅ Take as-is | — |
| `POST /logout` | ✅ Take as-is | — |
| `GET /me` | ✅ Take as-is | — |
| `PUT /profile` | ✅ Take as-is | — |
| `POST /signup` — `requireRole('admin')` | ❌ Must remove | Unauthenticated callers blocked; wrong module for admin user-creation |
| `DELETE /account` | ❌ Move to Stream B | GDPR route; belongs at `POST /gdpr/data-deletion` |
| `GET /account/export` | ❌ Move to Stream B | GDPR route; belongs at `POST /gdpr/data-export` |
| `requireRole` import | Review after edit | May become unused if signup guard removed; remove if so |

### `backend/src/modules/auth/validation.ts` (new file)

| Item | Status | Action |
|------|--------|--------|
| `SignupSchema` — all fields except `hotel_ids` | ✅ Take as-is | Better validation than main |
| `SignupSchema.hotel_ids` | ⚠️ Decision pending | Remove per PATCH-04, or keep per SCHEMA_RECONCILIATION MVP decision |
| `LoginSchema` | ✅ Take as-is | — |
| `RefreshTokenSchema` | ✅ Take as-is | — |
| `UpdateProfileSchema` | ✅ Take as-is | — |
| Exported types | ✅ Take as-is | — |

### `backend/src/modules/auth/types.ts`

| Item | Status | Action |
|------|--------|--------|
| `AuthUser.id`, `.email`, `.first_name`, etc. | ✅ Take from PR | — |
| `AuthUser.phone?` | ✅ Take from PR | Additive; not in main |
| `AuthUser.profile_photo_url?` | ✅ Take from PR | Additive; not in main |
| `AuthUser.updated_at?` | ✅ Take from PR | Additive; not in main |
| `AuthUser.hotel_ids: string[]` | ❌ Must remove | PATCH-04: hotel_ids removed from all User DTOs |
| `AuthTokens` interface | ✅ Take from PR | Better name than `AuthResponse` |

---

## Section 4 — Commit-by-Commit Salvage Table

The PR branch (`fix/backend-blockers`) has two commits that are distinct from `main`:

| Commit SHA | Message | Files changed | Salvage decision |
|-----------|---------|--------------|-----------------|
| `7509dd6` | feat(sprint-1): implement auth, user, hotel, hotel-worker modules with RBAC and audit logging | `backend/package.json`, `backend/prisma/schema.prisma`, `backend/src/**`, `backend/src/middleware/*`, `backend/src/lib/jwt.ts`, `backend/src/modules/auth/*` | **PARTIAL** — Do not cherry-pick this commit as a whole. The sprint-1 commit introduced bcryptjs+jest (main's approach). The PR subsequently swapped to argon2+vitest (visible in HEAD). The auth module implementation is salvageable at the function level per Section 2 above. Schema changes: DISCARD. Test changes: Stream C governance. |
| `ef57051` | chore: fix unused import in app.ts and add package-lock.json | `backend/src/app.ts`, `package-lock.json` | **PARTIAL** — Take `app.ts` (single import cleanup = MERGE_NOW). Discard `package-lock.json` (vitest dep tree). |

**Practical implication:** Do not cherry-pick either commit directly onto main. Branch off main and reconstruct the auth module files with the specific functions and fixes listed in Section 2. This avoids importing the schema conflict, package.json conflict, and package-lock.json conflict that are embedded in these commits.

---

## Section 5 — Estimated Implementation Effort

| Task | File(s) | Effort | Blocked by |
|------|---------|--------|-----------|
| Create Stream A branch from main | — | 5 min | Nothing |
| Copy `validation.ts` (new file) | validation.ts | 10 min | hotel_ids decision (15 min decision meeting) |
| Update `types.ts` | types.ts | 10 min | Nothing |
| Fix `jwt.ts` | jwt.ts | 20 min | Nothing |
| Take `controller.ts` + fix `logout` | controller.ts | 30 min | Nothing |
| Take `routes.ts` + remove guards + remove GDPR routes | routes.ts | 30 min | requireRole decision on signup |
| Reconstruct `service.ts` | service.ts | 3–4 hours | argon2/bcrypt governance decision (Stream C) |
| Take `app.ts` | app.ts | 5 min | Nothing |
| Update import paths (`types.js` → `validation.js`) across codebase | any file importing Zod schemas from `./types.js` | 30 min | Nothing |
| Compile check: `npx tsc --noEmit` | — | 10 min | service.ts complete |
| Run auth test suite | — | 30 min | Stream C decision |
| **Stream A total** | | **~6–7 hours** | Stream C governance decision for argon2 |

| Stream | Description | Effort | Blocked by |
|--------|-------------|--------|-----------|
| **Stream A** | Auth improvements (6 files) | 6–7 hours developer | Stream C (if argon2 kept) |
| **Stream B** | GDPR module (new module) | 3–5 days | Phase 2 schema must exist |
| **Stream C** | Test governance decision | 2–4 hours (meeting + document) | None — can happen now |
| **Schema** | Already on main (V2) | 0 | Nothing |
| **CRM module** | Rewrite from scratch | 2–3 days | V2 schema (already on main) |

**Stream C is the critical path.** The argon2 vs bcrypt decision determines whether `service.ts` in Stream A uses argon2 (and test seeds must be updated) or reverts to bcryptjs (Stream A is simpler but doesn't get the security improvement). The test runner decision (vitest vs jest) requires a superseding frozen plan if vitest is chosen.

---

## Section 6 — Recommended Integration Sequence

### Pre-work (do first, unblocks everything)

**Step 0 — Stream C governance decision:**
1. Decide: keep Jest + bcryptjs, or move to vitest + argon2?
   - Option A (keep Jest): service.ts uses bcryptjs. Test fixtures unchanged. Stream A can merge without updating seeds.
   - Option B (switch to vitest + argon2): requires `TESTING_MASTER_PLAN_V2` document, updated `db-seeds.ts` (swap `bcrypt.hash` → `argon2.hash`), updated CI YAML, updated mock strategy. Stream A can use argon2 in service.ts, but cannot merge until the test plan is updated.
2. Whichever option: record the decision in writing. If Option B, produce `TESTING_MASTER_PLAN_V2` before implementing.

### Stream A — Auth improvements (6 files)

**Step 1 — Create branch:**
```
git checkout main
git checkout -b feat/auth-improvements
```

**Step 2 — Copy new file:**
Take `backend/src/modules/auth/validation.ts` from PR branch verbatim (resolve hotel_ids decision first).

**Step 3 — Apply jwt.ts changes:**
- Add `{ SignOptions }` to jsonwebtoken import
- In `signAccessToken`: change `as any` → `as SignOptions['expiresIn']`  
- In `signRefreshToken`: add `const secret = env.JWT_REFRESH_SECRET ?? env.JWT_SECRET`, use `secret` in `jwt.sign()`, change typing `as any` → `as SignOptions['expiresIn']`
- In `verifyRefreshToken`: add `const secret = env.JWT_REFRESH_SECRET ?? env.JWT_SECRET`, use `secret` in `jwt.verify()`
- Remove `hotel_ids` from `AccessTokenPayload` interface
- Change `parseExpiryToSeconds` from private to `export function`

**Step 4 — Apply types.ts changes:**
- Remove `hotel_ids: string[]` from `AuthUser`
- Rename `AuthResponse` → `AuthTokens` (update all import sites)
- Add `phone?`, `profile_photo_url?`, `updated_at?` to `AuthUser`

**Step 5 — Apply service.ts changes (largest change):**
Following the checklist in Section 3 row by row. Key points:
- Decide argon2 vs bcrypt first (Stream C)
- Add `ForbiddenError` import
- Add `ROLE_PERMISSIONS` import, remove `getDefaultPermissions()`
- Remove all `hotel_ids` references (7 locations)
- Add `.toLowerCase()` to all role emissions in `signTokens` calls
- Restore IP param + `logAudit` on signup/login/updateProfile/logout
- Add optional `refreshToken` param to `logout`
- Add `deleteAccount` method (take from PR as-is)
- Add `formatAuthResponse`, `formatTokenResponse`, `formatUserResponse` (take from PR, minus hotel_ids)
- Delete `exportUserData` entirely

**Step 6 — Apply controller.ts changes:**
- Take entire PR controller.ts file
- Fix `logout`: add `req.body?.refresh_token` arg

**Step 7 — Apply routes.ts changes:**
- Take PR routes.ts file  
- Remove `requireRole('admin')` from POST /signup
- Remove `router.delete('/account', ...)` route
- Remove `router.get('/account/export', ...)` route
- Remove `requireRole` import if now unused

**Step 8 — Apply app.ts:**
- Take PR app.ts directly (single unused import removed)

**Step 9 — Update import paths:**
Scan for files importing Zod schemas from `./types.js` or `../auth/types.js` — update to `./validation.js` / `../auth/validation.js`.

**Step 10 — Compile check:**
```
cd backend && npx tsc --noEmit
```
Must pass with zero errors before opening PR.

**Step 11 — Run test suite:**
If Stream C chose bcryptjs: `npm test` (jest)  
If Stream C chose argon2+vitest: update seeds first, then `npm test` (vitest)

**Step 12 — Open PR against main with scope:** "Auth code quality improvements: argon2/bcryptjs, deleteAccount, thin-controller pattern, validation separation, jwt.ts typing"

### Stream B — GDPR module (after Phase 2 schema)

**Prerequisites:**
- Phase 2 schema migration (`Contract`, `Payroll`, `WorkerDocument`, `ConsentLog`, `DataRetentionLog`) merged to main
- Stream A merged

**Steps:**
1. Create `backend/src/modules/gdpr/` directory
2. Port `deleteAccount` from `auth/service.ts` to `gdpr/service.ts` (it belongs in GDPR module per canonical spec; auth/service.ts can delegate to it or it can be removed from auth)
3. Rewrite `exportUserData` against V2 entities: `WorkApplication`, `WorkerAssignment`, `Attendance`, `Rating`, plus Phase 2 `Contract`, `Payroll`, `WorkerDocument`
4. Create `gdpr/controller.ts` (take `exportUserData` + `deleteAccount` handler shapes from PR's `auth/controller.ts`)
5. Create `gdpr/routes.ts` with canonical paths: `POST /gdpr/data-export`, `POST /gdpr/data-deletion`, plus 3 other GDPR endpoints from API_SPEC_V1_PATCH_V2
6. Register `/gdpr` router in `routes/v1/index.ts`

---

## Section 7 — Open Decisions Blocking Merge

The following must be resolved by a human before Stream A code work begins:

| # | Decision | Options | Impact if deferred |
|---|----------|---------|-------------------|
| D-1 | **Test stack** — vitest or jest? | A: Keep jest (no governance doc needed). B: Move to vitest (requires TESTING_MASTER_PLAN_V2) | Blocks argon2 use in service.ts until test fixtures updated. Stream A cannot be tested if seeds use bcrypt but service uses argon2. |
| D-2 | **Password hashing** — argon2 or bcryptjs? | Tied to D-1. Argon2 is preferable security-wise but requires test fixture updates. | If bcryptjs chosen, service.ts reverts to bcrypt. Simpler but no security improvement. |
| D-3 | **Signup semantics** — open or admin-only? | A: Open registration (no auth guard on POST /auth/signup). B: Admin-only user creation (move to POST /users module). | Determines whether `requireRole('admin')` is removed or the route moves to users module. |
| D-4 | **hotel_ids on User** — keep for MVP or remove? | A: Keep (SCHEMA_RECONCILIATION decision — requires 1 ALTER TABLE migration). B: Remove now (cleaner, uses HotelWorker for scope). | Affects SignupSchema, AccessTokenPayload, formatAuthResponse, formatUserResponse, checkHotelAccess middleware. If removing, middleware must do DB lookup against HotelWorker table. |

**Recommended resolutions:**
- D-1: Option A (keep jest) to unblock Stream A immediately. Revisit vitest in a separate RFC.
- D-2: Follows from D-1. If jest, keep bcryptjs. If vitest, use argon2.
- D-3: Option A (open registration) for MVP. Worker self-registration is the intended flow.
- D-4: Option A (keep hotel_ids for MVP) — it is the simpler path and already assumed by `checkHotelAccess()` middleware and JWT `AccessTokenPayload`. Remove in a dedicated Phase 1.5 migration after HotelWorker scoping is fully tested.

---

## Quick Reference — What to Take, What to Leave

```
FROM PR #2 — TAKE THESE (per Section 2 modifications):
  backend/src/app.ts                         ← MERGE_NOW
  backend/src/modules/auth/validation.ts     ← MERGE_NOW (new file; review hotel_ids)
  backend/src/modules/auth/types.ts          ← minus hotel_ids field
  backend/src/lib/jwt.ts                     ← minus single-secret refresh; plus SignOptions; plus export parseExpiryToSeconds
  backend/src/modules/auth/controller.ts     ← all 8 handlers; fix logout arg
  backend/src/modules/auth/routes.ts         ← 6 routes (not 8); remove requireRole from signup; remove GDPR routes
  backend/src/modules/auth/service.ts        ← deleteAccount (whole method); format helpers (minus hotel_ids); argon2 (pending D-1); logout structure; all core methods with targeted fixes

FROM PR #2 — LEAVE THESE (do not merge):
  backend/prisma/schema.prisma               ← main already has correct V2 schema
  backend/package.json                       ← vitest violates frozen test plan
  package-lock.json                          ← generated artefact of discarded package.json
  backend/src/modules/crm/*                  ← pre-V2 schema; queries removed models

FROM PR #2 — DEFER (Stream B):
  deleteAccount route (DELETE /auth/account) ← move to POST /gdpr/data-deletion
  exportUserData route (GET /auth/account/export) ← move to POST /gdpr/data-export
  exportUserData service method              ← rewrite against V2 + Phase 2 schema
```
