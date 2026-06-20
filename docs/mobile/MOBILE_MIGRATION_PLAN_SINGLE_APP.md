# MOBILE_MIGRATION_PLAN_SINGLE_APP.md

**Status:** READY_FOR_MIGRATION  
**Decision source:** `INFRASTRUCTURE_AND_DEPLOYMENT_PLAN_PATCH_V2.md` — PATCH-09, OPTION A  
**Date:** 2026-06-10  
**Branch:** `claude/epic-volta-c95o3h`

---

## Context

`PATCH_V2 / PATCH-09` resolves BLOCKER-3: the repo contains two separate Expo apps
(`mobile/worker-app/`, `mobile/checker-app/`) that contradict the approved Master
Architecture v2.0 decision of **one role-based Expo app**. This plan migrates the
current two-app foundation into the single unified app at `mobile/hotel-crm-app/`.

No code is discarded. All screens, the API client, the auth store, and all types are
reused verbatim or with minimal modification.

---

## 1. File Move Map

### 1.1 — Files copied verbatim (zero changes)

| Source | Destination |
|---|---|
| `mobile/worker-app/src/types/api.ts` | `mobile/hotel-crm-app/src/types/api.ts` |
| `mobile/worker-app/src/lib/api.ts` | `mobile/hotel-crm-app/src/lib/api.ts` |
| `mobile/worker-app/src/stores/auth-store.ts` | `mobile/hotel-crm-app/src/stores/auth-store.ts` |
| `mobile/worker-app/src/constants/theme.ts` | `mobile/hotel-crm-app/src/constants/theme.ts` |
| `mobile/worker-app/src/global.css` | `mobile/hotel-crm-app/src/global.css` |
| `mobile/worker-app/src/hooks/use-theme.ts` | `mobile/hotel-crm-app/src/hooks/use-theme.ts` |
| `mobile/worker-app/src/hooks/use-color-scheme.ts` | `mobile/hotel-crm-app/src/hooks/use-color-scheme.ts` |
| `mobile/worker-app/src/hooks/use-color-scheme.web.ts` | `mobile/hotel-crm-app/src/hooks/use-color-scheme.web.ts` |
| `mobile/worker-app/src/components/themed-text.tsx` | `mobile/hotel-crm-app/src/components/themed-text.tsx` |
| `mobile/worker-app/src/components/themed-view.tsx` | `mobile/hotel-crm-app/src/components/themed-view.tsx` |
| `mobile/worker-app/src/components/animated-icon.tsx` | `mobile/hotel-crm-app/src/components/animated-icon.tsx` |
| `mobile/worker-app/src/components/animated-icon.web.tsx` | `mobile/hotel-crm-app/src/components/animated-icon.web.tsx` |
| `mobile/worker-app/src/components/animated-icon.module.css` | `mobile/hotel-crm-app/src/components/animated-icon.module.css` |
| `mobile/worker-app/src/components/external-link.tsx` | `mobile/hotel-crm-app/src/components/external-link.tsx` |
| `mobile/worker-app/src/components/hint-row.tsx` | `mobile/hotel-crm-app/src/components/hint-row.tsx` |
| `mobile/worker-app/src/components/web-badge.tsx` | `mobile/hotel-crm-app/src/components/web-badge.tsx` |
| `mobile/worker-app/src/components/ui/collapsible.tsx` | `mobile/hotel-crm-app/src/components/ui/collapsible.tsx` |
| `mobile/worker-app/src/components/app-tabs.tsx` | `mobile/hotel-crm-app/src/components/app-tabs.tsx` |
| `mobile/worker-app/src/components/app-tabs.web.tsx` | `mobile/hotel-crm-app/src/components/app-tabs.web.tsx` |
| `mobile/worker-app/src/app/(auth)/_layout.tsx` | `mobile/hotel-crm-app/src/app/(auth)/_layout.tsx` |
| `mobile/worker-app/assets/` (entire directory) | `mobile/hotel-crm-app/assets/` |
| `mobile/worker-app/scripts/reset-project.js` | `mobile/hotel-crm-app/scripts/reset-project.js` |
| `mobile/worker-app/tsconfig.json` | `mobile/hotel-crm-app/tsconfig.json` |
| `mobile/worker-app/.gitignore` | `mobile/hotel-crm-app/.gitignore` |
| `mobile/worker-app/LICENSE` | `mobile/hotel-crm-app/LICENSE` |

### 1.2 — Files copied then modified (changes described in each section below)

