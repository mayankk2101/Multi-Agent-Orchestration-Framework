# CONFIRMED REQUIREMENTS REGISTER v1.0
## Complete, Uncompressed Record of Every Confirmed Decision

**Client:** FHM Hotelservice GmbH (Frankfurt am Main, Germany)
**Vendor:** Zirove
**Market:** Germany only
**Purpose:** Exhaustive ledger of every decision confirmed across the entire requirements engagement. Nothing summarized, nothing dropped. This is the companion to the Pivot Design Document — the design doc says *how we build*, this register says *everything we agreed*.

**Legend:** ✅ = confirmed include · ❌ = confirmed exclude · 🔵 = confirmed value/rule · `[OPEN]` = not yet answered · `[ACTION]` = non-engineering task with an owner

---

## 1. ROLES & ACCESS

- ✅ Role model has exactly 5 roles: **Staff (Worker), Checker, Hotel Manager, Regional Manager, Admin**
- ❌ No "Supervisor" role exists anywhere in the system
- 🔵 Checker is its own distinct role — NOT a rename of Supervisor, NOT merged with any other role
- 🔵 Staff = the worker who performs jobs
- 🔵 Regional Manager is a NEW role being created
- 🔵 Regional Manager can see all data that a Hotel Manager can see, but across the entire Hotel Group they manage (multiple hotels)
- 🔵 A normal Hotel Manager can view data for their one assigned hotel only
- 🔵 Admin has system-wide access
- 🔵 Org chart ("who reports to whom") is visible ONLY to Regional Manager + Admin

## 2. LOGIN & ACCOUNT ACCESS

- ✅ Login with email/username + password
- ✅ Auto-logout after **1 week** (🔵 specific value: 7 days)
- ✅ "Forgot password" reset via email
- ✅ MFA (extra login step) required for managers (Hotel Manager and above)
- ❌ MFA NOT required for regular staff (Staff/Checker)
- ❌ No account lockout after failed login attempts
- 🔵 Instead of lockout: on repeated failed attempts, **notify the manager**
- ❌ No login rate-limiting
- ❌ No CAPTCHA (never requested; not in scope)

## 3. BACKGROUND CHECKS

- ❌ No background check process exists in the system at all (not just "no auto-block" — the entire process is excluded)

## 4. STAFF PROFILES & FIELDS

- ✅ Employee ID field
- ✅ Job Title field
- ✅ Start Date field
- ❌ No Department field
- ✅ Bulk import of staff via spreadsheet (CSV) — goes through the same approval workflow as manual creation
- ✅ Blocklist — a hotel can block specific staff from being assigned there, with a reason logged
- ✅ Full staff history (all work history, ratings, etc.) on the worker's profile
- ✅ Skill tags with a specific confirmed list: **Cleaner, Public Service, Kitchen Dishwasher, Waiter**
- 🔵 Cleaners are assessed by **rooms cleaned**
- 🔵 All other roles (Public Service, Kitchen Dishwasher, Waiter) are assessed by **hours worked**
- ✅ Document upload + expiry tracking at account creation
- ❌ No certifications (formal, expiring qualifications)
- ❌ No certification expiry reminders
- ❌ No "preferred staff" list
- ❌ No employment-type field (permanent/contract/seasonal) as a distinguishing field — see staffing-status note below
- ❌ No internal transfers tracking
- 🔵 All staff ARE permanent employees — they simply do not earn when not assigned to work (this is why the app is named "Employee App")

## 5. PROFILE / HISTORY VIEW

- ✅ Single unified profile-history view: full work history, task scores, rating history
- ✅ Includes date filters and other useful filters for managing
- ✅ Visible to: the worker themselves, plus every role above them (Checker, Manager, Regional Manager, Admin)
- ❌ No separate formal "performance review" process — this profile view IS the performance review
- ❌ No promotion history
- ❌ No training records
- ❌ No "reward history" (was typed by mistake by client, explicitly disregarded)

## 6. ONBOARDING — PERSONALFRAGEBOGEN (German new-hire form)

