# Employee Management Module — Business Specification

**Platform:** Workforce Operations Platform
**Client:** FHM Hotelservice GmbH (Frankfurt am Main, Germany) · **Vendor:** Zirove · **Market:** Germany only
**Document type:** Business specification (no implementation, no schema, no API, no code)
**Status:** Source-of-truth-aligned rewrite — supersedes the prior marketplace-era engineering specification at this path.

---

## Source of Truth & Provenance

This specification is derived **exclusively** from the two authoritative documents:

- `CONFIRMED_REQUIREMENTS_REGISTER.md` (referenced below as **CRR §n**)
- `PIVOT_DESIGN_DOCUMENT.md` (referenced below as **PDD §n**)

No behaviour in this document is derived from any other source. Marketplace-era documentation, previous PRDs, previous architecture, previous audits, and `docs/legacy/**` were not used.

> **[OPEN] Source-path discrepancy (flagged, not resolved here):** The governing instruction cites the authoritative files under `docs/01-product/requirements/`, but in the repository they exist only under `docs/00-foundations/` (the cited directory contains only a placeholder). The two documents were read from their actual location. This is a documentation-location inconsistency for the docs-tree owner to reconcile; it does not affect any behaviour specified here.

> **Refactor / conflict note (Rule 6):** This file **replaces** a previously merged engineering-style specification that was written against the *marketplace* architecture. That prior document derived behaviour from non-authoritative sources, reintroduced removed marketplace concepts (worker applications, marketplace matching, `WorkRequest → WorkApplication → WorkerAssignment`), omitted the confirmed **Regional Manager** role, declared **skills** non-existent (the Register confirms a fixed skill set), and contained database schema and API endpoints. Those conflicts are resolved here by adhering strictly to the authoritative documents. See **§27 Refactoring Summary**.

---

## 1. Module Overview

The Employee Management Module is the system of record for the **employee** as a business entity on the Workforce Operations Platform. Every person who performs work for the client — internally the **Staff (Worker)** role — is a permanent employee whose identity, employment record, skills, lifecycle status, profile-and-history view, day-level availability, and hotel blocklisting are owned here (CRR §1, §4, §5, §20; PDD §9.1).

The platform operates a **workforce operations model**, not a marketplace. Workers do not browse, apply for, or compete for work. Managers assign work directly (via the weekly calendar) or broadcast gap-fill requests to eligible workers. The Employee Management Module supplies the authoritative employee data (identity, skills, status, availability, blocklist) that those operational modules consume; it does not itself perform assignment, scheduling, rating, or attendance (CRR §13; PDD §5.5).

All staff are permanent employees who simply do not earn when they are not assigned to work — this is why the worker-facing application is named the **Employee App** (CRR §4, §31).

## 2. Purpose

To maintain a single, authoritative, legally compliant record of each employee and to expose that record consistently to the rest of the platform, so that:

- Each employee has one durable employment record with a well-defined lifecycle status (CRR §4, §6–§10).
- A unified profile-and-history view serves as the performance-review surface for the worker and every role above them (CRR §5).
- Skills carried on the employee record drive operational eligibility decisions made by other modules (CRR §4, §13).
- Day-level availability is represented for operational visibility (CRR §20).
- Hotel-level blocklisting constrains where an employee may be assigned (CRR §4).
- Employee personal data is handled under German/EU data-protection law, including special-category restrictions, tiered retention classification, and full auditability (CRR §25–§30; PDD §5.4, §5.7).

## 3. Scope

In scope for this module:

- **Employee identity linkage** to the platform account (the account itself is owned by Authentication/User Management; this module owns the employment-domain record and references the account) (CRR §1, §2; PDD §5.3).
- **Core employment profile fields:** Employee ID, Job Title, Start Date (CRR §4).
- **Employee lifecycle and status** from account creation through activation, the probationary milestone, and deactivation (CRR §6–§10; PDD §9.1).
- **Skills** carried on the employee record: the confirmed tag set and each tag's assessment basis (CRR §4).
- **Unified profile-and-history view:** aggregation and presentation of the employee's work history, task scores, and rating history, with date and management filters (CRR §5).
- **Day-level availability indicator** (red/green, today only) (CRR §20).
- **Blocklist:** a hotel blocking specific staff from assignment there, with a logged reason (CRR §4).
- **Bulk import** of staff via CSV, routed through the same hire-approval workflow as manual creation (CRR §4).
- **Employee-data governance:** special-category field visibility rules, retention-tier classification of employee fields, subject-rights data provision, and audit of employee-record actions (CRR §25–§30; PDD §5.4, §5.7).

## 4. Out of Scope

Owned by other modules and **referenced, never redefined** here (Rule 5):

