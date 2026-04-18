#!/bin/bash

# Secret Guardian - Full Stack Runner Script
# Usage:
#   ./start.sh          -> start backend + frontend in detached mode
#   ./start.sh start    -> start backend + frontend in detached mode
#   ./start.sh stop     -> stop services started by this script
#   ./start.sh status   -> show service status

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$PROJECT_ROOT/.runtime"
LOG_DIR="$PROJECT_ROOT/.logs"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

mkdir -p "$RUNTIME_DIR" "$LOG_DIR"

is_running() {
    local pid="$1"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid() {
    local file="$1"
    if [[ -f "$file" ]]; then
        cat "$file"
    fi
}

port_in_use() {
    local port="$1"
    lsof -ti "tcp:$port" >/dev/null 2>&1
}

stop_service() {
    local name="$1"
    local pid_file="$2"
    local pid
    pid="$(read_pid "$pid_file" || true)"

    if [[ -z "$pid" ]]; then
        echo -e "${YELLOW}${name}: no PID file found${NC}"
        return
    fi

    if is_running "$pid"; then
        kill "$pid" 2>/dev/null || true
        for _ in {1..20}; do
            if ! is_running "$pid"; then
                break
            fi
            sleep 0.2
        done
        if is_running "$pid"; then
            kill -9 "$pid" 2>/dev/null || true
        fi
        echo -e "${GREEN}${name}: stopped (PID ${pid})${NC}"
    else
        echo -e "${YELLOW}${name}: process not running (stale PID ${pid})${NC}"
    fi

    rm -f "$pid_file"
}

start_backend() {
    echo -e "${BLUE}⚙️  Configuring Backend...${NC}"
    cd "$PROJECT_ROOT/backend"

    if [[ ! -d "venv" ]]; then
        echo -e "${YELLOW}Backend venv not found. Creating...${NC}"
        python3 -m venv venv || /opt/homebrew/bin/python3.12 -m venv venv
        source venv/bin/activate
        echo -e "${YELLOW}Installing backend dependencies...${NC}"
        pip install -r requirements.txt
    fi

    if [[ ! -f ".env" && -f ".env.example" ]]; then
        echo -e "${YELLOW}Creating backend .env from example...${NC}"
        cp .env.example .env
    fi

    local existing_pid
    existing_pid="$(read_pid "$BACKEND_PID_FILE" || true)"
    if [[ -n "$existing_pid" ]] && is_running "$existing_pid"; then
        echo -e "${GREEN}✓ Backend already running (PID: $existing_pid)${NC}"
        return
    fi

    if port_in_use 8000; then
        echo -e "${YELLOW}Backend port 8000 is already in use. Skipping backend start.${NC}"
        return
    fi

    echo -e "${YELLOW}Starting Backend Server (Detached)...${NC}"
    nohup bash -lc "cd '$PROJECT_ROOT/backend' && source venv/bin/activate && exec uvicorn main:app --reload --host 0.0.0.0 --port 8000" >"$BACKEND_LOG" 2>&1 &
    local backend_pid=$!
    echo "$backend_pid" >"$BACKEND_PID_FILE"
    echo -e "${GREEN}✓ Backend running (PID: $backend_pid)${NC}"
}

start_frontend() {
    echo -e "${BLUE}⚙️  Configuring Frontend...${NC}"
    cd "$PROJECT_ROOT/frontend"

    if [[ ! -d "node_modules" ]]; then
        echo -e "${YELLOW}node_modules not found. Installing dependencies...${NC}"
        npm install
    else
        echo -e "${GREEN}✓ Frontend dependencies found${NC}"
    fi

    local existing_pid
    existing_pid="$(read_pid "$FRONTEND_PID_FILE" || true)"
    if [[ -n "$existing_pid" ]] && is_running "$existing_pid"; then
        echo -e "${GREEN}✓ Frontend already running (PID: $existing_pid)${NC}"
        return
    fi

    if port_in_use 3000; then
        echo -e "${YELLOW}Frontend port 3000 is already in use. Skipping frontend start.${NC}"
        return
    fi

    echo -e "${YELLOW}Starting Frontend Server (Detached)...${NC}"
    nohup bash -lc "cd '$PROJECT_ROOT/frontend' && exec npm run dev" >"$FRONTEND_LOG" 2>&1 &
    local frontend_pid=$!
    echo "$frontend_pid" >"$FRONTEND_PID_FILE"
    echo -e "${GREEN}✓ Frontend running (PID: $frontend_pid)${NC}"
}

show_status() {
    local backend_pid frontend_pid
    backend_pid="$(read_pid "$BACKEND_PID_FILE" || true)"
    frontend_pid="$(read_pid "$FRONTEND_PID_FILE" || true)"

    echo -e "${BLUE}Service Status${NC}"
    if [[ -n "$backend_pid" ]] && is_running "$backend_pid"; then
        echo -e "${GREEN}Backend: running (PID: $backend_pid)${NC}"
    else
        echo -e "${RED}Backend: not running${NC}"
    fi

    if [[ -n "$frontend_pid" ]] && is_running "$frontend_pid"; then
        echo -e "${GREEN}Frontend: running (PID: $frontend_pid)${NC}"
    else
        echo -e "${RED}Frontend: not running${NC}"
    fi
}

start_all() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}    Secret Guardian - Full Stack App${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    start_backend
    echo ""
    start_frontend
    echo ""

    echo -e "${GREEN}✓ Services started in detached mode${NC}"
    echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
    echo -e "${BLUE}Backend:${NC}  http://localhost:8000"
    echo -e "${BLUE}Logs:${NC}"
    echo "  - $BACKEND_LOG"
    echo "  - $FRONTEND_LOG"
    echo ""
    echo "Use './start.sh status' to check status or './start.sh stop' to stop services."
}

stop_all() {
    echo -e "${RED}🛑 Stopping services...${NC}"
    stop_service "Frontend" "$FRONTEND_PID_FILE"
    stop_service "Backend" "$BACKEND_PID_FILE"
}

ACTION="${1:-start}"
case "$ACTION" in
start)
    start_all
    ;;
stop)
    stop_all
    ;;
status)
    show_status
    ;;
*)
    echo "Usage: $0 [start|stop|status]"
    exit 1
    ;;
esac
