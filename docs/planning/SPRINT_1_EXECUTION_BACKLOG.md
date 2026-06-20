# SPRINT 1 EXECUTION BACKLOG

**Date:** 2026-06-10
**Branch:** `claude/jolly-dijkstra-jvfie3`
**Purpose:** Convert all Sprint 1 remediation work into an ordered, dependency-aware implementation sequence for bringing Sprint 1 into compliance.
**Scope:** Execution sequencing only. No new architecture, no module redesign, no new plans.

---

## Source Documents

This backlog sequences work already decided in the following documents. It does not introduce new decisions.

| Document | Status | Role in this backlog |
|---|---|---|
| `SPRINT_1_COMPLIANCE_REPORT.md` | Present | Per-module factual state of Sprint 1 code |
| `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md` | Present | File/module classifications, migration order, refactor layers, effort |
| `PR2_SALVAGE_PLAN.md` | Present | Function-level extraction guide for PR #2 auth files |
| `PR2_FINAL_MERGE_DECISION.md` | Present | Final disposition of PR #2 (close + reimplement) |

**Documents named in the task that do not exist in the repo** (sequencing proceeds on the equivalents above; their absence is carried as blocker **B-0**):

- `SPRINT_1_FINAL_REMEDIATION_PLAN.md` — NOT FOUND
- `ENUM_RECONCILIATION_PATCH_SPEC.md` — NOT FOUND
- `ARCHITECTURE_RECONCILIATION_REPORT.md` — NOT FOUND

Also referenced as authoritative by the source documents but absent from the repo (see B-0): `PRISMA_SCHEMA_V2_FREEZE.md`, `API_SPEC_V1_PATCH_V2.md`, `MARKETPLACE_REFACTOR_MASTER_PLAN.md`, `SCHEMA_RECONCILIATION_DECISION.md`.

---

## Legend

**Item class** (per requirement 3):

| Class | Meaning |
|---|---|
| **MERGE-NOW** | Take as-is or with trivial edits; no architecture decision outstanding |
| **PATCH** | Functionally correct; targeted edits to specific fields/checks |
| **REWRITE** | Structurally misaligned; new implementation required |

**Effort** is single-engineer hours familiar with the codebase (lower = minimal change, upper = full implementation incl. tests).

---

## Blocker Register

