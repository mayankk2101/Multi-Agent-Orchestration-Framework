# Current Project Report

Generated: 2026-05-27

Project root: `/Users/mayankmalhotra/Projects/hotel-crm`

## Executive Summary

This repository currently contains a Hotel CRM MVP skeleton with four major areas:

- A root orchestration layer with a readiness command, Docker Compose infrastructure services, and a service startup script.
- A backend made of 11 independent TypeScript/Express services: 10 domain services plus an API gateway.
- A frontend Next.js app using the App Router, Tailwind CSS, React 19, Supabase, SWR, and Zustand.
- Two Expo mobile apps, `worker-app` and `checker-app`, both currently based on the Expo starter template with shared structure and dependencies.

The backend services are scaffolded and runnable, but most business endpoints are placeholders returning `"coming soon"` messages. The frontend and mobile apps are also still starter-template level. The repo has package locks and installed `node_modules` for every app/service inspected.

## Current Runtime Status

I ran:

```bash
npm run test:readiness -- --no-start
```

The no-start readiness check produced this current local status:

- Docker daemon is not reachable from this shell.
- Redis is not reachable on `localhost:6379`.
- Supabase REST connectivity returns HTTP 401 with the current environment values.
- Backend services were not running, and the command skipped starting them because `--no-start` was used.
- API Gateway is not currently reachable on `127.0.0.1:3000`.
- Frontend is not currently reachable on `127.0.0.1:3002`.
- `frontend/app/page.tsx` does not make backend API calls yet.

The readiness run updated `reports/system-readiness-report.md`.

## High-Level Architecture

```text
hotel-crm/
├── backend/
│   ├── migrations/                 # Empty at inspection time
│   ├── services/                   # Express microservices
│   │   ├── analytics-service/
│   │   ├── api-gateway/
│   │   ├── auth-service/
│   │   ├── calendar-service/
│   │   ├── chatbot-service/
│   │   ├── crm-service/
│   │   ├── geo-service/
│   │   ├── hr-service/
│   │   ├── notifications-service/
│   │   ├── quality-service/
│   │   └── staffing-service/
│   └── shared/                     # Shared package scaffold
├── deployment/
│   ├── docker/                     # Empty at inspection time
│   └── k8s/                        # Empty at inspection time
├── docs/                           # Empty at inspection time
├── frontend/                       # Next.js web app
├── logs/
│   └── readiness/                  # Readiness log output
├── mobile/
│   ├── checker-app/                # Expo app scaffold
│   ├── shared/                     # Empty at inspection time
│   └── worker-app/                 # Expo app scaffold
├── reports/
├── scripts/
├── docker-compose.yml
├── package.json
└── start-all-services.sh
```

## Root Files

| Path | Purpose |
| --- | --- |
| `package.json` | Root package metadata and readiness script. |
| `README.md` | Exists but is currently empty. |
| `.gitignore` | Ignores env files, build output, logs, IDE folders, `node_modules`, Expo output, and coverage. |
| `.env.local` | Root environment file. Values intentionally not copied into this report. |
| `docker-compose.yml` | Defines infrastructure services only: Redis, Adminer, and Mailhog. |
| `start-all-services.sh` | Starts backend services plus frontend into `logs/`. |
| `scripts/system-readiness-check.mjs` | End-to-end readiness harness for static config, Docker, Redis, Supabase/database, backend health, gateway routes, and frontend reachability. |
| `scripts/test-environment.sh` | Present as an environment helper script. |
| `reports/system-readiness-report.md` | Machine-generated readiness report. |
| `reports/current-project-report.md` | This report. |

Root `package.json`:

```json
{
  "name": "hotel-crm-mvp",
  "version": "1.0.0",
  "description": "Hotel Management CRM",
  "private": true,
  "scripts": {
    "test:readiness": "node scripts/system-readiness-check.mjs"
  }
}
```

## Environment Configuration

Environment files exist in these locations:

- `.env.local`
- `frontend/.env.local`
- `mobile/worker-app/.env.local`
- `mobile/checker-app/.env.local`

