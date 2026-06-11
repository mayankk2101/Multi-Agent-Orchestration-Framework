# PHASE_6_IMPLEMENTATION_MAP

**Phase:** 6 — Phase 2 Schema Migration  
**Branch:** `feat/phase2-schema` (cut from `main`)  
**Canonical authority:** SPRINT_1_CANONICAL_EXECUTION_PLAN §4 Phase 6; PRISMA_SCHEMA_V2_FREEZE §1; API_SPEC_V1_PATCH_V2 PATCH-06  
**Depends on:** Phase 1 (`feat/auth-improvements`) merged to `main`  
**Estimated effort:** 3–5 days  
**Date produced:** 2026-06-11

---

## 1. Models Added

Nine deferred models not present in `backend/prisma/schema.prisma` (V2 freeze lists 13 MVP models; current schema contains 13 MVP models, none of the 9 below):

| # | Model | Module | Notes |
|---|---|---|---|
| 1 | `Contract` | Contracts | Worker engagement contract; anchored to `HotelWorker` |
| 2 | `ContractTemplate` | Contracts | Reusable contract template scoped to a hotel |
| 3 | `ContractLineItem` | Contracts | Individual terms/line items on a `Contract` |
| 4 | `WorkerDocument` | Documents | Document uploaded by a worker (CV, cert, ID) |
| 5 | `RequiredDocument` | Documents | Document type required by a hotel for roster eligibility |
| 6 | `Payroll` | Payroll | Payroll batch for a hotel/period |
| 7 | `PayrollLineItem` | Payroll | Per-assignment line on a `Payroll` |
| 8 | `DataRetentionLog` | GDPR | Append-only log of data retention/purge actions |
| 9 | `ConsentLog` | GDPR | Per-user consent record; **required before first production registration** |

---

## 2. Schema Changes

### 2a. New enums required

The following typed status enums must be added to `schema.prisma`; free strings are not acceptable (per schema freeze pattern):

| Enum | Values | Used by |
|---|---|---|
| `ContractStatus` | `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED`, `SUPERSEDED` | `Contract` |
| `DocumentStatus` | `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `EXPIRED` | `WorkerDocument` |
| `PayrollStatus` | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PAID`, `DISPUTED` | `Payroll` |
| `ConsentType` | `TERMS_OF_SERVICE`, `PRIVACY_POLICY`, `MARKETING`, `DATA_PROCESSING` | `ConsentLog` |
| `RetentionAction` | `ANONYMISED`, `DELETED`, `EXPORTED`, `FLAGGED` | `DataRetentionLog` |

### 2b. Notification enum additions (schema.prisma line 89–111)

PATCH-06 (`API_SPEC_V1_PATCH_V2`) mandates two new `NotificationType` values not currently in the schema:

| Value | Trigger |
|---|---|
| `CONTRACT_EXPIRING` | Contract approaching `end_date` (≥ 30-day threshold) |
| `DOCUMENT_UPLOADED` | Worker posts to `POST /worker-documents` |

Current schema is missing these two values. They must be appended to the `NotificationType` enum in `schema.prisma`.

### 2c. User model — no field additions required

`User` already has `deleted_at` (GDPR soft-delete). `ConsentLog` links to `User` via FK; no new columns on `User`.

### 2d. HotelWorker model — no field additions required

`Contract` and `RequiredDocument` link to `Hotel`/`User`; no new columns on `HotelWorker` needed in this phase.

---

## 3. Migrations Required

### Migration file: `backend/prisma/migrations/V3_phase2_schema.sql`

Must run inside a single `BEGIN / COMMIT` transaction. All DDL idempotent (`IF NOT EXISTS`).

