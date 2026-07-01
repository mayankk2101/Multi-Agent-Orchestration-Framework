# Onboarding Module — Business Specification

**Platform:** Workforce Operations Platform
**Client:** FHM Hotelservice GmbH (Frankfurt am Main, Germany) · **Vendor:** Zirove · **Market:** Germany only
**Document type:** Business specification (no implementation, no schema, no API, no code)
**Status:** Foundational module specification — derived from authoritative requirements.

---

## Source of Truth & Provenance

This specification is derived **exclusively** from the two authoritative documents:

- `CONFIRMED_REQUIREMENTS_REGISTER.md` (referenced below as **CRR §n**)
- `PIVOT_DESIGN_DOCUMENT.md` (referenced below as **PDD §n**)

No behaviour in this document is derived from any other source.

---

## 1. Module Overview

The Onboarding Module is the system responsible for **new-hire intake, document collection, legal contract execution, and hire approval decisioning**. It orchestrates the journey from first signup through manager approval to the point where the employee becomes active in Employee Management.

The module is customer-facing for workers (self-service signup, Personalfragebogen form, document upload chatbot, contract e-signature) and manager-facing for hiring decisioning (pool/claim review mechanism, approve/reject).

Onboarding produces two critical outputs: (1) a **completed employee hire**, reflected as a new Inactive employee record in the Employee Management module, and (2) a **manager decision** (approve/reject) that transitions the employee toward Active or Rejected status (CRR §6–§10; PDD §9.1).

## 2. Purpose

To provide a legally compliant, documented, and auditable new-hire workflow that:

- Captures the **Personalfragebogen** (German onboarding form) during self-service signup, so workers register with German authorities during probation (CRR §6).
- Collects all **required documents and work permits** with AI-guided assistance, ensuring compliance with work-permit regulations for non-EU workers (CRR §7, §8).
- Delivers and captures the **contract with QES (Qualified Electronic Signature)** to establish a legally binding fixed-term employment relationship (CRR §9; PDD §5.6).
- Implements a **pool/claim hiring-approval mechanism** so managers can review, claim, and decide on new hires without duplicate simultaneous review (CRR §10).
- Routes hiring decisions to the Employee Management module, which reflects the outcome in employee lifecycle state (CRR §10; EM Module §7).

## 3. Scope

In scope for this module:

- **Personalfragebogen (new-hire form):** a self-service digital form with all confirmed German onboarding fields (CRR §6).
- **Document collection and validation:** capturing required documents from workers; geofencing work-permit requirements to non-EU/EEA/Swiss workers (CRR §7).
- **Chatbot-guided document collection:** an AI agent using the Claude API to query workers for missing documents with cost controls and fallback to static UI (CRR §8).
- **Contract delivery and QES signing:** presenting the employment contract and capturing its signature via a QES provider (CRR §9; PDD §5.6).
- **Pool/claim hiring review:** a shared inbox mechanism where managers claim applications, review materials, and approve/reject new hires (CRR §10).
- **Hire approval decisioning:** manager judgment on probation suitability and contract approval — entirely manual, no rating thresholds or automation (CRR §10).
- **Employment record creation:** once approved, provisioning a new Inactive employee record in Employee Management (CRR §10; EM Module §7).
- **Rejection handling:** capturing and communicating rejection decisions; no re-application mechanics (CRR §10; [OPEN] rework flow — see §26 OPQ-4).

## 4. Out of Scope

**Module boundary (Onboarding / Employee Management / Compliance):**

- **Onboarding** owns **intake workflows, document collection, contract signing, and hire approval decisioning.**
- **Employee Management** owns **resulting employee records and employee state** (identity linkage, core profile fields, lifecycle status, skills).
- **Compliance** owns **policy governance**: retention policy, consent governance, and compliance automation.

Owned by other modules and **referenced, never redefined** here:

