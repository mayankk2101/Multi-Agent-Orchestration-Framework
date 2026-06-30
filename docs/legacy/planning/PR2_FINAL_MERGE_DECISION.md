# PR #2 — Final Merge Decision
**PR:** feat: complete auth module + repair Prisma schema relations  
**Branch:** `fix/backend-blockers` → `main`  
**Head SHA:** f676ac60 · **Base SHA:** bd9e14f7  
**Decision date:** 2026-06-10  
**Status:** FINAL — ANALYSIS ONLY. No code modified. No conflicts resolved.

---

## Reference Documents Used

| Document | Status | Role |
|---|---|---|
| `PR2_SALVAGE_PLAN.md` | Produced this session | Function-level extraction guide |
| `PR2_ARCHITECTURE_COMPLIANCE_AUDIT.md` | Produced this session | Per-file architectural verdicts |
| `SCHEMA_RECONCILIATION_DECISION.md` | Produced this session | Canonical model inventory |
| `MERGE_CONFLICT_RESOLUTION_REPORT.md` | Produced this session | Conflict-by-conflict breakdown |
| `docs/PRISMA_SCHEMA_V2_FREEZE.md` | APPROVED_WITH_MINOR_FOLLOWUPS | Canonical schema authority |
| `docs/API_SPEC_V1_PATCH_V2.md` | APPROVED_WITH_PATCHES | Canonical endpoint and DTO authority |
| `TESTING_MASTER_PLAN_FREEZE.md` | APPROVED — FROZEN | Canonical test stack authority |
| `MARKETPLACE_REFACTOR_MASTER_PLAN.md` | FROZEN | Entity chain, module removal/keep order |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` | IMPLEMENTATION-READY | JWT secret strategy, deployment |
| `DOCUMENTATION_AUDIT_REPORT.md` | Historical | Doc inventory, missing files identified |

**Note on requested documents:** `DOCUMENT_RECOVERY_AUDIT.md` and `CANONICAL_ARCHITECTURE_INDEX.md` do not exist in the repository (confirmed on both `main` and `fix/backend-blockers`). The analysis proceeds on the 8 documents that do exist. The absence of a `CANONICAL_ARCHITECTURE_INDEX` is itself a risk item — see Risk R-7.

---

## Executive Summary

**PR #2 should be CLOSED and its work reimplemented as three separate, scoped PRs.**

PR #2 bundles three unrelated work streams — auth code improvements, a pre-V2 CRM schema, and a test runner governance change — into one branch that is architecturally incompatible with `main` at the schema level. It cannot be made mergeable through conflict resolution because the disagreement is not syntactic: the PR's schema represents an entirely different architecture (task-based CRM) than main's frozen marketplace schema (V2). Resolving the git conflicts would produce a compile error regardless of which lines are chosen.

The PR contains genuine engineering value. That value is concentrated in seven auth-module files, all of which can be extracted and merged cleanly as a new PR against `main` with targeted per-function edits. The remainder must be discarded, governance-decided, or deferred to Phase 2.

---

## Part 1 — Answer to Each Decision Question

### Q1: Which files should be merged immediately?

"Immediately" means: can be taken to `main` in a new PR within one sprint, with no architecture decisions outstanding.

| File | Path | Merge target | Condition |
|------|------|-------------|-----------|
| `app.ts` | `backend/src/app.ts` | New PR (Stream A) | None — single import deletion, zero risk |
| `validation.ts` | `backend/src/modules/auth/validation.ts` | New PR (Stream A) | New file; resolve `hotel_ids` field in `SignupSchema` (15-minute decision) |
| `types.ts` | `backend/src/modules/auth/types.ts` | New PR (Stream A) | Remove `hotel_ids: string[]` from `AuthUser` interface |
| `jwt.ts` | `backend/src/lib/jwt.ts` | New PR (Stream A) | Fix refresh secret (2 lines); export `parseExpiryToSeconds`; remove `hotel_ids` from interface |
| `controller.ts` | `backend/src/modules/auth/controller.ts` | New PR (Stream A) | Fix `logout()` to pass `req.body?.refresh_token` (1 line) |
| `routes.ts` | `backend/src/modules/auth/routes.ts` | New PR (Stream A) | Remove `requireRole('admin')` from signup; remove 2 GDPR routes |
| `service.ts` | `backend/src/modules/auth/service.ts` | New PR (Stream A) | 7 targeted per-function fixes (see PR2_SALVAGE_PLAN §2.6) |

**None of these files should be merged from PR #2 directly.** They should be reconstructed on a new branch (`feat/auth-improvements`) created from `main`, with the edits from PR2_SALVAGE_PLAN applied. This avoids pulling in the schema conflict, package.json conflict, and package-lock.json that are embedded in PR #2's commit history.

### Q2: Which files should be rewritten?

| File / Module | Why rewrite? | Rewrite scope | Prerequisite |
|---|---|---|---|
| `backend/src/modules/crm/*` | Built against pre-V2 schema; queries `Task`/`Room` models (compile-time failure); missing `HotelWorker` enrollment endpoints required by canonical spec | Full module rewrite against V2 schema per `MARKETPLACE_REFACTOR_MASTER_PLAN` Part 3/4 | V2 schema on `main` (already available) |
| `backend/src/modules/gdpr/service.ts` (new) | `exportUserData()` in PR queries 4 removed/Phase 2 models; correct pattern, wrong entity chain | Rewrite against `WorkApplication`, `WorkerAssignment`, `Attendance`, `Rating` (V2) + `Contract`, `Payroll`, `WorkerDocument` (Phase 2) | Phase 2 schema migration first |
| `backend/src/modules/gdpr/controller.ts` (new) | Handler shapes from PR's `auth/controller.ts` are correct; routing paths are wrong | Copy handler shapes from PR; register at `/gdpr/*` paths | Stream A merged first |
| `backend/src/modules/gdpr/routes.ts` (new) | PR has routes at wrong paths (`/auth/account/export`, `/auth/account`) | Create at `/gdpr/data-export`, `/gdpr/data-deletion`, `/gdpr/consent`, `/gdpr/consent/:userId`, `/gdpr/retention-logs` per API_SPEC | Phase 2 schema; Stream A merged |

### Q3: Which files should be discarded?

| File | Discard reason | Authoritative source |
|---|---|---|
| `backend/prisma/schema.prisma` | Pre-V2 CRM architecture. Missing 6 MVP entities (HotelWorker, WorkApplication, Attendance, QualityVerification→fixed, WorkerOverallRating linkage, HotelWorker lifecycle). Includes 4 permanently removed entities (Room, Task, TaskPhoto, DailyOperation). 20 architecture/schema conflicts documented. The correct V2 schema already exists on `main`. | `PRISMA_SCHEMA_V2_FREEZE.md` (APPROVED); `MARKETPLACE_REFACTOR_MASTER_PLAN` (FROZEN) |
| `backend/package.json` | Replaces Jest + Supertest + bcryptjs with Vitest + argon2. `TESTING_MASTER_PLAN_FREEZE` status is `APPROVED — FROZEN` and explicitly mandates "Express.js · TypeScript · Prisma · PostgreSQL · Jest · Supertest". Changing the test runner requires a superseding `TESTING_MASTER_PLAN_V2`, which does not exist. The `argon2` dependency is desirable but cannot be introduced without also resolving the `db-seeds.ts` fixture incompatibility (seeds use `bcrypt.hash`; argon2.verify cannot check bcrypt hashes). | `TESTING_MASTER_PLAN_FREEZE.md` (FROZEN) |
| `package-lock.json` | Generated artefact of the discarded `package.json`. Reflects vitest dependency tree. Must be regenerated from whatever `package.json` is in force on `main`. | — |
| `backend/src/modules/crm/*` | All CRM service methods query `prisma.task`, `prisma.room`, `prisma.dailyOperation`. These models do not exist in V2 schema. CRM module will not compile against V2. Additionally, missing `HotelWorker` enrollment endpoints that V2 requires. | `PRISMA_SCHEMA_V2_FREEZE.md`; `API_SPEC_V1_PATCH_V2.md` |

### Q4: Which changes belong in separate future PRs?

| Change | Future PR | Trigger condition | Estimated effort |
|---|---|---|---|
| GDPR module: `data-deletion`, `data-export` endpoints | **PR B — GDPR Module** | Phase 2 schema (Contract, Payroll, WorkerDocument, ConsentLog, DataRetentionLog) merged to main | 3–5 days |
| GDPR module: `consent`, `retention-logs` endpoints | **PR B — GDPR Module** | Same | Included in 3–5 days |
| ConsentLog pre-registration gate (INFRA PATCH-08) | **PR B — GDPR Module** | Phase 2 schema | Included |
| argon2 as production password hasher | **PR C — Test Stack Upgrade** (or Stream A if bcrypt kept) | `TESTING_MASTER_PLAN_V2` document approved and frozen; `db-seeds.ts` updated | 2–4 hours after governance |
| Vitest as test runner | **PR C — Test Stack Upgrade** | Same as argon2 | Included |
| CRM module rewrite | **PR D — CRM V2** | V2 schema on main (already done); no other dependency | 2–3 days |
| `hotel_ids` removal from User, JWT, middleware | **PR E — hotel_ids Deprecation** | HotelWorker scoping fully tested on main; `checkHotelAccess()` rewritten to use DB lookup | 1–2 days; depends on HotelWorker service existing |
| Phase 2 schema migration | **PR F — Phase 2 Schema** | PRISMA_SCHEMA_V2_PATCH_V2 document; freeze review | 3–5 days |

### Q5: Is PR #2 mergeable after conflict resolution?

**No.** Standard git conflict resolution cannot produce a correct result because:

1. **The schema conflict is architectural, not syntactic.** Git can resolve which lines "win". It cannot produce a V2 marketplace schema from the line-by-line merge of a V2 schema and a pre-V2 CRM schema. The entities differ by name, relation, cardinality, and presence. Choosing either side produces the wrong schema.

2. **The package.json conflict is a governance violation.** Resolving in favour of the PR introduces vitest, which violates a frozen document. Resolving in favour of main loses argon2. Neither resolution is correct without a governance decision first.

3. **The service.ts conflict, if resolved naively, produces a compile-time failure.** The PR's `exportUserData()` queries `prisma.task`, `prisma.contract`, `prisma.workerDocument`, `prisma.payroll`. Against V2 schema, these models do not exist. TypeScript compilation will fail. Git conflict resolution cannot remove these calls — it only decides which branch's lines to use.

4. **The CRM module conflict is a category error.** The PR's CRM module is designed for a different architecture. There is no meaningful way to merge it with the V2 CRM module because V2 requires entirely different service methods (HotelWorker enrollment) and removes the methods the PR contains (Task/Room CRUD).

**Attempting to merge PR #2 as a whole, even after resolving all conflicts manually, would produce a non-compiling codebase.** The only path to a correct result is reconstructing the salvageable work on a clean branch.

### Q6: Should PR #2 be merged, split, closed and reimplemented, or superseded?

**DECISION: CLOSE PR #2. Reimplement as three targeted PRs.**

Not "split" — because splitting implies both halves of the PR can be made mergeable. PR #2's schema, package.json, and CRM module changes cannot be made mergeable at all; they must be discarded or rewritten from scratch.

Not "superseded by new work" — because the auth improvements in PR #2 are genuine contributions that should not be thrown away. They should be extracted and preserved.

The correct action is:
1. **Close PR #2** without merging, with a comment explaining the split plan.
2. **Open PR A** (`feat/auth-improvements`) from `main` with the 7 auth-module files, edited per PR2_SALVAGE_PLAN. This captures the engineering value.
3. **Open an architecture discussion** (not a PR) to decide vitest vs jest and argon2 vs bcrypt. Produce `TESTING_MASTER_PLAN_V2` if vitest is chosen.
4. **Create backlog tickets** for CRM V2, GDPR module, and Phase 2 schema. These are future PRs after architecture prerequisites are met.

---

## Part 2 — Final File Inventory

This is the complete disposition of every changed file in PR #2.

### Group 1 — EXTRACT AND RECONSTRUCT (Stream A, new PR from main)

All 7 files below must be authored fresh on a branch from `main`, not cherry-picked from PR #2. The edits are documented function-by-function in `PR2_SALVAGE_PLAN.md §2`.

| File | PR SHA | Main SHA | Delta summary | Net edits for Stream A |
|------|--------|----------|--------------|----------------------|
| `backend/src/app.ts` | 3590ad3a | different | Remove unused import (1 line) | 1 line deleted |
| `backend/src/modules/auth/validation.ts` | 22fb76e4 | does not exist | New file: Zod schemas separated from types | Copy verbatim; review `hotel_ids` field |
| `backend/src/modules/auth/types.ts` | a7be6630 | different | Interfaces only; `AuthTokens` rename; `phone/profile_photo_url/updated_at` added | Remove `hotel_ids: string[]`; take rest |
| `backend/src/lib/jwt.ts` | 90e0a64a | 59be7d20 | SignOptions typing; single-secret refresh (blocker) | 4 targeted line edits (see §2.1) |
| `backend/src/modules/auth/controller.ts` | 2dd94d6e | different | Thin-controller; 2 new handlers; logout all-sessions | Take PR; fix 1 line in logout |
| `backend/src/modules/auth/routes.ts` | fdbe7ee5 | different | 8 routes with route-level validation; GDPR routes wrong location | Take PR; remove 3 items |
| `backend/src/modules/auth/service.ts` | 1a99d9882 | 5b783214 | argon2; deleteAccount; exportUserData (blocker); format helpers | Remove 2 methods + 7 field refs; restore 5 items from main |

### Group 2 — DISCARD (do not carry forward in any form)

| File | Reason |
|------|--------|
| `backend/prisma/schema.prisma` | Pre-V2 architecture; 20 architecture/schema conflicts; V2 already on main |
| `backend/package.json` | Vitest violates TESTING_MASTER_PLAN_FREEZE (FROZEN document) |
| `package-lock.json` | Generated artefact of discarded package.json |
| `backend/src/modules/crm/*` (all files) | Queries removed models; compile-time failure against V2 |

### Group 3 — REWRITE (new work, informed by PR's intent)

| New file/module | Informed by PR | Target PR | Prerequisite |
|---|---|---|---|
| `backend/src/modules/gdpr/service.ts` | PR's `exportUserData` intent; `deleteAccount` method | PR B | Phase 2 schema |
| `backend/src/modules/gdpr/controller.ts` | PR's `exportUserData` + `deleteAccount` handler shapes | PR B | Stream A |
| `backend/src/modules/gdpr/routes.ts` | PR's 2 GDPR-intent routes, corrected paths | PR B | Stream A |
| `backend/src/modules/crm/` (replacement) | PR CRM intent, V2 entity chain | PR D | V2 schema on main (available) |

### Group 4 — ALREADY CORRECT ON MAIN (no action)

| File | Status |
|------|--------|
| `backend/prisma/schema.prisma` (main version) | V2 + SP-1..SP-9 applied. Authoritative. No change needed. |
| `backend/src/middleware/auth.ts` | Identical SHA on both branches. No conflict. |
| `backend/src/middleware/permissions.ts` | Identical SHA on both branches. No conflict. |

### Group 5 — GOVERNANCE ONLY (Stream C, not a code PR)

| Item | Required document | Owner |
|------|------------------|-------|
| Test runner: jest → vitest | `TESTING_MASTER_PLAN_V2` (supersedes FROZEN plan) | Tech lead + team |
| Password hashing: bcryptjs → argon2 | Same document; `db-seeds.ts` fixture update | Follows test runner decision |
| CI YAML update for new test runner | Same document | Follows test runner decision |

---

## Part 3 — Final Implementation Sequence

Phases are ordered by dependency. Work within a phase can be parallelised.

### Phase 0 — Governance (unblocks Stream A for argon2; parallel track)

**Owner:** Tech lead  
**Duration:** 2–4 hours (decision meeting + document)  
**Output:** Written decision: keep Jest + bcryptjs, OR produce `TESTING_MASTER_PLAN_V2` for vitest + argon2  
**No code produced in this phase**

If decision is **keep Jest + bcryptjs**:
- Stream A proceeds immediately, service.ts uses bcryptjs
- Argon2 improvement is deferred to Phase 2 or handled in a separate RFC

If decision is **vitest + argon2**:
- `TESTING_MASTER_PLAN_V2` must be produced and frozen before Stream A PR opens
- `db-seeds.ts` must be updated to use `argon2.hash` before Stream A tests can run
- CI YAML files must be updated

### Phase 1 — Stream A: Auth Improvements (depends on Phase 0 decision only)

**New branch:** `feat/auth-improvements` from `main`  
**Duration:** 6–7 hours developer time  
**Files:** 7 files

**Execution steps in order:**

| Step | Action | File | Time |
|------|--------|------|------|
| 1 | `git checkout main && git checkout -b feat/auth-improvements` | — | 2 min |
| 2 | Copy `validation.ts` from PR; decide `hotel_ids` field | `auth/validation.ts` | 15 min |
| 3 | Edit `jwt.ts`: fix refresh secret (×2), export `parseExpiryToSeconds`, remove `hotel_ids` from `AccessTokenPayload` | `lib/jwt.ts` | 20 min |
| 4 | Edit `types.ts`: remove `hotel_ids`; rename `AuthResponse` → `AuthTokens`; add `phone?/profile_photo_url?/updated_at?` | `auth/types.ts` | 15 min |
| 5 | Reconstruct `service.ts` from PR with all fixes from SALVAGE_PLAN §2.6 | `auth/service.ts` | 3–4 hrs |
| 6 | Copy `controller.ts` from PR; fix `logout` 1-line | `auth/controller.ts` | 30 min |
| 7 | Copy `routes.ts` from PR; remove `requireRole('admin')` from signup; remove 2 GDPR routes | `auth/routes.ts` | 20 min |
| 8 | Copy `app.ts` from PR (1 import deletion) | `app.ts` | 5 min |
| 9 | Scan for `from './types.js'` imports of Zod schemas → update to `./validation.js` | all consumers | 30 min |
| 10 | `cd backend && npx tsc --noEmit` — must pass zero errors | — | 10 min |
| 11 | `npm test` — all auth tests must pass | — | 30 min |
| 12 | Open PR against `main` with scope: "Auth improvements: deleteAccount, thin-controller, validation.ts, jwt typing" | — | 20 min |

**Gate before opening Stream A PR:** `npx tsc --noEmit` clean + auth tests passing.

### Phase 2 — CRM V2 Module (no PR #2 dependency; can start after Phase 1 or in parallel)

**New branch:** `feat/crm-v2` from `main`  
**Duration:** 2–3 days  
**Prerequisites:** V2 schema on `main` (already available)

Implementation per `MARKETPLACE_REFACTOR_MASTER_PLAN` Part 3/4:
1. Remove Task/Room CRUD service methods
2. Add HotelWorker enrollment endpoints: `GET/POST /hotels/:id/workers`, `DELETE /hotels/:id/workers/:worker_id`, `GET /hotels/:id/managers`
3. Verify RBAC per `API_SPEC_V1_PATCH_V2 PATCH-07`
4. Remove `hotel_ids` from Hotel controller responses per PATCH-04

### Phase 3 — Phase 2 Schema Migration

**New branch:** `feat/phase2-schema` from `main`  
**Duration:** 3–5 days (schema + tests + migration script)  
**Prerequisites:** Phase 1 merged; `PRISMA_SCHEMA_V2_PATCH_V2` document

Per `SCHEMA_RECONCILIATION_DECISION.md §4`, adds 9 models with V2 normalisation:
`Contract`, `ContractTemplate`, `ContractLineItem`, `WorkerDocument`, `RequiredDocument`, `Payroll`, `PayrollLineItem`, `DataRetentionLog`, `ConsentLog`

All models must be normalised: string status fields → typed enums; cascade rules aligned with V2 conventions.

### Phase 4 — Stream B: GDPR Module

**New branch:** `feat/gdpr-module` from `main`  
**Duration:** 3–5 days  
**Prerequisites:** Phase 1 merged AND Phase 3 (Phase 2 schema) merged

Create `backend/src/modules/gdpr/` with:

| File | Source | Content |
|------|--------|---------|
| `service.ts` | Rewrite | `exportUserData` against V2 + Phase 2 entities; `deleteAccount` delegated from auth |
| `controller.ts` | Informed by PR | Handler shapes from PR's auth controller; corrected method names |
| `routes.ts` | New | 5 endpoints at `/gdpr/*` per API_SPEC_V1_PATCH_V2 GDPR section |

GDPR endpoint surface:
```
POST /gdpr/consent           — roles: ADMIN, self
GET  /gdpr/consent/:userId   — roles: ADMIN, self
POST /gdpr/data-export       — roles: ADMIN, self
POST /gdpr/data-deletion     — roles: ADMIN
GET  /gdpr/retention-logs    — roles: ADMIN
```

Also: implement ConsentLog pre-registration gate (INFRA_PLAN PATCH-08: "Consent tracking live before first registration").

### Phase 5 — hotel_ids Deprecation (future, post-HotelWorker)

**Prerequisites:** HotelWorker service fully operational on `main`; `checkHotelAccess()` rewritten to use DB lookup against `HotelWorker`

- Remove `User.hotel_ids` column (`ALTER TABLE users DROP COLUMN hotel_ids`)
- Remove from `AccessTokenPayload`, `formatAuthResponse`, `formatUserResponse`
- Remove from all Zod schemas
- Remove from `checkHotelAccess()` — replace with `HotelWorker` membership query

This is a breaking change to the JWT payload. All issued tokens become stale; force re-login or implement a migration window.

---

## Part 4 — Final Risk Assessment

### Critical Risks (block merge)

| ID | Risk | File(s) | Consequence if ignored | Mitigation |
|----|------|---------|----------------------|-----------|
| R-1 | **JWT single-secret refresh** (BLOCKER) | `lib/jwt.ts` | Rotating `JWT_SECRET` invalidates all refresh tokens; rotation procedure in INFRA_PLAN PATCH-06 becomes inert; refresh token security model collapses | Fix in Stream A: restore `JWT_REFRESH_SECRET ?? JWT_SECRET` in `signRefreshToken` + `verifyRefreshToken` |
| R-2 | **Schema architecture incompatibility** | `prisma/schema.prisma` | Merging PR schema overwrites V2 marketplace schema; 6 MVP entities absent; `prisma generate` produces wrong client; all marketplace code fails to compile | DISCARD — V2 schema already correct on `main` |
| R-3 | **exportUserData compile failure** | `auth/service.ts` | `prisma.task`, `prisma.contract`, `prisma.workerDocument`, `prisma.payroll` do not exist in V2 schema; TypeScript build fails immediately | DISCARD `exportUserData` method in Stream A |
| R-4 | **Test stack governance violation** | `backend/package.json` | vitest contradicts `TESTING_MASTER_PLAN_FREEZE` (FROZEN document); no `TESTING_MASTER_PLAN_V2` exists; 45 jest tests deleted; bcrypt/argon2 fixture incompatibility untested | DISCARD package.json change; resolve via Stream C governance |

### High Risks (degrade correctness if unresolved)

| ID | Risk | File(s) | Consequence if ignored | Mitigation |
|----|------|---------|----------------------|-----------|
| R-5 | **Role casing RBAC mismatch** | `auth/service.ts` | PR emits `role: user.role` (uppercase `"WORKER"`) into JWT; `requireRole('admin')` in `permissions.ts` uses lowercase `'admin'`; every role check silently fails for every user; the auth system appears to work but RBAC is entirely broken | Fix in Stream A: `role: user.role.toLowerCase()` in all `signTokens` calls |
| R-6 | **ForbiddenError replaced with UnauthorizedError for disabled accounts** | `auth/service.ts` | HTTP 401 sent for disabled accounts instead of HTTP 403; clients that distinguish these codes will misclassify the error; disabled user triggers a re-login loop instead of "account disabled" message | Fix in Stream A: restore `ForbiddenError` |
| R-7 | **Missing canonical architecture documents** | — | `DOCUMENT_RECOVERY_AUDIT.md` and `CANONICAL_ARCHITECTURE_INDEX.md` referenced in this task do not exist; `WORKREQUEST_FINAL_ARCHITECTURE.md` and `WORKREQUEST_FINAL_ARCHITECTURE_PATCH_V1.md` also absent (noted in `PR2_ARCHITECTURE_COMPLIANCE_AUDIT.md`). Key architecture documents (`MASTER_ARCHITECTURE_v2.0`, `RBAC_PERMISSION_MATRIX_v1.0`, `FINAL_DECISIONS_SUMMARY.md`) exist only on Google Drive, not in the repo | Recover these documents to the repo. They are referenced as authoritative in multiple frozen plans. |
| R-8 | **`requireRole('admin')` on unauthenticated signup** | `auth/routes.ts` | `requireRole` reads `req.auth` but no `authMiddleware` precedes signup; route is unreachable for any unauthenticated caller; all new user registrations silently fail with 401 | Fix in Stream A: remove guard |
| R-9 | **Logout deletes all sessions** | `auth/controller.ts` | PR's `logout()` calls `authService.logout(userId)` with no refresh token; all sessions deleted on any device logout; multi-device users are force-logged-out on every logout event | Fix in Stream A: pass `req.body?.refresh_token` |
| R-10 | **argon2 + bcrypt fixture incompatibility** | `auth/service.ts`, `tests/` | If argon2 is used in service but `db-seeds.ts` hashes with `bcrypt.hash`, then `argon2.verify()` will reject test-seeded passwords; all integration tests that authenticate test users will fail | Resolve via Stream C: update seeds alongside test runner decision |

### Medium Risks (technical debt if unresolved)

| ID | Risk | File(s) | Consequence if ignored | Mitigation |
|----|------|---------|----------------------|-----------|
| R-11 | **GDPR routes in wrong module** | `auth/routes.ts` | `DELETE /auth/account` and `GET /auth/account/export` are at the wrong paths; correct paths are `POST /gdpr/data-deletion` and `POST /gdpr/data-export`; client SDKs built against wrong paths must be updated later | Move to Stream B |
| R-12 | **`getDefaultPermissions` inlined with legacy strings** | `auth/service.ts` | PR's permission strings reference `rooms:read:own`, `tasks:read:own`, `payroll:read:own` — models that are removed or Phase 2; newly created users get incorrect permissions that reference non-existent resources | Fix in Stream A: import `ROLE_PERMISSIONS` from `config/constants.ts` |
| R-13 | **hotel_ids in JWT payload persists** | `lib/jwt.ts`, `auth/service.ts` | `API_SPEC_V1_PATCH_V2 PATCH-04` removes `hotel_ids` from all User DTOs; `AccessTokenPayload` still embeds `hotel_ids`; this delays the `checkHotelAccess()` middleware rewrite to HotelWorker-based scoping | Tracked as Phase 5; acceptable for MVP if `User.hotel_ids` column kept |
| R-14 | **AuditLog missing on core auth flows** | `auth/service.ts` | PR drops `logAudit` calls on signup/login/logout/updateProfile; `AuditLog` rows have 5-year retention requirement per INFRA_PLAN PATCH-08; compliance gap | Fix in Stream A: restore `logAudit` calls |
| R-15 | **IP address tracking dropped** | `auth/service.ts` | Main passes `ip?` to audit log for security forensics; PR drops it; suspicious login patterns cannot be investigated via audit log | Fix in Stream A: restore IP param on `signup`, `login`, `updateProfile` |

### Low Risks (cleanup only)

| ID | Risk | Mitigation |
|----|------|-----------|
| R-16 | `parseExpiryToSeconds` not exported | Fix in Stream A (1 line) |
| R-17 | `AuthResponse` renamed to `AuthTokens` — import sites drift | Update import sites during Stream A (scan `from './types.js'`) |
| R-18 | `Session.refresh_token` lacks `@unique` in PR schema | Irrelevant — PR schema is discarded; main already has `@unique` |

---

## Part 5 — Execution Plan for Engineering

This is the complete, ordered action plan. Engineering can begin from Step 1 without waiting for this document to be approved — Steps 1 and 2 can be done immediately.

### Immediate Actions (today)

**Action 1 — Close PR #2**

Close PR #2 on GitHub with a comment explaining the split. Suggested comment:

> This PR bundles three independent work streams (auth improvements, schema migration, test runner change) that need to be handled separately. The auth code improvements have genuine value and will be reimplemented as PR A (`feat/auth-improvements`) against the V2 schema on `main`. The schema change is rejected — `main` already has the correct V2 marketplace schema. The test runner change requires a governance decision on `TESTING_MASTER_PLAN_V2` before implementation. See `PR2_FINAL_MERGE_DECISION.md` on `claude/peaceful-planck-u39n66` for the full analysis.

**Action 2 — Recover missing architecture documents**

The following documents are referenced as authoritative in frozen plans but exist only on Google Drive (not in the repo):
- `MASTER_ARCHITECTURE_v2.0.md` (Drive: `1D72ntyCBjcfLnBE217tecHBCToDlTk3s`)
- `RBAC_PERMISSION_MATRIX_v1.0.md` (Drive: `1E305G7z40CThPadno7-_RZgEXmg1mYVE`)
- `FINAL_DECISIONS_SUMMARY.md` (Drive: `1s-aBzmXelGxAZPGwiNJ86u6C_iE4ehRY`)

These must be committed to the repo so that future audits, CI, and new team members can access them without Google Drive access. Create `docs/` entries for each.

Additionally, `CANONICAL_ARCHITECTURE_INDEX.md` and `DOCUMENT_RECOVERY_AUDIT.md` do not exist anywhere. If they were planned documents, they must be created before the next architecture audit.

### Phase 0 — Governance decision (can be done in parallel with Action 2)

**Owner:** Tech lead  
**Output required:** A written decision document (even a single paragraph) answering:

1. Jest or vitest?
2. bcryptjs or argon2?
3. If vitest + argon2: produce `TESTING_MASTER_PLAN_V2` before any code work starts

**Recommended answer:** Keep Jest + bcryptjs for now. Reduces Stream A to 6–7 hours with no test fixture updates. Schedule vitest/argon2 migration as a separate sprint with proper test plan.

**Stream A is blocked for argon2 by Phase 0. Stream A is unblocked for all other changes.**

### Phase 1 — Stream A: feat/auth-improvements (Sprint 1)

**Duration:** 6–7 hours  
**Dependencies:** Phase 0 (for argon2 decision); Action 2 for import paths  
**PR target:** `main`

Complete execution in PR2_SALVAGE_PLAN §6 Steps 1–12.

**Acceptance criteria for Stream A PR:**
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` (jest): all tests pass, no test uses `argon2` if bcryptjs chosen
- [ ] `POST /auth/signup` — no auth required (test: unauthenticated request returns 201)
- [ ] `POST /auth/login` with disabled account — returns HTTP 403 not 401
- [ ] `POST /auth/logout` with valid refresh_token — deletes only that session, not all sessions
- [ ] `POST /auth/refresh` — uses `JWT_REFRESH_SECRET` (verify via env inspection test)
- [ ] `DELETE /auth/account` or any `/gdpr/` route — NOT present in auth router
- [ ] JWT payload role is lowercase (`"worker"` not `"WORKER"`) — verify via `requireRole('worker')` test

### Phase 2 — CRM V2 Module (Sprint 2, parallel to Phase 1)

**Duration:** 2–3 days  
**Dependencies:** None (V2 schema already on main)  
**PR target:** `main`

**Acceptance criteria:**
- [ ] No references to `prisma.task`, `prisma.room`, `prisma.dailyOperation` anywhere in CRM module
- [ ] `GET /hotels/:id/workers` returns `HotelWorker` rows, not `User.hotel_ids` array
- [ ] `POST /hotels/:id/workers` creates `HotelWorker` row with `status: INVITED`
- [ ] `DELETE /hotels/:id/workers/:worker_id` sets `status: REMOVED` (soft)
- [ ] RBAC per API_SPEC_V1_PATCH_V2 PATCH-07 (CHECKER removed from hotel write endpoints)

### Phase 3 — Phase 2 Schema (Sprint 3)

**Duration:** 3–5 days  
**Dependencies:** Stream A merged  
**PR target:** `main`

**Acceptance criteria:**
- [ ] 9 new models created with typed enum status fields (not plain `String`)
- [ ] All cascade/restrict rules aligned with V2 conventions
- [ ] `prisma migrate dev` succeeds from a clean V2 database
- [ ] `ConsentLog` table created before any endpoint requires registration (INFRA PATCH-08)

### Phase 4 — Stream B: GDPR Module (Sprint 4)

**Duration:** 3–5 days  
**Dependencies:** Phase 3 merged  
**PR target:** `main`

**Acceptance criteria:**
- [ ] `exportUserData` queries only V2 + Phase 2 models (no `prisma.task`)
- [ ] All 5 GDPR endpoints at `/gdpr/*` paths (not `/auth/account/*`)
- [ ] ConsentLog gate: `POST /gdpr/consent` must be called once before first `POST /users` in production setup
- [ ] GDPR data export returns `WorkApplication`, `WorkerAssignment`, `Attendance`, `Rating` — not `Task`

### Phase 5 — hotel_ids Deprecation (Sprint 5, future)

**Duration:** 1–2 days  
**Dependencies:** HotelWorker service fully operational and tested  
**PR target:** `main`

Migration window required: existing JWTs embed `hotel_ids`. Coordinate with mobile teams. Force re-login or implement a JWT version field to detect old tokens.

---

## Final Recommendation Summary

```
PR #2 disposition:     CLOSE — do not merge, do not attempt conflict resolution
Salvageable value:     7 auth-module files (reconstruct on new branch)
Discarded:             schema.prisma, package.json, package-lock.json, crm/*
Deferred (Phase 2):    GDPR module, exportUserData, Phase 2 schema
Governance required:   Test runner + password hashing decision (Stream C)

New PRs to open:
  PR A  feat/auth-improvements     6–7 hrs    Sprint 1   Unblocked (except argon2)
  PR B  feat/gdpr-module           3–5 days   Sprint 4   Blocked by Phase 3 schema
  PR C  feat/test-stack-upgrade    2–4 hrs    After governance   Blocked by TESTING_MASTER_PLAN_V2
  PR D  feat/crm-v2                2–3 days   Sprint 2   Unblocked
  PR E  feat/hotel-ids-removal     1–2 days   Sprint 5   Blocked by HotelWorker service

Blocking risks resolved by Stream A:   R-1, R-5, R-6, R-8, R-9, R-12, R-14, R-15, R-16, R-17
Risks resolved by discard:             R-2, R-3, R-4, R-18
Risks requiring Stream C governance:   R-10
Risks deferred to Phase 2+:            R-11, R-13
Risk requiring immediate action:       R-7 (missing canonical documents from repo)
```
