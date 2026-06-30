# MOBILE_ARCHITECTURE_COMPLIANCE_REPORT.md

**Date:** 2026-06-10  
**Branch:** `claude/epic-volta-c95o3h`  
**Subject:** `MOBILE_MIGRATION_PLAN_SINGLE_APP.md` compliance assessment  
**Classification:** **FAIL**

---

## Section 1 — Document Availability

The compliance task names seven reference documents. Availability was verified against the
repository filesystem and the `DOCUMENTATION_AUDIT_REPORT.md` inventory.

| Document | Location | Available |
|---|---|---|
| `MOBILE_PRODUCT_BLUEPRINT.md` | Not found anywhere in repo | ❌ ABSENT |
| `MOBILE_PRODUCT_BLUEPRINT_PATCH_V1.md` | Not found anywhere in repo | ❌ ABSENT |
| `CANONICAL_ARCHITECTURE_INDEX.md` | Not found anywhere in repo | ❌ ABSENT |
| `WORKREQUEST_FINAL_ARCHITECTURE` | Not found anywhere in repo | ❌ ABSENT |
| `MARKETPLACE_REFACTOR_MASTER_PLAN` | Not found anywhere in repo | ❌ ABSENT |
| `PRISMA_SCHEMA_V2_FREEZE` | Not found anywhere in repo | ❌ ABSENT |
| `API_SPEC_V1_PATCH_V2` | Not found anywhere in repo | ❌ ABSENT |
| `MOBILE_MIGRATION_PLAN_SINGLE_APP.md` | `/home/user/hotel-crm/` | ✅ PRESENT |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` | `/home/user/hotel-crm/` | ✅ PRESENT |
| `MASTER_ARCHITECTURE_v2.0.md` | Google Drive only — not in repo | ⚠️ INACCESSIBLE |
| `CLAUDE_CONTEXT.md` | Google Drive only — not in repo | ⚠️ INACCESSIBLE |
| `FINAL_DECISIONS_SUMMARY.md` | Google Drive only — not in repo | ⚠️ INACCESSIBLE |

**Finding:** Zero of the four compliance targets cited in Question 2 exist in the
repository. The two Tier 1 authority documents (`MASTER_ARCHITECTURE_v2.0`,
`CLAUDE_CONTEXT`) exist only on Google Drive and are not accessible for assessment.

This document can only assess compliance against what is recoverable from the repo:
`INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md`, `DOCUMENTATION_AUDIT_REPORT.md`,
`DOCUMENTATION_ACTION_PLAN.md`, and `README.md`.

---

## Section 2 — Q1: Compliance With Recovered Architecture Hierarchy

### What the hierarchy states (recovered from DOCUMENTATION_AUDIT_REPORT.md)

The audit report establishes the following authority tiers:

- **Tier 1:** `MASTER_ARCHITECTURE_v2.0.md` + `CLAUDE_CONTEXT.md` (Google Drive, 5/5 stars)
- **Tier 2:** `FINAL_DECISIONS_SUMMARY.md` + implementation guides (Google Drive)
- **Tier 3:** Local READMEs and working docs
- **Tier 4:** Decision records, changelog

The Tier 1 documents are not available for direct verification. Fragments of their
content are reconstructed below from audit report quotations.

### What can be verified from reconstructed Tier 1 content

**MASTER_ARCHITECTURE Section 9 — Mobile architecture decision:**  
*"One React Native (Expo) app with role switching at login."*

Migration plan compliance: **PASS.** The plan correctly implements a single
`mobile/hotel-crm-app/` with `RootNavigator` branching on JWT role.

**MASTER_ARCHITECTURE Section 14 — RBAC roles:**  
Recovered from `DOCUMENTATION_ACTION_PLAN.md` Task 1.2:

| Role | Capability |
|---|---|
| Worker | View own tasks, complete tasks, upload photos, view own rating |
| Checker | View tasks to verify, submit quality scores, rate workers |
| Manager | Create tasks, assign workers, view hotel data, manage HR |
| Admin | All access |

Migration plan compliance against role capabilities: **PARTIAL FAIL.**  
The plan designs a `WorkerNavigator` with Tasks + Profile tabs and a
`CheckerNavigator` with Inspections + Profile tabs. It does not design:
- Worker photo upload capability
- Worker rating/leaderboard view
- Checker quality score submission form
- Checker worker rating submission
- Manager navigator (deferred with a `default:` fallback)
- Admin navigator

**MASTER_ARCHITECTURE Section 16 — API Standards:**  
Response format specifies `{ status, data, meta }` with `request_id`.  
Migration plan API client uses `body.data` extraction. **PASS** against reconstructed
standard.

**INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2 — PATCH-09:**  
Single app, bundle ID `com.zirove.hotelcrm`, three EAS profiles (development/staging/
production), API URLs per environment.  
Migration plan compliance: **PASS.** All four requirements are present in the plan's
EAS section.

### Hierarchy compliance summary

| Requirement | Source | Status |
|---|---|---|
| Single Expo app | MASTER_ARCH Section 9 | ✅ PASS |
| RootNavigator branches on role | MASTER_ARCH Section 9 | ✅ PASS |
| WorkerNavigator | MASTER_ARCH Section 14 | ⚠️ PARTIAL — shells only, missing photo upload, ratings |
| CheckerNavigator | MASTER_ARCH Section 14 | ⚠️ PARTIAL — shells only, missing verification form, rating submission |
| ManagerNavigator | MASTER_ARCH Section 14 | ❌ ABSENT — falls through to WorkerNavigator |
| AdminNavigator | MASTER_ARCH Section 14 | ❌ ABSENT — falls through to WorkerNavigator |
| Bundle ID `com.zirove.hotelcrm` | PATCH_V2 PATCH-09 | ✅ PASS |
| EAS three-profile config | PATCH_V2 PATCH-09 | ✅ PASS |
| Full Tier 1 compliance | MASTER_ARCH (inaccessible) | ❓ CANNOT VERIFY |

---

## Section 3 — Q2: Compliance With Four Named Documents

All four named compliance targets are absent from the repository.

### WORKREQUEST_FINAL_ARCHITECTURE
**Status: CANNOT ASSESS — document does not exist in repository.**  
No content is recoverable. No fragments appear in any accessible document.
Compliance: **INDETERMINATE.**

### MARKETPLACE_REFACTOR_MASTER_PLAN
**Status: CANNOT ASSESS — document does not exist in repository.**  
The term "marketplace" does not appear in any accessible document. It is unclear
whether this plan is applicable to the hotel CRM mobile context or is a naming
convention for a different document series.  
Compliance: **INDETERMINATE.**

### PRISMA_SCHEMA_V2_FREEZE
**Status: CANNOT ASSESS — document does not exist in repository.**  
`DOCUMENTATION_ACTION_PLAN.md` (Task 1.3) establishes a 23-table schema across 7
modules. The migration plan's API client covers only the `auth` module. The plan
makes no reference to the Prisma schema and cannot be assessed for schema compliance.  
Compliance: **INDETERMINATE** (likely non-compliant given API client scope).

### API_SPEC_V1_PATCH_V2
**Status: CANNOT ASSESS — document does not exist in repository.**  
The backend routes directory confirms 8 API modules exist. The migration plan's API
client implements only 5 auth endpoints (`/auth/login`, `/auth/refresh`, `/auth/logout`,
`/auth/me`). No endpoint from CRM, quality, HR, staffing, notifications, analytics, or
calendar modules is implemented.  
Compliance: **INDETERMINATE** (structurally incomplete given known backend scope).

---

## Section 4 — Q3: Architecture Gaps

### 4.1 Remaining Architecture Gaps

**Gap 1 — ManagerNavigator not designed.**  
`user.role === 'manager'` falls through to `WorkerNavigator` with a `default:` case.
The audit report identifies Manager as a distinct role with distinct capabilities
(create tasks, assign workers, manage HR). No navigator, no screens, no API client
coverage for Manager-specific operations.

**Gap 2 — No `hotel_id` scoping in API client.**  
The backend middleware enforces hotel-scoped access via `hotel_ids` in the JWT payload.
The API client carries the Bearer token but contains no mechanism to pass `hotel_id`
as a query parameter, route parameter, or request header. All CRM and staffing
endpoints require hotel scoping.

**Gap 3 — No `app-config.ts` entry point for environment-based API URL.**  
The plan references `EXPO_PUBLIC_API_URL` in `eas.json` but the `api.ts` file
reads `process.env.EXPO_PUBLIC_API_URL` with a `localhost` fallback. No validation
or startup assertion confirms the variable is present in staging/production builds.

**Gap 4 — No `JWT_REFRESH_SECRET` separation on the mobile side.**  
`PATCH_V2 PATCH-06` mandates two separate JWT secrets (`JWT_SECRET` and
`JWT_REFRESH_SECRET`). The migration plan's API client sends the refresh token to
`/auth/refresh` but does not reflect this in any token parsing or validation logic.
The auth store has no token refresh path (only token deletion on failure).

---

### 4.2 Missing Screens

The following screens are required by recovered RBAC definitions and the Phase 1 MVP
scope (from `README.md`), and are absent from the migration plan:

**Worker role — missing screens:**

| Screen | Required by |
|---|---|
| Task detail view | Phase 1 MVP: task management |
| Task completion form | RBAC: "complete tasks" |
| Photo upload on task | RBAC: "upload photos" |
| Worker rating / leaderboard | RBAC: "view own rating"; Phase 1: rating system, leaderboard |
| Push notification inbox | Phase 1: notifications |

**Checker role — missing screens:**

| Screen | Required by |
|---|---|
| Inspection detail view | Phase 1 MVP: quality verification |
| Quality verification form | RBAC: "submit quality scores" |
| Worker rating submission | RBAC: "rate workers" |
| Push notification inbox | Phase 1: notifications |

**Manager role — missing entirely:**

| Screen | Required by |
|---|---|
| Task creation screen | RBAC: "create tasks" |
| Worker assignment screen | RBAC: "assign workers" |
| Hotel/room overview | RBAC: "view hotel data" |
| HR overview | RBAC: "manage HR" |
| Daily operations view | Phase 1: daily operations |
| Push notification inbox | Phase 1: notifications |

**Both roles — missing shared screens:**

| Screen | Required by |
|---|---|
| Notification inbox | Phase 1 MVP: notifications |
| Settings / account | Standard mobile requirement |

---

### 4.3 Missing API Dependencies

The migration plan's `api.ts` implements 5 auth endpoints. The Phase 1 MVP scope
requires coverage across at minimum the following modules. All are absent:

**CRM module — absent:**
- `GET /hotels` — hotel list (Manager/Admin)
- `GET /hotels/:hotel_id/rooms` — room list
- `GET /tasks` — task list (Worker: own tasks; Manager: all hotel tasks)
- `GET /tasks/:id` — task detail
- `PUT /tasks/:id/complete` — task completion (Worker)
- `POST /tasks/:id/photos` — photo upload (Worker)
- `POST /hotels/:hotel_id/tasks` — task creation (Manager)

**Quality module — absent:**
- `GET /quality/verifications` — inspections list (Checker)
- `GET /quality/verifications/:id` — inspection detail
- `POST /quality/verifications/:id/rate` — quality score submission (Checker)
- `GET /quality/ratings` — worker ratings / leaderboard

**Notifications module — absent:**
- `GET /notifications` — notification list
- `PUT /notifications/:id/read` — mark read
- `POST /notifications/push-token` — FCM/APNs token registration

**Staffing module — absent:**
- `GET /staffing/assignments` — worker's own assignments
- `GET /staffing/requests` — work requests (Manager)

**Analytics module — absent:**
- `GET /analytics/leaderboard` — worker leaderboard

**HR module — absent:**
- `GET /hr/contracts` — worker's own contract (Phase 1 basic HR)

---

### 4.4 Missing State Management

The plan implements one Zustand store (`auth-store`). The Phase 1 feature set requires
additional stores. The following are absent:

| Store | Purpose | Missing |
|---|---|---|
| Tasks store | Cached task list, optimistic task completion | ❌ |
| Notifications store | Unread count, notification list | ❌ |
| Quality store | Inspection list, verification form state | ❌ |
| Leaderboard store | Worker rankings | ❌ |

The `swr` package is declared in both apps' `package.json` but is not used anywhere
in the migration plan. The plan references SWR in the dependency list but specifies
no SWR integration, no SWR key conventions, and no SWR fetcher configuration.

---

### 4.5 Missing Notification Dependencies

**`expo-notifications` not in `package.json`.**  
Push notification registration requires `expo-notifications`. The package is absent
from both apps' dependency lists. Without it:
- FCM/APNs device tokens cannot be obtained.
- Foreground notification display cannot be handled.
- Background notification receipt cannot be processed.

**No push token registration flow.**  
`PATCH_V2 PATCH-07` adds a `PushToken` table to the backend schema and a
`POST /notifications/push-token` endpoint. The migration plan has no corresponding
client-side flow to register the device token after login.

**No notification permission request.**  
iOS requires explicit `requestPermissionsAsync()` before a push token can be
obtained. No permission request flow is designed or referenced in the plan.

**No foreground notification handler.**  
When the app is in the foreground, `expo-notifications` requires a handler to
display or suppress incoming notifications. None is specified.

---

### 4.6 Missing Offline Requirements

`README.md` Phase 1 scope: *"Full offline-first sync"* is listed as **deferred to
Phase 2.**

However, no offline handling of any kind is present in the migration plan:

| Requirement | Status |
|---|---|
| Network status detection | ❌ Absent |
| Offline error feedback to user | ❌ Absent |
| Action queue for offline submissions | ❌ Absent (deferred scope) |
| Optimistic UI updates | ❌ Absent |
| Cached data display when offline | ❌ Absent |
| Retry logic on reconnect | ❌ Absent |

The migration plan's API client throws `ApiError` on failure with no network
differentiation. A network failure (device offline) produces the same error path as
a 401 or 500. No `NetInfo` or equivalent integration is present.

Whether a baseline offline UX (show cached data, queue writes) was intended for
Phase 1 or strictly Phase 2 cannot be confirmed without `MOBILE_PRODUCT_BLUEPRINT.md`.

---

## Section 5 — Summary Table

| Question | Finding | Result |
|---|---|---|
| Compliance with architecture hierarchy | Complies with PATCH-09 single-app decision. Partial compliance with RBAC roles. Tier 1 documents inaccessible. | ⚠️ PARTIAL |
| Compliance with WORKREQUEST_FINAL_ARCHITECTURE | Document absent — cannot assess | ❌ INDETERMINATE |
| Compliance with MARKETPLACE_REFACTOR_MASTER_PLAN | Document absent — cannot assess | ❌ INDETERMINATE |
| Compliance with PRISMA_SCHEMA_V2_FREEZE | Document absent — cannot assess. API client covers 1 of 8 modules | ❌ INDETERMINATE |
| Compliance with API_SPEC_V1_PATCH_V2 | Document absent — cannot assess. 5 of 30+ expected endpoints present | ❌ INDETERMINATE |
| Architecture gaps | ManagerNavigator absent, no hotel scoping, no EXPO_PUBLIC_API_URL assertion, no token refresh path | ❌ GAPS PRESENT |
| Missing screens | 15+ screens absent across Worker, Checker, Manager roles | ❌ GAPS PRESENT |
| Missing API dependencies | All non-auth modules absent from API client | ❌ GAPS PRESENT |
| Missing state management | 4 required stores absent, SWR unused | ❌ GAPS PRESENT |
| Missing notification dependencies | expo-notifications absent, no token registration | ❌ GAPS PRESENT |
| Missing offline handling | No network detection, no error differentiation | ⚠️ UNCLEAR SCOPE |

---

## Section 6 — Classification

### FAIL

**Primary reason:** Four of four named compliance targets do not exist in the
repository. Compliance cannot be determined against absent documents. The
classification is `FAIL` on the basis of precondition failure, not on the basis
of known errors in the migration plan itself.

**Secondary reason:** Against what can be assessed from available documents, the
migration plan covers the structural foundation only (single app, role navigation,
auth). The Phase 1 feature scope documented in `README.md` and the RBAC role
definitions recovered from `DOCUMENTATION_ACTION_PLAN.md` both indicate that the
plan covers approximately 15–20% of the required mobile surface area.

**What the plan correctly implements:**
- PATCH-09 single-app architecture decision
- Role-based navigator branching
- Auth store with SecureStore token persistence
- API client structure with Bearer token injection
- EAS three-profile configuration
- Unified bundle ID

**What the plan does not address:**
- Any non-auth API endpoints
- Worker and Checker feature screens beyond empty shells
- Manager and Admin navigators
- Push notification infrastructure
- State management beyond auth
- Hotel-scoped API calls

---

## Section 7 — Preconditions for Re-Assessment

A compliance re-assessment can only return `PASS` or `PASS_WITH_WARNINGS` after:

1. The following documents are committed to the repository and accessible:
   - `MOBILE_PRODUCT_BLUEPRINT.md`
   - `MOBILE_PRODUCT_BLUEPRINT_PATCH_V1.md`
   - `API_SPEC_V1_PATCH_V2` (or equivalent)
   - `PRISMA_SCHEMA_V2_FREEZE` (or equivalent)
   - `WORKREQUEST_FINAL_ARCHITECTURE`
   - `CANONICAL_ARCHITECTURE_INDEX.md`

2. Or the above are confirmed permanently absent, and a documented decision records
   that `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` is the sole governing
   document for mobile implementation scope.

Until one of those conditions is met, all compliance verdicts against the four named
targets remain `INDETERMINATE`.

---

**Report generated:** 2026-06-10  
**Assessment basis:** `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md`,
`DOCUMENTATION_AUDIT_REPORT.md`, `DOCUMENTATION_ACTION_PLAN.md`, `README.md`  
**Inaccessible authority:** `MASTER_ARCHITECTURE_v2.0.md`, `CLAUDE_CONTEXT.md`,
`FINAL_DECISIONS_SUMMARY.md` (Google Drive only)