| Step | Operation |
|---|---|
| 1 | Create 5 new enums: `ContractStatus`, `DocumentStatus`, `PayrollStatus`, `ConsentType`, `RetentionAction` |
| 2 | Append `CONTRACT_EXPIRING`, `DOCUMENT_UPLOADED` to `NotificationType` enum (`ALTER TYPE ... ADD VALUE`) |
| 3 | Create `ContractTemplate` table (FK → `Hotel`) |
| 4 | Create `Contract` table (FK → `HotelWorker`, `ContractTemplate`; status enum; `start_date`, `end_date`, `signed_at`) |
| 5 | Create `ContractLineItem` table (FK → `Contract`; `position`, `description`, `quantity`, `unit_price`) |
| 6 | Create `RequiredDocument` table (FK → `Hotel`; `document_type`, `is_mandatory`) |
| 7 | Create `WorkerDocument` table (FK → `User`, `RequiredDocument?`; status enum; `file_url`, `expires_at`) |
| 8 | Create `Payroll` table (FK → `Hotel`; status enum; `period_start`, `period_end`, `total_amount`, `currency`) |
| 9 | Create `PayrollLineItem` table (FK → `Payroll`, `WorkerAssignment`; `worker_id`, `hours_worked`, `amount`) |
| 10 | Create `ConsentLog` table (FK → `User`; `consent_type` enum; `consented_at`, `withdrawn_at`, `ip_address`, `user_agent`) |
| 11 | Create `DataRetentionLog` table (FK → `User` SetNull; `action` enum; `resource_type`, `resource_id`, `performed_by_id`, `performed_at`) |
| 12 | Create standard indexes on all 9 new tables |
| 13 | Extend `set_updated_at()` trigger (already exists from V2) to cover new mutable tables |

**`ConsentLog` deployment note:** Step 10 must be applied and verified before the first production user registration. It is the hard gate for GDPR compliance. All other steps can follow in sequence.

**`ALTER TYPE ... ADD VALUE` note:** PostgreSQL does not allow `ADD VALUE` inside a transaction block on PG < 12. On PG 15+ (target) it is safe inside a transaction. Confirm PG version before running Step 2.

---

## 4. Service Modules Affected

| Module path | Change type | Detail |
|---|---|---|
| `backend/src/modules/notifications/service.ts` | Enum extension | Add `CONTRACT_EXPIRING` and `DOCUMENT_UPLOADED` dispatch paths; update `NotificationType` switch/map |
| `backend/src/modules/notifications/types.ts` | Enum extension | Add two new `NotificationType` values to the TS type |
| `backend/src/modules/notifications/routes.ts` | No change | Endpoint surface unchanged |

**New service modules to create (no existing counterpart):**

| Module path | Scope |
|---|---|
| `backend/src/modules/contracts/service.ts` | CRUD for `Contract`, `ContractTemplate`, `ContractLineItem`; `CONTRACT_EXPIRING` notification trigger logic |
| `backend/src/modules/contracts/controller.ts` | Request handling |
| `backend/src/modules/contracts/routes.ts` | Route registration |
| `backend/src/modules/contracts/types.ts` | DTOs and enums |
| `backend/src/modules/documents/service.ts` | CRUD for `WorkerDocument`, `RequiredDocument`; `DOCUMENT_UPLOADED` notification dispatch |
| `backend/src/modules/documents/controller.ts` | Request handling |
| `backend/src/modules/documents/routes.ts` | Route registration |
| `backend/src/modules/documents/types.ts` | DTOs and enums |
| `backend/src/modules/payroll/service.ts` | CRUD for `Payroll`, `PayrollLineItem`; derive line items from `WorkerAssignment` + `Attendance` |
| `backend/src/modules/payroll/controller.ts` | Request handling |
| `backend/src/modules/payroll/routes.ts` | Route registration |
| `backend/src/modules/payroll/types.ts` | DTOs and enums |
| `backend/src/modules/gdpr/service.ts` | `ConsentLog` writes/reads; `DataRetentionLog` writes; `exportUserData` against V2 + Phase 2 entities (Phase 7 completes this) |
| `backend/src/modules/gdpr/controller.ts` | Request handling |
| `backend/src/modules/gdpr/routes.ts` | Route registration at `/gdpr/*` |
| `backend/src/modules/gdpr/types.ts` | DTOs and enums |

**Note:** The GDPR module stub (service/controller/routes) is created in Phase 6 alongside `ConsentLog` and `DataRetentionLog` schema. Full `exportUserData` implementation is Phase 7. Phase 6 delivers the schema + the consent and retention log write paths only.

---

## 5. API Endpoints Affected

### New endpoints (not in current 46-endpoint surface)

