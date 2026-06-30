# Architecture Consolidation Execution Plan

Status: Planning only. No code changes, no merges, no conflict resolution in this document.

Scope: Defines the merge order, dependencies, expected conflicts, conflict-resolution strategy, document disposition (main vs archive), authority hierarchy, and the four freeze packages (MVP architecture, implementation, testing, deployment) for consolidating the eight architecture branches/artifacts into `main`.

Note on missing references: `CANONICAL_ARCHITECTURE_INDEX.md` and `GOVERNANCE_RECONSTRUCTION_REPORT.md` were specified as inputs but are not present in the working tree. This plan is derived from the documents physically present in the repo (`MARKETPLACE_REFACTOR_MASTER_PLAN.md`, `TESTING_MASTER_PLAN*.md`, `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN*.md`, `MOBILE_MIGRATION_PLAN_SINGLE_APP.md`, `DOCUMENTATION_ACTION_PLAN.md`, `DOCUMENTATION_AUDIT_REPORT.md`) plus the eight named artifacts. If the two missing index documents are recovered, Section 7 (Authority Hierarchy) and Section 4 (Document Disposition) must be reconciled against them before execution.

---

## 1. Dependency Graph

Layered, bottom-up. Lower layers have no upstream dependencies among the eight; higher layers consume the contracts frozen below.

```
Layer 0 — Domain Model
    PRISMA_SCHEMA_V2_FREEZE           (data contract; source of truth for entities)

Layer 1 — Domain Logic
    WORKREQUEST_FINAL_ARCHITECTURE    (depends on: Prisma v2)
    MARKETPLACE_REFACTOR_MASTER_PLAN  (depends on: Prisma v2, WorkRequest)

Layer 2 — Interface Contract
    API_SPEC_V1_PATCH_V2              (depends on: Prisma v2, WorkRequest, Marketplace)

Layer 3 — Implementation
    BACKEND_EXECUTION_BLUEPRINT_V2    (depends on: Prisma v2, WorkRequest, Marketplace, API Spec)
    MOBILE_PRODUCT_BLUEPRINT          (depends on: API Spec, WorkRequest, Marketplace)

Layer 4 — Verification & Delivery
    TESTING_MASTER_PLAN_FREEZE        (depends on: all of L0–L3)
    INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2
                                      (depends on: Backend Blueprint, API Spec, Testing)
```

Cross-edges:

| Consumer | Consumes from | Reason |
|---|---|---|
| WorkRequest | Prisma v2 | Entity shape, state enums, FK contracts |
| Marketplace | Prisma v2, WorkRequest | Listing/bid/award models, WR state machine |
| API Spec v1 P2 | Prisma v2, WorkRequest, Marketplace | DTOs, endpoint surface, authz boundaries |
| Backend Blueprint v2 | API Spec, WorkRequest, Marketplace, Prisma v2 | Module layout, service boundaries, migrations |
| Mobile Blueprint | API Spec, WorkRequest, Marketplace | Client contracts, offline/sync model |
| Testing Plan Freeze | All above | Coverage matrix, contract tests, E2E flows |
| Infra/Deploy P2 | Backend Blueprint, API Spec, Testing | Env topology, CI gates, migration ordering |

Critical path: `Prisma v2 → WorkRequest → Marketplace → API Spec → Backend Blueprint → Testing → Infra`.

---

## 2. Merge Sequence

Strict linear order. Each step lands on `main` and is tagged before the next begins. No parallel merges across layers; Mobile may land in parallel with Testing (Step 7a/7b) because they touch disjoint document sets.

| # | Branch / Artifact | Tag on land | Gate before next |
|---|---|---|---|
| 1 | `PRISMA_SCHEMA_V2_FREEZE` | `arch/prisma-v2` | Schema doc + ERD on main |
| 2 | `WORKREQUEST_FINAL_ARCHITECTURE` | `arch/wr-final` | State machine doc references Prisma v2 |
| 3 | `MARKETPLACE_REFACTOR_MASTER_PLAN` | `arch/marketplace` | Listing/bid/award flows reference WR states |
| 4 | `API_SPEC_V1_PATCH_V2` | `arch/api-v1p2` | DTOs match Prisma v2; endpoints cover WR + Marketplace |
| 5 | `BACKEND_EXECUTION_BLUEPRINT_V2` | `arch/backend-v2` | Module map matches API surface |
| 6 | `MOBILE_PRODUCT_BLUEPRINT` | `arch/mobile-v1` | Client surface matches API v1 P2 |
| 7 | `TESTING_MASTER_PLAN_FREEZE` | `arch/testing-freeze` | Coverage matrix references all above |
| 8 | `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2` | `arch/infra-v2` | CI gates wired to Testing Freeze |

Step 6 (Mobile) may run concurrently with Step 5 (Backend) once Step 4 (API) is in, since both consume the API spec but do not modify each other's documents.

---

## 3. Expected Conflicts

Conflicts are predicted per merge step. "Doc" = markdown conflict; "Semantic" = no textual conflict but contradictory content across files.

