#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL=0
PASSED=0
FAILED=0
WARNED=0

PASSED_ITEMS=()
FAILED_ITEMS=()
WARNED_ITEMS=()
RESPONDING_PORTS=()
WORKING_ROUTES=()
FAILED_ROUTES=()
WORKING_SERVICES=()
FAILED_SERVICES=()

print_header() {
  echo
  echo -e "${BLUE}== $1 ==${NC}"
}

pass() {
  local name="$1"
  local detail="${2:-}"
  TOTAL=$((TOTAL + 1))
  PASSED=$((PASSED + 1))
  PASSED_ITEMS+=("$name")
  echo -e "${GREEN}PASS${NC} $name${detail:+ - $detail}"
}

fail() {
  local name="$1"
  local detail="${2:-}"
  TOTAL=$((TOTAL + 1))
  FAILED=$((FAILED + 1))
  FAILED_ITEMS+=("$name${detail:+: $detail}")
  echo -e "${RED}FAIL${NC} $name${detail:+ - $detail}"
}

warn() {
  local name="$1"
  local detail="${2:-}"
  TOTAL=$((TOTAL + 1))
  WARNED=$((WARNED + 1))
  WARNED_ITEMS+=("$name${detail:+: $detail}")
  echo -e "${YELLOW}WARN${NC} $name${detail:+ - $detail}"
}

http_status() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local headers=(-H "Content-Type: application/json")

  if [[ -n "$body" ]]; then
    curl -sS -o /tmp/hotel-crm-test-body.txt -w "%{http_code}" -X "$method" "${headers[@]}" -d "$body" --max-time 10 "$url" 2>/tmp/hotel-crm-test-error.txt
  else
    curl -sS -o /tmp/hotel-crm-test-body.txt -w "%{http_code}" -X "$method" --max-time 10 "$url" 2>/tmp/hotel-crm-test-error.txt
  fi
}

body_preview() {
  if [[ -s /tmp/hotel-crm-test-error.txt ]]; then
    tr '\n' ' ' < /tmp/hotel-crm-test-error.txt | cut -c 1-160
  elif [[ -s /tmp/hotel-crm-test-body.txt ]]; then
    tr '\n' ' ' < /tmp/hotel-crm-test-body.txt | cut -c 1-160
  else
    echo "no response body"
  fi
}

check_http() {
  local name="$1"
  local method="$2"
  local url="$3"
  local expected="$4"
  local body="${5:-}"
  local status

  status="$(http_status "$method" "$url" "$body")"
  if [[ "$status" == "$expected" ]]; then
    pass "$name" "HTTP $status"
    return 0
  fi

  fail "$name" "expected HTTP $expected, got HTTP ${status:-000}; $(body_preview)"
  return 1
}

check_frontend_env() {
  local file="$ROOT_DIR/frontend/.env.local"
  if [[ ! -f "$file" ]]; then
    fail "Frontend env" "frontend/.env.local missing"
    return
  fi

  if grep -q '^NEXT_PUBLIC_API_URL=http://localhost:3000$' "$file"; then
    pass "Frontend env" "NEXT_PUBLIC_API_URL=http://localhost:3000"
  else
    fail "Frontend env" "NEXT_PUBLIC_API_URL is missing or not http://localhost:3000"
  fi
}

load_env_value() {
  local key="$1"
  local file
  for file in "$ROOT_DIR/.env.local" "$ROOT_DIR/frontend/.env.local"; do
    if [[ -f "$file" ]]; then
      local value
      value="$(grep -E "^${key}=" "$file" | tail -n 1 | cut -d '=' -f 2- | sed -E "s/^['\"]//; s/['\"]$//")"
      if [[ -n "$value" ]]; then
        echo "$value"
        return
      fi
    fi
  done
}

check_docker_services() {
  print_header "Infrastructure"

  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker CLI" "docker command not found"
    return
  fi

  local compose_output
  if compose_output="$(cd "$ROOT_DIR" && docker compose ps 2>&1)"; then
    pass "Docker compose" "docker compose ps succeeded"
    local service
    for service in redis adminer mailhog; do
      if echo "$compose_output" | grep -qi "$service"; then
        pass "Docker service: $service" "listed by docker compose ps"
      else
        fail "Docker service: $service" "not listed by docker compose ps"
      fi
    done
  else
    fail "Docker compose" "$compose_output"
  fi

  check_redis
  check_http "Adminer UI" GET "http://localhost:8082" 200 || true
  check_http "Mailhog UI" GET "http://localhost:8025" 200 || true
}

check_redis() {
  if ! command -v redis-cli >/dev/null 2>&1; then
    warn "Redis PING" "redis-cli not found"
    return
  fi

  local output
  if output="$(redis-cli ping 2>&1)" && [[ "$output" == *PONG* ]]; then
    pass "Redis PING" "$output"
    return
  fi

  if output="$(redis-cli -a dev_password ping 2>&1)" && [[ "$output" == *PONG* ]]; then
    pass "Redis PING" "PONG with dev_password"
    return
  fi

  fail "Redis PING" "$output"
}

check_service_health() {
  print_header "Backend Service Health"

  local services=(
    "Auth:3001:auth-service"
    "CRM:3020:crm-service"
    "HR:3003:hr-service"
    "Quality:3004:quality-service"
    "Calendar:3005:calendar-service"
    "Staffing:3006:staffing-service"
    "Notifications:3007:notifications-service"
    "Geo:3008:geo-service"
    "Chatbot:3009:chatbot-service"
    "Analytics:3010:analytics-service"
  )

  local item name port service status
  for item in "${services[@]}"; do
    IFS=':' read -r name port service <<< "$item"
    status="$(http_status GET "http://localhost:${port}/health")"
    if [[ "$status" == "200" ]] && grep -q "\"service\":\"$service\"" /tmp/hotel-crm-test-body.txt; then
      pass "$name health" "port $port HTTP 200"
      RESPONDING_PORTS+=("$port")
      WORKING_SERVICES+=("$name")
    else
      fail "$name health" "port $port HTTP ${status:-000}; $(body_preview)"
      FAILED_SERVICES+=("$name")
    fi
  done
}

