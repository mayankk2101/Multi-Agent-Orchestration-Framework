# Schema Reconciliation Decision
**Inputs:** `MERGE_CONFLICT_RESOLUTION_REPORT.md`, `main:backend/prisma/schema.prisma`, `PR#2:backend/prisma/schema.prisma`
**Output:** canonical model inventory for MVP vs Phase 2.
**Status:** Architecture decision only — no code or schema changes applied.

---

## 1. Guiding Principles

1. **Main's V2 marketplace architecture is the canonical core.** It is internally consistent, uses typed enums, and reflects the post-pivot product (workers apply to requests, not managers push tasks).
2. **Task-based legacy models (Room, Task, TaskPhoto, DailyOperation) are removed.** They are incompatible with the marketplace flow and were explicitly deleted in main's V2 header comment.
3. **Compliance models (Contract, Payroll, GDPR) are deferred to Phase 2.** They are valuable but not on the critical path for marketplace MVP. None of the 78 auth tests depend on them except `exportUserData`, which must be rewritten.
4. **MVP must ship with full auth + marketplace + attendance + ratings.** This is the minimum viable hotel-worker matching loop.
5. **Phase 2 adds HR, payroll, document management, GDPR logging.** These are post-launch compliance/operations features.

---

## 2. Definitive Model Inventory

Legend:
- ✅ **Keep** — present in main, retain as-is.
- 🆕 **Merge** — exists in PR only, add into canonical schema after normalization.
- ❌ **Remove** — exists in PR only, do not bring forward (incompatible with V2).
- ⏭️ **Deferred Phase 2** — exists in PR only, valuable, but out of MVP scope.

| # | Model | Source | Decision | Reason |
|---|-------|--------|----------|--------|
| 1 | `User` | both | **Merge** | Take main's V2 shape; add `hotel_ids String[]` field back to support `checkHotelAccess()` middleware; reconcile relation back-refs after MVP/Phase 2 split |
| 2 | `Session` | both | ✅ **Keep** | Main's version with `@unique` on `refresh_token` is the safe choice |
| 3 | `Hotel` | both | **Merge** | Take main's V2 shape; add `contract_templates`, `required_documents` back-relations only when Phase 2 ships |
| 4 | `HotelWorker` | main | ✅ **Keep** | Core marketplace roster — required for MVP |
| 5 | `WorkRequest` | both | ✅ **Keep (main)** | Main's V2 has SP-9 versioning, typed enums, `WorkApplication` back-ref; PR's is a strictly weaker subset |
| 6 | `WorkApplication` | main | ✅ **Keep** | Mandatory marketplace step — core MVP |
| 7 | `WorkerAssignment` | both | ✅ **Keep (main)** | Main's V2 has `application_id` FK (SP-3), reassignment chain, and removed over-constrained `@@unique([worker_id, status])` (SP-5) |
| 8 | `Attendance` | main | ✅ **Keep** | Core operational record — required for MVP |
| 9 | `QualityVerification` | both | ✅ **Keep (main)** | Main's V2 links to `WorkerAssignment` (correct); PR's links to deleted `Task` model |
| 10 | `Rating` | both | ✅ **Keep (main)** | Same as QV: linked to `WorkerAssignment`, not `Task` |
| 11 | `WorkerOverallRating` | both | ✅ **Keep (main)** | Main's has richer aggregates (`completion_rate`, `on_time_rate`, `last_worked_at`) and `onDelete: Cascade` |
| 12 | `Notification` | both | ✅ **Keep (main)** | Main's uses `NotificationType` enum (SP-8); PR's uses plain `String` |
| 13 | `AuditLog` | both | ✅ **Keep (main)** | Main's uses typed `UserRole?` for `actor_role` and includes `old_values`/`new_values` snapshots |
| 14 | `Room` | PR | ❌ **Remove** | Incompatible with V2 marketplace — explicitly deleted in V2 header |
| 15 | `Task` | PR | ❌ **Remove** | Same |
| 16 | `TaskPhoto` | PR | ❌ **Remove** | Same |
| 17 | `DailyOperation` | PR | ❌ **Remove** | Same |
| 18 | `Contract` | PR | ⏭️ **Deferred Phase 2** | HR module — out of MVP scope; depends on workers being signed to hotel |
| 19 | `ContractTemplate` | PR | ⏭️ **Deferred Phase 2** | HR module |
| 20 | `ContractLineItem` | PR | ⏭️ **Deferred Phase 2** | HR module |
| 21 | `WorkerDocument` | PR | ⏭️ **Deferred Phase 2** | Document compliance — Phase 2 |
| 22 | `RequiredDocument` | PR | ⏭️ **Deferred Phase 2** | Document compliance — Phase 2 |
| 23 | `Payroll` | PR | ⏭️ **Deferred Phase 2** | Payroll module — Phase 2 |
| 24 | `PayrollLineItem` | PR | ⏭️ **Deferred Phase 2** | Payroll module — Phase 2 |
| 25 | `DataRetentionLog` | PR | ⏭️ **Deferred Phase 2** | GDPR compliance — Phase 2 |
| 26 | `ConsentLog` | PR | ⏭️ **Deferred Phase 2** | GDPR compliance — Phase 2 |