- ✅ Worker fills out the Personalfragebogen themselves, during signup (self-service digital form, NOT manager-entered, NOT PDF-upload-after-the-fact)
- 🔵 Confirmed fields on the form:
  - First name (Vorname)
  - Last name (Nachname)
  - Date of birth (Geburtsdatum)
  - Nationality (Staatsangehörigkeit)
  - Place of birth (Geburtsort)
  - Country of birth (Geburtsland)
  - Street + house number (Straße & Hausnummer)
  - Postal code & city (PLZ & Ort)
  - Bank account holder (Kontoinhaber)
  - IBAN
  - Tax ID (Steuer-ID)
  - Health insurance provider (Krankenkasse)
  - Social security number (Sozialversicherungsnummer)
  - Employment type: Teilzeit / Minijob
  - Work start date (Beginn der Arbeit)
  - Signed declaration (Unterschrift + Ort/Datum)
- 🔵 Teilzeit vs. Minijob is **stored as information only — no system logic, no warning attached**
- 🔵 Purpose: this data is used to register the worker with German working authorities so they can work during a probationary period

## 7. ONBOARDING — DOCUMENTS & WORK PERMIT

- ✅ Worker must upload all required documents in the app
- 🔵 Work-permit / residence documents are required ONLY for workers who are NOT from the EU/EEA/Switzerland
- 🔵 EU/EEA/Swiss citizens do NOT require work permits (explicitly confirmed)
- 🔵 This is a mandatory legal obligation for non-EU workers, separate from (and not affected by) the rejected background-check process

## 8. ONBOARDING — CHATBOT FLOW

- ✅ A chatbot guides the document collection during onboarding
- 🔵 The chatbot asks the worker for all required documents
- 🔵 If documents are incomplete, the chatbot asks again for the missing ones
- 🔵 The account ("ID") does NOT activate until all required documents are uploaded AND the contract is filled
- 🔵 The chatbot is an AI agent using the Claude API (not just a static wizard)
- 🔵 Cost controls are mandatory: hard limits to control the bill
- 🔵 Recommended implementation (Zirove to apply): claude-haiku model (cheapest), hard monthly token budget cap stored in config, per-conversation token limit, cached required-document list, graceful fallback to a static checklist UI if limits are hit
- 🔵 The chatbot is also used for GDPR subject-rights requests (second use of the same agent)

## 9. ONBOARDING — CONTRACT, PROBATION & LIFECYCLE

### Signing method
- ✅ Contract document is stored in the system
- ✅ Contract is shown to the worker so they can fill it
- 🔵 Employment contracts are signed **BY HAND** (physical/handwritten signature)
- ❌ NO Qualified Electronic Signature (QES) — explicitly rejected due to added cost and being time-consuming for employees
- ❌ Skribble / any QES provider — NO LONGER NEEDED (supersedes the earlier QES/Skribble decision)

### Application → familiarization → contract sequence
- 🔵 Before an employment contract is concluded, the applicant must submit a complete application with all required and valid documents
- 🔵 Afterwards, a familiarization period (trial work) may take place
- 🔵 Purpose of familiarization: solely to let both parties determine whether the working relationship is suitable
- 🔵 Familiarization period is limited to a **maximum of two trial days** and always complies with applicable legal requirements
- 🔵 An employment contract is concluded ONLY if both parties agree to proceed after the familiarization period

### Contract lifecycle (fixed-term → extension → permanent)
- 🔵 The initial employment contract is a **fixed-term contract for ONE year**
- 🔵 It includes a **six-month probation period**
- 🔵 During the probation period, either party may terminate by giving **two weeks' notice**
- 🔵 At the end of the first year, the fixed-term contract expires
- 🔵 If both parties wish to continue, the contract may be extended for **one additional year**
- 🔵 NO new probation period applies to the extension (probation was already completed at the start)
- 🔵 After **two years** of successful employment, the employee is offered a **permanent (open-ended) contract**

### Contract expiry reminders (system behavior)
- 🔵 System automatically reminds the responsible manager BEFORE the initial 1-year contract expires, so a renewal decision can be made
- 🔵 If extended for a second year, the system again reminds the manager before the end of the second year
- 🔵 Once the employee is on a permanent (open-ended) contract, NO further contract-expiration reminders are sent

## 10. ONBOARDING — APPROVAL (POOL/CLAIM)

- ✅ After docs uploaded + contract filled, the application goes for review to a manager
- 🔵 Mechanism: **Pool/Claim** — the completed application appears in a shared inbox visible to ALL managers in the Hotel Group
- 🔵 The first manager to open it "claims" it; it locks to them so two managers cannot review the same application simultaneously
- 🔵 Other managers see "Under review by [manager name]"
- 🔵 The claiming manager approves or rejects the application
- 🔵 Probation suitability is decided by **fully manual manager judgment** (no system timer, no rating-threshold automation)
- 🔵 The manager marks a worker "suitable" for the contract