### Step 1 — Prisma v2
- Doc: none expected (new freeze doc).
- Semantic: legacy `MARKETPLACE_REFACTOR_MASTER_PLAN.md` already on main may reference older field names.

### Step 2 — WorkRequest Final
- Doc: none expected.
- Semantic: state-machine names vs. existing references in `MARKETPLACE_REFACTOR_MASTER_PLAN.md`.

### Step 3 — Marketplace Master Plan
- Doc: high — file with same name already exists on main. Whole-file conflict likely.
- Semantic: bid/award flow vs. WR state transitions from Step 2.

### Step 4 — API Spec v1 Patch V2
- Doc: low (new file).
- Semantic: endpoint shapes vs. legacy API references in `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN.md` and `_legacy/`.

### Step 5 — Backend Blueprint V2
- Doc: low.
- Semantic: module boundaries vs. current `backend/` tree; migration ordering vs. Prisma v2 freeze.

### Step 6 — Mobile Blueprint
- Doc: medium — `MOBILE_MIGRATION_PLAN_SINGLE_APP.md` on main may overlap.
- Semantic: offline/sync assumptions vs. API spec idempotency rules.

### Step 7 — Testing Master Plan Freeze
- Doc: high — `TESTING_MASTER_PLAN.md`, `TESTING_MASTER_PLAN_PATCH_V1.md`, `TESTING_MASTER_PLAN_PATCH_V2.md` all on main. Multi-file overlap.
- Semantic: coverage matrix vs. modules defined in Backend Blueprint.

### Step 8 — Infra & Deploy Patch V2
- Doc: high — `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN.md`, `_PATCH_V1.md`, `_PATCH_V2.md` all present. Likely already a patch chain.
- Semantic: CI gates vs. Testing Freeze gates; env vars vs. Backend Blueprint config contract.

---

## 4. Conflict Resolution Strategy

General rules:

1. **Layer authority wins.** When two documents disagree, the lower layer (closer to Prisma) is authoritative for entities/state; the closer-to-interface layer is authoritative for endpoint shape; the closer-to-runtime layer is authoritative for deployment topology.
2. **Freeze documents beat patch documents beat base documents.** Suffix precedence: `_FREEZE` > `_PATCH_V2` > `_PATCH_V1` > base.
3. **Newer-numbered version supersedes** within the same family (`V2` > `V1`).
4. **No silent rewrites.** Any semantic conflict that requires changing content in a frozen upstream document must trigger a new patch document on that upstream, not an inline edit during merge.
5. **Patch chains collapse only at freeze.** Base + patches are retained until a `_FREEZE` document is produced consolidating them, after which base and patches move to `_legacy/`.

Per-step playbook:

- **Step 3 (Marketplace doc conflict):** Replace existing `MARKETPLACE_REFACTOR_MASTER_PLAN.md` wholesale with the branch version. Archive prior version under `_legacy/architecture/` with date suffix.
- **Step 6 (Mobile overlap):** Keep `MOBILE_PRODUCT_BLUEPRINT.md` as authoritative; demote `MOBILE_MIGRATION_PLAN_SINGLE_APP.md` to `_legacy/` (it is a migration plan, not a product blueprint — different scope, but redundant once blueprint lands).
- **Step 7 (Testing patch chain):** Land `TESTING_MASTER_PLAN_FREEZE.md` as the single authority. Move `TESTING_MASTER_PLAN.md`, `_PATCH_V1.md`, `_PATCH_V2.md` to `_legacy/architecture/testing/`.
- **Step 8 (Infra patch chain):** Land `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` as current authority. Retain `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN.md` (base) on main only if Patch V2 is delta-only; otherwise archive base + V1, keep V2 standalone. Decision deferred to merge time based on whether Patch V2 is self-contained.

Semantic conflict resolution order (when documents technically merge but contradict):

1. Open an issue tagged `arch-conflict` describing both positions.
2. Authoritative layer (per §1) wins by default.
3. If the higher layer is correct, produce a patch document against the lower-layer freeze; do not edit the freeze in place.

---

## 5. Document Disposition

### 5.1 Copy to `main` (authoritative)