**Totals:** MVP = 13 models. Phase 2 = +9 models (= 22 total). Removed permanently = 4.

---

## 3. Canonical MVP Schema

Source: `main:backend/prisma/schema.prisma` (already V2 + SP-1..SP-9 patches applied), with **one modification**:

### 3.1 Single change vs main
Add `hotel_ids String[]` to `User`:

```prisma
model User {
  // ... (existing main fields)
  hotel_ids  String[]  // hotels this user has scope over; admins ignore this field
  // ... (existing relations)
}
```

**Why this addition is necessary:**
- `backend/src/middleware/permissions.ts::checkHotelAccess()` reads `req.auth.hotel_ids`.
- `backend/src/lib/jwt.ts::AccessTokenPayload` embeds `hotel_ids: string[]`.
- Without this column on `User`, the JWT payload cannot be populated at sign-in.

The cleaner long-term model would be deriving `hotel_ids` from `HotelWorker` rows where `status = ACTIVE`. That refactor is itself a Phase 2 item; for MVP, denormalise to the `User` row.

### 3.2 MVP enums
Keep all enums from main as-is: `UserRole`, `HotelWorkerStatus`, `WorkRequestStatus`, `ApplicationStatus`, `AssignmentStatus`, `AttendanceStatus`, `VerificationStatus`, `NotificationChannel`, `NotificationType`.

### 3.3 MVP model list (13)
`User`, `Session`, `Hotel`, `HotelWorker`, `WorkRequest`, `WorkApplication`, `WorkerAssignment`, `Attendance`, `QualityVerification`, `Rating`, `WorkerOverallRating`, `Notification`, `AuditLog`.

### 3.4 Known MVP issues to address pre-ship
- None blocking. SP-1..SP-9 already applied. `hotel_ids` field addition is the only delta.

---

## 4. Phase 2 Schema (additive)

Phase 2 adds 9 models from PR, plus required back-relations on `User` and `Hotel`. All Phase 2 models must be normalised against V2 conventions before insertion.

### 4.1 Phase 2 models to add

| Model | Required normalizations before merge |
|-------|--------------------------------------|
| `Contract` | Change `status String` → new `ContractStatus` enum (`DRAFT`, `SIGNED`, `ACTIVE`, `EXPIRED`, `TERMINATED`). Change `employment_type String` → new `EmploymentType` enum. Keep `onDelete` semantics. |
| `ContractTemplate` | No normalisation needed; add `is_active Boolean` for soft-deactivation |
| `ContractLineItem` | Change `item_type String` → new `LineItemType` enum (`SALARY`, `BONUS`, `DEDUCTION`) |
| `WorkerDocument` | Change `document_type String` → new `DocumentType` enum. Drop `onDelete: Restrict` on worker (use `Cascade` for consistency with V2 worker-scoped tables) |
| `RequiredDocument` | Same `DocumentType` enum |
| `Payroll` | Change `status String` → new `PayrollStatus` enum (`DRAFT`, `CALCULATED`, `APPROVED`, `PAID`, `ARCHIVED`) |
| `PayrollLineItem` | Change `amount_type String` → new `PayrollLineItemType` enum |
| `DataRetentionLog` | Change `data_category String`, `status String` → enums. Decouple from `Worker.id` `onDelete: Restrict` — use `SetNull` so deletion is not blocked |
| `ConsentLog` | Change `consent_type String`, `consent_source String` → enums |