- **Worker platform account and authentication** — Authentication module (CRR §2).
- **Employee record creation and employee lifecycle state transitions** — Employee Management module; Onboarding requests state changes that EM executes (CRR §6–§10; EM Module §7).
- **Skills, job titles, and other core employee profile fields** — Employee Management module (EM Module §3).
- **Document storage backend and non-EU work-permit validation logic** — Documents module (CRR §7).
- **Contract template ownership and version control** — Documents/Compliance module (CRR §9).
- **QES provider integration and signature capture** — Contracts module (CRR §9; PDD §5.6).
- **Chatbot user data and GDPR subject-rights exports** — the chatbot is reused for subject-rights requests; Compliance module owns the subject-rights workflow and data provision (CRR §8, §26; [OPEN] event contract — see §26 OPQ-3).
- **Special-category data handling, retention tiers, and policy enforcement** — Compliance module (CRR §25–§27; PDD §5.4, §5.7).
- **Three-tier automatic deletion jobs** — Retention module (CRR §25).
- **Push notification delivery** — Notifications module (CRR §18).
- **Hotel, Hotel Group, and manager records** — Hotels module (CRR §11).

Explicitly excluded from the platform entirely and therefore **never** part of this module:

- Worker-initiated job applications; auto-matching; marketplace workflows.
- Background checks; account lockout; login rate-limiting; CAPTCHA.
- Any process that alters or updates employee records post-hire (that is the responsibility of Employee Management and Compliance).

## 5. Responsibilities

The module is responsible for:

1. **Personalfragebogen capture:** providing a self-service digital form with all confirmed fields, presented during initial signup (CRR §6).
2. **Document collection orchestration:** determining which documents are required based on worker nationality/residency status; requesting them via chatbot and fallback UI (CRR §7, §8).
3. **Chatbot execution:** running an AI-guided conversation with cost controls, caching, token limits, and graceful fallback (CRR §8; PDD §5.6).
4. **Contract presentation:** delivering the employment contract template and coordinating with Contracts module on QES signing (CRR §9).
5. **QES coordination:** requesting Qualified Electronic Signature from the chosen provider (Skribble recommended) and capturing the signed contract (CRR §9; PDD §5.6).
6. **Account activation gate:** blocking account activation until all required documents are uploaded AND contract is signed (CRR §8).
7. **Pool/claim mechanism:** managing a shared inbox of pending applications visible to all Hotel Group managers; supporting claiming, locking, and preventing simultaneous review (CRR §10).
8. **Hire approval:** capturing manager decisions (approve/reject) and probation suitability assessment (CRR §10).
9. **Employee record provisioning:** requesting Employee Management module to create a new Inactive employee record when hire is approved (CRR §10; EM Module §7).
10. **Audit trail:** recording all onboarding steps, documents submitted, contract signature, and approval decisions for compliance and dispute resolution (CRR §26).

## 6. Core Concepts

### 6.1 Personalfragebogen (German New-Hire Form)

**Definition:** A legally required self-service digital form completed by the worker during signup. It captures German identity, tax, banking, and employment-type information required to register the worker with German social-security and tax authorities during the probationary period.

**Confirmed fields** (CRR §6):

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

**Constraints:**

- Self-service only — the worker fills it out themselves; managers do NOT enter it on their behalf (CRR §6).
- Digital form, not PDF upload or paper (CRR §6).
- All fields are mandatory.
- Employment type (Teilzeit vs. Minijob) is stored for information purposes only; it does not trigger system logic or warnings (CRR §6).

**Use:** Data is submitted to German authorities to register the worker during their probationary period (CRR §6).

### 6.2 Document Requirements

**Definition:** Work authorisation documents required from non-EU/EEA/Swiss workers to comply with German employment law.

**Rules** (CRR §7):

- EU/EEA/Swiss citizens do NOT require work-permit documents (explicitly confirmed).
- Non-EU workers MUST upload work-permit / residence documents.
- Work-permit requirements are a **mandatory legal obligation** separate from the (rejected) background-check process.
- Document validation is owned by the Documents module; Onboarding orchestrates the collection workflow.

**Chatbot coordination:** The document-collection chatbot (§6.3) queries workers for documents and resubmits missing ones until the requirement is met.

### 6.3 Document Collection Chatbot

**Definition:** An AI agent that guides workers through document collection during signup, asking for missing documents until all requirements are satisfied.

