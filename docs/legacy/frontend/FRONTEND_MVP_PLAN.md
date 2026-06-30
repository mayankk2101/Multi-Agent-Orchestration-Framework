# FRONTEND_MVP_PLAN

**Goal:** the smallest possible web frontend that lets a **hotel manager run the marketplace workflow end-to-end** — post a shift, review applicants, accept one, see the assignment, and verify attendance.

**Not in scope:** an enterprise CRM, worker-facing web app, analytics dashboards, multi-hotel admin consoles, rich notification centers. Workers already have mobile apps; the web frontend is **manager-first**.

---

## 0. Constraints discovered from the codebase

| Item | Finding | Source |
|---|---|---|
| Stack (already scaffolded) | Next.js 16 (App Router), React 19, **SWR** (server cache), **Zustand** (client state), Tailwind 4 | `frontend/package.json` |
| Auth model | Custom JWT: `access_token` + `refresh_token` + `expires_in`. `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` | `backend/src/modules/auth/*` |
| Note | `@supabase/supabase-js` is installed but backend auth is **custom JWT** — do **not** use Supabase auth. Treat that dep as unused for MVP. | `frontend/package.json`, `auth/service.ts` |
| Roles | `WORKER`, `CHECKER`, `MANAGER`, `ADMIN` | `schema.prisma` UserRole |
| Marketplace flow (mandatory, no bypass) | WorkRequest → WorkApplication → (manager accepts) → WorkerAssignment → Attendance → QualityVerification → Rating | `schema.prisma` MARKETPLACE/ATTENDANCE modules |
| Request lifecycle | `DRAFT → OPEN → PARTIALLY_FILLED → FILLED` (`CANCELLED`/`EXPIRED` terminal). Create accepts `DRAFT` or `OPEN` directly. | `work-requests/types.ts` |
| Application lifecycle | `PENDING → ACCEPTED / REJECTED / WITHDRAWN / EXPIRED` | `schema.prisma` ApplicationStatus |
| Assignment lifecycle | `CONFIRMED → IN_PROGRESS → COMPLETED` (`NO_SHOW`/`CANCELLED`/`REASSIGNED`) | `schema.prisma` AssignmentStatus |

---

## 1. Required user roles (frontend)

| Role | MVP web access | Rationale |
|---|---|---|
| **MANAGER** | **Full** — the only role the MVP is built for | Owns the marketplace loop end-to-end |
| **ADMIN** | Reuses manager screens (superset RBAC on backend) | No separate admin UI for MVP |
| WORKER | **None on web** (mobile only) | Workers apply/check-in via existing mobile apps |
| CHECKER | None on web (Post MVP) | Quality verification is Post-MVP on web |

**MVP builds one role experience: MANAGER (ADMIN inherits it).**

---

## 2. Required workflows

### W1 — Authenticate (Must Have)
Login → store tokens → load `GET /auth/me` → gate app on `role ∈ {MANAGER, ADMIN}`.

### W2 — Post a work request (Must Have)
Manager creates a shift (`position`, `shift_date`, `start/end`, `workers_needed`, `hourly_rate`) and publishes it (`status: OPEN`) — the entry point of the marketplace.

### W3 — Review & accept applicants (Must Have — the core loop)
For an OPEN/PARTIALLY_FILLED request, list applications (with `worker_rating_snapshot`), then **accept** (`PATCH …/applications/:id` → `ACCEPTED`, which the backend turns into a `WorkerAssignment`) or **reject**.

### W4 — See resulting assignments (Must Have)
List/inspect assignments produced from accepted applications so the manager can confirm the shift is filling.

### W5 — Verify attendance (Should Have)
View attendance for a shift and mark verified (`PATCH /attendance/:id`). Closes the operational loop after workers check in via mobile.

### W6 — Notifications glance (Should Have)
Unread badge + simple list (`GET /notifications`, `POST /:id/read`) so the manager sees "application received".

---

## 3. Required pages

> App Router. `(auth)` = public, `(app)` = authenticated manager shell.

| # | Route | Workflow | Classification |
|---|---|---|---|
| P1 | `/login` | W1 | **Must Have** |
| P2 | `/requests` (list — filter by status) | W2/W3 | **Must Have** |
| P3 | `/requests/new` (create + publish) | W2 | **Must Have** |
| P4 | `/requests/[id]` (detail + **applications tab** + accept/reject) | W3 | **Must Have** (core) |
| P5 | `/assignments` (list, filter by request/status) | W4 | **Must Have** |
| P6 | `/attendance` (per-shift, verify action) | W5 | **Should Have** |
| P7 | `/notifications` | W6 | **Should Have** |
| — | `/requests/[id]/edit` | edit DRAFT | **Post MVP** |
| — | `/hotels`, `/hotels/[id]/workers` (roster mgmt) | onboarding | **Post MVP** |
| — | `/quality`, ratings, analytics | quality loop | **Post MVP** |

**MVP page count: 5 Must Have + 2 Should Have = 7 pages.** (`/` redirects to `/requests`.)

---

## 4. Required API integrations

All under `/api/v1`. Response envelope: `{ status, data, pagination?, meta }`.

