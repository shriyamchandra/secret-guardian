#!/bin/bash

# Secret Guardian - Full Stack Runner Script
# This script runs both the FastAPI backend and Next.js frontend

# Color codes for pretty output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to kill background processes on exit
cleanup() {
    echo -e "\n${RED}🛑 Shutting down services...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}

# Trap SIGINT (Ctrl+C)
trap cleanup SIGINT

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}    Secret Guardian - Full Stack App${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get the absolute path of the project root
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# ------------------------------------------------------------------
# 1. SETUP & START BACKEND
# ------------------------------------------------------------------
echo -e "${BLUE}⚙️  Configuring Backend...${NC}"
cd "$PROJECT_ROOT/backend" || exit

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Backend venv not found. Creating...${NC}"
    # Try generic python3, fallback to specific path if needed
    python3 -m venv venv || /opt/homebrew/bin/python3.12 -m venv venv
    source venv/bin/activate
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Check env
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo -e "${YELLOW}Creating backend .env from example...${NC}"
    cp .env.example .env
fi

echo -e "${GREEN}✓ Backend ready${NC}"
echo -e "${YELLOW}Starting Backend Server (Background)...${NC}"

# Run uvicorn in background
uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /dev/null 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend running (PID: $BACKEND_PID)${NC}"
echo ""

# ------------------------------------------------------------------
# 2. SETUP & START FRONTEND
# ------------------------------------------------------------------
echo -e "${BLUE}⚙️  Configuring Frontend...${NC}"
cd "$PROJECT_ROOT/frontend" || exit

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}node_modules not found. Installing dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}✓ Frontend dependencies found${NC}"
fi

echo -e "${YELLOW}Starting Frontend Server...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Run frontend in foreground so we can see its logs and Ctrl+C it
npm run dev
