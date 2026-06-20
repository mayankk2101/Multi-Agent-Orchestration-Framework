# MOBILE_ARCHITECTURE_ADJUDICATION

**Date:** 2026-06-10
**Type:** Conflict adjudication — single issue, binding
**Scope:** Resolves *only* the mobile app-count conflict. No redesign, no implementation plan, no backend.

---

## 1. The Conflict

| Source | Asserts |
|---|---|
| `MOBILE_PRODUCT_BLUEPRINT.md` (+ `_PATCH_V1`) | "Worker App" and "Checker App" — presented as two app surfaces |
| Repo directories `mobile/worker-app/` + `mobile/checker-app/` | Two physical Expo projects |
| `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` — PATCH-09 | One role-based Expo app, bundle ID `com.zirove.hotelcrm` |

These cannot both stand as written.

---

## 2. Governing Document

**`INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` PATCH-09 governs.**

Authority chain (per `DOCUMENTATION_AUDIT_REPORT.md` tiers):

1. **Tier 1 — `MASTER_ARCHITECTURE_v2.0.md` §9** is the signed source of truth. It states: *"One React Native (Expo) app with role switching at login."*
2. **PATCH-09** is the faithful, in-repo implementation of that Tier-1 decision. It explicitly identifies the contradiction and resolves it to OPTION A (single app) by deferring to Master Architecture §9.
3. **`MOBILE_PRODUCT_BLUEPRINT.md`** is a Tier-3 product/working document. It is subordinate to Tier 1, and its app-count framing was never ratified as an override.

PATCH-09 wins not because a patch outranks a blueprint, but because PATCH-09 carries the Tier-1 decision and the Blueprint does not.

---

## 3. Nature of the Conflict

**Primarily DOCUMENTATION; secondarily DEPLOYMENT/PACKAGING. It is NOT architectural and NOT a product disagreement.**

- The architecture was never actually in dispute. Tier-1 (§9) decided "one app" before either document was written.
- The Blueprint never specifies two **binaries**: it contains no EAS configuration, no separate bundle IDs, no separate App Store / Play Store listings, no packaging or build topology. "Worker App" and "Checker App" appear only as **screen-inventory and navigation groupings** (16 worker screens / 11 checker screens). These are *role surfaces*, not shippable applications.
- The only genuinely physical two-app artifact is the pair of repo directories `mobile/worker-app/` + `mobile/checker-app/`. PATCH-09 itself states these "predate the Master Architecture v2.0 decision; [they are] not an intentional override." That is a **deployment/packaging** residue, not a product or architectural intent.

Therefore the conflict reduces to: **terminology in a Tier-3 doc + stale directory structure**, both already adjudicated by Tier-1 and PATCH-09. There is no live architectural or product decision left to make.

---

## 4. Canonical MVP Decision

**ONE app is canonical for MVP.**

- A single Expo binary, role-routed at login (JWT `role` claim → WorkerNavigator / CheckerNavigator / future ManagerNavigator).
- Bundle ID: **`com.zirove.hotelcrm`** (single).
- One EAS project, one Apple listing, one Google Play listing, three EAS profiles (development / staging / production).

"Worker App" and "Checker App" are **role surfaces inside the one app**, not separate products.

This matches `MOBILE_MIGRATION_PLAN_SINGLE_APP.md`, which already consolidates the two directories into `mobile/hotel-crm-app/`.

---

## 5. Required Corrections to Non-Governing Documents

### 5.1 `MOBILE_PRODUCT_BLUEPRINT.md`
- Retitle subject line "Worker App & Checker App" → reframe as **role surfaces within a single app** (e.g., "Worker role · Checker role").
- Add a one-line governance note at the top: *"This blueprint specifies screens and flows per role. Packaging is a single Expo app per MASTER_ARCHITECTURE §9 / PATCH-09 (`com.zirove.hotelcrm`). 'Worker App' / 'Checker App' denote role surfaces, not separate binaries."*
- §1.1 / §1.2 headings: change "1.1 Worker App" → "1.1 Worker Role Surface"; "1.2 Checker App" → "1.2 Checker Role Surface".
- §2 Navigation: present both as branches of one `RootNavigator`, not two independent Root Stacks.
- Anywhere "both apps" appears (stores, notifications, offline): change to "both role surfaces" / "the app".

### 5.2 `MOBILE_PRODUCT_BLUEPRINT_PATCH_V1.md`
- No app-count change required; it does not assert two binaries. If it inherits "App" terminology from the base blueprint, apply the same "role surface" reframing for consistency.

### 5.3 Repository directory structure
- `mobile/worker-app/` and `mobile/checker-app/` are non-canonical and must be retired in favor of the single `mobile/hotel-crm-app/`, per the existing `MOBILE_MIGRATION_PLAN_SINGLE_APP.md`. (Execution belongs to that plan; this adjudication only confirms the directories are not authoritative.)

### 5.4 `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md`
- No correction. This is the governing document. PATCH-09 stands as written.

---

## 6. Ruling

The mobile architecture is **one role-based Expo app** (`com.zirove.hotelcrm`). PATCH-09 governs; the Blueprint's two-"app" framing is corrected to role surfaces; the two repo directories are non-authoritative residue to be retired. The conflict is closed.