## 11. HOTELS & PROPERTIES

- ✅ Hotel profile — each hotel has its own dedicated manager
- 🔵 Only the manager is dedicated/permanent to a hotel; the rest (staff) are not tied to a specific hotel
- ✅ Hotel Groups — multiple hotels grouped under one Regional Manager with shared billing
- ✅ "Pause new jobs" toggle for a hotel — must be simple for the manager to use
- 🔵 Job listing is handled by the manager independently; the system just makes it simple for him
- ❌ No rooms system
- ❌ No floors system
- ❌ No buildings system
- ❌ No zones system
- ✅ New hotels can be added over time (system designed to scale as hotels grow)
- 🔵 New hotels may ONLY be created by Headquarters or users with the **Admin** role
- 🔵 After a hotel is created, it is assigned to the responsible Regional Manager or Property Manager
- 🔵 Regional/Property Managers get permissions ONLY for their assigned hotels/properties
- 🔵 Regional/Property Managers may manage their assigned properties but may NOT create new hotels or modify existing hotel groups

## 12. CROSS-HOTEL ASSIGNMENT

- 🔵 No worker is tied to a specific hotel
- 🔵 A worker can only be assigned tasks in the hotel chosen by the manager
- 🔵 This can only happen within the group of hotels the worker is working in (the Hotel Group)
- 🔵 Once a worker is assigned by a manager, he is not available for any other job (that day)
- ❌ No separate dual-manager cross-hotel approval step

## 13. JOBS — ASSIGNMENT MODEL (TWO-TIER)

### Primary: Calendar / Weekly Plan (direct assignment)
- ✅ Manager builds a weekly plan via a calendar interface
- ✅ Manager directly places/selects workers for each day (day-by-day)
- 🔵 This is a DIRECT assignment — no accept/decline step by the worker
- 🔵 The assignment simply appears on the worker's calendar
- ✅ Worker can view their own calendar
- 🔵 Calendar-based assignment does NOT trigger any broadcast

### Fallback: Broadcast Job Request (gap-fill)
- 🔵 A broadcast only fires when the manager specifically raises a NEW standalone job request (NOT when updating the weekly plan)
- 🔵 Example trigger: more guests arrive than expected, hotel needs extra workers that day
- 🔵 Manager inputs: how many workers he wants
- 🔵 Manager selects which skill(s) he wants, out of the integrated skill list
- 🔵 Manager specifies how many workers per skill (e.g., 2 Cleaners + 1 Waiter)
- 🔵 Only workers with the matching skill get notified for that skill's slots
- 🔵 Only workers who are NOT already working/assigned that day are eligible
- 🔵 Works on a first-accept basis
- 🔵 Tie-break when multiple workers accept the same slot simultaneously: **first acceptance received by the server (earliest timestamp) wins**
- 🔵 When a skill's slots are full, workers who try to accept afterward get a notification that the job requirement is already fulfilled (explicit message, not silence, not an error)
- 🔵 Job request auto-closes after **6 hours** if not filled
- 🔵 Manager can also close the job request manually before the 6 hours

### Assignment exclusivity
- 🔵 Once a worker is assigned ANYTHING for a day (via calendar OR broadcast), he is blocked from any further assignment for that entire day
- 🔵 "Already assigned" blocks all further requests for that day (not just a specific time slot)

### Removed from jobs
- ❌ Worker-initiated applications (workers do NOT browse and apply for jobs)
- ❌ Automatic matching/ranking engine
- ❌ Automatic best-match suggestions
- ❌ "Approval required for risky matches" logic
- ❌ "Probation staff can't be auto-assigned" logic (no auto-assignment exists)
- ❌ Urgency levels / SLA / response deadlines / auto-escalation (the SLA kind)
- ❌ Formal job status state machine (Open→Assigned→In Progress→etc.) — rest handled manually
- ❌ Recurring/repeating jobs (manual day-by-day entry only)

## 14. REWORK FLOW

- ✅ Checker assigns rework to a specific worker
- 🔵 Worker is notified via **in-app inbox AND a separate push notification** (BOTH channels, not one instead of the other)
- 🔵 There must be a stored, readable inbox entry for the rework, in addition to the push alert
- ✅ Worker uploads a photo and clicks "work done"
- ✅ Checker is notified with the photo + details
- 🔵 If the rework is NOT completed within **20 minutes**, notify BOTH the Manager and the Checker (auto-escalation)