- **Authentication, login, MFA, sessions, password reset** — Authentication module (CRR §2; PDD §5.3).
- **The platform account/role/scope object itself and the RBAC framework** — User Management / Authorization (CRR §1; PDD §5.4).
- **Onboarding orchestration:** the Personalfragebogen self-service form, the document-collection chatbot, and the pool/claim hire-approval mechanism — Onboarding module (CRR §6, §8, §10).
- **Document storage, expiry tracking, and the non-EU work-permit requirement** — Documents module (CRR §4, §7).
- **Contract storage and QES signing** — Contracts module (CRR §9).
- **Weekly calendar, direct scheduling, and sick/vacation marking** — Calendar/Scheduling module (CRR §13, §22).
- **Broadcast job requests, direct assignment, skill-based eligibility computation, and daily assignment exclusivity enforcement** — Job Dispatch module (CRR §13).
- **Quality scoring, rating computation, rating tiers, recency weighting, warnings, and the rework flow** — Quality module (CRR §14, §15, §16).
- **Geofenced clock-in/out and coordinate capture/retention** — Attendance/Geo module (CRR §17).
- **Push notification delivery** — Notifications module (CRR §18).
- **Payslip request flow** — Payslips module (CRR §23).
- **Daily GDPR consent gate** — Consent module (CRR §24).
- **Three-tier automatic deletion jobs** — Retention module (CRR §25).
- **Hotel and Hotel Group records and the per-hotel "pause new jobs" toggle** — Hotels module (CRR §11).
- **Basic analytics** — Analytics module (CRR §21).

Explicitly excluded from the platform entirely and therefore **never** part of this module (CRR §3, §4, §13, §22, §23, Explicit Non-Goals):

- Worker-initiated job applications; auto-matching/ranking; best-match suggestions; worker browsing or selection workflows; marketplace analytics; all marketplace terminology.
- Background checks; account lockout; login rate-limiting; CAPTCHA; MFA for regular staff.
- Department field; certifications and certification reminders; preferred-staff list; internal-transfer tracking; an employment-type *distinguishing* field; promotion history; training records; reward history.
- In-system payroll math; leave-balance tracking; leave-approval workflow; shift swaps; coverage planning; recurring jobs.
- Rooms/floors/buildings/zones; offline mode; SMS/email notification channels; multi-country support.

## 5. Responsibilities

The module is responsible for:

1. Creating and maintaining one employment record per employee, including identity linkage and core profile fields (CRR §4).
2. Owning the **employee lifecycle status** and enforcing valid transitions (CRR §6–§10).
3. Holding the employee's **skill tags** and their assessment basis, as the authoritative source other modules read (CRR §4, §13).
4. Composing and serving the **unified profile-and-history view** by aggregating data owned elsewhere (ratings, scores, attendance history) (CRR §5).
5. Representing **today-only availability** for each employee (CRR §20).
6. Maintaining **hotel blocklist** entries with logged reasons (CRR §4).
7. Supporting **bulk CSV import**, with each imported employee routed into the standard hire-approval path (CRR §4).
8. Enforcing **special-category field visibility** and emitting a distinct audit entry on every such access (CRR §27, §30).
9. Classifying employee fields by **retention tier** so the Retention module can delete them automatically at the correct horizon (CRR §25).
10. Providing the employee's data for **subject-rights access/export** requests (CRR §26).
11. Ensuring **every important employee-record action is audit-logged** immutably via the existing audit framework (CRR §30).

## 6. Core Concepts

- **Employee (Staff/Worker):** A permanent employee who performs jobs; earns only when assigned. The only worker role; there is no Supervisor role (CRR §1, §4, §13).
- **Employment record:** The durable per-employee record owned by this module, repurposed from the retained roster record and now serving as the permanent-employment record (PDD §9.1).
- **Account:** The authentication identity (email/username, role, scope) owned by Authentication/User Management and linked to the employment record (CRR §1, §2; PDD §5.3).
- **Hotel Group context:** Workers are not tied to any single hotel; a worker may be assigned only within the group of hotels they are working in (CRR §11, §12). *(Association mechanism — see [OPEN] in §26.)*
- **Skill tag:** One of a fixed, confirmed set; determines which broadcast slots an employee is eligible for and how the employee is assessed (CRR §4, §13).
- **Profile-and-history view:** A single unified view of full work history, task scores, and rating history — this view *is* the performance review; there is no separate review process (CRR §5).
- **Availability indicator:** A today-only red/green signal of whether the employee is available for work today (CRR §20).
- **Blocklist entry:** A hotel-scoped block preventing a specific employee from being assigned at that hotel, with a logged reason (CRR §4).
- **Special-category data:** Konfession (religion, for church tax), disability status, and health data (sick notes) — handled under restricted visibility (CRR §27).
- **Hire-approval (pool/claim):** The onboarding-owned review by which a completed application becomes an active employee; this module owns the resulting status, not the mechanism (CRR §10).

## 7. Employee Lifecycle