These are implied by the 9 new models and the `CONTRACT_EXPIRING` / `DOCUMENT_UPLOADED` notification events. They are not defined in `API_SPEC_V1_PATCH_V2` (the spec notes contracts as out of scope for this surface). They require a `API_SPEC_V2` patch document before implementation:

| Method | Route | Module | Status |
|---|---|---|---|
| POST | `/contracts` | contracts | **Needs spec** |
| GET | `/contracts` | contracts | **Needs spec** |
| GET | `/contracts/:id` | contracts | **Needs spec** |
| PATCH | `/contracts/:id` | contracts | **Needs spec** |
| POST | `/worker-documents` | documents | **Needs spec** — triggers `DOCUMENT_UPLOADED` |
| GET | `/worker-documents` | documents | **Needs spec** |
| POST | `/payroll` | payroll | **Needs spec** |
| GET | `/payroll` | payroll | **Needs spec** |

### Existing endpoints affected (no route change, internal change only)

| Endpoint | Change |
|---|---|
| `POST /notifications` | `NotificationType` enum extended; `CONTRACT_EXPIRING` and `DOCUMENT_UPLOADED` are now valid `type` values |
| `GET /notifications` | No change to route; response data may include two new type values |

### GDPR endpoints (already in API_SPEC_V1_PATCH_V2 Final API Surface)

Phase 6 creates the module stubs and schema. Phase 7 completes them.

| Method | Route | Phase 6 delivers | Phase 7 delivers |
|---|---|---|---|
| POST | `/gdpr/consent` | `ConsentLog` write path | — |
| GET | `/gdpr/consent/:userId` | `ConsentLog` read path | — |
| POST | `/gdpr/data-export` | stub (501) | full `exportUserData` |
| POST | `/gdpr/data-deletion` | stub (501) | deletion logic |
| GET | `/gdpr/retention-logs` | `DataRetentionLog` read path | — |

---

## 6. Tests Affected

### Existing test files requiring patches

| File | Change required |
|---|---|
| `backend/src/__tests__/hotel-workers.test.ts` | No change required in Phase 6; `HotelWorker` schema unchanged |
| `backend/src/__tests__/users.test.ts` | No change required; User schema unchanged |
| `backend/src/__tests__/hotel.test.ts` | No change required; Hotel schema unchanged |
| `backend/src/__tests__/auth.test.ts` | No change required |
| `backend/src/__tests__/rbac.test.ts` | No change required |

### New test files to create

| File | Scope |
|---|---|
| `backend/src/__tests__/contracts.test.ts` | CRUD + status lifecycle + `CONTRACT_EXPIRING` notification dispatch |
| `backend/src/__tests__/documents.test.ts` | CRUD + `DOCUMENT_UPLOADED` notification dispatch |
| `backend/src/__tests__/payroll.test.ts` | CRUD + line item derivation from `WorkerAssignment` |
| `backend/src/__tests__/gdpr.test.ts` | `ConsentLog` write/read; `DataRetentionLog` write/read; stub 501s for Phase 7 paths |
| `backend/src/__tests__/notifications.test.ts` | Extend existing notification tests to cover two new `NotificationType` enum values |

**Test stack:** Jest + Supertest + bcryptjs (per `TESTING_MASTER_PLAN_FREEZE`; no change to stack in this phase).

---

## 7. Dependency Graph

```
Phase 1 (auth) ─────────────────────────────────────────────────┐
                                                                  │
                                                                  ▼
                                                     Phase 6 (feat/phase2-schema)
                                                          │
                     ┌────────────────┬─────────────┬────┴──────────┬──────────────────┐
                     ▼                ▼             ▼               ▼                  ▼
               ConsentLog      ContractTemplate  Contract      WorkerDocument      Payroll
               (HARD GATE      → ContractLineItem → CONTRACT_   → RequiredDocument  → PayrollLineItem
               before prod reg)                   EXPIRING notif  → DOCUMENT_UPLOADED  (anchored to
                                                                     notif              WorkerAssignment
                                                                                        + Attendance)
                     │
                     ▼
             Phase 7 (feat/gdpr-module)
             [depends on Phase 1 + Phase 6]
             exportUserData over V2 + Phase 2 entities
```

**Internal to Phase 6:**