Root `.env.local` contains these keys:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRY`
- `REDIS_URL`
- `NODE_ENV`
- `API_PORT`
- `API_BASE_URL`

Frontend `.env.local` contains:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

Mobile app `.env.local` files contain:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL`

No secret values are included here.

## Installed Package Areas

`node_modules` is present in every package area inspected:

- `frontend/node_modules`
- `mobile/worker-app/node_modules`
- `mobile/checker-app/node_modules`
- `backend/shared/node_modules`
- Every backend service under `backend/services/*/node_modules`

Package locks are present for:

- `frontend/package-lock.json`
- `mobile/worker-app/package-lock.json`
- `mobile/checker-app/package-lock.json`
- Every backend service under `backend/services/*/package-lock.json`

There is no root `package-lock.json` listed in the current file inventory.

## Backend Overview

The backend is structured as separate service folders. Each service has:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `Dockerfile`
- `src/index.ts`
- `node_modules/`

Most services share the same TypeScript compiler settings:

- `target`: `ES2020`
- `module`: `commonjs`
- `outDir`: `./dist`
- `rootDir`: `./src`
- `strict`: `true`
- `esModuleInterop`: `true`
- `skipLibCheck`: `true`
- `forceConsistentCasingInFileNames`: `true`

Most service scripts:

