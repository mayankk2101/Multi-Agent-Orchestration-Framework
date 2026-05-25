# System Readiness Report

Generated: 2026-05-25T22:22:30.320Z

## Summary

- Passing checks: 12
- Warnings: 11
- Failures: 11
- Skipped: 8

## What Is Working Well

- Docker Compose infrastructure services are visible: Redis, Adminer, and Mailhog.
- Redis accepts authenticated connections and responds to `PING`.
- Auth Service and API Gateway health endpoints are responding.
- The frontend runtime is reachable on its configured local port.

## What Needs Fixing

- Keep the local port map consistent across services, scripts, Docker, and the readiness harness.
- Fix API Gateway proxy path handling. Mounted Express middleware receives paths after the mount prefix is stripped, so the current `pathRewrite` rules send requests like `/contracts` instead of `/api/v1/contracts`.
- Fix POST proxying through the API Gateway. `express.json()` runs before proxy middleware, so proxied POST bodies can be consumed before `http-proxy-middleware` forwards them.
- Replace placeholder or malformed Supabase values in `.env.local`; the current Supabase URL is not a valid `http(s)` URL.
- Update `start-all-services.sh`; it points to `web-dashboard`, but this repo uses `frontend`.

## Missing Or Incomplete

- Backend Node services are not represented in `docker-compose.yml`; only Redis, Adminer, and Mailhog are defined.
- The frontend still appears to be the stock Next.js starter page and does not make an application API call from `app/page.tsx`.
- Service endpoints are placeholders (`coming soon`) and do not yet exercise Supabase-backed business flows.
- There is no shared smoke-test command for mobile apps yet.

## Recommended Next Steps

1. Keep the selected port map consistent: API Gateway `3000`, Auth `3001`, frontend `3002`, HR `3003`, and CRM `3020`.
2. Fix API Gateway routing, then rerun `npm run test:readiness -- --no-start` against already-running services.
3. Correct `.env.local` and verify Supabase with this readiness check before wiring feature work to database tables.
4. Add backend service definitions or a separate dev compose profile so the full stack can be started reproducibly.
5. Replace the frontend starter screen with a minimal authenticated CRM shell that calls the API Gateway health/status endpoint first.

## Priority Fixes

- P0: Database / Supabase REST connectivity: Supabase URL is not a valid http(s) URL
- P0: API Gateway routing / auth-service: POST /api/v1/auth/signup -> request timed out
- P0: API Gateway routing / crm-service: GET /api/v1/crm/hotels -> HTTP 404
- P0: API Gateway routing / hr-service: GET /api/v1/hr/contracts -> HTTP 504
- P0: API Gateway routing / quality-service: POST /api/v1/quality/ratings -> HTTP 404
- P0: API Gateway routing / calendar-service: GET /api/v1/calendar/schedules -> HTTP 504
- P0: API Gateway routing / staffing-service: POST /api/v1/staffing/work-requests -> HTTP 504
- P0: API Gateway routing / notifications-service: POST /api/v1/notifications/notifications -> HTTP 504
- P0: API Gateway routing / geo-service: POST /api/v1/geo/locations -> HTTP 504
- P0: API Gateway routing / chatbot-service: POST /api/v1/chatbot/chat -> HTTP 504
- P0: API Gateway routing / analytics-service: GET /api/v1/analytics -> HTTP 504
- P2: Static config / auth-service compose entry: missing from docker-compose.yml
- P2: Static config / crm-service compose entry: missing from docker-compose.yml
- P2: Static config / hr-service compose entry: missing from docker-compose.yml
- P2: Static config / quality-service compose entry: missing from docker-compose.yml
- P2: Static config / calendar-service compose entry: missing from docker-compose.yml
- P2: Static config / staffing-service compose entry: missing from docker-compose.yml
- P2: Static config / notifications-service compose entry: missing from docker-compose.yml
- P2: Static config / geo-service compose entry: missing from docker-compose.yml
- P2: Static config / chatbot-service compose entry: missing from docker-compose.yml
- P2: Static config / analytics-service compose entry: missing from docker-compose.yml
- P2: Frontend / backend call implementation: app/page.tsx does not make backend API calls yet

