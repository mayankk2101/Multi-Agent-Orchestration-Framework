# Hotel CRM - Documentation Action Plan

**Status**: Ready to Execute  
**Effort**: 4-6 hours  
**Timeline**: This week

---

## The Problem in 30 Seconds

✅ **Good News**: MASTER_ARCHITECTURE_v2.0 is excellent, comprehensive, up-to-date.

❌ **Problem**: 5 specification documents it references don't exist in the repo:
- `API_STANDARDS.md` — Referenced by developers, missing
- `RBAC_PERMISSION_MATRIX.md` — Security critical, missing
- `DATABASE_RELATIONSHIP_DIAGRAM.md` — Missing
- `EVENT_FLOW_MAPPING.md` — Missing
- `IMPLEMENTATION_PROCESS.md` — Created in Google Drive but not in repo

Result: Developers hit "file not found" when trying to understand standards.

---

## Priority 1: CREATE MISSING FILES (2-3 hours)

### Task 1.1: Create `docs/API_STANDARDS.md`
**Source**: Extract from MASTER_ARCHITECTURE_v2.0 Section 16 (API Security)

**Include**:
```markdown
# API Standards

## Response Format (Success)
- status: "success" | "error"
- data: { ... }
- meta: { timestamp, request_id }

## Error Format
- status: "error"
- error: { code, message, details }
- meta: { timestamp, request_id }

## Required Practices
- Zod validation on all endpoints
- JWT auth: Authorization Bearer header
- RBAC permission checks
- Rate limiting: 100 req/min per IP
- CORS: Restrict to known domains
- Helmet.js security headers

## Endpoints by Module
[List all endpoints with auth/permission requirements]
```

**Effort**: 1 hour  
**Blocker**: Will unblock API implementation

---

### Task 1.2: Create `docs/RBAC_PERMISSION_MATRIX.md`
**Source**: Extract from MASTER_ARCHITECTURE_v2.0 Section 14

**Include**:
```markdown
# RBAC & Permissions

## Roles
- **Worker**: Can view own tasks, complete tasks, upload photos, view own rating
- **Checker**: Can view tasks to verify, submit quality scores, rate workers
- **Manager**: Can create tasks, assign workers, view hotel data, manage HR
- **Admin**: Can manage all hotels, all users, system settings

## Permission Matrix
| Endpoint | Worker | Checker | Manager | Admin |
|----------|--------|---------|---------|-------|
| GET /hotels | ❌ | ❌ | ✅ (own) | ✅ |
| POST /tasks | ❌ | ❌ | ✅ | ✅ |
| PUT /tasks/:id/complete | ✅ (own) | ❌ | ✅ | ✅ |
| ...more | | | | |

## Hotel Scoping
- Workers see only their hotel's tasks
- Managers see only their assigned hotels
- Admin sees all hotels
```

**Effort**: 1 hour  
**Blocker**: Will unblock permission middleware implementation

---

### Task 1.3: Create `docs/DATABASE_RELATIONSHIP_DIAGRAM.md`
**Source**: Derive from backend/prisma/schema.prisma + MASTER_ARCHITECTURE_v2.0 Section 7

**Include**:
```markdown
# Database Schema

## Overview
23 tables across 7 modules:
- Auth (2): users, sessions
- CRM (5): hotels, rooms, tasks, task_photos, daily_operations
- Quality (3): quality_verification, ratings, worker_overall_rating
- HR (7): contracts, contract_templates, required_documents, worker_documents, payroll, payroll_line_items, data_retention_log
- Staffing (3): work_requests, worker_assignments, daily_operations
- Notifications (1): notifications
- Compliance (2): audit_log, consent_log

## ER Diagram

\`\`\`
users ──┐
        ├── contracts
        ├── work_assignments
        ├── tasks
        ├── ratings
        └── notifications
        
hotels ──┐
         ├── rooms
         ├── work_requests
         ├── tasks
         └── daily_operations

tasks ──┐
        ├── task_photos
        └── quality_verification
        
payroll ── payroll_line_items
\`\`\`

## Table Details
[Include 23 table definitions with column details]
```