**Specifications** (CRR §8; PDD §5.6):

- **Provider:** Claude API (not a static wizard; an AI agent).
- **Model:** Claude Haiku (cheapest tier) recommended.
- **Behavior:**
  - Asks workers which documents they have.
  - If documents are incomplete, asks again for missing ones.
  - Loops until all required documents are uploaded OR the worker gives up.
- **Cost controls (mandatory):**
  - Hard monthly token budget cap, stored in configuration.
  - Per-conversation token limit.
  - Cached required-document list to reduce repeated API calls.
  - Graceful fallback to a static checklist UI if token limits are exceeded.
- **Secondary use:** The same agent is reused for GDPR subject-rights requests (owned by Compliance module) (CRR §8, §26).
- **Conversation state:** [OPEN] whether conversation history is persisted for the worker, or discarded after onboarding completion (see §26 OPQ-3).

### 6.4 Employment Contract & QES

**Definition:** A fixed-term employment contract signed with Qualified Electronic Signature (QES), establishing a legally binding employment relationship.

**Specifications** (CRR §9; PDD §5.6):

- The contract is the **same document** used at signup and after probation (one document, not two). If differences are needed in future, they are introduced later through a separate process.
- Contract is shown to the worker so they can review and sign.
- Signature method: **Qualified Electronic Signature (QES)**, not simple e-signature.
- **Why QES is mandatory:** Fixed-term employment contracts in Germany (§14(4) TzBfG) **require QES** to establish the fixed term; a simple e-signature would invalidate the fixed-term clause.
- **QES provider:** Skribble recommended (native QES, EU/German hosting, API-embeddable); alternatives: Yousign, sproof.
- **Contract ownership:** Contract template and versioning are owned by the Contracts/Compliance module; Onboarding coordinates signature capture.
- **Account activation gate:** The account does NOT activate until the contract is signed (CRR §8).

**Open questions** (CRR §9):

- [OPEN] **Probation legal shape:** fixed-term trial contract vs. permanent contract with probation clause. This determines whether QES is mandatory from day one. Client: "to be answered later" (OPQ-6).
- [OPEN] **Contract expiry/renewal length:** client confirmed the contract WILL expire but the duration is "will tell you later" (OPQ-7).

### 6.5 Pool/Claim Hiring Mechanism

**Definition:** A shared-inbox workflow where completed applications appear for all Hotel Group managers; the first manager to open it "claims" it, preventing duplicate simultaneous review.

**Specifications** (CRR §10):

- **Visibility:** Completed applications (Personalfragebogen + documents + contract signed) appear in a shared inbox visible to **all managers in the Hotel Group**.
- **Claiming:** The first manager to open an application "claims" it; it locks to that manager.
- **Locked view:** Other managers see "Under review by [manager name]" and cannot claim the same application.
- **Actions:** The claiming manager approves or rejects.
- **No simultaneous review:** The lock prevents two managers from reviewing the same application at the same time.

### 6.6 Hire Approval Decision

**Definition:** A manager's judgment decision on whether to approve or reject a new hire.

**Specifications** (CRR §10):

- **Suitability assessment:** The manager marks a worker as "suitable" (approve) or rejects them.
- **Probation judgment:** entirely manual manager judgment — no system timer, no rating-threshold automation, no probation clock.
- **Scope of review:** Manager has full access to the Personalfragebogen, uploaded documents, and signed contract.
- **No re-application:** [OPEN] how rejected applicants are handled; whether they can reapply (see §26 OPQ-4).

## 7. Onboarding Lifecycle

The onboarding lifecycle progresses through the following states:

1. **Signup initiated** — Worker creates platform account and enters signup flow.
2. **Personalfragebogen in progress** — Worker fills out the form.
3. **Personalfragebogen completed** — Form submitted.
4. **Document collection in progress** — Chatbot guides worker through required documents.
5. **Documents collected** — All required documents uploaded (or worker exempted due to EU status).
6. **Contract presented** — Contract template shown to worker.
7. **Contract signed** — Worker has signed contract via QES; account is now activated.
8. **Awaiting manager review** — Application appears in pool for manager claiming.
9. **Under manager review** — Manager has claimed the application and is reviewing.
10. **Approved** — Manager approves; Employee Management module is requested to create Inactive employee record.
11. **Rejected** — Manager rejects; worker is notified; application is archived.
12. **Employee record created (Inactive)** — EM module confirms creation; onboarding is complete. Employee awaits HR administrative activation (probation end + EM module §8.2).