### 4.2 Phase 2 changes to existing models
- `User`: add back-relations `contracts`, `created_contracts`, `documents`, `uploaded_documents`, `payroll_records`, `data_retention_logs`, `consent_logs`.
- `Hotel`: add back-relations `contracts`, `contract_templates`, `documents`, `required_documents`, `payroll_records`.
- `AuditLog`: no schema change needed — already supports arbitrary `resource_type` strings; just add new constants in app code (`CONTRACT`, `PAYROLL`, `DOCUMENT`, `CONSENT`).

### 4.3 Models explicitly NOT brought into Phase 2
`Room`, `Task`, `TaskPhoto`, `DailyOperation` — these belong to the deprecated task-push architecture. Any future per-room or per-room-type tracking must be modelled on top of `WorkerAssignment`, not as a parallel hierarchy.

---

## 5. Data Migration Requirements

### 5.1 MVP migration (from current main)
**One migration only:**
1. `ALTER TABLE "User" ADD COLUMN "hotel_ids" TEXT[] NOT NULL DEFAULT '{}';`
2. Backfill is not required — existing main has no production data on V2 yet.
3. Add a CHECK constraint or trigger to ensure `hotel_ids` ⊆ `Hotel.id` referential integrity at application layer (Postgres cannot FK an array element).

### 5.2 Phase 2 migration (additive)
1. Create all 9 new tables via standard Prisma migrate.
2. No data backfill from PR branch — PR's `Contract`, `Payroll`, etc. tables were never populated in production.
3. For each Phase 2 model, add the partial indexes / CHECK constraints listed in §4.1 alongside the table creation.
4. Document retention: when `ConsentLog` is introduced, write a one-off backfill that inserts a synthetic `PRIVACY_POLICY` consent row for every existing user (`consent_given = false`, `consent_source = 'legacy_backfill'`) so compliance dashboards do not show false positives.

### 5.3 Permanent removals (Room/Task/TaskPhoto/DailyOperation)
If any environment ever held data for these tables (it likely did not on main), archive and drop. Otherwise no-op — they don't exist in main's V2 schema.

---

## 6. Route Impact

### 6.1 MVP — routes affected by the `User.hotel_ids` addition
None functionally change. The field is already assumed by:
- `POST /auth/signup` — service writes `hotel_ids: []`
- `POST /auth/login` — service reads `hotel_ids` into JWT
- `POST /auth/refresh` — same
- `GET /auth/me` — returns `hotel_ids`

### 6.2 MVP — routes to **remove** from PR before merging
- `GET /auth/account/export` — depends on Phase 2 models (`Contract`, `Payroll`, `WorkerDocument`). **Defer to Phase 2.**
- `DELETE /auth/account` — soft-delete is safe at MVP; keep.

### 6.3 MVP — routes that must NOT acquire `requireRole('admin')`
- `POST /auth/signup` — open registration is intended for MVP.

### 6.4 Phase 2 — new route surface (forecast)
- `GET /auth/account/export` — restored with full Phase 2 model coverage.
- `/hr/contracts/*`, `/hr/documents/*`, `/hr/payroll/*` — new modules.
- `/compliance/consent/*`, `/compliance/retention/*` — new modules.

---

## 7. Service Impact