| Source | Destination | Change |
|---|---|---|
| `mobile/worker-app/src/app/_layout.tsx` | `mobile/hotel-crm-app/src/app/_layout.tsx` | Remove `ALLOWED_ROLES` gate; mount `RootNavigator` |
| `mobile/worker-app/src/app/index.tsx` | `mobile/hotel-crm-app/src/app/index.tsx` | Redirect target changes from `/(app)/` to `/(app)/router` |
| `mobile/worker-app/src/app/(auth)/login.tsx` | `mobile/hotel-crm-app/src/app/(auth)/login.tsx` | Remove role blocklist; success navigates to `/(app)/router` |
| `mobile/worker-app/src/app/(app)/profile.tsx` | `mobile/hotel-crm-app/src/app/(app)/profile.tsx` | No logic change; lives as shared screen |
| `mobile/worker-app/package.json` | `mobile/hotel-crm-app/package.json` | Rename to `hotel-crm-app`; keep all deps including `expo-secure-store` |
| `mobile/worker-app/app.json` | `mobile/hotel-crm-app/app.json` | Update name/slug/scheme/bundle ID |

### 1.3 — Files moved from checker-app (not duplicated in worker-app)

| Source | Destination | Change |
|---|---|---|
| `mobile/checker-app/src/app/(app)/index.tsx` | `mobile/hotel-crm-app/src/screens/checker/InspectionsScreen.tsx` | Rename export to `InspectionsScreen` |

### 1.4 — Files renamed from worker-app

| Source | Destination | Change |
|---|---|---|
| `mobile/worker-app/src/app/(app)/index.tsx` | `mobile/hotel-crm-app/src/screens/worker/TasksScreen.tsx` | Rename export to `TasksScreen` |

### 1.5 — Files created new (described fully in sections 3–5)

| File | Purpose |
|---|---|
| `mobile/hotel-crm-app/src/app/(app)/router.tsx` | RootNavigator: reads role, renders correct navigator |
| `mobile/hotel-crm-app/src/navigators/WorkerNavigator.tsx` | Tab layout for WORKER role |
| `mobile/hotel-crm-app/src/navigators/CheckerNavigator.tsx` | Tab layout for CHECKER role |
| `mobile/hotel-crm-app/src/constants/app-config.ts` | Unified config, no per-role split |
| `mobile/hotel-crm-app/eas.json` | Unified EAS build profiles |

### 1.6 — Files archived (git mv, not deleted)

```
mobile/worker-app/   →   mobile/_archive/worker-app/
mobile/checker-app/  →   mobile/_archive/checker-app/
```

Archive after migration is smoke-tested. Do not delete until first EAS staging build passes.

---

## 2. Directory Structure of `mobile/hotel-crm-app/`

```
mobile/hotel-crm-app/
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
├── .gitignore
├── LICENSE
├── assets/
│   ├── expo.icon/
│   └── images/
├── scripts/
│   └── reset-project.js
└── src/
    ├── global.css
    ├── app/                            ← expo-router file-based routes
    │   ├── _layout.tsx                 ← Root layout: SplashScreen + ThemeProvider + Stack
    │   ├── index.tsx                   ← Redirect: unauthenticated → login, authenticated → router
    │   ├── (auth)/
    │   │   ├── _layout.tsx             ← Stack, headerShown: false
    │   │   └── login.tsx               ← Login screen (shared, no role gate)
    │   └── (app)/
    │       ├── router.tsx              ← RootNavigator: reads role, renders WorkerNavigator or CheckerNavigator
    │       └── profile.tsx             ← Shared profile + logout (accessible from both navigators)
    ├── navigators/
    │   ├── WorkerNavigator.tsx         ← Tabs: Tasks | Profile
    │   └── CheckerNavigator.tsx        ← Tabs: Inspections | Profile
    ├── screens/
    │   ├── worker/
    │   │   └── TasksScreen.tsx         ← Migrated from worker-app (app)/index.tsx
    │   └── checker/
    │       └── InspectionsScreen.tsx   ← Migrated from checker-app (app)/index.tsx
    ├── components/                     ← All existing components, copied verbatim
    │   ├── themed-text.tsx
    │   ├── themed-view.tsx
    │   ├── animated-icon.tsx
    │   ├── animated-icon.web.tsx
    │   ├── animated-icon.module.css
    │   ├── app-tabs.tsx
    │   ├── app-tabs.web.tsx
    │   ├── external-link.tsx
    │   ├── hint-row.tsx
    │   ├── web-badge.tsx
    │   └── ui/
    │       └── collapsible.tsx
    ├── constants/
    │   ├── theme.ts                    ← Copied verbatim
    │   └── app-config.ts               ← Unified: APP_NAME only, no ALLOWED_ROLES split
    ├── hooks/
    │   ├── use-theme.ts
    │   ├── use-color-scheme.ts
    │   └── use-color-scheme.web.ts
    ├── lib/
    │   └── api.ts                      ← Copied verbatim
    ├── stores/
    │   └── auth-store.ts               ← Copied verbatim
    └── types/
        └── api.ts                      ← Copied verbatim
```

