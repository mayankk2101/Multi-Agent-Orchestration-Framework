# PR2 Auth Salvage — Execution Plan
**Source PR:** feat: complete auth module + repair Prisma schema relations (`fix/backend-blockers` → `main`)  
**Plan date:** 2026-06-10  
**Status:** EXECUTION-READY — pending governance decision D-1/D-2

---

## File Disposition Index

### Stream A — Auth Improvements (`feat/auth-improvements` from `main`)

| File | Disposition | Rationale |
|------|-------------|-----------|
| `backend/src/app.ts` | **KEEP** | Single unused-import deletion. Zero risk. Take PR version verbatim. |
| `backend/src/modules/auth/validation.ts` | **KEEP** | New file; does not exist on main. Strong Zod schema improvements over main's colocated approach. One open field decision (hotel_ids) does not block file creation. |
| `backend/src/modules/auth/types.ts` | **MODIFY** | Interface additions are sound. One field must be removed before merge (`hotel_ids: string[]`). All other changes are additive improvements. |
| `backend/src/lib/jwt.ts` | **MODIFY** | SignOptions typing is a genuine improvement. Refresh-secret handling is a blocker that requires two targeted line edits. Export visibility of one function requires one line edit. |
| `backend/src/modules/auth/controller.ts` | **MODIFY** | Thin-controller pattern is correct. Seven of eight handlers are clean. One handler (`logout`) passes wrong argument; one-line fix required. |
| `backend/src/modules/auth/routes.ts` | **MODIFY** | Route-level validation pattern is correct. Two routes belong in a future GDPR module and must be removed. One middleware guard on signup must be removed. |
| `backend/src/modules/auth/service.ts` | **MODIFY** | Core method structure is usable. Two entire methods must be removed (`exportUserData`, `getDefaultPermissions`). Seven field references must be purged. Four behavioural regressions must be restored from main. Password-hashing import is conditional on governance decision D-1. |

### Stream B — GDPR Module (`feat/gdpr-module` from `main`)

| File | Disposition | Rationale |
|------|-------------|-----------|
| `backend/src/modules/gdpr/service.ts` | **REIMPLEMENT** | Does not exist. PR's `exportUserData` intent is correct but queries models that do not exist in V2 or are Phase 2 only. Must be authored fresh against V2 entity chain once Phase 2 schema is merged. |
| `backend/src/modules/gdpr/controller.ts` | **REIMPLEMENT** | Does not exist. Handler shapes from PR's auth controller are a valid starting reference, but the file must be created on a new branch after Stream A is merged. |
| `backend/src/modules/gdpr/routes.ts` | **REIMPLEMENT** | Does not exist. Canonical paths differ from PR's intent. Must be authored from scratch at `/gdpr/*` per `API_SPEC_V1_PATCH_V2`. |

### Discarded Files — not carried forward in any form

| File | Disposition | Rationale |
|------|-------------|-----------|
| `backend/prisma/schema.prisma` (PR version) | **DISCARD** | Pre-V2 architecture. Main already holds the correct V2 schema. Cherry-picking or merging any part of this file produces an incorrect result. |
| `backend/package.json` (PR version) | **DISCARD** | Vitest introduction violates `TESTING_MASTER_PLAN_FREEZE` (status: FROZEN). No superseding plan exists. Cannot be merged until governance produces `TESTING_MASTER_PLAN_V2`. |
| `package-lock.json` (PR version) | **DISCARD** | Generated artefact of the discarded package.json. Must be regenerated from the package.json that wins the governance decision. |
| `backend/src/modules/crm/*` (PR version) | **DISCARD** | Queries models removed in V2. Module does not compile against the V2 Prisma client. Cannot be salvaged incrementally; a full rewrite is required as a separate PR (Stream D). |

### No-Action Files — already correct on main

| File | Disposition | Rationale |
|------|-------------|-----------|
| `backend/prisma/schema.prisma` (main version) | **KEEP** | V2 + schema patches SP-1..SP-9 applied. Authoritative. |
| `backend/src/middleware/auth.ts` | **KEEP** | Identical SHA on both branches. |
| `backend/src/middleware/permissions.ts` | **KEEP** | Identical SHA on both branches. |