### 7.1 `backend/src/modules/auth/service.ts`
- **`signup`, `login`, `refreshToken`** — must include `hotel_ids` in JWT payload. Both branches already do this; no change.
- **`exportUserData`** — currently references `prisma.task`, `prisma.contract`, `prisma.workerDocument`, `prisma.payroll`. **Remove from MVP service entirely.** Reintroduce in Phase 2 with V2-compatible queries against `WorkApplication`, `WorkerAssignment`, `Attendance`, `Rating`, plus Phase 2 `Contract`, `Payroll`, `WorkerDocument`.
- **`deleteAccount`** — schema-independent; keep as-is.
- **`getDefaultPermissions`** — move to `config/constants.ts::ROLE_PERMISSIONS` (already exists on main). Service should import, not duplicate.

### 7.2 Modules with stub references to removed models
The following modules in PR import or reference `Task`/`Room`/`DailyOperation` and must be either deleted or rewritten against marketplace models:
- `backend/src/modules/crm/*` — `Room`/`Task` CRUD. **Delete entirely; MVP has no CRM module in the legacy sense.**
- `backend/src/modules/hr/*` — Contract/Document/Payroll stubs. **Move to Phase 2 backlog; remove from MVP build.**
- `backend/src/modules/calendar/*` — references `DailyOperation`. **Delete or rewrite against `WorkRequest`/`Attendance`.**
- `backend/src/modules/staffing/*` — overlaps with marketplace. **Audit: keep only the marketplace-compatible surface.**
- `backend/src/modules/analytics/service.ts` — uses `Task` aggregates. **Rewrite against `WorkerAssignment` + `Rating`.**

### 7.3 New MVP service modules required
- `marketplace/` — work-request, application, assignment lifecycle.
- `attendance/` — check-in/out, verification.
- `quality/` — quality verification + rating writes.
- `notifications/` — typed notification dispatch.

---

## 8. Test Impact

### 8.1 Existing tests
- **78 auth tests on PR branch** — all pass against PR's schema with `argon2` + vitest.
  - Tests that touch only `User`/`Session` remain valid against the canonical MVP schema. Estimated 65–70 of 78.
  - Tests that exercise `exportUserData` (querying `Task`/`Contract`/`Payroll`) **must be removed or rewritten** with the route. Estimated 8–13 tests.
- **No marketplace tests exist on either branch.** This is a gap.

### 8.2 New tests required for MVP
1. `marketplace.service.test.ts` — application → assignment flow, SP-9 versioning, slot fill race.
2. `attendance.service.test.ts` — check-in/out, EXPECTED → PRESENT/ABSENT transitions, verification.
3. `quality.service.test.ts` — verification + rating + aggregate update on `WorkerOverallRating`.
4. `permissions.middleware.test.ts` — `checkHotelAccess()` against `User.hotel_ids`.
5. `auth.signup.test.ts` — explicit test that signup is open (no `requireRole`) and assigns default WORKER permissions.

### 8.3 Phase 2 test additions
- HR module tests: contract lifecycle, document expiry alerts, payroll calculation.
- Compliance tests: consent capture, retention scheduling, GDPR export coverage.

### 8.4 Tests to delete outright
- Any test in PR exercising `prisma.task.*`, `prisma.room.*`, `prisma.dailyOperation.*` — these models no longer exist.

---

## 9. Decision Summary

**MVP schema = main's V2 + 1 field (`User.hotel_ids`).**
**Phase 2 schema = MVP + 9 PR compliance models, all normalised to V2 enum/cascade conventions.**
**Permanently removed: 4 legacy task-based models.**

| Phase | Model count | New since main | Migration complexity |
|-------|-------------|----------------|---------------------|
| MVP | 13 | +0 models, +1 field | Trivial (1 ALTER TABLE) |
| Phase 2 | 22 | +9 models | Moderate (9 tables + back-relations + enums) |

The PR's auth-code improvements (argon2, deleteAccount, vitest, types/validation split) are independent of this schema decision and should be taken regardless — see `MERGE_CONFLICT_RESOLUTION_REPORT.md` for the per-file recommendations.