| ID | Blocker | Blocks | Resolvable now? |
|---|---|---|---|
| **B-0** | Canonical docs absent (schema freeze, API spec, marketplace refactor plan, schema reconciliation). All "target architecture" rewrites are unverified without them. | All REWRITE items in SCHEMA, AUTH, HOTEL WORKER, CRM groups | No — obtain documents |
| **B-1** | JWT payload decision (remove `hotel_ids` + `permissions`?) | jwt.ts rewrite, auth.ts patch, AuthContext, auth/user service rewrites | No — needs API spec |
| **B-2** | `HotelMembership` junction table does not exist | HotelWorker rewrite, User list-filter rewrite, `checkHotelAccess` rewrite, drop of `User.hotel_ids` | No — needs schema freeze |
| **B-3** | Session storage strategy (keep PostgreSQL vs Redis/IdP) | auth service session logic | No — needs marketplace refactor plan |
| **B-4** | Test stack governance: Jest+bcryptjs vs Vitest+argon2 (PR #2 introduced the latter, violating `TESTING_MASTER_PLAN_FREEZE`) | argon2 in auth service; PR #2 `package.json`/seed updates | Yes — tech-lead decision (2–4h) |
| **B-5** | `hotel_ids`-on-User keep-vs-remove decision (PATCH-04) | SignupSchema field, AccessTokenPayload, format helpers, `checkHotelAccess` | Partially — interim MVP keep is the documented default |
| **B-6** | RBAC redesign: static `ROLE_PERMISSIONS` vs DB-driven; `super_admin` phantom role | permissions.ts rewrite, constants.ts | No — needs marketplace refactor plan |
| **B-7** | Data backfill of `User.hotel_ids` → `HotelMembership` must complete and verify before column drop | drop `hotel_ids` migration step | After B-2 |

---

## Execution Phases (high level)

```
PHASE 0  Governance + document recovery        (unblocks B-0, B-4; partial B-5)
PHASE 1  Immediate patches (no blockers)       INFRASTRUCTURE + CRM + tests
PHASE 2  PR #2 auth salvage → Stream A          AUTH (extract & reconstruct)
PHASE 3  Schema migration                       SCHEMA (HotelMembership, drops)
PHASE 4  Core lib + middleware rewrites          INFRASTRUCTURE (jwt, permissions)
PHASE 5  Service rewrites                         AUTH / HOTEL WORKER / CRM / User
PHASE 6  Test reconciliation                      cross-group
```

Ordering rule (from `SPRINT_1_SALVAGE_AND_REFACTOR_PLAN.md` Part 4): **schema → core lib → middleware → services → controllers → tests → routes/index.**

---

## GROUP A — SCHEMA

| # | Task | Class | Effort | Depends on / Blocker |
|---|---|---|---|---|
| S-1 | Recover & commit `PRISMA_SCHEMA_V2_FREEZE.md` and reconciliation docs to repo | MERGE-NOW | 1–2h | B-0 |
| S-2 | Add `HotelMembership` table (id, hotel_id, user_id, assigned_by, assigned_at, removed_at, status) | REWRITE | 4–6h | S-1, B-2 |
| S-3 | Backfill `HotelMembership` from `User.hotel_ids` (data migration) | REWRITE | incl. S-2 | S-2, B-7 |
| S-4 | Add `Hotel.deleted_at` (nullable; GDPR soft-delete gap) | PATCH | 1h | S-1 |
| S-5 | Add `WorkerAssignment` partial unique index (in schema, missing from migration SQL) | PATCH | 0.5h | S-1 |
| S-6 | Declare missing `User` relations (`WorkerOverallRating`, `DataRetentionLog`, `ConsentLog`) | PATCH | 0.5h | S-1 |
| S-7 | Revisit `DataRetentionLog` FK `onDelete: Restrict` vs GDPR anonymisation | PATCH | 1h | S-1 |
| S-8 | Normalise free-text status fields to typed enums (PR #2 schema used string status; align statuses, e.g. `HotelWorker.status`, Phase-2 model statuses) | PATCH | 2–3h | S-1, B-0 |
| S-9 | Drop `User.hotel_ids` column (after S-3 verified) | REWRITE | 1–2h | S-3, B-5, B-7 |
| S-10 | Drop `User.permissions` column (after RBAC redesign) | REWRITE | 1h | I-7, B-6 |
| S-11 | Discard PR #2 `schema.prisma` entirely (pre-V2 CRM; main already V2) | MERGE-NOW | 0 | — |

**Group A effort:** ~12–18h. **Critical blockers:** B-0, B-2, B-5, B-6, B-7.

---

## GROUP B — AUTH

Per `PR2_FINAL_MERGE_DECISION.md`: **close PR #2, reconstruct the 7 auth files on a fresh branch from `main`** (Stream A). Do not cherry-pick PR #2 commits.

| # | Task | Class | Effort | Depends on / Blocker |
|---|---|---|---|---|
| AU-1 | Take `app.ts` (single unused-import deletion) | MERGE-NOW | 5m | — |
| AU-2 | Add `validation.ts` (new file; Zod schemas separated from types) | MERGE-NOW | 10–15m | B-5 (SignupSchema `hotel_ids` field) |
| AU-3 | `types.ts`: remove `hotel_ids` from `AuthUser`; rename `AuthResponse`→`AuthTokens`; add `phone?/profile_photo_url?/updated_at?` | PATCH | 15m | B-5 |
| AU-4 | `jwt.ts` (Stream A scope): add `SignOptions` typing; fix refresh secret → `JWT_REFRESH_SECRET ?? JWT_SECRET` (×2, **BLOCKER R-1**); `export parseExpiryToSeconds`; remove `hotel_ids` from `AccessTokenPayload` | PATCH | 20m | — |
| AU-5 | `controller.ts`: take all 8 thin handlers; fix `logout` to pass `req.body?.refresh_token` (R-9) | PATCH | 30m | — |
| AU-6 | `routes.ts`: 6 routes; remove `requireRole('admin')` from signup (R-8); move 2 GDPR routes out to Stream B | PATCH | 20–30m | B-5 (signup semantics) |
| AU-7 | `service.ts` reconstruct: remove 7 `hotel_ids` refs; `.toLowerCase()` role in all `signTokens` (R-5); restore `ForbiddenError` for disabled (R-6); restore IP + `logAudit` on signup/login/logout/updateProfile (R-14/R-15); add optional `refreshToken` param to `logout`; keep `deleteAccount`; import `ROLE_PERMISSIONS`, delete inline `getDefaultPermissions` (R-12); **delete `exportUserData`** (R-3 compile failure) | REWRITE (scoped) | 3–4h | B-4 (argon2 vs bcrypt) |
| AU-8 | Update import sites `./types.js`→`./validation.js` for Zod schemas | PATCH | 30m | AU-2 |
| AU-9 | `tsc --noEmit` clean + auth tests pass (acceptance gate) | MERGE-NOW | 40m | AU-1..AU-8 |
| AU-10 | Discard PR #2 CRM module files (query removed models; compile failure) | MERGE-NOW | 0 | — |
| AU-11 | Full marketplace auth REWRITE (Session strategy, role-at-signup gating, payload redesign) — **deferred** | REWRITE | 6–8h | B-0, B-1, B-3 |

**Group B effort:** Stream A salvage ~6–7h (unblocked except argon2/B-4); full rewrite +6–8h (blocked).
**Blocking risks resolved by Stream A:** R-1, R-5, R-6, R-8, R-9, R-12, R-14, R-15, R-16, R-17. **Resolved by discard:** R-3.

---

## GROUP C — HOTEL WORKER

Entire storage model is misaligned (association stored as `User.hotel_ids` array mutation). All three service methods perform the wrong DB operation — full rewrite onto `HotelMembership`.

| # | Task | Class | Effort | Depends on / Blocker |
|---|---|---|---|---|
| HW-1 | Add `requirePermission('hotel_workers:write')` to `DELETE` route (role-only today) | PATCH | 0.5h | — |
| HW-2 | Rewrite `service.ts` to CRUD on `HotelMembership` (assign/remove/list via junction, not array `push`/`has`) | REWRITE | 6–8h | S-2, B-2 |
| HW-3 | Rewrite `types.ts` to membership shape (`assigned_at`, `status`, `assigned_by`, `role_override`) | REWRITE | 2h | S-2, B-2 |
| HW-4 | Patch `controller.ts` for new membership response fields | PATCH | 1–2h | HW-2 |
| HW-5 | Rewrite `hotel-workers.test.ts` (every mock/assertion coupled to array model) | REWRITE | 3–4h | HW-2 |

**Group C effort:** ~12–16h (HW-1 unblocked; rest blocked on B-2).

---

## GROUP D — CRM (Hotel module)

Hotel/Room CRUD is functionally sound; mostly PATCH. PR #2's CRM is discarded (Group B AU-10).

| # | Task | Class | Effort | Depends on / Blocker |
|---|---|---|---|---|
| CR-1 | Remove two 501 stub routes (`POST /hotels/:id/tasks`, `POST /tasks/:id/photos`) | MERGE-NOW | 0.5h | — |
| CR-2 | Remove `uploadPhoto` stub handler from `controller.ts` | MERGE-NOW | 0.5h | — |
| CR-3 | `deleteHotel`: write `Hotel.deleted_at` (after S-4) | PATCH | 1h | S-4 |
| CR-4 | Move `listHotels` admin/manager visibility logic out of service into middleware (dup RBAC) | PATCH | 1h | — |
| CR-5 | Implement missing `DELETE /rooms/:room_id` (no route exists) | PATCH | 1h | — |
| CR-6 | Confirm/flatten `/crm/` route prefix against API spec | PATCH | 1–2h | B-0 (API spec) |
| CR-7 | CRM V2 module direction (HotelWorker enrollment endpoints, remove Task/Room CRUD per refactor plan) | REWRITE | 2–3d | B-0, S-2 |

**Group D effort:** patches ~5–6h (CR-1..CR-5 unblocked); V2 rewrite 2–3 days (blocked on B-0).

---

## GROUP E — INFRASTRUCTURE (core lib, middleware, RBAC, audit, config, tests)

| # | Task | Class | Effort | Depends on / Blocker |
|---|---|---|---|---|
| I-1 | Remove unreachable `super_admin` bypass branch in `permissions.ts` | MERGE-NOW | 0.5h | — |
| I-2 | Add `JWT_REFRESH_SECRET` + `APNS_PRIVATE_KEY_BASE64` to `.env.example` | MERGE-NOW | 0.5h | — |
| I-3 | `base-service.ts` `logAudit`: write `actor_role` as validated enum value, not free text | PATCH | 0.5h | — |
| I-4 | `env.ts` / `constants.ts`: keep; revisit `SESSION_*` + `ROLE_PERMISSIONS` only when strategy decided | PATCH | 1–2h | B-3, B-6 |
| I-5 | Governance decision: Jest+bcryptjs vs Vitest+argon2; produce `TESTING_MASTER_PLAN_V2` if switching | MERGE-NOW (decision) | 2–4h | B-4 |
| I-6 | `jwt.ts` full payload redesign (remove `hotel_ids`+`permissions`) — beyond Stream A AU-4 | REWRITE | 3–4h | B-1 |
| I-7 | `permissions.ts` rewrite: `requirePermission` off stale JWT; `checkHotelAccess`→`HotelMembership` query; resolve `super_admin` | REWRITE | 4–6h | I-6, S-2, B-6 |
| I-8 | `auth.ts` middleware: align `req.auth` population after payload redesign | PATCH | 1h | I-6 |
| I-9 | `lib/types.ts` `AuthContext`: remove `hotel_ids`/`permissions` after payload redesign | PATCH | 1h | I-6 |
| I-10 | Add `GET /audit-logs` route (`audit:read` defined, no route) + retention enforcement job (5-yr) | PATCH | 2–3h | B-0 |
| I-11 | Discard PR #2 `package.json` + `package-lock.json` (Vitest violates frozen test plan) | MERGE-NOW | 0 | B-4 |
| I-12 | Test gaps (no blocker): add `refreshToken`/`updateProfile`/`updateHotel`/`listRooms`/`getRoom`/`updateRoom`/`updateUser` cases | PATCH | 5h | — |
| I-13 | Patch auth/users/rbac test mock data after payload + membership rewrites | PATCH | 4–6h | I-6, I-7, HW-2 |

**Group E effort:** immediate patches ~8–9h; rewrites ~15–22h (blocked on B-1/B-3/B-6).

---

## Consolidated Classification Index (requirement 3)

**MERGE-NOW (do immediately, no decision outstanding):**
AU-1, AU-2, AU-9, AU-10, CR-1, CR-2, I-1, I-2, I-11, S-11, S-1 (+I-5 decision).

**PATCH (targeted edits):**
AU-3, AU-4, AU-5, AU-6, AU-8, HW-1, CR-3, CR-4, CR-5, CR-6, S-4, S-5, S-6, S-7, S-8, I-3, I-4, I-8, I-9, I-10, I-12, I-13.

**REWRITE (new implementation):**
AU-7 (scoped), AU-11, HW-2, HW-3, HW-4, HW-5, CR-7, S-2, S-3, S-9, S-10, I-6, I-7.

---

## Effort Roll-Up

| Group | Unblocked now | Blocked (needs docs/decisions) |
|---|---|---|
| A — Schema | S-4/5/6/7/11 ≈ 3h | S-1/2/3/8/9/10 ≈ 9–15h |
| B — Auth | Stream A ≈ 6–7h | AU-11 ≈ 6–8h |
| C — Hotel Worker | HW-1 ≈ 0.5h | HW-2..5 ≈ 11–16h |
| D — CRM | CR-1..5 ≈ 5–6h | CR-6/7 ≈ 2–3d |
| E — Infrastructure | I-1/2/3/12 ≈ 8–9h | I-6/7/8/9/10/13 ≈ 15–22h |
| **Total** | **~23–26h (≈3 days)** | **~60–90h + 2–3d CRM (blocked)** |

---

## Recommended Execution Sequence

1. **PHASE 0 — unblock:** I-5 governance decision (B-4); S-1 recover docs (B-0); confirm B-5 interim "keep `hotel_ids` for MVP".
2. **PHASE 1 — immediate (parallelisable, no blockers):** I-1, I-2, I-3, CR-1, CR-2, CR-5, HW-1, I-12, S-4, S-5, S-6.
3. **PHASE 2 — Stream A auth salvage:** AU-1 → AU-9 (close PR #2 first), then AU-10/I-11 discards.
4. **PHASE 3 — schema migration:** S-2 → S-3 → (verify) → S-7, S-8, then S-9/S-10 after B-6/B-7.
5. **PHASE 4 — core lib + middleware rewrites:** I-6 → I-8 → I-9 → I-7.
6. **PHASE 5 — service rewrites:** HW-2/HW-3/HW-4 → User-service membership rewrite → CR-3/CR-4 → CR-7.
7. **PHASE 6 — tests:** HW-5, I-13, remaining coverage; final routes/index + `tsc --noEmit` gate.

**Critical path:** B-0/B-2 → S-2/S-3 (HotelMembership) gate the HotelWorker, User, and RBAC rewrites. B-1 (JWT payload) gates jwt/middleware/auth rewrites. Everything in PHASE 1 + Stream A (PHASE 2) is executable today.