**Effort**: 1.5 hours  
**Blocker**: Will unblock database implementation

---

### Task 1.4: Create `docs/EVENT_FLOW_MAPPING.md`
**Source**: Derive from requirements + MASTER_ARCHITECTURE_v2.0

**Include**:
```markdown
# Event Flows & Workflows

## 1. Task Creation Flow
User: Manager
1. Manager creates task (POST /tasks)
2. System validates inputs, saves to database
3. System triggers TASK_CREATED event
4. Notification service sends:
   - In-app notification to assigned worker
   - Push notification (APNs/FCM)
   - Email notification

## 2. Worker Assignment Flow
1. Manager creates work request
2. Manager selects available workers
3. System assigns workers (1 active assignment per worker)
4. WORKER_ASSIGNED event triggered
5. Notifications sent to selected workers

## 3. Quality Verification Flow
1. Worker completes task
2. Checker verifies completion + rates (0-100)
3. QUALITY_VERIFIED event triggered
4. Rating aggregated to leaderboard
5. RATING_RECEIVED notification to worker

## 4. GDPR Data Request Flow
1. Worker requests data export
2. System generates ZIP with all records
3. Email link sent (24-hour expiry)
4. Data deletion requests processed
5. Auto-deletion after retention period

[Continue for all major flows]
```

**Effort**: 1 hour  
**Blocker**: Will unblock notification and workflow implementation

---

### Task 1.5: Download & Commit `IMPLEMENTATION_PROCESS.md`
**Source**: Google Drive (IMPLEMENTATION_PROCESS_v1.0.md)

**Steps**:
1. Download from Google Drive
2. Save to repo root as `docs/IMPLEMENTATION_PROCESS.md`
3. Commit with message: "docs: add implementation process from Google Drive"

**Effort**: 0.5 hour  
**Blocker**: Will unblock timeline clarity

---

## Priority 2: UPDATE BROKEN REFERENCES (1-2 hours)

### Task 2.1: Update `backend/README.md`
**Changes**:
```diff
- See [../API_STANDARDS.md](../API_STANDARDS.md)
+ See [../docs/API_STANDARDS.md](../docs/API_STANDARDS.md)

- See `RBAC_PERMISSION_MATRIX.md` in `/docs/`
+ See [../docs/RBAC_PERMISSION_MATRIX.md](../docs/RBAC_PERMISSION_MATRIX.md)

+ See [../docs/DATABASE_RELATIONSHIP_DIAGRAM.md](../docs/DATABASE_RELATIONSHIP_DIAGRAM.md) for schema
```

**Effort**: 0.5 hour

---

### Task 2.2: Update Root `README.md`
**Changes**:
Add at top:
```markdown
## 📋 Documentation

**START HERE**: [MASTER_ARCHITECTURE.md](docs/MASTER_ARCHITECTURE.md) — System design, timeline, scope

Key references:
- [API Standards](docs/API_STANDARDS.md) — Endpoint contract
- [RBAC Matrix](docs/RBAC_PERMISSION_MATRIX.md) — Who can do what
- [Database Schema](docs/DATABASE_RELATIONSHIP_DIAGRAM.md) — Table relationships
- [Event Flows](docs/EVENT_FLOW_MAPPING.md) — User workflows
```

**Effort**: 0.5 hour

---

### Task 2.3: Create `_legacy/README.md`
**Content**:
```markdown
# Legacy Code Archive

This directory contains code from previous architecture iterations.

## Contents
- `backend-microservices/` — Old microservice implementation (pre-Phase 1)
- `docker/` — Old Docker configs
- `k8s/` — Kubernetes configs (for Phase 3+)
- `reports/` — Archived analysis documents

## Status
✅ **ARCHIVED** — Not used in current Phase 1.

## DO NOT
- ❌ Merge code from here
- ❌ Copy old patterns
- ❌ Reference for new features

## Delete After
- Phase 1 launch + 6 months
- Keep in git history for reference
```

**Effort**: 0.25 hour

---

## Priority 3: CLARIFY AMBIGUITIES (1-2 hours)