---

## Branch Strategy

| Branch | Base | Purpose | Opens when |
|--------|------|---------|-----------|
| `feat/auth-improvements` | `main` HEAD | Stream A: auth module salvage | Immediately after governance decision D-1/D-2 |
| `feat/crm-v2` | `main` HEAD | Stream D: CRM rewrite against V2 | Immediately; no dependency on Stream A |
| `feat/phase2-schema` | `main` HEAD | Phase 2 schema migration (Contract, Payroll, WorkerDocument, ConsentLog, DataRetentionLog) | After `PRISMA_SCHEMA_V2_PATCH_V2` document is frozen |
| `feat/gdpr-module` | `main` HEAD | Stream B: GDPR module | After Stream A merged AND `feat/phase2-schema` merged |
| `feat/test-stack-upgrade` | `main` HEAD | Stream C: vitest + argon2 (if governance approves) | After `TESTING_MASTER_PLAN_V2` is frozen |
| `feat/hotel-ids-removal` | `main` HEAD | Phase 5: deprecate `hotel_ids` from User/JWT | After HotelWorker service is fully operational on main |

**Branch rules:**
- Every branch is cut from `main` HEAD at the moment work begins — never from `fix/backend-blockers`.
- No cherry-picks from `fix/backend-blockers`. Files are reconstructed from main and edited per salvage instructions.
- `fix/backend-blockers` is closed without merge after Stream A PR opens.

---

## Implementation Order

Phases are hard-sequenced by dependency. Work within a phase may be parallelised.

### Phase 0 — Governance (unblocks Stream A for password hashing)
**Owner:** Tech lead  
**Output:** Written decision on D-1 (jest vs vitest) and D-2 (bcryptjs vs argon2)  
**Duration:** 2–4 hours  

Open decisions that must be resolved before Stream A code begins:

| Decision | Options | Default recommendation |
|----------|---------|----------------------|
| D-1: Test runner | Keep jest / Switch to vitest (requires `TESTING_MASTER_PLAN_V2`) | Keep jest — unblocks Stream A immediately |
| D-2: Password hashing | Keep bcryptjs / Switch to argon2 (requires fixture updates) | Follows D-1; if jest kept, keep bcryptjs for now |
| D-3: Signup semantics | Open self-registration / Admin-only creation | Open registration for MVP |
| D-4: hotel_ids on User | Keep for MVP / Remove now (requires HotelWorker middleware rewrite) | Keep for MVP; remove in Phase 5 |

### Phase 1 — Stream A: Auth Improvements
**Branch:** `feat/auth-improvements`  
**Dependency:** Phase 0 complete  
**Duration:** 6–7 hours  

Implementation sequence within this phase (files are order-dependent):

1. `validation.ts` — copy from PR branch; apply D-4 decision to `hotel_ids` field in SignupSchema
2. `types.ts` — apply from PR; remove `hotel_ids` from `AuthUser`; rename `AuthResponse` → `AuthTokens`
3. `jwt.ts` — apply PR's SignOptions typing; restore refresh-secret two-secret pattern; export `parseExpiryToSeconds`; remove `hotel_ids` from `AccessTokenPayload`
4. `service.ts` — largest unit; reconstruct from main, applying all PR improvements with the twelve targeted modifications specified in `PR2_SALVAGE_PLAN.md §2.6` and `§3`; password hashing follows D-1/D-2 decision
5. `controller.ts` — take PR version; apply single-line logout fix
6. `routes.ts` — take PR version; remove signup guard; remove two GDPR routes; remove `requireRole` import if unused
7. `app.ts` — take PR version (single-line cleanup)
8. Scan all import sites referencing `./types.js` for Zod schemas; update to `./validation.js`
9. Compile gate: `npx tsc --noEmit` must exit 0
10. Test gate: full auth test suite must pass

**Gate before PR opens:** TypeScript compilation clean + all auth tests passing.

### Phase 2 — Stream D: CRM V2 Rewrite
**Branch:** `feat/crm-v2`  
**Dependency:** None (V2 schema already on main); can run in parallel with Phase 1  
**Duration:** 2–3 days  