The employee lifecycle is the employee-level view of the journey from account creation to active employment and eventual deactivation. The **mechanics** of onboarding (form, chatbot, contract, approval) are owned by the Onboarding, Documents, and Contracts modules; this module owns the **status** that results from each stage.

1. **Record created / Inactive.** An account and employment record come into existence at signup or via bulk CSV import. The record is inactive: it does **not** activate until all required documents are uploaded **and** the contract is filled (CRR §4, §6, §8).
2. **Onboarding in progress.** The worker completes the Personalfragebogen, uploads required documents (work-permit documents required only for non-EU/EEA/Swiss nationals), and fills the contract; the chatbot re-prompts for anything missing. The record remains inactive throughout (CRR §6, §7, §8, §9).
3. **Under review.** Once documents and contract are complete, the application enters the Hotel-Group manager pool. The first manager to open it claims it (locking out others, who see "Under review by [manager]"). The record is pending a decision (CRR §10).
4. **Active (approved) / Rejected.** The claiming manager approves or rejects. Approval activates the employee; rejection ends the journey for that application (CRR §10).
5. **Probationary period.** Active employees serve a probationary period during which they may work; the manager later manually marks the worker **suitable** (no system timer, no rating-threshold automation). The precise employment/contract semantics of probation depend on an unresolved legal question (see [OPEN] in §26) (CRR §6, §9, §10).
6. **Deactivated.** The platform retains soft-deletion of the account/record, so an employee record can be deactivated without destroying operational history. The **triggering offboarding/termination workflow is not defined** in the authoritative documents (see [OPEN] in §26) (PDD §9.1; CRR §30).

## 8. Employee Status Model

The confirmed employee-level statuses, each grounded in the authoritative documents:

- **Inactive** — record exists; onboarding not yet complete; cannot work (CRR §4, §8).
- **Under Review** — onboarding complete; application in the manager pool, possibly claimed by a specific manager (CRR §10).
- **Active** — approved by a manager; the employee may be scheduled and may accept broadcasts (CRR §10).
- **Rejected** — the manager rejected the application (CRR §10).
- **Deactivated (soft-deleted)** — record retained for history/audit but no longer an operating employee (PDD §9.1).

Additional notes:

- **Probation is a milestone, not an automated status.** "Suitable" is a manual manager marking; there is no system timer or automatic transition (CRR §10). Whether probation constitutes a *distinct* status depends on the [OPEN] probation legal shape (§26).
- **Rating tiers (Elite / High / Standard / Low / Probation) are NOT employee statuses.** They are display labels owned by the Quality module, layered on the 0–100 rating, and must not be conflated with lifecycle status (CRR §15).
- **No suspension status exists.** Warnings explicitly trigger no auto-suspension and no automated consequence beyond manager notification (CRR §16).
- **No account lockout** exists as a status either (CRR §2).

## 9. Employee Profile

The employee profile is composed from data this module owns directly and data it references from other modules. It must never expose special-category fields on the general profile/history view (CRR §27).

**Owned core fields (CRR §4):**

- Employee ID
- Job Title *(value domain — see [OPEN] in §26)*
- Start Date