```json
{
  "test": "echo \"Error: no test specified\" && exit 1",
  "dev": "ts-node src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

### Backend Direct Dependencies

All domain services currently install:

- `@types/cors`: `^2.8.19`
- `@types/express`: `^5.0.6`
- `@types/node`: `^25.9.1`
- `cors`: `^2.8.6`
- `dotenv`: `^17.4.2`
- `express`: `^5.2.1`
- `nodemon`: `^3.1.14`
- `ts-node`: `^10.9.2`
- `typescript`: `^6.0.3`

`api-gateway` has the same list plus:

- `http-proxy-middleware`: `^3.0.5`

`backend/shared` installs:

- `typescript`: `^5.3.3`
- `@types/node`: `^20.10.0`
- `zod`: `^3.12.0`
- `winston`: `^3.11.0`
- `dotenv`: `^16.3.1`
- `cors`: `^2.8.5`
- `express`: `^4.18.2`

### Backend Services And Routes

| Service | Default port | Health route | Domain route currently implemented | Current behavior |
| --- | ---: | --- | --- | --- |
| `api-gateway` | `3000` | `GET /health` | Proxy routes under `/api/v1/*` | Routes traffic to local services. |
| `auth-service` | `3001` | `GET /health` | `POST /api/v1/auth/signup` | Placeholder signup response. |
| `crm-service` | `3020` | `GET /health` | `GET /api/v1/hotels`, `POST /api/v1/tasks` | Placeholder hotels/tasks responses. |
| `hr-service` | `3003` | `GET /health` | `GET /api/v1/contracts` | Placeholder contracts response. |
| `quality-service` | `3004` | `GET /health` | `POST /api/v1/ratings` | Placeholder rating response. |
| `calendar-service` | `3005` | `GET /health` | `GET /api/v1/schedules` | Placeholder schedules response. |
| `staffing-service` | `3006` | `GET /health` | `POST /api/v1/work-requests` | Placeholder work request response. |
| `notifications-service` | `3007` | `GET /health` | `POST /api/v1/notifications` | Placeholder notification response. |
| `geo-service` | `3008` | `GET /health` | `POST /api/v1/locations` | Placeholder location response. |
| `chatbot-service` | `3009` | `GET /health` | `POST /api/v1/chat` | Placeholder chat response. |
| `analytics-service` | `3010` | `GET /health` | `GET /api/v1/analytics` | Placeholder analytics response. |

Each service currently:

- Imports `express`, `cors`, and `dotenv`.
- Calls `dotenv.config()`.
- Enables CORS.
- Enables JSON parsing with `express.json()`, except the gateway applies JSON middleware after proxy routes.
- Returns a JSON health payload with `status`, `service`, and `timestamp`.
- Uses `process.env.PORT` with a service-specific fallback port.

### API Gateway Proxy Map

The gateway mounts these proxy routes:

| Gateway mount | Target |
| --- | --- |
| `/api/v1/auth` | `http://localhost:3001` |
| `/api/v1/crm` | `http://localhost:3020` |
| `/api/v1/hr` | `http://localhost:3003` |
| `/api/v1/quality` | `http://localhost:3004` |
| `/api/v1/calendar` | `http://localhost:3005` |
| `/api/v1/staffing` | `http://localhost:3006` |
| `/api/v1/notifications` | `http://localhost:3007` |
| `/api/v1/geo` | `http://localhost:3008` |
| `/api/v1/chatbot` | `http://localhost:3009` |
| `/api/v1/analytics` | `http://localhost:3010` |

The gateway defines a helper:

```ts
const rewriteMountedPath = (downstreamBasePath: string) => (path: string) => {
  const suffix = path === '/' ? '' : path;
  return `${downstreamBasePath}${suffix}`;
};
```

This is used in `pathRewrite` to rebuild downstream paths after Express strips the mounted prefix.

### Backend Dockerfiles

Every backend service Dockerfile is currently identical:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

Important detail: every Dockerfile exposes `3001`, even though the services use different runtime fallback ports in source code. Docker Compose does not currently define these backend services.

### Backend Generated Output

The file inventory shows compiled `dist/index.js` files for:

- `backend/services/api-gateway/dist/index.js`
- `backend/services/crm-service/dist/index.js`

No other backend `dist/index.js` files were listed outside ignored folders.

### Backend Shared Package

`backend/shared` has:

- `package.json`
- `tsconfig.json`
- `node_modules/`
- `src/` directory

No shared source files were listed inside `backend/shared/src` at inspection time.

The shared package is named `@hotel-crm/shared`, points `main` to `dist/index.js`, and points `types` to `dist/index.d.ts`.

## Frontend Overview

The frontend lives in `frontend/` and is a Next.js app using the App Router.

### Frontend File Structure

```text
frontend/
├── .env.local
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
└── tsconfig.json
```

### Frontend Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

### Frontend Dependencies

Runtime dependencies:

- `@supabase/supabase-js`: `^2.106.2`
- `next`: `16.2.6`
- `react`: `19.2.4`
- `react-dom`: `19.2.4`
- `swr`: `^2.4.1`
- `zustand`: `^5.0.13`

Dev dependencies:

- `@tailwindcss/postcss`: `^4`
- `@types/node`: `^20`
- `@types/react`: `^19`
- `@types/react-dom`: `^19`
- `eslint`: `^9`
- `eslint-config-next`: `16.2.6`
- `tailwindcss`: `^4`
- `typescript`: `^5`

### Frontend Current Implementation

`frontend/app/page.tsx` is still the stock create-next-app page:

- Displays the Next.js logo.
- Shows the starter text "To get started, edit the page.tsx file."
- Links to Vercel templates and Next.js docs.
- Does not call the backend API.
- Does not use Supabase, SWR, or Zustand yet.

`frontend/app/layout.tsx`:

- Uses `Geist` and `Geist_Mono` from `next/font/google`.
- Sets metadata to `"Create Next App"` and `"Generated by create next app"`.
- Applies `h-full antialiased` on `<html>`.
- Uses `min-h-full flex flex-col` on `<body>`.

`frontend/app/globals.css`:

- Imports Tailwind via `@import "tailwindcss";`.
- Defines `--background` and `--foreground` CSS variables.
- Adds Tailwind theme variables for background, foreground, sans, and mono fonts.
- Supports dark mode through `prefers-color-scheme`.
- Sets body background, foreground, and fallback font stack.

`frontend/next.config.ts` currently exports an empty config object.

`frontend/postcss.config.mjs` configures `@tailwindcss/postcss`.

`frontend/eslint.config.mjs` uses Next.js core web vitals and TypeScript ESLint config.

## Mobile Overview

There are two Expo apps:

- `mobile/worker-app`
- `mobile/checker-app`

They are currently near-identical Expo starter applications with different app names, slugs, and URL schemes.

### Mobile Shared Traits

Both apps use:

- Expo Router entrypoint: `expo-router/entry`
- Expo typed routes
- React Compiler experiment
- Light/dark theme support
- Native tabs via `expo-router/unstable-native-tabs`
- Web tabs via `expo-router/ui`
- `expo-image`
- `expo-symbols`
- `react-native-reanimated`
- `react-native-worklets`
- `react-native-safe-area-context`

### Mobile App Config

`worker-app/app.json`:

- App name: `worker-app`
- Slug: `worker-app`
- Scheme: `workerapp`
- Version: `1.0.0`
- Orientation: portrait
- Web output: static
- User interface style: automatic

`checker-app/app.json`:

- App name: `checker-app`
- Slug: `checker-app`
- Scheme: `checkerapp`
- Version: `1.0.0`
- Orientation: portrait
- Web output: static
- User interface style: automatic

Both configure:

- App icon: `./assets/images/icon.png`
- iOS icon folder: `./assets/expo.icon`
- Android adaptive icon foreground, background, and monochrome images
- `expo-router` plugin
- `expo-splash-screen` plugin with blue background and splash icon

### Mobile Scripts

Both apps expose:

```json
{
  "start": "expo start",
  "reset-project": "node ./scripts/reset-project.js",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "lint": "expo lint"
}
```

### Mobile Dependencies

Both mobile apps have the same runtime dependencies:

- `@expo/ui`: `~56.0.13`
- `@supabase/supabase-js`: `^2.106.2`
- `expo`: `~56.0.4`
- `expo-constants`: `~56.0.15`
- `expo-device`: `~56.0.4`
- `expo-font`: `~56.0.5`
- `expo-glass-effect`: `~56.0.4`
- `expo-image`: `~56.0.9`
- `expo-linking`: `~56.0.11`
- `expo-router`: `~56.2.6`
- `expo-splash-screen`: `~56.0.10`
- `expo-status-bar`: `~56.0.4`
- `expo-symbols`: `~56.0.5`
- `expo-system-ui`: `~56.0.5`
- `expo-web-browser`: `~56.0.5`
- `react`: `19.2.3`
- `react-dom`: `19.2.3`
- `react-native`: `0.85.3`
- `react-native-gesture-handler`: `~2.31.1`
- `react-native-reanimated`: `4.3.1`
- `react-native-safe-area-context`: `~5.7.0`
- `react-native-screens`: `4.25.2`
- `react-native-web`: `~0.21.0`
- `react-native-worklets`: `0.8.3`
- `swr`: `^2.4.1`
- `zustand`: `^5.0.13`

Both mobile apps have the same dev dependencies:

- `@types/react`: `~19.2.2`
- `typescript`: `~6.0.3`

### Mobile Source Structure

Each mobile app has this source structure:

```text
src/
├── app/
│   ├── _layout.tsx
│   ├── explore.tsx
│   └── index.tsx
├── components/
│   ├── animated-icon.module.css
│   ├── animated-icon.tsx
│   ├── animated-icon.web.tsx
│   ├── app-tabs.tsx
│   ├── app-tabs.web.tsx
│   ├── external-link.tsx
│   ├── hint-row.tsx
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   ├── ui/
│   │   └── collapsible.tsx
│   └── web-badge.tsx
├── constants/
│   └── theme.ts
├── global.css
└── hooks/
    ├── use-color-scheme.ts
    ├── use-color-scheme.web.ts
    └── use-theme.ts
```

### Mobile Current Implementation

`src/app/_layout.tsx`:

- Reads system color scheme.
- Applies Expo Router `ThemeProvider`.
- Shows `AnimatedSplashOverlay`.
- Renders `AppTabs`.

`src/app/index.tsx`:

- Starter home screen.
- Shows animated Expo icon and "Welcome to Expo".
- Shows starter hints for editing files, dev tools, and project reset.
- Shows web badge on web.

`src/app/explore.tsx`:

- Starter Explore screen.
- Contains collapsible sections about file-based routing, platform support, images, light/dark mode, and animations.
- Links to Expo and React Native docs.

`components/animated-icon.tsx`:

- Native animated splash overlay using Reanimated keyframes.
- Animated Expo logo and glow image.

`components/animated-icon.web.tsx`:

- Web-specific animated icon implementation.
- Uses CSS module for Expo logo background.

`components/app-tabs.tsx`:

- Native tabs with Home and Explore.
- Uses tab icon PNG assets.

`components/app-tabs.web.tsx`:

- Web tab bar with Home, Explore, brand text "Expo Starter", and Docs link.

`components/external-link.tsx`:

- Uses Expo Router `Link`.
- On native, opens URLs with `expo-web-browser`.

`components/themed-text.tsx` and `components/themed-view.tsx`:

- Local theme-aware wrappers over React Native `Text` and `View`.

`constants/theme.ts`:

- Defines light/dark color sets.
- Defines platform font aliases.
- Defines spacing constants.
- Defines tab inset and max content width.

### Mobile Assets

Both apps include:

- Expo icon asset folder under `assets/expo.icon/`
- App icon and splash images
- Android adaptive icon background, foreground, and monochrome images
- Expo badge images
- Expo logo and glow images
- React logo images
- Home and Explore tab icons at `1x`, `2x`, and `3x`
- Tutorial web PNG
- Favicon

## Infrastructure And Local Services

### Docker Compose

`docker-compose.yml` currently defines only infrastructure services:

| Service | Image | Ports | Notes |
| --- | --- | --- | --- |
| `redis` | `redis:7-alpine` | `6379:6379` | Starts with password `dev_password`; persists data in `redis_data`. |
| `adminer` | `adminer:latest` | `8082:8080` | Database admin UI. |
| `mailhog` | `mailhog/mailhog:latest` | `1025:1025`, `8025:8025` | SMTP capture and web UI. |

Compose also defines:

- Volume: `redis_data`
- Network: `app-network`

Backend services and frontend are not currently defined in Compose.

### Startup Script

`start-all-services.sh` starts:

- `auth-service` on `3001`
- `crm-service` on `3020`
- `hr-service` on `3003`
- `quality-service` on `3004`
- `calendar-service` on `3005`
- `staffing-service` on `3006`
- `notifications-service` on `3007`
- `geo-service` on `3008`
- `chatbot-service` on `3009`
- `analytics-service` on `3010`
- `api-gateway` on `3000`
- Frontend on `3002`

It writes logs to:

- `logs/<service-name>.log`
- `logs/frontend.log`

The readiness harness writes service logs under:

- `logs/readiness/*.log`

### Readiness Harness

`scripts/system-readiness-check.mjs` checks:

- Static Docker Compose entries for backend services
- Docker CLI and `docker compose ps`
- Redis connectivity
- Supabase/database connectivity
- Backend service package existence
- Backend `node_modules` presence
- Backend service startup, unless `--no-start` is used
- Backend `/health` endpoints
- API gateway proxy routes
- Frontend API config
- Frontend source API usage
- Frontend runtime reachability

Supported flags:

- `--no-start`: do not start missing services
- `--keep-running`: leave started services running
- `--verbose`: emit extra cleanup logging

The readiness harness writes `reports/system-readiness-report.md`.

## Current File Inventory

The repository currently has 213 files when excluding `.git`, `node_modules`, `.next`, and `.expo` directories.

Notable full file inventory:

```text
./.env.local
./.gitignore
./README.md
./backend/services/analytics-service/Dockerfile
./backend/services/analytics-service/package-lock.json
./backend/services/analytics-service/package.json
./backend/services/analytics-service/src/index.ts
./backend/services/analytics-service/tsconfig.json
./backend/services/api-gateway/Dockerfile
./backend/services/api-gateway/dist/index.js
./backend/services/api-gateway/package-lock.json
./backend/services/api-gateway/package.json
./backend/services/api-gateway/src/index.ts
./backend/services/api-gateway/tsconfig.json
./backend/services/auth-service/Dockerfile
./backend/services/auth-service/package-lock.json
./backend/services/auth-service/package.json
./backend/services/auth-service/src/index.ts
./backend/services/auth-service/tsconfig.json
./backend/services/calendar-service/Dockerfile
./backend/services/calendar-service/package-lock.json
./backend/services/calendar-service/package.json
./backend/services/calendar-service/src/index.ts
./backend/services/calendar-service/tsconfig.json
./backend/services/chatbot-service/Dockerfile
./backend/services/chatbot-service/package-lock.json
./backend/services/chatbot-service/package.json
./backend/services/chatbot-service/src/index.ts
./backend/services/chatbot-service/tsconfig.json
./backend/services/crm-service/Dockerfile
./backend/services/crm-service/dist/index.js
./backend/services/crm-service/package-lock.json
./backend/services/crm-service/package.json
./backend/services/crm-service/src/index.ts
./backend/services/crm-service/tsconfig.json
./backend/services/geo-service/Dockerfile
./backend/services/geo-service/package-lock.json
./backend/services/geo-service/package.json
./backend/services/geo-service/src/index.ts
./backend/services/geo-service/tsconfig.json
./backend/services/hr-service/Dockerfile
./backend/services/hr-service/package-lock.json
./backend/services/hr-service/package.json
./backend/services/hr-service/src/index.ts
./backend/services/hr-service/tsconfig.json
./backend/services/notifications-service/Dockerfile
./backend/services/notifications-service/package-lock.json
./backend/services/notifications-service/package.json
./backend/services/notifications-service/src/index.ts
./backend/services/notifications-service/tsconfig.json
./backend/services/quality-service/Dockerfile
./backend/services/quality-service/package-lock.json
./backend/services/quality-service/package.json
./backend/services/quality-service/src/index.ts
./backend/services/quality-service/tsconfig.json
./backend/services/staffing-service/Dockerfile
./backend/services/staffing-service/package-lock.json
./backend/services/staffing-service/package.json
./backend/services/staffing-service/src/index.ts
./backend/services/staffing-service/tsconfig.json
./backend/shared/package.json
./backend/shared/tsconfig.json
./docker-compose.yml
./frontend/.env.local
./frontend/.gitignore
./frontend/AGENTS.md
./frontend/CLAUDE.md
./frontend/README.md
./frontend/app/favicon.ico
./frontend/app/globals.css
./frontend/app/layout.tsx
./frontend/app/page.tsx
./frontend/eslint.config.mjs
./frontend/next-env.d.ts
./frontend/next.config.ts
./frontend/package-lock.json
./frontend/package.json
./frontend/postcss.config.mjs
./frontend/public/file.svg
./frontend/public/globe.svg
./frontend/public/next.svg
./frontend/public/vercel.svg
./frontend/public/window.svg
./frontend/tsconfig.json
./logs/readiness/analytics-service.log
./logs/readiness/api-gateway.log
./logs/readiness/auth-service.log
./logs/readiness/calendar-service.log
./logs/readiness/chatbot-service.log
./logs/readiness/crm-service.log
./logs/readiness/geo-service.log
./logs/readiness/hr-service.log
./logs/readiness/notifications-service.log
./logs/readiness/quality-service.log
./logs/readiness/staffing-service.log
./mobile/checker-app/.claude/settings.json
./mobile/checker-app/.env.local
./mobile/checker-app/.gitignore
./mobile/checker-app/.vscode/extensions.json
./mobile/checker-app/.vscode/settings.json
./mobile/checker-app/AGENTS.md
./mobile/checker-app/CLAUDE.md
./mobile/checker-app/LICENSE
./mobile/checker-app/README.md
./mobile/checker-app/app.json
./mobile/checker-app/assets/expo.icon/Assets/expo-symbol 2.svg
./mobile/checker-app/assets/expo.icon/Assets/grid.png
./mobile/checker-app/assets/expo.icon/icon.json
./mobile/checker-app/assets/images/android-icon-background.png
./mobile/checker-app/assets/images/android-icon-foreground.png
./mobile/checker-app/assets/images/android-icon-monochrome.png
./mobile/checker-app/assets/images/expo-badge-white.png
./mobile/checker-app/assets/images/expo-badge.png
./mobile/checker-app/assets/images/expo-logo.png
./mobile/checker-app/assets/images/favicon.png
./mobile/checker-app/assets/images/icon.png
./mobile/checker-app/assets/images/logo-glow.png
./mobile/checker-app/assets/images/react-logo.png
./mobile/checker-app/assets/images/react-logo@2x.png
./mobile/checker-app/assets/images/react-logo@3x.png
./mobile/checker-app/assets/images/splash-icon.png
./mobile/checker-app/assets/images/tabIcons/explore.png
./mobile/checker-app/assets/images/tabIcons/explore@2x.png
./mobile/checker-app/assets/images/tabIcons/explore@3x.png
./mobile/checker-app/assets/images/tabIcons/home.png
./mobile/checker-app/assets/images/tabIcons/home@2x.png
./mobile/checker-app/assets/images/tabIcons/home@3x.png
./mobile/checker-app/assets/images/tutorial-web.png
./mobile/checker-app/package-lock.json
./mobile/checker-app/package.json
./mobile/checker-app/scripts/reset-project.js
./mobile/checker-app/src/app/_layout.tsx
./mobile/checker-app/src/app/explore.tsx
./mobile/checker-app/src/app/index.tsx
./mobile/checker-app/src/components/animated-icon.module.css
./mobile/checker-app/src/components/animated-icon.tsx
./mobile/checker-app/src/components/animated-icon.web.tsx
./mobile/checker-app/src/components/app-tabs.tsx
./mobile/checker-app/src/components/app-tabs.web.tsx
./mobile/checker-app/src/components/external-link.tsx
./mobile/checker-app/src/components/hint-row.tsx
./mobile/checker-app/src/components/themed-text.tsx
./mobile/checker-app/src/components/themed-view.tsx
./mobile/checker-app/src/components/ui/collapsible.tsx
./mobile/checker-app/src/components/web-badge.tsx
./mobile/checker-app/src/constants/theme.ts
./mobile/checker-app/src/global.css
./mobile/checker-app/src/hooks/use-color-scheme.ts
./mobile/checker-app/src/hooks/use-color-scheme.web.ts
./mobile/checker-app/src/hooks/use-theme.ts
./mobile/checker-app/tsconfig.json
./mobile/worker-app/.claude/settings.json
./mobile/worker-app/.env.local
./mobile/worker-app/.gitignore
./mobile/worker-app/.vscode/extensions.json
./mobile/worker-app/.vscode/settings.json
./mobile/worker-app/AGENTS.md
./mobile/worker-app/CLAUDE.md
./mobile/worker-app/LICENSE
./mobile/worker-app/README.md
./mobile/worker-app/app.json
./mobile/worker-app/assets/expo.icon/Assets/expo-symbol 2.svg
./mobile/worker-app/assets/expo.icon/Assets/grid.png
./mobile/worker-app/assets/expo.icon/icon.json
./mobile/worker-app/assets/images/android-icon-background.png
./mobile/worker-app/assets/images/android-icon-foreground.png
./mobile/worker-app/assets/images/android-icon-monochrome.png
./mobile/worker-app/assets/images/expo-badge-white.png
./mobile/worker-app/assets/images/expo-badge.png
./mobile/worker-app/assets/images/expo-logo.png
./mobile/worker-app/assets/images/favicon.png
./mobile/worker-app/assets/images/icon.png
./mobile/worker-app/assets/images/logo-glow.png
./mobile/worker-app/assets/images/react-logo.png
./mobile/worker-app/assets/images/react-logo@2x.png
./mobile/worker-app/assets/images/react-logo@3x.png
./mobile/worker-app/assets/images/splash-icon.png
./mobile/worker-app/assets/images/tabIcons/explore.png
./mobile/worker-app/assets/images/tabIcons/explore@2x.png
./mobile/worker-app/assets/images/tabIcons/explore@3x.png
./mobile/worker-app/assets/images/tabIcons/home.png
./mobile/worker-app/assets/images/tabIcons/home@2x.png
./mobile/worker-app/assets/images/tabIcons/home@3x.png
./mobile/worker-app/assets/images/tutorial-web.png
./mobile/worker-app/expo-env.d.ts
./mobile/worker-app/package-lock.json
./mobile/worker-app/package.json
./mobile/worker-app/scripts/reset-project.js
./mobile/worker-app/src/app/_layout.tsx
./mobile/worker-app/src/app/explore.tsx
./mobile/worker-app/src/app/index.tsx
./mobile/worker-app/src/components/animated-icon.module.css
./mobile/worker-app/src/components/animated-icon.tsx
./mobile/worker-app/src/components/animated-icon.web.tsx
./mobile/worker-app/src/components/app-tabs.tsx
./mobile/worker-app/src/components/app-tabs.web.tsx
./mobile/worker-app/src/components/external-link.tsx
./mobile/worker-app/src/components/hint-row.tsx
./mobile/worker-app/src/components/themed-text.tsx
./mobile/worker-app/src/components/themed-view.tsx
./mobile/worker-app/src/components/ui/collapsible.tsx
./mobile/worker-app/src/components/web-badge.tsx
./mobile/worker-app/src/constants/theme.ts
./mobile/worker-app/src/global.css
./mobile/worker-app/src/hooks/use-color-scheme.ts
./mobile/worker-app/src/hooks/use-color-scheme.web.ts
./mobile/worker-app/src/hooks/use-theme.ts
./mobile/worker-app/tsconfig.json
./package.json
./reports/system-readiness-report.md
./scripts/system-readiness-check.mjs
./scripts/test-environment.sh
./start-all-services.sh
```

## Current Gaps And Risks

- The user-facing web app is still a stock Next.js starter screen.
- Both mobile apps are still stock Expo starter screens.
- Backend domain APIs do not yet implement real hotel CRM business logic.
- Backend services do not persist or read data yet.
- Supabase client packages are installed but not wired into frontend or backend flows.
- SWR and Zustand are installed in frontend/mobile but not used yet.
- Docker Compose does not start the app services.
- Backend Dockerfiles expose the same port for every service.
- No backend tests are implemented; service `test` scripts intentionally fail with "no test specified".
- There is no root workspace setup to install/build all packages together.
- Root README is empty.
- Shared backend package has dependencies and build config but no source files.
- `backend/migrations`, `deployment/docker`, `deployment/k8s`, `docs`, and `mobile/shared` are empty.
- Local readiness currently fails because supporting services and app services are not running.

## What Is Actually Built Versus Scaffolded

Built and present:

- Multi-service backend folder structure.
- TypeScript Express service skeletons.
- API gateway proxy skeleton.
- Health endpoints for all backend services.
- Placeholder domain endpoints for all backend services.
- Next.js frontend project with Tailwind and lint/build scripts.
- Two Expo mobile app projects with routing, theming, tabs, assets, and starter screens.
- Docker Compose infrastructure for Redis, Adminer, and Mailhog.
- Local startup script for services and frontend.
- Readiness harness that can validate local environment state.

Still scaffolded or not yet implemented:

- Real CRM dashboard UI.
- Authentication flow.
- Supabase database models, migrations, and CRUD.
- Hotel, task, HR, quality, calendar, staffing, notification, geo, chatbot, and analytics business logic.
- Shared types/contracts.
- Mobile app role-specific workflows for workers/checkers.
- Centralized logging, auth middleware, request validation, and error response conventions.
- CI/CD, deployment manifests, and production config.