## Detailed Results

| Status | Area | Check | Details | Priority |
| --- | --- | --- | --- | --- |
| WARN | Static config | auth-service compose entry | missing from docker-compose.yml | P2 |
| WARN | Static config | crm-service compose entry | missing from docker-compose.yml | P2 |
| WARN | Static config | hr-service compose entry | missing from docker-compose.yml | P2 |
| WARN | Static config | quality-service compose entry | missing from docker-compose.yml | P2 |
| WARN | Static config | calendar-service compose entry | missing from docker-compose.yml | P2 |
| WARN | Static config | staffing-service compose entry | missing from docker-compose.yml | P2 |
| WARN | Static config | notifications-service compose entry | missing from docker-compose.yml | P2 |
| WARN | Static config | geo-service compose entry | missing from docker-compose.yml | P2 |
| WARN | Static config | chatbot-service compose entry | missing from docker-compose.yml | P2 |
| WARN | Static config | analytics-service compose entry | missing from docker-compose.yml | P2 |
| PASS | Docker | redis | listed by docker compose ps |  |
| PASS | Docker | adminer | listed by docker compose ps |  |
| PASS | Docker | mailhog | listed by docker compose ps |  |
| PASS | Redis | PING | PONG |  |
| FAIL | Database | Supabase REST connectivity | Supabase URL is not a valid http(s) URL | P0 |
| PASS | Service startup | auth-service | port 3001 already open |  |
| PASS | Health endpoint | auth-service | HTTP 200 |  |
| SKIP | Service startup | crm-service | not running and --no-start was used |  |
| SKIP | Service startup | hr-service | not running and --no-start was used |  |
| PASS | Service startup | quality-service | port 3004 already open |  |
| PASS | Health endpoint | quality-service | HTTP 200 |  |
| SKIP | Service startup | calendar-service | not running and --no-start was used |  |
| SKIP | Service startup | staffing-service | not running and --no-start was used |  |
| SKIP | Service startup | notifications-service | not running and --no-start was used |  |
| SKIP | Service startup | geo-service | not running and --no-start was used |  |
| SKIP | Service startup | chatbot-service | not running and --no-start was used |  |
| SKIP | Service startup | analytics-service | not running and --no-start was used |  |
| PASS | Service startup | api-gateway | port 3000 already open |  |
| PASS | Health endpoint | api-gateway | HTTP 200 |  |
| FAIL | API Gateway routing | auth-service | POST /api/v1/auth/signup -> request timed out | P0 |
| FAIL | API Gateway routing | crm-service | GET /api/v1/crm/hotels -> HTTP 404 | P0 |
| FAIL | API Gateway routing | hr-service | GET /api/v1/hr/contracts -> HTTP 504 | P0 |
| FAIL | API Gateway routing | quality-service | POST /api/v1/quality/ratings -> HTTP 404 | P0 |
| FAIL | API Gateway routing | calendar-service | GET /api/v1/calendar/schedules -> HTTP 504 | P0 |
| FAIL | API Gateway routing | staffing-service | POST /api/v1/staffing/work-requests -> HTTP 504 | P0 |
| FAIL | API Gateway routing | notifications-service | POST /api/v1/notifications/notifications -> HTTP 504 | P0 |
| FAIL | API Gateway routing | geo-service | POST /api/v1/geo/locations -> HTTP 504 | P0 |
| FAIL | API Gateway routing | chatbot-service | POST /api/v1/chatbot/chat -> HTTP 504 | P0 |
| FAIL | API Gateway routing | analytics-service | GET /api/v1/analytics -> HTTP 504 | P0 |
| PASS | Frontend | API configuration | http://localhost:3000/health -> HTTP 200 |  |
| WARN | Frontend | backend call implementation | app/page.tsx does not make backend API calls yet | P2 |
| PASS | Frontend | runtime | http://127.0.0.1:3002/ -> HTTP 200 |  |

## How To Run

```bash
npm run test:readiness
npm run test:readiness -- --no-start
npm run test:readiness -- --keep-running
```