---

## 3. RootNavigator Design

**File:** `mobile/hotel-crm-app/src/app/(app)/router.tsx`

**Role:** This is the single decision point after successful authentication. It reads the
role from the auth store and renders the correct role navigator. It never renders a screen
itself.

**Logic:**

```
user.role === 'worker'            → render <WorkerNavigator />
user.role === 'checker'           → render <CheckerNavigator />
user.role === 'manager'           → render <WorkerNavigator />   (future: ManagerNavigator)
user.role === 'admin'             → render <WorkerNavigator />   (future: AdminNavigator)
user === null (guard)             → <Redirect href="/(auth)/login" />
```

**Specification:**

```typescript
// src/app/(app)/router.tsx

import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';
import { WorkerNavigator } from '@/navigators/WorkerNavigator';
import { CheckerNavigator } from '@/navigators/CheckerNavigator';

export default function RoleRouter() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  switch (user.role) {
    case 'checker':
      return <CheckerNavigator />;
    case 'worker':
    case 'manager':
    case 'admin':
    default:
      return <WorkerNavigator />;
  }
}
```

**Notes:**
- `manager` and `admin` fall through to `WorkerNavigator` as a temporary scaffold.
  When `ManagerNavigator` is built, add a `case 'manager':` branch.
- This file is a route (`/(app)/router`). The expo-router Stack in `(app)` renders it.
- The `(app)` group has no `_layout.tsx`. The root Stack in `src/app/_layout.tsx`
  handles the group transition.

---

## 4. WorkerNavigator Design

**File:** `mobile/hotel-crm-app/src/navigators/WorkerNavigator.tsx`

**Screens:** Tasks (index) | Profile

**Tab 1 — Tasks:**
- Source screen: `src/screens/worker/TasksScreen.tsx`
- Tab label: `Tasks`
- Tab icon: `{ ios: 'checklist', android: 'assignment', web: 'assignment' }`

**Tab 2 — Profile:**
- Source screen: `src/app/(app)/profile.tsx` (shared)
- Tab label: `Profile`
- Tab icon: `{ ios: 'person.circle', android: 'account_circle', web: 'account_circle' }`

**Specification:**

```typescript
// src/navigators/WorkerNavigator.tsx

import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/hooks/use-theme';
import TasksScreen from '@/screens/worker/TasksScreen';
import ProfileScreen from '../app/(app)/profile';

export function WorkerNavigator() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.background },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
      }}
    >
      <Tabs.Screen
        name="tasks"
        component={TasksScreen}
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'checklist', android: 'assignment', web: 'assignment' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'person.circle', android: 'account_circle', web: 'account_circle' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## 5. CheckerNavigator Design

**File:** `mobile/hotel-crm-app/src/navigators/CheckerNavigator.tsx`

**Screens:** Inspections (index) | Profile

**Tab 1 — Inspections:**
- Source screen: `src/screens/checker/InspectionsScreen.tsx`
- Tab label: `Inspections`
- Tab icon: `{ ios: 'magnifyingglass.circle', android: 'search', web: 'search' }`

**Tab 2 — Profile:**
- Source screen: `src/app/(app)/profile.tsx` (shared)
- Tab label: `Profile`
- Tab icon: `{ ios: 'person.circle', android: 'account_circle', web: 'account_circle' }`

**Specification:**

```typescript
// src/navigators/CheckerNavigator.tsx

import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/hooks/use-theme';
import InspectionsScreen from '@/screens/checker/InspectionsScreen';
import ProfileScreen from '../app/(app)/profile';

