#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting all services...${NC}\n"

mkdir -p logs

# Start each service in the background
services=(
  "auth-service:3001"
  "crm-service:3020"
  "hr-service:3003"
  "quality-service:3004"
  "calendar-service:3005"
  "staffing-service:3006"
  "notifications-service:3007"
  "geo-service:3008"
  "chatbot-service:3009"
  "analytics-service:3010"
  "api-gateway:3000"
)

for service in "${services[@]}"; do
  name="${service%%:*}"
  port="${service##*:}"
  
  echo -e "${GREEN}Starting $name on port $port${NC}"
  cd "backend/services/$name"
  PORT="$port" npm run dev > "../../../logs/$name.log" 2>&1 &
  cd ../../..
  sleep 1
done

# Start frontend
echo -e "${GREEN}Starting frontend on port 3002${NC}"
cd frontend
npm run dev -- -p 3002 > ../logs/frontend.log 2>&1 &
cd ..

echo -e "${BLUE}\nAll services started!${NC}"
echo -e "${BLUE}Check logs in: logs/ folder${NC}"
echo -e "\nAccess points:"
echo "  Frontend: http://localhost:3002"
echo "  API Gateway: http://localhost:3000/health"
echo "  CRM Service: http://localhost:3020/health"
echo "  Redis: localhost:6379"
echo "  Mailhog: http://localhost:8025"
echo "  Adminer: http://localhost:8082"
