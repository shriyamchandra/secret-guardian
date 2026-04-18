#!/bin/bash

# Secret Guardian - Full Stack Runner Script
# Usage:
#   ./start.sh          -> start backend + frontend in detached mode
#   ./start.sh start    -> start backend + frontend in detached mode
#   ./start.sh restart  -> restart services started by this script
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
BACKEND_PORT=8000
FRONTEND_PORT=3000

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
    lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1
}

port_pid() {
    local port="$1"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1
}

pid_command() {
    local pid="$1"
    if [[ -n "$pid" ]]; then
        ps -p "$pid" -o command= 2>/dev/null || true
    fi
}

wait_for_port() {
    local port="$1"
    local attempts="${2:-30}"

    for _ in $(seq 1 "$attempts"); do
        if port_in_use "$port"; then
            return 0
        fi
        sleep 0.2
    done

    return 1
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

    if [[ ! -d "venv" || ! -x "venv/bin/python" ]]; then
        echo -e "${YELLOW}Backend venv not found. Creating...${NC}"
        python3 -m venv venv || /opt/homebrew/bin/python3.12 -m venv venv
        echo -e "${YELLOW}Installing backend dependencies...${NC}"
        venv/bin/python -m pip install -r requirements.txt
    elif [[ ! -x "venv/bin/uvicorn" ]]; then
        echo -e "${YELLOW}uvicorn missing in backend venv. Re-installing dependencies...${NC}"
        venv/bin/python -m pip install -r requirements.txt
    fi

    if ! venv/bin/python -c "import uvicorn" >/dev/null 2>&1; then
        echo -e "${YELLOW}uvicorn import failed in backend venv. Re-installing dependencies...${NC}"
        venv/bin/python -m pip install -r requirements.txt
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

    if port_in_use "$BACKEND_PORT"; then
        local existing_port_pid
        existing_port_pid="$(port_pid "$BACKEND_PORT" || true)"
        echo -e "${YELLOW}Backend port ${BACKEND_PORT} is already in use by PID ${existing_port_pid:-unknown}. Skipping backend start.${NC}"
        return 0
    fi

    echo -e "${YELLOW}Starting Backend Server (Detached)...${NC}"
    nohup bash -lc "cd '$PROJECT_ROOT/backend' && exec '$PROJECT_ROOT/backend/venv/bin/python' -m uvicorn main:app --reload --host 0.0.0.0 --port ${BACKEND_PORT}" >"$BACKEND_LOG" 2>&1 &
    local backend_pid=$!
    echo "$backend_pid" >"$BACKEND_PID_FILE"

    if is_running "$backend_pid" && wait_for_port "$BACKEND_PORT" 40; then
        echo -e "${GREEN}✓ Backend running (PID: $backend_pid, Port: ${BACKEND_PORT})${NC}"
        return 0
    else
        echo -e "${RED}Backend failed to start. Check ${BACKEND_LOG}.${NC}"
        rm -f "$BACKEND_PID_FILE"
        tail -n 20 "$BACKEND_LOG" || true
        return 1
    fi
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

    if port_in_use "$FRONTEND_PORT"; then
        local existing_port_pid existing_port_cmd
        existing_port_pid="$(port_pid "$FRONTEND_PORT" || true)"
        existing_port_cmd="$(pid_command "$existing_port_pid")"
        echo -e "${YELLOW}Frontend port ${FRONTEND_PORT} is already in use by PID ${existing_port_pid:-unknown}. Skipping frontend start.${NC}"
        if [[ -n "$existing_port_cmd" ]]; then
            echo -e "${YELLOW}Port owner command: ${existing_port_cmd}${NC}"
        fi
        return 0
    fi

    echo -e "${YELLOW}Starting Frontend Server (Detached)...${NC}"
    nohup bash -lc "cd '$PROJECT_ROOT/frontend' && exec npm run dev" >"$FRONTEND_LOG" 2>&1 &
    local frontend_pid=$!
    echo "$frontend_pid" >"$FRONTEND_PID_FILE"

    if is_running "$frontend_pid" && wait_for_port "$FRONTEND_PORT" 50; then
        echo -e "${GREEN}✓ Frontend running (PID: $frontend_pid, Port: ${FRONTEND_PORT})${NC}"
        return 0
    else
        echo -e "${RED}Frontend failed to start on port ${FRONTEND_PORT}. Check ${FRONTEND_LOG}.${NC}"
        rm -f "$FRONTEND_PID_FILE"
        tail -n 20 "$FRONTEND_LOG" || true
        return 1
    fi
}

show_status() {
    local backend_pid frontend_pid
    backend_pid="$(read_pid "$BACKEND_PID_FILE" || true)"
    frontend_pid="$(read_pid "$FRONTEND_PID_FILE" || true)"

    echo -e "${BLUE}Service Status${NC}"
    if [[ -n "$backend_pid" ]] && is_running "$backend_pid"; then
        echo -e "${GREEN}Backend: running (PID: $backend_pid)${NC}"
    elif port_in_use "$BACKEND_PORT"; then
        local external_backend_pid
        external_backend_pid="$(port_pid "$BACKEND_PORT" || true)"
        echo -e "${YELLOW}Backend: running externally on port ${BACKEND_PORT} (PID: ${external_backend_pid:-unknown})${NC}"
    else
        echo -e "${RED}Backend: not running${NC}"
    fi

    if [[ -n "$frontend_pid" ]] && is_running "$frontend_pid"; then
        echo -e "${GREEN}Frontend: running (PID: $frontend_pid)${NC}"
    elif port_in_use "$FRONTEND_PORT"; then
        local external_frontend_pid
        external_frontend_pid="$(port_pid "$FRONTEND_PORT" || true)"
        echo -e "${YELLOW}Frontend: running externally on port ${FRONTEND_PORT} (PID: ${external_frontend_pid:-unknown})${NC}"
    else
        echo -e "${RED}Frontend: not running${NC}"
    fi
}

start_all() {
    local backend_ok=0
    local frontend_ok=0

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}    Secret Guardian - Full Stack App${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if start_backend; then
        backend_ok=1
    fi
    echo ""
    if start_frontend; then
        frontend_ok=1
    fi
    echo ""

    if [[ "$backend_ok" -eq 1 && "$frontend_ok" -eq 1 ]]; then
        echo -e "${GREEN}✓ Services started in detached mode${NC}"
    else
        echo -e "${RED}Some services failed to start. Review logs below.${NC}"
    fi
    echo -e "${BLUE}Frontend:${NC} http://localhost:${FRONTEND_PORT}"
    echo -e "${BLUE}Backend:${NC}  http://localhost:${BACKEND_PORT}"
    echo -e "${BLUE}Logs:${NC}"
    echo "  - $BACKEND_LOG"
    echo "  - $FRONTEND_LOG"
    echo ""
    echo "Use './start.sh status' to check status or './start.sh stop' to stop services."

    if [[ "$backend_ok" -eq 1 && "$frontend_ok" -eq 1 ]]; then
        return 0
    fi

    return 1
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
restart)
    stop_all
    start_all
    ;;
stop)
    stop_all
    ;;
status)
    show_status
    ;;
*)
    echo "Usage: $0 [start|restart|stop|status]"
    exit 1
    ;;
esac