export function CheckerNavigator() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.background },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
      }}
    >
      <Tabs.Screen
        name="inspections"
        component={InspectionsScreen}
        options={{
          title: 'Inspections',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'magnifyingglass.circle', android: 'search', web: 'search' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'person.circle', android: 'account_circle', web: 'account_circle' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## 6. Shared Screens Strategy

Two screens are shared across both navigators: **Profile** and any future screens that
apply to all roles (e.g., Notifications, Settings).

### Rule

A screen is shared if its content and behaviour are identical regardless of role.
A screen is role-specific if its data, actions, or layout differ by role.

### Current shared screens

| Screen | File | Used by |
|---|---|---|
| Profile + Logout | `src/app/(app)/profile.tsx` | WorkerNavigator, CheckerNavigator |

### Current role-specific screens

| Screen | File | Used by |
|---|---|---|
| Tasks shell | `src/screens/worker/TasksScreen.tsx` | WorkerNavigator only |
| Inspections shell | `src/screens/checker/InspectionsScreen.tsx` | CheckerNavigator only |

### Placement rule for future screens

```
Role-specific screen  →  src/screens/worker/   or   src/screens/checker/
Shared screen         →  src/app/(app)/         (exposed as a named expo-router route)
```

Shared screens live inside `src/app/(app)/` so they remain reachable as named routes
by both navigators. Role-specific screens live in `src/screens/{role}/` and are imported
as components by the navigator; they do not need their own route file.

---

## 7. Shared Auth Strategy

### What is shared (no changes required)

| Layer | File | Notes |
|---|---|---|
| API client | `src/lib/api.ts` | Identical — no role coupling |
| Auth store | `src/stores/auth-store.ts` | Identical — `login`, `logout`, `initialize`, SecureStore tokens |
| Types | `src/types/api.ts` | Identical — `User`, `UserRole`, `AuthResponse` |
| Login screen | `src/app/(auth)/login.tsx` | One change only (see below) |
| Root layout | `src/app/_layout.tsx` | One change only (see below) |

### Changes to login screen

**Remove:** The `ALLOWED_ROLES` import and the role-blocklist check after login.

**Before (two-app version):**
```typescript
import { ALLOWED_ROLES } from '@/constants/app-config';
// ...
const user = useAuthStore.getState().user;
if (user && !ALLOWED_ROLES.includes(user.role)) {
  await logout();
  setError('Your account does not have access to this app.');
  return;
}
router.replace('/(app)/');
```

**After (single-app version):**
```typescript
router.replace('/(app)/router');
```

All roles are now valid. The role determines which navigator is shown, not whether
login is permitted.

### Changes to root `_layout.tsx`

No structural change. The `SplashScreen` + `ThemeProvider` + `Stack` pattern is identical.
The Stack will now contain a route at `(app)/router` instead of `(app)/index`, which
requires no change to `_layout.tsx` itself.

### Changes to `app-config.ts`

**Remove:** `ALLOWED_ROLES` export entirely.

**Keep:** `APP_NAME` (update value to `'Hotel CRM'`).

**Before:**
```typescript
export const APP_NAME = 'Worker Portal';
export const ALLOWED_ROLES: readonly UserRole[] = ['worker', 'manager', 'admin'];
```

**After:**
```typescript
export const APP_NAME = 'Hotel CRM';
```

### Token storage

SecureStore keys are unchanged: `hotel_crm_access_token`, `hotel_crm_refresh_token`.
No migration of stored tokens is required.

---

## 8. EAS Configuration Changes

**File:** `mobile/hotel-crm-app/eas.json`

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_ENV": "development",
        "EXPO_PUBLIC_API_URL": "http://localhost:3001/api/v1"
      }
    },
    "staging": {
      "distribution": "internal",
      "env": {
        "APP_ENV": "staging",
        "EXPO_PUBLIC_API_URL": "https://staging-api.hotelcrm.app/api/v1"
      }
    },
    "production": {
      "distribution": "store",
      "env": {
        "APP_ENV": "production",
        "EXPO_PUBLIC_API_URL": "https://api.hotelcrm.app/api/v1"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "FILL_IN",
        "ascAppId": "FILL_IN",
        "appleTeamId": "FILL_IN"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "internal"
      }
    }
  }
}
```

**File:** `mobile/hotel-crm-app/app.json` — fields to update from worker-app base:

| Field | Old value (worker-app) | New value |
|---|---|---|
| `expo.name` | `worker-app` | `Hotel CRM` |
| `expo.slug` | `worker-app` | `hotel-crm` |
| `expo.scheme` | `workerapp` | `hotelcrm` |
| `expo.ios.bundleIdentifier` | _(not set)_ | `com.zirove.hotelcrm` |
| `expo.android.package` | _(not set)_ | `com.zirove.hotelcrm` |

All other `app.json` fields (orientation, icons, splash, plugins, experiments) carry over
unchanged from the worker-app base.

**package.json** — field to update:

| Field | Old value | New value |
|---|---|---|
| `name` | `worker-app` | `hotel-crm-app` |

---

## 9. CI/CD Changes

### Current state (two-app, broken against PATCH_V2)

The two-app structure implies two EAS builds, two sets of credentials, and two App Store
listings. No CI/CD workflow files have been created yet for mobile — this is a greenfield
configuration.

### Required CI/CD configuration

Create `.github/workflows/mobile.yml`:

```yaml
name: Mobile