### Task 3.1: Clarify Mobile App Architecture
**Issue**: MASTER_ARCHITECTURE says "ONE app" but folder structure shows two separate apps

**Action**: Add note to `README.md`:
```markdown
## Mobile App Architecture

**Decision**: Single React Native app with role-based UI (worker/checker)
**Current Status**: Currently separate apps, should be unified during Phase 1
**Timeline**: Refactor to single app in Week 1 of implementation
**See**: [MASTER_ARCHITECTURE.md](docs/MASTER_ARCHITECTURE.md) Section 9
```

**Effort**: 0.25 hour

---

### Task 3.2: Clarify Timeline Change
**Issue**: Some old docs say "4 weeks", new docs say "6-8 weeks"

**Action**: Update root `README.md`:
```markdown
## Timeline
- **Phase 1 (MVP)**: 6-8 weeks (updated May 27, 2026)
  - Week 4: Tier 1 (Demo-ready)
  - Weeks 6-8: Tier 2 (Production-ready)
- **Previous estimate**: 4 weeks (updated to be more realistic)
```

**Effort**: 0.25 hour

---

## Git Workflow

### Commit 1: Create specifications
```bash
git add docs/API_STANDARDS.md
git add docs/RBAC_PERMISSION_MATRIX.md
git add docs/DATABASE_RELATIONSHIP_DIAGRAM.md
git add docs/EVENT_FLOW_MAPPING.md
git add docs/IMPLEMENTATION_PROCESS.md
git commit -m "docs: create specification documents extracted from MASTER_ARCHITECTURE_v2.0"
```

### Commit 2: Fix references
```bash
git add README.md backend/README.md _legacy/README.md
git commit -m "docs: update README files with correct references and clarifications"
```

---

## Success Checklist

After implementing this plan, verify:

- [ ] ✅ `docs/API_STANDARDS.md` exists with response/error formats
- [ ] ✅ `docs/RBAC_PERMISSION_MATRIX.md` exists with role matrix
- [ ] ✅ `docs/DATABASE_RELATIONSHIP_DIAGRAM.md` exists with ER diagram
- [ ] ✅ `docs/EVENT_FLOW_MAPPING.md` exists with user workflows
- [ ] ✅ `docs/IMPLEMENTATION_PROCESS.md` exists (downloaded from Drive)
- [ ] ✅ `README.md` links to all specification documents
- [ ] ✅ `backend/README.md` has no broken file references
- [ ] ✅ `_legacy/README.md` explains archived code
- [ ] ✅ No developer should hit "file not found" when reading docs

---

## Time Estimate

| Task | Time | Status |
|------|------|--------|
| Create API_STANDARDS.md | 1.0h | — |
| Create RBAC_PERMISSION_MATRIX.md | 1.0h | — |
| Create DATABASE_RELATIONSHIP_DIAGRAM.md | 1.5h | — |
| Create EVENT_FLOW_MAPPING.md | 1.0h | — |
| Download IMPLEMENTATION_PROCESS.md | 0.5h | — |
| Update README files | 1.5h | — |
| Create _legacy/README.md | 0.25h | — |
| Clarify ambiguities | 0.5h | — |
| **TOTAL** | **~7.25h** | — |

**Realistic timeline**: 4-6 hours (some tasks have overlap)

---

## Next Steps

1. **Assign owner**: Who will create the 5 specification documents?
2. **Create docs/**: Ensure the `docs/` folder exists
3. **Schedule work**: 2-3 hour blocks (focus time needed)
4. **Review**: Have Mayank/Ritik review new docs before committing
5. **Merge**: Create single PR with all changes
6. **Verify**: Check that developers can find what they need

---

## Questions?

If any of these documents are unclear or missing content:
1. Check MASTER_ARCHITECTURE_v2.0 for the source material
2. Ask Mayank (architecture) or Ritik (process) for clarification
3. Reference the full audit report: [DOCUMENTATION_AUDIT_REPORT.md](DOCUMENTATION_AUDIT_REPORT.md)

---

**Owner**: [Assign to team member]  
**Due**: End of week  
**Status**: Ready to start