## 15. QUALITY & RATINGS

- ✅ Quality score is 0–100 (not a 5-star system)
- 🔵 The process is manual: the Checker/supervisor uploads a photo WITH the rating
- 🔵 The manager can view it and already knows who did which room, so no backend matching logic is built for this — handled manually
- ✅ Rating tiers (Elite/High/Standard/Low/Probation) shown as a simple label on top of the 0–100 score
- ✅ Recency-weighted averaging: a worker's overall rating leans more heavily on their last 10 jobs than older ones
- ✅ Each worker's rating is 0–100
- ✅ Checker assesses the room, has the worker's profile, and uploads the result directly onto that specific worker's profile
- ✅ Confirmed inspection checklist items: **dust, bathroom, bed linen, mirror, floor, minibar/restocking, fragrance/amenities, other**
- ❌ No 14-day dispute window
- ❌ No formal dispute resolution by Regional Manager
- ❌ No auto-reward engine

## 16. WARNINGS

- ✅ Worker gets a notification (first warning) if their rating falls below **70**
- ✅ Worker gets a second warning if rating falls below **50**
- 🔵 After the second warning (<50), the **manager** receives a specific notification about the worker's rating, and handles the rest manually
- 🔵 No further automated consequence after the second-warning manager notification (no auto-suspension, no auto-anything)

## 17. LOCATION & ATTENDANCE

- ❌ Location is NOT mandatory always-on / continuous tracking
- ✅ Location must be ON only at the moment the Start/Close shift buttons are used
- 🔵 Start and Close buttons only function when the worker is physically at the hotel location
- 🔵 If the worker is not at the location, the button will not work
- 🔵 Geofence radius: **100 meters** (chosen by Zirove due to GPS drift near large buildings; can be made per-hotel configurable later)
- ✅ Distance is shown to the worker; the exact/specific location is NOT revealed (just distance)
- ✅ Actual coordinates are captured and stored at each clock-in and clock-out
- 🔵 Shift-location coordinates are retained for **6 months**, then **hard-deleted at exactly 6 months** (automatic scheduled deletion, not indefinite)

## 18. NOTIFICATIONS

- ✅ Push notifications only (system-wide channel decision)
- 🔵 Declining the daily consent gate blocks the user's access AND notifies the manager
- ❌ No SMS channel (push-only decision supersedes earlier multi-channel ideas)
- ❌ No self-service notification settings screen (not confirmed; not in scope)

## 19. MANAGER OPERATIONS (manual data entry)

- ✅ Manager gets data from reception and updates it in the system, including: checked-out rooms, long-stay guests, long-stay guests without service
- ✅ Manager feeds data on how many rooms were done by which worker, and compares against the task start
- ✅ Manager, Regional Manager, and Admin can see active workers for that day

## 20. AVAILABILITY INDICATOR

- ✅ Red = worker is NOT available today
- ✅ Green = worker IS available today
- 🔵 The indicator is for **today only** — it does NOT change based on which date is being viewed on the calendar

## 21. SEARCH & ANALYTICS

- ✅ Search workforce by selecting hotel filters
- ✅ Filter analytics/workforce by hotel
- ✅ Option to scale and increase hotels over time
- 🔵 Full marketplace analytics were removed; only BASIC analytics to be built (scope to be defined by Zirove — proposed: active workers/day, rooms completed per worker, rating/warning counts, sick/vacation counts per hotel)
- (Note: at one point analytics was said to be removed entirely, then later clarified to "create basic analytics, you figure out scope" — basic analytics IS in scope.)

## 22. SCHEDULING — SICK & VACATION

- ✅ Worker can go on their calendar and mark a day as sick or vacation
- 🔵 Can only be done for the current day and future days (not past days)
- 🔵 Worker must specify whether it is "sick" or "vacation"
- ✅ Manager is notified about any such action
- 🔵 Marking a day sick OR vacation **auto-cancels** any existing assignment for that day
- 🔵 No cap on number of sick/vacation days
- 🔵 No advance-notice requirement
- 🔵 No approval required (manager is just notified after the fact)
- 🔵 Vacation is a label only — NO balance tracking (the system does not track remaining leave days)
- ❌ No leave-approval workflow
- ❌ No shift swaps
- ❌ No coverage planning
- ❌ No recurring/repeating schedule patterns (manual entry only)

## 23. PAYROLL & PAYSLIPS