**Account activation gate:** States 1–7 result in an activated platform account. Account is **blocked** until state 7 is reached (CRR §8).

## 8. State Transitions

Valid transitions:

```
Signup initiated → Personalfragebogen in progress
Personalfragebogen in progress → Personalfragebogen completed
Personalfragebogen completed → Document collection in progress
Document collection in progress → Documents collected
Documents collected → Contract presented
Contract presented → Contract signed
Contract signed → Awaiting manager review
Awaiting manager review → Under manager review
Under manager review → Approved → Employee record created (Inactive)
Under manager review → Rejected
```

**No backwards transitions:** once a state is left, it cannot be re-entered within the same application.

**Rejection final:** Rejected applications do not re-enter the flow; workers must re-signup to try again (or follow [OPEN] rework rules — OPQ-4).

## 9. Permissions & Authorization

**Personalfragebogen & document upload:** Only the applicant (the worker themselves) can fill out the form and upload documents (CRR §6).

**Pool/claim review:** Only **Hotel Group managers** can access the pool and claim applications. Specifically:

- Hotel Manager: Can claim and review applications for employees they will manage.
- Regional Manager: Can claim and review applications for any hotel in their Hotel Group.
- Admin: Can claim and review applications across the system.
- Staff (Worker) and Checker: No access to the pool.

**Approval decision:** Only the manager who claimed the application can approve or reject it (lock prevents others from interfering).

## 10. Events Produced

Onboarding produces the following events for consumption by other modules:

1. **`OnboardingStarted`** — Worker has initiated signup.
   - Payload: Worker ID, timestamp.
   - Consumers: Analytics, Audit.

2. **`PersonalfragebogenSubmitted`** — Worker has completed and submitted the form.
   - Payload: Worker ID, form data (structure [OPEN]).
   - Consumers: Audit, Compliance (for data-protection audit).

3. **`DocumentsCollected`** — All required documents have been uploaded (or worker is EU/EEA/Swiss exempt).
   - Payload: Worker ID, document list, exemption status if applicable.
   - Consumers: Audit, Documents module (for validation).

4. **`ContractSigned`** — Worker has signed the contract via QES.
   - Payload: Worker ID, contract signature timestamp, QES provider reference.
   - Consumers: Audit, Contracts module.

5. **`ApplicationReadyForReview`** — Completed application (Personalfragebogen + documents + contract signed) is now in the pool.
   - Payload: Application ID, Worker ID.
   - Consumers: Notifications (manager notification), Pool/Claim system.

6. **`ApplicationClaimed`** — Manager has claimed the application for review.
   - Payload: Application ID, Manager ID.
   - Consumers: Audit, other managers in the pool (for "Under review" status).

7. **`HireApproved`** — Manager has approved the hire.
   - Payload: Application ID, Worker ID, Manager ID, approval timestamp.
   - Consumers: Employee Management module (request to create Inactive employee record), Notifications (worker notification).

8. **`HireRejected`** — Manager has rejected the hire.
   - Payload: Application ID, Worker ID, Manager ID, rejection reason (optional), timestamp.
   - Consumers: Notifications (worker notification), Audit.

**Event contract** [OPEN]: Whether events are transactional (exactly-once) or best-effort; retry/idempotency semantics (see §26 OPQ-3).

## 11. Events Consumed

Onboarding consumes events from other modules:

1. **`EmployeeRecordCreated`** (from Employee Management) — Confirms that an Inactive employee record has been provisioned for an approved hire.
   - Expected after Onboarding publishes `HireApproved`.
   - Action: Mark onboarding as complete; send final confirmation to worker and manager.