Rewrite `backend/src/modules/crm/` from scratch:
- Remove all Task/Room CRUD service methods
- Implement HotelWorker enrollment endpoints per `MARKETPLACE_REFACTOR_MASTER_PLAN` Part 3/4
- Align RBAC per `API_SPEC_V1_PATCH_V2 PATCH-07`

### Phase 3 — Phase 2 Schema Migration
**Branch:** `feat/phase2-schema`  
**Dependency:** Stream A merged; `PRISMA_SCHEMA_V2_PATCH_V2` document frozen  
**Duration:** 3–5 days  

Adds 9 models: `Contract`, `ContractTemplate`, `ContractLineItem`, `WorkerDocument`, `RequiredDocument`, `Payroll`, `PayrollLineItem`, `DataRetentionLog`, `ConsentLog`. `ConsentLog` must be created before any registration endpoint is active in production (INFRA PATCH-08 hard gate).

### Phase 4 — Stream B: GDPR Module
**Branch:** `feat/gdpr-module`  
**Dependency:** Phase 1 merged AND Phase 3 merged  
**Duration:** 3–5 days  

Implement `backend/src/modules/gdpr/` — three files, all REIMPLEMENT:
- `service.ts` against V2 + Phase 2 entity chain
- `controller.ts` informed by PR's handler shapes
- `routes.ts` at canonical `/gdpr/*` paths

### Phase 5 — hotel_ids Deprecation
**Branch:** `feat/hotel-ids-removal`  
**Dependency:** HotelWorker service fully operational and tested on main  
**Duration:** 1–2 days  

Removes `User.hotel_ids` column and all associated JWT payload fields. Requires migration window coordination — existing issued JWTs embed `hotel_ids`. Force re-login or implement JWT version field.

### Phase 6 — Stream C: Test Stack Upgrade (if governance approves)
**Branch:** `feat/test-stack-upgrade`  
**Dependency:** `TESTING_MASTER_PLAN_V2` frozen  
**Duration:** 2–4 hours after governance document exists  

Switches jest → vitest, bcryptjs → argon2, updates `db-seeds.ts` fixtures, updates CI YAML. Cannot proceed before governance document exists; cannot run concurrently with any open PR that adds jest-based tests.

---

## Effort Summary

| Stream | Scope | Estimated effort | Blocking dependencies |
|--------|-------|-----------------|----------------------|
| Phase 0 — Governance | Decision meeting + written record | 2–4 hours | None |
| Phase 1 — Stream A | 7 modified files | 6–7 hours | Phase 0 |
| Phase 2 — Stream D | CRM rewrite (all new) | 2–3 days | None |
| Phase 3 — Phase 2 Schema | 9 new models | 3–5 days | Stream A merged; schema doc frozen |
| Phase 4 — Stream B | 3 new files | 3–5 days | Phase 1 + Phase 3 |
| Phase 5 — hotel_ids removal | Cross-cutting deprecation | 1–2 days | HotelWorker service operational |
| Phase 6 — Stream C | Test runner swap | 2–4 hours | `TESTING_MASTER_PLAN_V2` frozen |

**Critical path to MVP auth merge:** Phase 0 → Phase 1 (total: ~1 day)  
**Critical path to GDPR module:** Phase 0 → Phase 1 → Phase 3 → Phase 4 (total: ~2–3 sprints)

---

## Immediate Pre-Work Actions

The following must happen before any branch is cut:

1. **Close PR #2** on GitHub without merge. Comment explaining the split plan.
2. **Record governance decisions** D-1 through D-4 in writing. Even a single-paragraph document is sufficient to unblock Stream A.
3. **Recover missing canonical documents** to the repository: `MASTER_ARCHITECTURE_v2.0.md`, `RBAC_PERMISSION_MATRIX_v1.0.md`, `FINAL_DECISIONS_SUMMARY.md` (currently only on Google Drive). Create `CANONICAL_ARCHITECTURE_INDEX.md` and `DOCUMENT_RECOVERY_AUDIT.md` if these were planned documents. Their absence is a tracking risk for all future audits.