check_gateway() {
  print_header "API Gateway"

  if check_http "API Gateway health" GET "http://localhost:3000/health" 200; then
    RESPONDING_PORTS+=("3000")
  fi

  print_header "API Gateway GET Routes"

  local get_routes=(
    "CRM hotels|http://localhost:3000/api/v1/crm/hotels"
    "HR contracts|http://localhost:3000/api/v1/hr/contracts"
    "Quality ratings|http://localhost:3000/api/v1/quality/ratings"
    "Calendar schedules|http://localhost:3000/api/v1/calendar/schedules"
    "Analytics|http://localhost:3000/api/v1/analytics"
  )

  local item name url
  for item in "${get_routes[@]}"; do
    IFS='|' read -r name url <<< "$item"
    if check_http "$name" GET "$url" 200; then
      WORKING_ROUTES+=("GET $url")
    else
      FAILED_ROUTES+=("GET $url")
    fi
  done

  print_header "API Gateway POST Routes"

  local post_routes=(
    "Auth signup|http://localhost:3000/api/v1/auth/signup|{\"email\":\"test@example.com\"}"
    "Quality rating|http://localhost:3000/api/v1/quality/ratings|{\"score\":85}"
    "Staffing work request|http://localhost:3000/api/v1/staffing/work-requests|{\"role\":\"worker\"}"
    "Notifications|http://localhost:3000/api/v1/notifications/notifications|{\"message\":\"test\"}"
    "Geo location|http://localhost:3000/api/v1/geo/locations|{\"lat\":0,\"lng\":0}"
    "Chatbot chat|http://localhost:3000/api/v1/chatbot/chat|{\"message\":\"hello\"}"
  )

  local body
  for item in "${post_routes[@]}"; do
    IFS='|' read -r name url body <<< "$item"
    if check_http "$name" POST "$url" 200 "$body"; then
      WORKING_ROUTES+=("POST $url")
    else
      FAILED_ROUTES+=("POST $url")
    fi
  done
}

check_frontend() {
  print_header "Frontend"

  check_http "Frontend runtime" GET "http://localhost:3002" 200 || true
  check_frontend_env
}

check_supabase() {
  print_header "Database"

  local supabase_url
  local supabase_anon_key
  supabase_url="$(load_env_value NEXT_PUBLIC_SUPABASE_URL)"
  supabase_anon_key="$(load_env_value NEXT_PUBLIC_SUPABASE_ANON_KEY)"

  if [[ -z "$supabase_url" || -z "$supabase_anon_key" ]]; then
    fail "Supabase REST connectivity" "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing"
    return
  fi

  if [[ ! "$supabase_url" =~ ^https?:// ]]; then
    fail "Supabase REST connectivity" "URL must start with http:// or https://"
    return
  fi

  local status
  status="$(curl -sS -o /tmp/hotel-crm-test-body.txt -w "%{http_code}" \
    -H "apikey: $supabase_anon_key" \
    -H "authorization: Bearer $supabase_anon_key" \
    --max-time 15 \
    "${supabase_url%/}/rest/v1/" 2>/tmp/hotel-crm-test-error.txt)"

  if [[ "$status" =~ ^([23][0-9][0-9]|404)$ ]]; then
    pass "Supabase REST connectivity" "HTTP $status"
  elif [[ "$status" == "401" ]]; then
    fail "Supabase REST connectivity" "HTTP 401; anon key is missing, invalid, or does not match the project"
  else
    fail "Supabase REST connectivity" "HTTP ${status:-000}; $(body_preview)"
  fi
}

print_summary() {
  print_header "Summary"

  echo "Total tests run: $TOTAL"
  echo -e "Passed tests: ${GREEN}$PASSED${NC}"
  echo -e "Failed tests: ${RED}$FAILED${NC}"
  echo -e "Warnings: ${YELLOW}$WARNED${NC}"
  echo

  echo "Responding ports: ${RESPONDING_PORTS[*]:-none}"
  echo "Working services: ${WORKING_SERVICES[*]:-none}"
  echo "Not working services: ${FAILED_SERVICES[*]:-none}"
  echo

  echo "Working API routes:"
  if [[ ${#WORKING_ROUTES[@]} -eq 0 ]]; then
    echo "  none"
  else
    printf '  %s\n' "${WORKING_ROUTES[@]}"
  fi

  echo
  echo "Failed API routes:"
  if [[ ${#FAILED_ROUTES[@]} -eq 0 ]]; then
    echo "  none"
  else
    printf '  %s\n' "${FAILED_ROUTES[@]}"
  fi

  if [[ ${#FAILED_ITEMS[@]} -gt 0 ]]; then
    echo
    echo -e "${RED}Failures:${NC}"
    printf '  %s\n' "${FAILED_ITEMS[@]}"
  fi

  if [[ ${#WARNED_ITEMS[@]} -gt 0 ]]; then
    echo
    echo -e "${YELLOW}Warnings:${NC}"
    printf '  %s\n' "${WARNED_ITEMS[@]}"
  fi
}

main() {
  echo -e "${BLUE}Hotel CRM Environment Test${NC}"
  echo "Root: $ROOT_DIR"

  check_docker_services
  check_service_health
  check_gateway
  check_frontend
  check_supabase
  print_summary

  if [[ "$FAILED" -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