**[OPEN] Document validation events** (from Documents module) — whether Documents module publishes validation status (CRR §7; coordination required — see §26 OPQ-2).

## 12. Security

**Data classification:** Personalfragebogen and document data are **sensitive** — subject to special-category protection under GDPR (§27).

**Transmission:**
- Document uploads: HTTPS with TLS 1.2 or higher.
- Chatbot conversations: encrypted end-to-end between worker and Claude API (via HTTPS).

**Chatbot input validation:** Worker input is validated to reject:
- SQL injection attempts.
- Script injection / XSS attempts.
- File-type uploads outside the expected set (chatbot should only accept document uploads, not executable files).

**Contract signing:** QES signature is captured by the QES provider; Onboarding stores only the provider reference and signature timestamp, not signature material itself (that is owned by Contracts module).

**Manager access control:** Pool/claim interface requires Hotel Manager role or above. The pool is scoped to the manager's Hotel Group (Hotel Manager sees only their hotel; Regional Manager sees all hotels in their group).

**Session security:** When manager reviews a claimed application, session timeout rules apply per CRR §2 (auto-logout after 7 days; MFA for managers).

## 13. GDPR & Data Protection

**Personalfragebogen fields:** All Personalfragebogen fields are classified as **special-category data** (or closely adjacent) due to:

- Nationality, place of birth, date of birth: identity markers.
- Tax ID, Social Security Number: quasi-identifiers.
- Bank account (IBAN, account holder): financial special-category (not GDPR special-category per se, but financial data).
- Health insurance provider: implies health status / special-category proximity.
- Konfession (religion): explicitly special-category (only if collected — confirm if included in §6.1 fields; not listed but flagged in CRR §27).

**Retention:** Personalfragebogen data falls under **Tier 2 (Payroll-adjacent): 6 years** per German tax/payroll retention law (§41 EStG / §257 HGB / §147 AO) (CRR §25; [OPEN] tax-advisor sign-off — OPQ-1).

**Subject-rights:** Workers can request data export via button or chatbot (§6.3); Compliance module owns fulfilment, coordinating with Onboarding to retrieve Personalfragebogen and documents (CRR §26).

**Document storage:** Documents are stored by the Documents module; Onboarding maintains only references to them. Documents follow CRR §25 retention tiers.

**Contract:** Signed contract (with QES reference) is owned by Contracts module; Onboarding maintains only a reference.

**Audit trail:** All Onboarding actions (form submission, document upload, claiming, approval/rejection) are logged for audit and dispute resolution (CRR §26).

## 14. Audit & Compliance

Every Onboarding action produces an audit log entry:

- Worker signup initiated (timestamp, device/IP [OPEN]).
- Personalfragebogen submitted (timestamp, field-by-field changes [OPEN]).
- Each document uploaded (timestamp, document type, file hash [OPEN]).
- Chatbot conversation started/ended (timestamp, [OPEN] conversation transcript retention).
- Contract presented (timestamp).
- Contract signed (timestamp, QES provider, signature reference).
- Application entered pool (timestamp).
- Application claimed by manager (timestamp, manager ID).
- Application approved (timestamp, manager ID, decision narrative [OPEN]).
- Application rejected (timestamp, manager ID, rejection reason).

**Audit access:** Audit logs are accessible to Admin and Regional Manager (scoped to their Hotel Group). [OPEN] whether Checkers have access.

**Audit retention:** Logs are retained for dispute and legal-compliance purposes; classified under CRR §25 **Tier 2 (5 years)**.

## 15. Validation & Error Handling

### 15.1 Personalfragebogen Validation

- **Mandatory fields:** All fields in §6.1 are mandatory; form cannot be submitted with missing fields.
- **Field formats:**
  - Date of birth: valid date, worker is 18+ years old [OPEN] (verify statutory minimum).
  - IBAN: valid IBAN format (ISO 13616).
  - Tax ID: valid German tax-ID format.
  - Social Security Number: valid format (CRR §6).
  - Nationality: must match a list of valid country codes.
- **Error presentation:** On validation failure, user is shown which field failed and is asked to correct it.

### 15.2 Document Validation