on:
  push:
    branches: [main]
    paths:
      - 'mobile/hotel-crm-app/**'
  pull_request:
    branches: [main]
    paths:
      - 'mobile/hotel-crm-app/**'

jobs:
  build-development:
    name: EAS Development Build
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    defaults:
      run:
        working-directory: mobile/hotel-crm-app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: mobile/hotel-crm-app/package-lock.json
      - run: npm ci
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas build --platform all --profile development --non-interactive

  build-production:
    name: EAS Production Build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    defaults:
      run:
        working-directory: mobile/hotel-crm-app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: mobile/hotel-crm-app/package-lock.json
      - run: npm ci
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas build --platform all --profile production --non-interactive
```

### Required GitHub Actions secrets

| Secret | Value |
|---|---|
| `EXPO_TOKEN` | EAS personal access token from expo.dev |

### Path filters

The `paths:` filter on `mobile/hotel-crm-app/**` ensures the mobile workflow only
triggers on mobile changes. Backend and frontend changes do not trigger a mobile build.

### Removal of two-app references

If any prior workflow references `mobile/worker-app` or `mobile/checker-app`, those
references must be removed. As of this migration no such workflow files exist.

---

## 10. Rollback Plan

### Trigger condition

Roll back if any of the following occur after migration commit is pushed:

- Metro bundler fails to start on a clean `npm install`
- Auth flow broken: login does not navigate to role navigator
- Role routing broken: worker login shows checker screens or vice versa
- EAS development build fails compilation

### Rollback procedure

```
Step 1 — Revert the migration commit on the branch:
  git revert <migration-commit-sha>
  git push origin claude/epic-volta-c95o3h

Step 2 — The archived directories are still intact:
  mobile/_archive/worker-app/
  mobile/_archive/checker-app/
  Restore with:
  git mv mobile/_archive/worker-app  mobile/worker-app
  git mv mobile/_archive/checker-app mobile/checker-app

Step 3 — Delete the unified app directory:
  git rm -r mobile/hotel-crm-app

Step 4 — The previous foundation commit is still in history:
  git log --oneline  →  find "feat(mobile): build mobile foundation"
  The two-app foundation is recoverable at any point.
```

### What is safe throughout rollback

- Backend is not touched by this migration. No rollback needed on the backend.
- SecureStore token keys are identical in both architectures. Users who authenticated
  against the two-app version will re-authenticate cleanly against the single-app
  version with no token conflict.
- No database schema changes are involved.

### Archive retention policy

Keep `mobile/_archive/` in the repository until:
1. First EAS staging build passes on `hotel-crm-app`
2. Role-based routing is smoke-tested for both worker and checker roles on device

After those two conditions are met, `mobile/_archive/` may be removed in a separate
cleanup commit.

---

## Execution Checklist

```
PRE-MIGRATION
[ ] Confirm current branch: claude/epic-volta-c95o3h
[ ] Confirm both archived apps build before archiving (npm install + expo start)

MIGRATION
[ ] Create mobile/hotel-crm-app/ using worker-app as base (cp -r)
[ ] Apply all file moves from Section 1
[ ] Apply all file modifications from Sections 6, 7, 8
[ ] Create src/app/(app)/router.tsx per Section 3
[ ] Create src/navigators/WorkerNavigator.tsx per Section 4
[ ] Create src/navigators/CheckerNavigator.tsx per Section 5
[ ] Create src/screens/worker/TasksScreen.tsx (rename from worker-app (app)/index.tsx)
[ ] Create src/screens/checker/InspectionsScreen.tsx (rename from checker-app (app)/index.tsx)
[ ] Update app.json fields per Section 8
[ ] Update package.json name field
[ ] Create eas.json per Section 8
[ ] Archive: git mv mobile/worker-app mobile/_archive/worker-app
[ ] Archive: git mv mobile/checker-app mobile/_archive/checker-app
[ ] Create .github/workflows/mobile.yml per Section 9

VERIFICATION
[ ] npm install succeeds in mobile/hotel-crm-app/
[ ] expo start launches without Metro errors
[ ] Login screen renders with title "Hotel CRM"
[ ] Worker credentials → Tasks tab visible, Inspections tab not visible
[ ] Checker credentials → Inspections tab visible, Tasks tab not visible
[ ] Profile screen shows correct user data for both roles
[ ] Logout returns to login screen for both roles

POST-MIGRATION
[ ] Commit all changes with message referencing PATCH-09
[ ] Push to claude/epic-volta-c95o3h
[ ] After smoke-test passes: remove mobile/_archive/ in a cleanup commit
```

---

**Status:** READY_FOR_MIGRATION
