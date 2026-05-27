# System Readiness Report

Generated: 2026-05-27T11:08:25.361Z

## Summary

- Passing checks: 0
- Warnings: 12
- Failures: 5
- Skipped: 11

## What Is Working Well


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
- P0: API Gateway routing / gateway unavailable: connect ECONNREFUSED 127.0.0.1:3000
- P1: Docker / compose ps: failed to connect to the docker API at unix:///Users/mayankmalhotra/.docker/run/docker.sock; check if the path is correct and if the daemon is running: dial unix /Users/mayankmalhotra/.docker/run/docker.sock: connect: no such file or directory
- P1: Redis / PING: Could not connect to Redis at localhost:6379: Connection refused
- P1: Frontend / API configuration: http://localhost:3000/health -> HTTP undefined
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
| SKIP | Service startup | auth-service | not running and --no-start was used |  |
| SKIP | Service startup | crm-service | not running and --no-start was used |  |
| SKIP | Service startup | hr-service | not running and --no-start was used |  |
| SKIP | Service startup | quality-service | not running and --no-start was used |  |
| SKIP | Service startup | calendar-service | not running and --no-start was used |  |
| SKIP | Service startup | staffing-service | not running and --no-start was used |  |
| SKIP | Service startup | notifications-service | not running and --no-start was used |  |
| SKIP | Service startup | geo-service | not running and --no-start was used |  |
| SKIP | Service startup | chatbot-service | not running and --no-start was used |  |
| SKIP | Service startup | analytics-service | not running and --no-start was used |  |
| SKIP | Service startup | api-gateway | not running and --no-start was used |  |
| FAIL | API Gateway routing | gateway unavailable | connect ECONNREFUSED 127.0.0.1:3000 | P0 |
| FAIL | Frontend | API configuration | http://localhost:3000/health -> HTTP undefined | P1 |
| WARN | Frontend | backend call implementation | app/page.tsx does not make backend API calls yet | P2 |
| WARN | Frontend | runtime | http://127.0.0.1:3002/ -> connect ECONNREFUSED 127.0.0.1:3002 | P2 |

## How To Run

```bash
npm run test:readiness
npm run test:readiness -- --no-start
npm run test:readiness -- --keep-running
```