- **Document type:** Chatbot specifies which document types it will accept (e.g., PDF, JPG); system rejects unsupported types.
- **File size:** [OPEN] maximum file size per document.
- **Non-EU status validation:** System determines work-permit-requirement status by:
  - Comparing Nationality field from Personalfragebogen against EU/EEA/Swiss country list.
  - No manual override; rule is deterministic.
- **Missing documents:** If required documents are missing, chatbot re-prompts; account cannot activate (§7, gate).

### 15.3 Contract Signing Validation

- **Contract loaded:** Worker can load contract and review it.
- **Signature request:** Worker initiates signature request; QES provider integration is triggered.
- **Signature completion:** QES provider confirms signature completion (or failure); Onboarding records outcome.
- **Missing contract:** If worker declines to sign, account remains inactive; application does not proceed to pool.

### 15.4 Pool/Claim Validation

- **Application completeness:** Manager can only claim applications where Personalfragebogen + documents + contract are all marked complete.
- **Incomplete applications:** Applications missing any component do NOT appear in the pool (remain in "Document collection" or earlier state).
- **Double-claim prevention:** Lock mechanism prevents second manager from claiming an already-claimed application (database-level constraint).

### 15.5 Approval Decision Validation

- **Decision required:** Manager must select either "Approve" or "Reject"; cannot claim without deciding.
- **Approval triggers:** Once approved, Employee Management module is called to create Inactive employee record.
- **Rejection captures:** Rejection reason is optional but recommended for documentation; rejection is final (no re-entry unless worker re-signups).

## 16. Error Scenarios & Recovery

### 16.1 Chatbot Token Limit Exceeded

**Scenario:** Worker is in document-collection chatbot; token budget for the conversation is exceeded.

**Behavior:** Chatbot gracefully falls back to a **static checklist UI** listing all required documents, with manual upload. Worker continues with fallback UI until documents are complete.

**Recovery:** No error message shown; seamless transition to fallback.

### 16.2 QES Provider Unavailable

**Scenario:** Worker attempts to sign contract; QES provider (Skribble, etc.) is temporarily down.

**Behavior:**
- User is shown "Signature service temporarily unavailable; please try again in a moment."
- Onboarding retains contract-signing state; worker can retry within [OPEN] retry window (OPQ-8).
- Account remains inactive until signature succeeds.

**Recovery:** [OPEN] Whether system automatically retries, or user must manually retry (OPQ-8).

### 16.3 Manager Claims, Then Logs Out

**Scenario:** Manager claims an application; session times out; manager never approves/rejects.

**Behavior:** [OPEN] Whether claim automatically expires after [OPEN] duration (e.g., 24 hours), releasing the application back to the pool (OPQ-9).

**Recovery:** [OPEN] claim-expiry policy and notification (OPQ-9).

### 16.4 Duplicate Signup Attempt

**Scenario:** Worker tries to sign up a second time with the same email/identity.

**Behavior:** Platform rejects as duplicate account (Authentication module concern); user is directed to log in if they already have an account.

**Recovery:** Worker logs in to existing account; if onboarding was incomplete, they resume from the last step (or restart per [OPEN] OPQ-5).

### 16.5 Network Failure During Personalfragebogen Submission

**Scenario:** Worker fills out form; network fails during submission.

**Behavior:** [OPEN] whether form is persisted (partial save) or lost (OPQ-5).

**Recovery:** [OPEN] retry/resume behavior (OPQ-5).

## 17. Edge Cases

### 17.1 EU/EEA/Swiss Citizen (No Work Permit Required)

A worker with Nationality = Austria, Poland, etc., skips the work-permit document requirement. Chatbot correctly recognizes this and does NOT request work-permit documents (CRR §7).

### 17.2 Personalfragebogen Data Mismatch

Worker fills Personalfragebogen with Name = "Max Müller" but later uploads an ID showing Name = "Maxim Mueller". [OPEN] Whether system flags discrepancy or accepts both (OPQ-11).

### 17.3 Manager Approves, Employee Management Rejects