- ✅ Payslip request flow: worker can REQUEST a payslip
- 🔵 The manager sends the payslip by email manually
- 🔵 The worker CANNOT retrieve the payslip himself
- ❌ Salary / hourly pay calculation — NOT handled by the system (manual, manager-side)
- ❌ Overtime calculation — NOT handled by the system
- ❌ Bonuses & deductions — NOT handled by the system
- ❌ Payroll exports for finance — NOT handled by the system
- 🔵 The system performs ZERO payroll math

## 24. GDPR — DAILY CONSENT GATE

- ✅ Every time the worker logs in / starts work, he must agree to the German data-protection notice (Datenschutzinformation nach Art. 13 DSGVO) to proceed
- 🔵 Must be accepted **once per calendar day** (not on every login within the same day)
- 🔵 If the worker declines: block access AND notify the manager
- 🔵 The consent notice must be available in ALL languages the system supports
- 🔵 (Flagged by Zirove for legal/DPO validation: the notice is mostly informational under its own legal-basis table, not consent-based; gating daily access on it may be a legal mismatch. Client instructed to keep it as specified regardless.)

## 25. GDPR — DATA RETENTION (THREE TIERS, ALL AUTOMATIC DELETION)

- 🔵 Tier 1 — Shift clock-in/out coordinates: **6 months**, then hard delete
- 🔵 Tier 2 — General personal/profile data: **5 years**
- 🔵 Tier 3 — Payroll/tax-adjacent fields (IBAN, tax ID, payslip-request records, wage records): **6 years** (per §41 EStG / §257 HGB / §147 AO)
- 🔵 All deletion is AUTOMATIC (scheduled jobs), not manual
- 🔵 (Reference: German law as of 1 Jan 2025 — 10yr for books/statements, 8yr for accounting source documents/invoices, 6yr for business correspondence and wage records. The 6-year tier is the one that maps to this app's payroll-adjacent data. 8/10-year tiers only apply if invoice-type documents are ever introduced.)
- `[ACTION]` Retention mapping should get a quick tax-advisor sign-off before final lock-in (owner: client's tax advisor)

## 26. GDPR — SUBJECT RIGHTS

- ✅ Subject-rights requests (data access / export) are handled AUTOMATICALLY
- 🔵 Via a button or using the chatbot
- ❌ Data minimization is not being actively pruned ("we don't need minimization") — BUT each collected field should remain tied to a stated legal basis (flagged once by Zirove as a core GDPR principle, not a toggle; kept documented per-field)

## 27. GDPR — SPECIAL-CATEGORY DATA

- 🔵 Special-category fields identified: Konfession (religion, for church tax), disability status, health data (sick notes)
- 🔵 Handling plan (proposed by Zirove, approved to implement):
  - Konfession: restricted-visibility field; visible only to whoever processes payslip requests + Admin; tied only to its church-tax legal basis; never shown on general profile/history views
  - Disability status: voluntary (not mandatory); restricted visibility (Admin only)
  - Mechanism: a separate "restricted" permission tier, smaller than general staff-data access; every view/edit of these fields gets its own distinct audit-log entry
- 🔵 Sick leave requires NO doctor's note (a plain "sick" calendar flag, which avoids storing sensitive health data)

## 28. GDPR — WORKING HOURS

- ❌ Working-hours legal-limit warning rule — DROPPED entirely (no warning, no block)

## 29. GDPR — VENDOR & GOVERNANCE

- 🔵 Zirove is the vendor building this FOR the client (FHM Hotelservice GmbH)
- `[ACTION]` An Art. 28 GDPR Data Processing Agreement (DPA) must exist between Zirove and FHM Hotelservice GmbH (owner: business/legal, both parties)
- `[ACTION]` Mandatory Data Protection Officer (DPO) threshold under §38 BDSG kicks in at 20+ people regularly processing personal data — the client must track and own this (owner: client side, not the app)

## 30. AUDIT LOGS

- ✅ Every important action is logged (who did what, when) — immutable
- 🔵 Audit logs retained for 5 years (consistent with general-data tier)
- ❌ No admin-facing log viewer/search screen (admin does not want a log viewer)

## 31. MOBILE APPS

- ✅ Employee App (the worker side) — RENAMED from "Staff/Worker App" to "Employee App" (because all staff are permanent employees)
- ✅ Checker App (the inspector side) — unchanged, NOT relabeled
- ❌ No offline mode (explicitly out of scope)

## 32. LANGUAGES & RTL

- ✅ 12 supported languages: **German, English, Urdu, Arabic, Russian, Italian, Polish, Turkish, French, Spanish, Danish, Sorbian**
- 🔵 "Pakistani" was clarified to mean **Urdu**
- 🔵 RTL (right-to-left) writing support required for **Arabic AND Urdu** (both RTL)
- 🔵 Legal documents (GDPR notice, contract, consent flows) should use professional/certified translation, separate from ordinary in-app UI strings (flagged by Zirove)

## 33. DATA / SYSTEM SCOPE

- 🔵 Platform operates in **Germany only** for now (no other jurisdictions to design for)
- 🔵 No room-level task layer — "Task" and "Work Request" do NOT need separating; full-day employment model
- 🔵 Compliance module: EXTEND the existing module per the client's fuller requirements (coming later), NOT a separate new module built from zero

## 34. ARCHITECTURE PIVOT DECISIONS (from codebase audit)

- ✅ Change from "workers apply for jobs" to the new broadcast/receive flow — CONFIRMED
- ✅ Remove the "marketplace" architecture framing — CONFIRMED
- ✅ Fix the inconsistent API response envelope (centralize the success path behind a builder; fix per_page/limit mismatch) — Zirove to implement as it sees fit
- ✅ Reduce the analytics module to basic scope (not remove entirely)
- ✅ Regional Manager role — new, being created
- ✅ Calendar / weekly plan — new, being created
- ✅ Geofenced Start/Close — new, being created (geo module was a placeholder)
- ✅ Chatbot / Claude agent — new, being created (chatbot module was a placeholder)
- ✅ Personalfragebogen onboarding form — new, being created
- ✅ Contract storage — new, being created
- ✅ Special-category data handling — new, being created
- ✅ Red/green availability indicator — new, being created
- ✅ Retention + auto-deletion jobs — new, being created
- ✅ Multilingual support (12 languages) — new, being created
- ✅ RTL support (Arabic + Urdu) — new, being created
- ✅ Daily GDPR consent gate — new, being created
- ✅ Work-permit field (non-EU workers) — new, being created
- ✅ Payslip request flow — new, being created
- ❌ QES / Skribble integration — REMOVED (contracts signed by hand; no e-signature integration)
- ✅ Pool/claim manager assignment for onboarding — new, being created

## 35. BUILD SEQUENCE (process decisions)

- 🔵 Documents are updated FIRST, before any code work
- 🔵 Code review (audit) happens against the UPDATED documents, not the old marketplace-era ones
- 🔵 Codebase verification (sections 6–12 of the audit) deferred to a report the client will run via the provided token-optimized Claude Code prompt
- 🔵 Confirmed existing stack to keep: PostgreSQL, Express+TypeScript, Prisma, JWT auth, Zod validation, Winston logging, immutable audit log, AWS (EC2+RDS), Nginx, PM2, GitHub Actions CI/CD, two mobile apps

---

## OPEN ITEMS

**None. All product questions are resolved.**

The previously open items are now confirmed:
- Probation legal shape → **RESOLVED** (fixed-term 1yr contract, 6-month probation, handwritten signature — see Section 9)
- Contract expiry length → **RESOLVED** (1yr initial, extendable +1yr, permanent after 2yr — see Section 9)
- Hotel-creation permission → **RESOLVED** (Admin/HQ only — see Section 11)

## ACTION ITEMS (non-engineering, other owners)

- `[ACTION]` Art. 28 DPA between Zirove and FHM Hotelservice GmbH (business/legal)
- `[ACTION]` DPO threshold tracking (§38 BDSG, 20+ people) — client side
- `[ACTION]` Tax-advisor sign-off on the 6-year payroll/tax retention mapping

## EXPLICIT NON-GOALS (confirmed OUT of scope)

Marketplace/matching engine · worker-initiated job applications · auto-matching/ranking · rooms/floors/buildings/zones · in-system payroll calculation (salary/overtime/bonuses/deductions/exports) · SLA/urgency tiers · recurring jobs · dispute window & resolution · auto-reward engine · working-hours warning/enforcement · promotion history · training records · certifications · preferred-staff list · internal transfers · employment-type distinguishing field · background checks · account lockout · login rate-limiting · CAPTCHA · MFA for regular staff · self-service notification settings · admin log-viewer screen · offline mode · SMS/email notification channels · multi-country support · leave-balance tracking · leave-approval workflow · shift swaps · coverage planning · self-retrievable payslips · Qualified Electronic Signature (QES) / e-signature integration (contracts signed by hand)