```
Step 1-2 (enums)
    → Step 3 (ContractTemplate)
        → Step 4 (Contract)
            → Step 5 (ContractLineItem)
    → Step 6 (RequiredDocument)
        → Step 7 (WorkerDocument)
    → Step 8 (Payroll)
        → Step 9 (PayrollLineItem)   [also depends on WorkerAssignment — already exists]
    → Step 10 (ConsentLog)           [MUST run before prod registration]
    → Step 11 (DataRetentionLog)
    → Steps 12-13 (indexes + triggers)
```

---

## 8. Implementation Order

1. **Cut branch** `feat/phase2-schema` from `main` HEAD (after Phase 1 merged).
2. **Append two enum values** to `NotificationType` in `schema.prisma` (`CONTRACT_EXPIRING`, `DOCUMENT_UPLOADED`).
3. **Add 5 new enums** to `schema.prisma`.
4. **Add 9 new model blocks** to `schema.prisma` in dependency order: `ContractTemplate` → `Contract` → `ContractLineItem` → `RequiredDocument` → `WorkerDocument` → `Payroll` → `PayrollLineItem` → `ConsentLog` → `DataRetentionLog`.
5. **Run `prisma validate`** — must pass before any migration file is written.
6. **Write `V3_phase2_schema.sql`** in `backend/prisma/migrations/`. Steps 1–13 as specified above.
7. **Apply migration** to dev database; confirm zero errors.
8. **`ConsentLog` deployment gate:** verify Step 10 is applied and the table is queryable before any production traffic is allowed.
9. **Create service/controller/routes/types** for `contracts`, `documents`, `payroll`, `gdpr` modules (stubs with correct structure; GDPR data-export and deletion stubs return 501).
10. **Patch `notifications/service.ts` and `notifications/types.ts`** for two new enum values.
11. **Register new routers** in `app.ts`.
12. **Write tests** for all new modules.
13. **Gate:** `tsc --noEmit` clean + all tests pass (including existing suite unbroken).
14. **Open PR** targeting `main`; do not merge until Phase 7 readiness is confirmed.

---

## 9. Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R-1 | `ConsentLog` table not applied before first production user registration — GDPR violation | **Critical** | Treat Step 10 of the migration as a hard deployment gate; block prod registration route until migration is confirmed applied |
| R-2 | `ALTER TYPE ... ADD VALUE` for `NotificationType` fails if wrapped in a transaction on PG < 12 | High | Project targets PG 15+ (schema freeze); confirm version. If PG < 12 is encountered, extract Step 2 to a separate migration run outside the transaction |
| R-3 | `PayrollLineItem` anchored to `WorkerAssignment`; if Phase 3 (HotelWorker v2) changes `WorkerAssignment` shape, FK may need updating | Medium | Phase 6 depends on Phase 1 only; Phase 3 runs in parallel on a separate branch. Coordinate before merging Phase 6 if Phase 3 alters `WorkerAssignment` columns referenced by payroll |
| R-4 | `WorkRequestStatus` enum conflict (Blocker B-2): schema freeze has 6 states; API spec PATCH-05 published 3 states (`OPEN`, `CLOSED`, `CANCELLED`) | Medium | This conflict must be resolved as Phase 0 pre-work (API spec patch) before Phase 6 opens. Phase 6 does not modify `WorkRequestStatus`; risk is inherited from unresolved B-2 if it bleeds into notification trigger logic for `WORK_REQUEST_*` events |
| R-5 | New modules (`contracts`, `documents`, `payroll`) have no spec in `API_SPEC_V1_PATCH_V2` — endpoints listed in §5 are unspecified | Medium | Do not implement endpoint logic beyond stubs until a `API_SPEC_V2` patch document is produced. Phase 6 delivers schema + stubs only for these three modules |
| R-6 | `set_updated_at()` trigger (V2 migration Step 15) must be extended to cover new mutable tables; omitting it means `updated_at` is never auto-maintained | Low | Step 13 of the Phase 6 migration explicitly extends the trigger. Verify trigger function signature is compatible with new table names |
| R-7 | `DataRetentionLog.performed_by_id` references `User`; if actor is deleted, SetNull is required (consistent with `AuditLog.actor_id` pattern) | Low | Apply `onDelete: SetNull` in the Prisma model definition and corresponding FK in the migration |