[Hypothetical] Manager approves the hire; Employee Management module receives `HireApproved` event but rejects employee creation (e.g., duplicate employee ID). 

**Behavior:** [OPEN] escalation and resolution path (OPQ-12).

### 17.4 Worker Declines Consent During Onboarding

Onboarding may contain a GDPR consent gate (e.g., data-processing consent for chatbot). [OPEN] Whether declining blocks onboarding or is optional (OPQ-3).

## 18. Dependencies

**Module dependencies** (modules Onboarding consumes):

1. **Authentication:** Login, account creation, password reset, MFA (CRR §2).
2. **Employee Management:** Creates Inactive employee records upon hire approval; confirms employee creation (CRR §10; EM Module §7).
3. **Documents:** Stores uploaded documents; validates non-EU work-permit requirements (CRR §7).
4. **Contracts:** Manages contract template, versioning, and storage (CRR §9).
5. **Compliance:** Owns data retention, consent governance, and special-category handling; Onboarding defers to it (CRR §25–§27).
6. **Hotels:** Hotel Group context for pool/claim scope (managers see applications for their Hotel Group) (CRR §11).
7. **Claude API:** Powers the document-collection chatbot and subject-rights agent (CRR §8; PDD §5.6).
8. **QES Provider (Skribble/Yousign/sproof):** Signs contracts on worker's behalf (CRR §9; PDD §5.6).
9. **Notifications:** Sends notifications to managers and workers (application ready, approval, rejection) (CRR §18).

**Outbound dependencies** (modules that consume Onboarding):

1. **Employee Management:** Consumes `HireApproved` event; creates Inactive employee; publishes `EmployeeRecordCreated` (CRR §10; EM Module §7).
2. **Audit/Compliance:** Consumes all onboarding events for audit and legal compliance.
3. **Analytics:** Consumes `OnboardingStarted`, `HireApproved`, `HireRejected` for hiring metrics.

## 19. Future Extensibility

**Planned** (may be added in subsequent phases, out of scope for v1):

- Re-application after rejection (decide policy: auto-allow, manager-initiated, or disallowed).
- Bulk import of onboarding candidates (CSV upload of pre-filled forms, then individual signing).
- Approval workflow escalation (e.g., require Regional Manager sign-off for first hires).
- Probation clock and auto-graduation (currently entirely manual).
- Nationality/residency change during employment (currently one-time at signup).

**Not planned** (explicitly excluded):

- Background-check integration (CRR §3).
- Multiple contract templates per employee.
- Renegotiation or amendment workflows mid-employment (only possible after onboarding).

## 20. Open Questions

The following genuine unknowns are unresolved and will block final implementation. All are confirmed as genuine gaps, not placeholders.

**OPQ-1: Tax-advisor sign-off on 6-year retention tier** [ACTION]
- 6-year retention for payroll-adjacent data is based on German tax law; should be validated by client's tax advisor before final lock-in.
- Owner: Client's tax advisor.
- Status: Pending.

**OPQ-2: Document validation event contract** [DESIGN]
- Should Documents module publish validation-status events (e.g., "Document is valid work permit"), or is synchronous API-call validation sufficient?
- Impacts: Chatbot knows when to stop requesting documents.

**OPQ-3: Chatbot conversation persistence & consent**
- Are chatbot conversations (with worker) persisted for future reference / subject-rights export, or discarded after onboarding?
- Does engaging the chatbot require explicit data-processing consent?
- Impacts: Compliance/audit trail; GDPR subject-rights scope.

**OPQ-4: Rejected applicant re-application**
- Can a rejected applicant re-apply immediately, or is there a cooldown?
- Is rejection permanent (worker must contact HR to appeal), or can rejection be overturned?
- Impacts: Worker UX; HR process definition.

**OPQ-5: Form persistence during network failure**
- If worker fills Personalfragebogen and network fails before submission, is the form auto-saved?
- Can worker resume from where they left off?
- Impacts: Worker UX; data-loss prevention.

**OPQ-6: Probation legal shape (fixed-term trial vs. permanent with clause)**
- Determines whether QES is mandatory from day one.
- Also impacts Employee Management §9.2 probation-state definition.
- Impacts: Contract design; signature requirement; legal compliance.

