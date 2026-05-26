# System Readiness Report

Generated: 2026-05-26T07:27:13.947Z

## Summary

- Passing checks: 23
- Warnings: 12
- Failures: 13
- Skipped: 0

## What Is Working Well

- Auth Service and API Gateway health endpoints are responding.
- Most Node services can be started by the readiness harness and respond on `/health`.

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

- P0: Database / Supabase REST connectivity: HTTP 401
- P0: API Gateway routing / auth-service: POST /api/v1/auth/signup -> HTTP 404
- P0: API Gateway routing / crm-service: GET /api/v1/crm/hotels -> HTTP 404
- P0: API Gateway routing / hr-service: GET /api/v1/hr/contracts -> HTTP 404
- P0: API Gateway routing / quality-service: POST /api/v1/quality/ratings -> HTTP 404
- P0: API Gateway routing / calendar-service: GET /api/v1/calendar/schedules -> HTTP 404
- P0: API Gateway routing / staffing-service: POST /api/v1/staffing/work-requests -> HTTP 404
- P0: API Gateway routing / notifications-service: POST /api/v1/notifications/notifications -> HTTP 404
- P0: API Gateway routing / geo-service: POST /api/v1/geo/locations -> HTTP 404
- P0: API Gateway routing / chatbot-service: POST /api/v1/chatbot/chat -> HTTP 404
- P0: API Gateway routing / analytics-service: GET /api/v1/analytics -> HTTP 404
- P1: Docker / compose ps: failed to connect to the docker API at unix:///Users/mayankmalhotra/.docker/run/docker.sock; check if the path is correct and if the daemon is running: dial unix /Users/mayankmalhotra/.docker/run/docker.sock: connect: no such file or directory
- P1: Redis / PING: Could not connect to Redis at localhost:6379: Connection refused
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
- P2: Frontend / runtime: http://127.0.0.1:3002/ -> connect ECONNREFUSED 127.0.0.1:3002

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
| FAIL | Docker | compose ps | failed to connect to the docker API at unix:///Users/mayankmalhotra/.docker/run/docker.sock; check if the path is correct and if the daemon is running: dial unix /Users/mayankmalhotra/.docker/run/docker.sock: connect: no such file or directory | P1 |
| FAIL | Redis | PING | Could not connect to Redis at localhost:6379: Connection refused | P1 |
| FAIL | Database | Supabase REST connectivity | HTTP 401 | P0 |
| PASS | Service startup | auth-service | started on port 3001 |  |
| PASS | Health endpoint | auth-service | HTTP 200 |  |
| PASS | Service startup | crm-service | started on port 3020 |  |
| PASS | Health endpoint | crm-service | HTTP 200 |  |
| PASS | Service startup | hr-service | started on port 3003 |  |
| PASS | Health endpoint | hr-service | HTTP 200 |  |
| PASS | Service startup | quality-service | started on port 3004 |  |
| PASS | Health endpoint | quality-service | HTTP 200 |  |
| PASS | Service startup | calendar-service | started on port 3005 |  |
| PASS | Health endpoint | calendar-service | HTTP 200 |  |
| PASS | Service startup | staffing-service | started on port 3006 |  |
| PASS | Health endpoint | staffing-service | HTTP 200 |  |
| PASS | Service startup | notifications-service | started on port 3007 |  |
| PASS | Health endpoint | notifications-service | HTTP 200 |  |
| PASS | Service startup | geo-service | started on port 3008 |  |
| PASS | Health endpoint | geo-service | HTTP 200 |  |
| PASS | Service startup | chatbot-service | started on port 3009 |  |
| PASS | Health endpoint | chatbot-service | HTTP 200 |  |
| PASS | Service startup | analytics-service | started on port 3010 |  |
| PASS | Health endpoint | analytics-service | HTTP 200 |  |
| PASS | Service startup | api-gateway | port 3000 already open |  |
| PASS | Health endpoint | api-gateway | HTTP 200 |  |
| FAIL | API Gateway routing | auth-service | POST /api/v1/auth/signup -> HTTP 404 | P0 |
| FAIL | API Gateway routing | crm-service | GET /api/v1/crm/hotels -> HTTP 404 | P0 |
| FAIL | API Gateway routing | hr-service | GET /api/v1/hr/contracts -> HTTP 404 | P0 |
| FAIL | API Gateway routing | quality-service | POST /api/v1/quality/ratings -> HTTP 404 | P0 |
| FAIL | API Gateway routing | calendar-service | GET /api/v1/calendar/schedules -> HTTP 404 | P0 |
| FAIL | API Gateway routing | staffing-service | POST /api/v1/staffing/work-requests -> HTTP 404 | P0 |
| FAIL | API Gateway routing | notifications-service | POST /api/v1/notifications/notifications -> HTTP 404 | P0 |
| FAIL | API Gateway routing | geo-service | POST /api/v1/geo/locations -> HTTP 404 | P0 |
| FAIL | API Gateway routing | chatbot-service | POST /api/v1/chatbot/chat -> HTTP 404 | P0 |
| FAIL | API Gateway routing | analytics-service | GET /api/v1/analytics -> HTTP 404 | P0 |
| PASS | Frontend | API configuration | http://localhost:3000/health -> HTTP 200 |  |
| WARN | Frontend | backend call implementation | app/page.tsx does not make backend API calls yet | P2 |
| WARN | Frontend | runtime | http://127.0.0.1:3002/ -> connect ECONNREFUSED 127.0.0.1:3002 | P2 |

## How To Run

```bash
npm run test:readiness
npm run test:readiness -- --no-start
npm run test:readiness -- --keep-running
```