**Personal data captured at onboarding and carried on the record (collected by Onboarding; stored as the employee's personal data) (CRR §6):**

- First name, Last name
- Date of birth
- Nationality, Place of birth, Country of birth
- Street & house number, Postal code & city
- Bank account holder, IBAN
- Tax ID (Steuer-ID)
- Health insurance provider (Krankenkasse)
- Social security number (Sozialversicherungsnummer)
- Employment type: Teilzeit / Minijob — **stored as information only**, with no system logic or warning attached (CRR §4, §6)
- Work start date
- Signed declaration (place/date)

**Special-category fields — restricted, never on the general profile (CRR §27):**

- Konfession (religion) — voluntary; visible only to the payslip-request processor and Admin; tied solely to its church-tax legal basis.
- Disability status — voluntary; visible to Admin only.

**Referenced (owned elsewhere, surfaced in the unified view):**

- Documents and their expiry, including the non-EU work-permit document (Documents module) (CRR §4, §7).
- Contract and its signing status (Contracts module) (CRR §9).
- Skills (held on the employee record — see §10).
- Rating history, task scores, rating tier, and recency-weighted overall rating (Quality module) (CRR §5, §15).
- Attendance/work history (Attendance module) (CRR §5, §17).
- Availability indicator (see §11/§13).

There is **no Department field** and **no employment-type distinguishing field** (CRR §4).

## 10. Skills

- The confirmed skill tag set is exactly: **Cleaner, Public Service, Kitchen Dishwasher, Waiter** (CRR §4).
- **Assessment basis** (a property of the skill, used by the Quality/operations modules, owned as data here):
  - **Cleaner** → assessed by **rooms cleaned**.
  - **Public Service, Kitchen Dishwasher, Waiter** → assessed by **hours worked** (CRR §4).
- An employee may carry one or more skill tags. Skills carried on the employee record are the authoritative input to **broadcast eligibility**: for a given broadcast slot, only workers holding the matching skill are notified (eligibility computation is owned by Job Dispatch; the skill data is owned here) (CRR §13).
- There are **no certifications, no formal expiring qualifications, and no certification reminders** — skill tags are not certifications (CRR §4).

> **[OPEN] Skill-set governance:** The authoritative documents fix the *set* of skill tags and each tag's assessment basis, but do not state whether the tag set is a closed system list versus administratively editable. Treated as the fixed confirmed set above; governance of changes is unresolved (§26).

## 11. Employment Rules

- **All staff are permanent employees** who do not earn when not assigned (CRR §4, §31).
- **No worker is tied to a specific hotel**; only the manager is dedicated/permanent to a hotel (CRR §11, §12).
- A worker may be assigned tasks **only within the Hotel Group they are working in**, and only at the hotel a manager selects (CRR §12).
- **Daily assignment exclusivity:** once a worker is assigned anything for a day (via calendar or broadcast), they are blocked from any further assignment for that entire day — this blocks all further requests for the day, not merely a time slot. *Enforcement is owned by Job Dispatch;* this module reflects the resulting availability (CRR §12, §13).
- **No internal-transfer tracking** and **no cross-hotel dual-manager approval step** exist (CRR §4, §12).
- **Teilzeit/Minijob is informational only** and carries no system logic (CRR §6).
- **Bulk-imported staff are still permanent employees** and still pass through hire-approval (CRR §4).

## 12. Relationships

Each relationship below names the owning module to avoid duplication (Rule 5):

- **Employee ↔ Account** — one employment record links to one platform account (account owned by Authentication/User Management) (CRR §1, §2; PDD §5.3).
- **Employee ↔ Personal data** — the Personalfragebogen-sourced personal data carried on the record (collected by Onboarding) (CRR §6).
- **Employee ↔ Documents** — uploaded documents with expiry, including the non-EU work-permit document (Documents module) (CRR §4, §7).
- **Employee ↔ Contract** — one contract used at signup and post-probation (Contracts module) (CRR §9).
- **Employee ↔ Hotel Group** — the group within which the employee may be assigned (Hotels module; association mechanism [OPEN], §26) (CRR §11, §12).
- **Employee ↔ Hotel (assignment context)** — non-permanent, established per assignment (Calendar/Job Dispatch) (CRR §12, §13).
- **Employee ↔ Skills** — the skill tags carried on the record (owned here) (CRR §4).
- **Employee ↔ Quality history** — ratings, scores, tiers, warnings (Quality module) (CRR §5, §14–§16).
- **Employee ↔ Attendance history** — clock-in/out and work history (Attendance module) (CRR §5, §17).
- **Employee ↔ Blocklist** — hotel-scoped blocks with reasons (owned here) (CRR §4).
- **Employee ↔ Manager** — the manager who claims/approves and who manages the employee's hotel context (Onboarding/Hotels) (CRR §10, §11).
- **Employee ↔ Org chart / reporting** — "who reports to whom," visible only to Regional Manager and Admin; the reporting-relationship structure itself is not defined ([OPEN], §26) (CRR §1).

## 13. Business Rules

1. An employee record **cannot become Active** unless all required documents are uploaded and the contract is filled (CRR §4, §8).
2. **Non-EU/EEA/Swiss** nationals require work-permit documents to complete onboarding; EU/EEA/Swiss citizens do not (validation owned by Documents/Onboarding; this module's activation invariant depends on it) (CRR §7).
3. Hire-approval is a **pool/claim** process: the first manager to open an application claims it; it locks to them; others see "Under review by [manager]" (mechanism owned by Onboarding; this module's status reflects it) (CRR §10).
4. **Probation suitability is a manual manager judgment** — no system timer, no rating-threshold automation (CRR §10).
5. A worker is **available for further work on a day only if not already assigned that day and not marked sick/vacation that day** (exclusivity owned by Job Dispatch; sick/vacation owned by Calendar; this module reflects the result in the availability indicator) (CRR §12, §20, §22).
6. The **availability indicator is today-only** and does not change based on which date is being viewed on the calendar (CRR §20).
7. A hotel may **blocklist** specific staff from assignment there; the block requires a **logged reason** (CRR §4).
8. The **unified profile-and-history view** is the performance-review surface — there is no separate performance-review process (CRR §5).
9. **Special-category fields never appear on the general profile/history view** and are visible only to the restricted audiences in §15 (CRR §27).
10. **Bulk CSV import** creates staff that flow through the **same hire-approval workflow** as manual creation (CRR §4).
11. **Removing (deactivating) a worker does not destroy operational history** (history retained per audit/retention tiers) (CRR §30; PDD §9.1).
12. **Warnings produce no status change** in this module: a worker is notified at rating < 70 and again at < 50, after which the manager is notified and handles it manually — no auto-suspension, no automated consequence (warning logic owned by Quality; this module's status model is unaffected) (CRR §16).

## 14. State Transitions

Employee-status transitions owned by this module. Each transition is audit-logged (§20) and arises from a confirmed event.

- **(none) → Inactive** — record created at signup or via bulk import (CRR §4, §6).
- **Inactive → Under Review** — documents complete **and** contract filled; application enters the manager pool (CRR §8, §10).
- **Under Review → Under Review (claimed)** — a manager claims the application; lock applied (mechanism owned by Onboarding) (CRR §10).
- **Under Review → Active** — claiming manager approves (CRR §10).
- **Under Review → Rejected** — claiming manager rejects (CRR §10).
- **Active → Active (marked suitable)** — manager manually confirms probation suitability; not an automated transition (CRR §10). Whether this is a *distinct* status is [OPEN] (§26).
- **Active → Deactivated** — soft-deletion of the record; **triggering workflow is [OPEN]** (PDD §9.1; §26).

Constraints:

- There is **no Suspended state** and **no automated transition out of Active** driven by ratings/warnings (CRR §16).
- Re-engagement of a deactivated worker is **not defined** in the authoritative documents ([OPEN], §26).

## 15. Permissions

Permissions are expressed against the existing RBAC framework (reused, not redefined — Rule 3) using the confirmed five-role model and role × hotel/group scope; the model is deny-by-default (CRR §1; PDD §5.4).

**Roles:** Staff (Worker), Checker, Hotel Manager, Regional Manager, Admin. There is no Supervisor role (CRR §1).

**Profile-and-history view** is visible to the worker themselves plus every role above them — Checker, Hotel Manager, Regional Manager, Admin (CRR §5).

| Capability | Staff | Checker | Hotel Manager | Regional Manager | Admin |
|---|---|---|---|---|---|
| View own profile & history | ✅ (self) | — | — | — | — |
| View a worker's profile & history | — | ✅ (assigned hotel) | ✅ (their hotel) | ✅ (their group) | ✅ (all) |
| Blocklist a worker at a hotel (with reason) | — | — | ✅ (their hotel) | ✅ (their group) | ✅ |
| Bulk-import staff | — | — | [OPEN] (§26) | [OPEN] (§26) | ✅ |
| View active workers today | — | — | ✅ | ✅ | ✅ |
| View org chart ("who reports to whom") | — | — | — | ✅ | ✅ |
| View Konfession (special-category) | — | — | — | — | ✅ + payslip-request processor |
| View disability status (special-category) | — | — | — | — | ✅ |
| Account deletion (deactivation) | — | — | — | — | ✅ |

Scope rules (PDD §5.4):

- Hotel Manager is scoped to **one hotel**; Regional Manager to **all hotels in their group**; Admin is **system-wide**.
- Special-category fields sit behind a **separate restricted permission tier**, smaller than general staff-data access; every view/edit is individually audit-logged (CRR §27).
- The hire-approval (claim/approve/reject) capability is exercised by managers in the Hotel-Group pool; the approval mechanism is owned by Onboarding (CRR §10).

> **[OPEN] Self-edit of profile by Staff after onboarding:** Only self-entry of the Personalfragebogen at signup is confirmed (CRR §6). Whether Staff may edit profile fields after activation is unresolved (§26).
> **[OPEN] Bulk-import permission holder:** Bulk import is confirmed (CRR §4) but the authoritative documents do not state which managerial role(s), beyond Admin, may perform it (§26).

## 16. Events Produced

> The authoritative documents describe a modular monolith with an event/job flow and confirmed manager notifications, but **do not enumerate a formal event schema**. The events below are the business-level domain events implied by confirmed state changes this module owns. The concrete event contract/transport is **[OPEN]** (§26).

This module announces (for other modules and Notifications/Audit to consume):

- **Employee record created** (signup or bulk import; status Inactive) (CRR §4, §6).
- **Employee submitted for review** (documents + contract complete; entered the pool) (CRR §8, §10).
- **Employee approved / activated** (CRR §10).
- **Employee rejected** (CRR §10).
- **Employee marked suitable** (probation milestone confirmed by manager) (CRR §10).
- **Employee profile updated** (core/personal fields changed) (CRR §4, §6).
- **Employee skills changed** (CRR §4).
- **Employee blocklisted / unblocklisted at a hotel** (with reason) (CRR §4).
- **Employee availability changed** (today's red/green flipped) (CRR §20).
- **Employee deactivated** (soft-deleted) (PDD §9.1).

## 17. Events Consumed

This module reacts to events owned elsewhere in order to keep the profile, availability, and history aggregation current (formal contract **[OPEN]**, §26):

- From **Onboarding/Documents/Contracts:** documents complete; contract filled/signed; hire-approval claimed/approved/rejected → drives lifecycle transitions (CRR §8, §9, §10).
- From **Job Dispatch:** worker assigned for a day (direct or broadcast) → marks the worker unavailable for the day and contributes to history (CRR §12, §13, §20).
- From **Calendar/Scheduling:** worker marked sick or vacation for a day (which auto-cancels any same-day assignment) → updates today's availability (CRR §20, §22).
- From **Quality:** new rating/score recorded; warning thresholds crossed (< 70, < 50) → reflected in the profile-and-history view (display only; no status change) (CRR §5, §15, §16).
- From **Attendance:** clock-in/clock-out recorded → contributes to work history surfaced in the profile view (CRR §5, §17).

## 18. Security Considerations

- **Reuse existing authentication** (email/username + password; auto-logout after 7 days; forgot-password via email; MFA required for Hotel Manager and above; MFA not required for Staff/Checker). This module does not implement authentication (CRR §2; PDD §5.3) (Rule 3).
- **Deny-by-default authorization** with role × hotel/group scope; cross-hotel access requires the actor's scope to include the target hotel (PDD §5.4).
- **Restricted permission tier** gates special-category fields, smaller than general staff-data access (CRR §27).
- **No background checks** are performed anywhere — this module must not introduce any (CRR §3).
- **No account lockout, no login rate-limiting, no CAPTCHA**; repeated failed logins instead **notify the manager** (owned by Authentication; noted for consistency) (CRR §2).
- Employee data exposure is bounded by scope: a Hotel Manager sees only their hotel's workers; a Regional Manager their group; Admin all (PDD §5.4).
- The platform operates **Germany only**, with documents/photos stored in the EU/EEA; no employee data leaves the EU/EEA (CRR §33; PDD §5.7).

## 19. GDPR Considerations

- **Daily consent gate:** access to the system (and therefore to employee functions) is contingent on the worker accepting the German data-protection notice once per calendar day; declining blocks access and notifies the manager. The gate is owned by the Consent module; this module's availability of employee functions depends on it (CRR §24).
- **Three-tier automatic retention** — this module classifies each employee field into the correct tier; deletion is executed automatically by the Retention module (CRR §25):
  - **Tier 1 — shift clock-in/out coordinates:** 6 months (attendance-linked) (CRR §17, §25).
  - **Tier 2 — general personal/profile data:** 5 years (CRR §25).
  - **Tier 3 — payroll/tax-adjacent fields** (IBAN, Tax ID, payslip-request records, wage records): 6 years (CRR §25).
- **Special-category data** (Konfession, disability, health/sick data) is voluntary where applicable, restricted in visibility, tied to a named legal basis, never shown on the general profile, and individually audit-logged on each access (CRR §27).
- **Sick leave requires no doctor's note** — a plain "sick" calendar flag avoids storing sensitive health data (owned by Calendar; noted because it shapes what health data the employee record never holds) (CRR §27).
- **Subject-rights requests** (data access/export) are handled automatically, via a button or the chatbot; this module supplies the employee's data for fulfilment (CRR §26).
- **Legal-basis-per-field:** data minimization is not actively pruned, but each collected field remains tied to a stated legal basis (CRR §26).
- **Soft deletion** of the employee record is retained, preserving the ability to delete identity while honouring retention of operational/audit history (PDD §9.1; CRR §30).

## 20. Audit Requirements

- **Every important employee-record action is logged immutably** (who did what, when), using the existing immutable audit-log framework (reused, not rebuilt — Rule 3) (CRR §30).
- **Audit logs are retained for 5 years**, consistent with the general-data tier (CRR §30).
- **Each view or edit of a special-category field produces its own distinct audit entry** (CRR §27).
- **Blocklist actions are logged with their reason** (CRR §4).
- **Lifecycle transitions** (submit-for-review, approve, reject, mark-suitable, deactivate) are audit-logged (CRR §10, §30).
- There is **no admin-facing log-viewer/search screen** — the audit trail is written and retained but not surfaced in an admin UI (CRR §30).

## 21. Validation Rules

- An employee may transition to **Active** only when onboarding completeness holds: all required documents uploaded **and** contract filled (CRR §4, §8).
- **Work-permit documents** are required to complete onboarding for non-EU/EEA/Swiss nationals and not required for EU/EEA/Swiss citizens (rule owned by Documents/Onboarding; this module honours it as an activation precondition) (CRR §7).
- **Skill tags** must be drawn from the confirmed set: Cleaner, Public Service, Kitchen Dishwasher, Waiter (CRR §4).
- **Core fields** Employee ID, Job Title, and Start Date are part of the employee record (CRR §4).
- **Sick/vacation** may be marked only for the current day or future days, never past days (rule owned by Calendar; noted because it constrains availability inputs) (CRR §22).
- **Blocklist** entries require a reason (CRR §4).
- **Bulk CSV import** validates each row and routes successfully created staff through hire-approval; **invalid-row and duplicate handling is [OPEN]** (§26) (CRR §4).
- **Personalfragebogen field formats** (e.g., IBAN, Tax ID, social-security number) are validated at the point of capture by the Onboarding module; this module stores validated values and does not re-define their formats (CRR §6).

## 22. Error Scenarios

- **Activation attempted with incomplete onboarding** → blocked; the account stays inactive until documents and contract are complete (the chatbot re-prompts for missing items) (CRR §4, §8).
- **Non-EU national missing work-permit documents** → onboarding cannot complete, so the employee cannot reach Active (CRR §7, §8).
- **Two managers attempt to review the same application** → the first claims it; the second is shown "Under review by [manager]" rather than an error or silent failure (CRR §10).
- **Assignment attempted for a blocklisted worker at that hotel** → not permitted (enforced at assignment time by Job Dispatch using this module's blocklist) (CRR §4).
- **Access to a special-category field without the restricted permission** → denied, and the attempt is audit-logged (CRR §27, §30).
- **Bulk import contains invalid rows** → valid staff are created and routed to approval; handling of the invalid rows is **[OPEN]** (§26) (CRR §4).

## 23. Edge Cases

- **EU/EEA/Swiss vs non-EU determination** hinges on nationality; **dual nationality or a change of nationality** is not addressed by the authoritative documents → **[OPEN]** (§26) (CRR §7).
- **Worker marks sick/vacation after being assigned that day** → the existing same-day assignment is auto-cancelled and today's availability flips to red (cancellation owned by Calendar; availability reflected here) (CRR §22, §20).
- **Worker with no skill tags** → eligible for no broadcast slots (eligibility owned by Job Dispatch) (CRR §13).
- **Fewer than 10 completed jobs** → the recency-weighted overall rating still computes from available history (owned by Quality; surfaced here) (CRR §15).
- **Deactivated worker** → operational history and audit entries remain intact and retrievable within retention horizons (CRR §30; PDD §9.1).
- **Availability viewed against a future/past calendar date** → the indicator does not change; it reflects *today* only (CRR §20).
- **Worker's Hotel-Group association** governs the set of hotels they can be assigned within; the **mechanism establishing that association is [OPEN]** (§26) (CRR §12).

## 24. Dependencies

> No sibling module specification is merged yet; the integration **contracts** with the modules below are therefore **[OPEN]** beyond what the authoritative documents state. Dependencies are listed by ownership (Rule 4/5).

**Platform / infrastructure (reused — Rule 3; PDD §2, §5):** PostgreSQL system of record; Express + TypeScript modular monolith; existing RBAC framework; existing immutable audit log; Winston logging; AWS (EC2 + RDS), Nginx, PM2, GitHub Actions CI/CD; EU-region object storage for documents/photos.

**Sibling modules:**

- **Authentication / User Management** — account, role, scope, MFA, sessions (CRR §1, §2; PDD §5.3).
- **Onboarding** — Personalfragebogen, document-collection chatbot, pool/claim hire-approval (CRR §6, §8, §10).
- **Documents** — document storage, expiry, non-EU work-permit (CRR §4, §7).
- **Contracts** — contract storage and QES signing (CRR §9).
- **Calendar/Scheduling** — weekly plan, sick/vacation (availability inputs) (CRR §13, §22).
- **Job Dispatch** — broadcast, direct assignment, skill eligibility, daily exclusivity (availability inputs) (CRR §13).
- **Quality** — scores, ratings, tiers, warnings, rework (profile inputs) (CRR §14–§16).
- **Attendance/Geo** — clock-in/out, coordinates (history inputs) (CRR §17).
- **Notifications** — push delivery of employee-related events (CRR §18).
- **Payslips** — payslip-request processor context (special-category visibility) (CRR §23, §27).
- **Consent** — daily consent gate (access precondition) (CRR §24).
- **Retention** — automatic tiered deletion of classified employee fields (CRR §25).
- **Compliance** — special-category governance and subject-rights, to be **extended** later per fuller client requirements (CRR §26, §27, §33).
- **Hotels** — hotel and Hotel Group records, group context (CRR §11).

## 25. Future Extensibility

- **Scaling hotels and groups:** the design anticipates new hotels added over time; employee-to-group association and search/filter by hotel must scale accordingly (CRR §11, §21).
- **Compliance extension:** the compliance surface is to be **extended** (not rebuilt) when the client's fuller compliance requirements arrive (CRR §33).
- **Post-probation contract divergence:** today one contract document serves both signup and post-probation; if it must differ later, that is a future change (CRR §9).
- **Contract expiry/renewal:** the contract will expire after a period to be defined; once the length is known, expiry handling attaches to the employee/contract relationship ([OPEN] length, §26) (CRR §9).
- **Per-hotel configurable geofence radius** is anticipated later (attendance-owned; noted for platform consistency) (CRR §17).
- The retained employment record is intended to accommodate future scheduling expansion **without restructuring** (PDD §9.5).

## 26. Open Questions

Genuine unresolved items. Items 1–3 are the three open product questions recorded in the authoritative register; items 4+ are gaps this module surfaces (Rule 7 — not resolved here).

- **[OPEN] OPQ-1 — Probation legal shape.** Fixed-term trial contract vs. permanent contract with a probation clause. Determines whether QES is mandatory from day one and whether probation is a distinct employee status (CRR §9, Open Items).
- **[OPEN] OPQ-2 — Contract expiry length.** The contract expires, but the duration is pending; blocks any contract-expiry handling on the employee record (CRR §9, Open Items).
- **[OPEN] OPQ-3 — Hotel-creation permission.** Admin-only vs. Regional Manager may add hotels to their own group; affects governance of employee-to-hotel/group context (CRR §11, Open Items).
- **[OPEN] OPQ-4 — Offboarding/termination workflow.** Soft-deletion is retained, but no triggering termination/deactivation or re-engagement workflow is defined (PDD §9.1; CRR §30).
- **[OPEN] OPQ-5 — Hotel-Group association mechanism.** Workers may be assigned only within the group they are working in, but how a worker becomes associated with a group is not specified (CRR §12).
- **[OPEN] OPQ-6 — Staff self-edit after onboarding.** Only signup-time self-entry of the Personalfragebogen is confirmed; post-activation self-edit rights are unspecified (CRR §6).
- **[OPEN] OPQ-7 — Org-chart / reporting structure.** Visibility (Regional Manager + Admin) is confirmed, but the underlying reporting-relationship model is undefined (CRR §1).
- **[OPEN] OPQ-8 — Formal domain-event contract.** The authoritative documents describe an event/job flow but enumerate no event schema/transport for §16–§17 (PDD §5.5).
- **[OPEN] OPQ-9 — Bulk-import row handling & permission holder.** Invalid-row and duplicate handling, and which managerial roles (beyond Admin) may import, are unspecified (CRR §4).
- **[OPEN] OPQ-10 — Availability-indicator derivation.** Confirmed inputs are same-day assignment and sick/vacation; the exact derivation rule and its precise ownership boundary are not stated (CRR §20).
- **[OPEN] OPQ-11 — Job Title value domain.** A Job Title field is confirmed, but whether it is free text or a controlled list is not specified (CRR §4).
- **[OPEN] OPQ-12 — Skill-set governance.** The skill tag set and assessment bases are fixed; whether the set is administratively editable is unspecified (CRR §4).

## 27. Refactoring Summary

This module is a **refactor** within the marketplace → Workforce Operations Platform rewrite. Changes below are scoped to Employee Management and derived from the authoritative documents (CRR §13, §34, Explicit Non-Goals; PDD §9.1, §9.2).

**Reused components (kept; not redesigned — Rule 3):**

- Authentication, MFA, sessions, password reset (Authentication).
- RBAC framework and role × scope authorization (User Management/Authorization).
- The retained roster/employment record, repurposed (see "Redesigned").
- Hotel and Hotel Group records (Hotels).
- Notifications framework, immutable audit logging, AWS infrastructure, and deployment architecture.

**Removed components (marketplace-era, explicitly out of scope — must not appear):**

- Worker-initiated job applications and the application-to-assignment linkage.
- Auto-matching / auto-ranking engine and best-match suggestions.
- Worker browsing and worker-selection workflows; all "marketplace" framing and terminology.
- The employment-type *distinguishing* field; certifications and reminders; preferred-staff list; internal-transfer tracking; promotion history; training records; reward history.

**Redesigned components:**

- The retained roster record becomes the **permanent-employment record**, reflecting that all staff are permanent employees who earn only when assigned (PDD §9.1; CRR §4, §31).
- The employee's relationship to work changes from *applying/competing* to **being directly assigned or broadcast-eligible**; assignment no longer depends on a prior application (PDD §9.1; CRR §13).
- The profile-and-history view becomes the **single performance-review surface** (no separate review process) (CRR §5).
- Availability is expressed as a **today-only red/green indicator** rather than any marketplace availability semantics (CRR §20).
- The lifecycle status set is reduced to confirmed states (Inactive, Under Review, Active, Rejected, Deactivated), with rating "tiers" explicitly separated out as Quality-owned display labels (CRR §10, §15, §16).

**New components:**

- Personalfragebogen-sourced personal data carried on the employee record (CRR §6).
- Non-EU work-permit data linkage (CRR §7).
- The fixed skill-tag set with per-tag assessment basis as the eligibility input (CRR §4, §13).
- Special-category restricted fields (Konfession, disability) with per-access auditing (CRR §27).
- Three-tier retention classification of employee fields (CRR §25).
- Hotel blocklist with logged reasons (CRR §4).
- Bulk CSV import routed through hire-approval (CRR §4).
- Regional Manager visibility (including org-chart visibility) over employee data across a group (CRR §1).
- Dependence on the daily GDPR consent gate as an access precondition (CRR §24).