**OPQ-7: Contract expiry/renewal length**
- Client confirmed contracts expire; duration not yet specified.
- Impacts: Employment record design; lifecycle auto-graduation; contract-renewal workflow.

**OPQ-8: QES provider retry policy**
- On provider timeout, does system auto-retry, or does user manually retry?
- Retry window / backoff strategy?
- Impacts: User UX; error handling.

**OPQ-9: Manager-claimed application expiry**
- If manager claims an application but never approves/rejects, does the claim auto-release after a duration?
- Auto-release duration?
- Notification to manager before auto-release?
- Impacts: Pool/claim fairness; fallback paths.

**OPQ-10: Personalfragebogen submission persistence (sync vs. async)**
- Are form submissions stored synchronously (immediate acknowledgment), or asynchronously (queue-based)?
- If async, how long is the worker informed of submission status?
- Impacts: Worker UX; confirmation messaging.

**OPQ-11: Personalfragebogen vs. ID document mismatch**
- If worker fills "Max Müller" but ID shows "Maxim Mueller", does system flag as discrepancy or accept both variants?
- Is fuzzy-matching applied (Soundex, Levenshtein)?
- Manual review flag?
- Impacts: Data quality; manager review burden.

**OPQ-12: Employee Management record-creation failure**
- Manager approves hire; Employee Management module fails to create employee record (e.g., duplicate employee ID).
- What is the recovery path? Does Onboarding mark as "Pending Employee Creation" and retry?
- Is manager / worker notified of the failure?
- Impacts: Data consistency; error handling.

## 21. Refactoring Summary

**Status:** This is the first foundational Onboarding module specification. No prior specification exists to refactor.

**Design decisions:**

- **Self-service Personalfragebogen only:** Worker fills form themselves; no manager entry or PDF-upload-after-the-fact.
- **Chatbot with cost controls:** AI-guided document collection with hard budget caps and fallback.
- **QES mandatory:** Contract is legally binding only with Qualified Electronic Signature.
- **Pool/claim mechanism:** Prevents duplicate simultaneous review; simple, auditable, no auto-assignment logic.
- **Manual approval, no automation:** Probation suitability is purely manager judgment; no rating thresholds or system gates.
- **No re-application logic:** Rejected workers must explicitly re-signup (may be relaxed in future phases).

**Relationship to Employee Management module:**

Onboarding **feeds into** Employee Management via the `HireApproved` → `EmployeeRecordCreated` flow (EM Module §7). Onboarding does NOT duplicate EM responsibilities:

- EM owns employee records, lifecycle states, and field definitions.
- Onboarding owns intake, documents, contract, and hire-approval decisioning.

No circular dependency; flow is unidirectional.

---

## Index of Cross-Module References

| Module | Reference | Reason |
|--------|-----------|--------|
| Employee Management | §10 (hire approval creates employee) | Onboarding requests EM to create Inactive employee record |
| Documents | §7 (work-permit requirement) | Documents module owns document storage and validation |
| Contracts | §9 (contract template, QES signing) | Contracts module owns contract versioning and signature |
| Compliance | §13–14, §25–27 (GDPR, audit, retention) | Compliance owns retention policy, consent, special-category handling |
| Authentication | §9, §5 (login, MFA for managers) | Auth module owns account creation and session management |
| Hotels | §5, §9, §10 (Hotel Group scope) | Hotels module owns Hotel and Hotel Group records |
| Notifications | §10 (notifications to managers/workers) | Notifications module owns push delivery |
| Claude API | §6.3 (chatbot) | Zirove integrates Claude API for document-collection agent |
| QES Provider | §9 (contract signing) | Skribble (or alternative) provides Qualified Electronic Signature |

---

**Document version:** 1.0  
**Last updated:** 2026-07-01  
**Authority:** CONFIRMED_REQUIREMENTS_REGISTER.md, PIVOT_DESIGN_DOCUMENT.md  
**Status:** Foundational specification — ready for downstream module specifications to reference as authority on Onboarding boundary.