| Capability | Endpoint(s) | Method | Classification |
|---|---|---|---|
| Login | `/auth/login` | POST | Must |
| Token refresh | `/auth/refresh` | POST | Must |
| Current user / role gate | `/auth/me` | GET | Must |
| Logout | `/auth/logout` | POST | Should |
| List work requests | `/work-requests?hotel_id&status` | GET | Must |
| Create + publish request | `/work-requests` | POST (`status: OPEN`) | Must |
| Request detail | `/work-requests/:id` | GET | Must |
| Cancel/edit request | `/work-requests/:id` | PATCH | Should |
| List applications for a request | `/work-requests/:id/applications` | GET | Must |
| Accept / reject application | `/work-requests/:id/applications/:applicationId` | PATCH | **Must (core)** |
| List assignments | `/assignments` | GET | Must |
| Assignment detail | `/assignments/:id` | GET | Should |
| List / read attendance | `/attendance`, `/attendance/:id` | GET | Should |
| Verify attendance | `/attendance/:id` | PATCH | Should |
| Notifications + mark read | `/notifications`, `/notifications/:id/read` | GET/POST | Should |
| Hotels (for request's hotel_id picker) | `/crm/hotels` | GET | Must (read-only) |

Workers must be on the hotel roster to apply (`/crm/hotels/:id/workers`) — **roster management is Post MVP** on web; assume workers are seeded/managed via mobile/admin for launch.

---

## 5. Required state management

Keep it minimal — **SWR for server state, Zustand for the one piece of true client state (auth).**

- **Auth store (Zustand):** `accessToken`, `refreshToken`, `user`, `role`; persisted to `localStorage`. Single source of truth for the session.
- **Server cache (SWR):** all lists/details (`/work-requests`, `/applications`, `/assignments`, `/attendance`, `/notifications`). Use `mutate()` after accept/reject so the request detail and assignments list revalidate immediately.
- **Fetch wrapper:** one `apiFetch` that injects `Authorization: Bearer <access_token>`, and on `401` calls `/auth/refresh` once, retries, else logs out. This is the only "middleware" needed.
- **No Redux, no React Query, no global form state lib.** Local `useState` for forms.

---

## 6. Required auth flow

```
/login  ──POST /auth/login──▶ { access_token, refresh_token, expires_in, user }
   │                                  │
   │                          store in Zustand (+localStorage)
   ▼
(app) layout guard ── GET /auth/me ──▶ role ∈ {MANAGER, ADMIN} ? render : ──▶ /login (403)
   │
   ▼
apiFetch on every call: attach Bearer token
   └─ on 401 ─▶ POST /auth/refresh (once) ─▶ retry ─▶ on fail: clear store + redirect /login
```

- Route protection via a client `(app)` layout guard reading the Zustand store (tokens live client-side; no SSR session needed for MVP).
- Role gate: non-manager/admin users are bounced to `/login` with a message (web is manager-only).
- **Post MVP:** signup, password reset UI, httpOnly-cookie/SSR session hardening.

---

## 7. Estimates

### Page count
- **Must Have: 5** · **Should Have: 2** · MVP total **7** · Post MVP +5.

### Component count (~22 shared components for MVP)

**Layout/shell (4):** `AppShell` (nav + topbar), `AuthGuard`, `Topbar` (user menu + notif badge), `SideNav`.

**Primitives (7):** `Button`, `Input`, `Select`, `Badge` (status pill), `Card`, `Table`, `Modal`/`Dialog`.

**Feedback (3):** `Spinner`/skeleton, `EmptyState`, `Toast`/error banner.

**Domain (8):** `WorkRequestForm`, `WorkRequestRow`, `WorkRequestStatusBadge`, `ApplicationRow` (with rating + accept/reject), `AssignmentRow`, `AttendanceRow` (with verify), `NotificationItem`, `HotelPicker`.

**Plus** the `apiFetch` client + `auth` Zustand store + SWR hooks (`useWorkRequests`, `useApplications`, `useAssignments`, `useAttendance`, `useNotifications`) — ~6 non-visual modules.

**Total MVP build surface: ~7 pages + ~22 components + ~8 data/lib modules ≈ 37 files.**

### Implementation order

1. **Foundation** — Tailwind theme, primitives (Button/Input/Select/Badge/Card/Table/Modal), `apiFetch`, env config (`API_BASE_URL`). *(blocks everything)*
2. **Auth** — Zustand auth store, `/login` (P1), `apiFetch` 401→refresh, `(app)` `AuthGuard` + role gate, `Topbar`/`SideNav`. *(W1)*
3. **Work requests read** — `useWorkRequests`, `/requests` list (P2), `/requests/[id]` detail (P4 shell), `HotelPicker` via `/crm/hotels`. *(W2 read)*
4. **Post a shift** — `WorkRequestForm`, `/requests/new` (P3) with publish (`status: OPEN`). *(W2)*
5. **★ Core loop** — applications tab on P4: `useApplications`, `ApplicationRow`, accept/reject PATCH + SWR `mutate`. *(W3 — the MVP-defining milestone)*
6. **Assignments** — `useAssignments`, `/assignments` (P5) to confirm fills. *(W4)* → **end-to-end manager marketplace flow complete here.**
7. **Attendance verify** — `/attendance` (P6), verify PATCH. *(W5, Should)*
8. **Notifications** — badge + `/notifications` (P7), mark-read. *(W6, Should)*

> **Definition of MVP done:** after step 6 a manager can log in → post a shift → review applicants → accept one → see the confirmed assignment. Steps 7–8 are Should-Have polish.

---

## 8. Classification summary

| Must Have | Should Have | Post MVP |
|---|---|---|
| Login + JWT/refresh auth | Logout | Signup / password-reset UI |
| Manager/admin role gate | Attendance verify (P6) | Worker & checker web experiences |
| Work request list + create/publish | Notifications (P7) | Quality verification + ratings UI |
| Application review + accept/reject (core) | Cancel/edit request | Hotel & roster management (`/hotels`) |
| Assignment list | Assignment detail | Analytics / calendar dashboards |
| Hotel picker (read-only) | | Reassignment chains, bulk actions, i18n |