| File | Role |
|---|---|
| `PRISMA_SCHEMA_V2_FREEZE.md` | Data contract |
| `WORKREQUEST_FINAL_ARCHITECTURE.md` | Domain state machine |
| `MARKETPLACE_REFACTOR_MASTER_PLAN.md` (new) | Marketplace domain plan |
| `API_SPEC_V1_PATCH_V2.md` | Interface contract |
| `BACKEND_EXECUTION_BLUEPRINT_V2.md` | Backend implementation map |
| `MOBILE_PRODUCT_BLUEPRINT.md` | Mobile implementation map |
| `TESTING_MASTER_PLAN_FREEZE.md` | Verification authority |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` | Deployment authority |
| `CANONICAL_ARCHITECTURE_INDEX.md` (to be recreated) | Top-level index |
| `GOVERNANCE_RECONSTRUCTION_REPORT.md` (to be recreated) | Governance record |
| `ARCHITECTURE_CONSOLIDATION_EXECUTION_PLAN.md` (this file) | Execution record |

### 5.2 Archive to `_legacy/architecture/`

| File | Reason |
|---|---|
| `TESTING_MASTER_PLAN.md` | Superseded by Freeze |
| `TESTING_MASTER_PLAN_PATCH_V1.md` | Superseded by Freeze |
| `TESTING_MASTER_PLAN_PATCH_V2.md` | Superseded by Freeze |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN.md` | Superseded by Patch V2 (if V2 is self-contained) |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V1.md` | Superseded by Patch V2 |
| `MOBILE_MIGRATION_PLAN_SINGLE_APP.md` | Superseded by Mobile Product Blueprint |
| `DOCUMENTATION_ACTION_PLAN.md` | Process doc, completed by this plan |
| `DOCUMENTATION_AUDIT_REPORT.md` | Snapshot, no ongoing authority |
| Pre-merge `MARKETPLACE_REFACTOR_MASTER_PLAN.md` | Superseded by branch version |

### 5.3 Remain in place, untouched

- `README.md`
- `_legacy/` existing contents

---

## 6. Authority Hierarchy

Top to bottom: when documents conflict, higher entry wins.

```
1. PRISMA_SCHEMA_V2_FREEZE
       — entities, fields, enums, FKs, indexes
2. WORKREQUEST_FINAL_ARCHITECTURE
       — WR lifecycle, state machine, invariants
3. MARKETPLACE_REFACTOR_MASTER_PLAN
       — listing/bid/award domain rules
4. API_SPEC_V1_PATCH_V2
       — endpoint shapes, DTOs, authz boundaries
5. BACKEND_EXECUTION_BLUEPRINT_V2
       — module layout, service boundaries, migration order
6. MOBILE_PRODUCT_BLUEPRINT
       — mobile client surface, offline/sync model
7. TESTING_MASTER_PLAN_FREEZE
       — coverage matrix, gating tests, contract tests
8. INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2
       — env topology, CI/CD, runtime config
```

Meta authority:

- `CANONICAL_ARCHITECTURE_INDEX.md` — pointer-only; never overrides content.
- `GOVERNANCE_RECONSTRUCTION_REPORT.md` — describes process, never overrides content.
- This plan — execution record, never overrides content.

---

## 7. Freeze Packages

Four bundles. Each is a frozen set of documents shipped together; a package is considered "frozen" when every document in it is on `main` with its tag.

### 7.1 MVP Architecture Freeze Package

Purpose: define what the system *is*.

- `PRISMA_SCHEMA_V2_FREEZE.md`
- `WORKREQUEST_FINAL_ARCHITECTURE.md`
- `MARKETPLACE_REFACTOR_MASTER_PLAN.md`
- `API_SPEC_V1_PATCH_V2.md`
- `CANONICAL_ARCHITECTURE_INDEX.md`

Gate: all five present on `main`, tagged `arch/mvp-freeze`. No implementation may begin against these contracts until tag exists.

### 7.2 Implementation Package

Purpose: define how the system is *built*.

- `BACKEND_EXECUTION_BLUEPRINT_V2.md`
- `MOBILE_PRODUCT_BLUEPRINT.md`
- (consumes) MVP Architecture Freeze Package

Gate: tagged `arch/impl-ready`. Backend and mobile workstreams branch from this tag.

### 7.3 Testing Package

Purpose: define how the system is *verified*.

- `TESTING_MASTER_PLAN_FREEZE.md`
- (consumes) MVP Architecture Freeze Package + Implementation Package

Gate: tagged `arch/test-ready`. CI gates configured from this tag; no PR merges to `main` after this tag without passing the freeze's required suites.

### 7.4 Deployment Package

Purpose: define how the system is *shipped and operated*.

- `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md`
- (consumes) Implementation Package + Testing Package

Gate: tagged `arch/deploy-ready`. Release pipeline and environments are provisioned from this tag.

Package dependency:

```
MVP Architecture Freeze
        │
        ▼
Implementation ──────────┐
        │                │
        ▼                ▼
   Testing  ─────────► Deployment
```

---

## 8. Execution Checklist (for the operator running the merges)

1. Verify `CANONICAL_ARCHITECTURE_INDEX.md` and `GOVERNANCE_RECONSTRUCTION_REPORT.md` exist or recreate them before Step 1.
2. For each step in §2: rebase branch onto current `main`, run the conflict playbook in §4, land, tag, and update the index.
3. After Step 4: cut `arch/mvp-freeze`.
4. After Step 6: cut `arch/impl-ready`.
5. After Step 7: cut `arch/test-ready` and wire CI gates.
6. After Step 8: cut `arch/deploy-ready`.
7. Move archived documents (§5.2) in a single follow-up commit after `arch/deploy-ready`, not during the merge sequence, to keep history readable.

End of plan.
