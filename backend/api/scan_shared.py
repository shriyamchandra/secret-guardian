import os

from fastapi import HTTPException

try:
    from ..ai_fixer import MAX_AI_CALLS_PER_SCAN
    from ..rate_limiter import rate_limiter
except Exception:
    from ai_fixer import MAX_AI_CALLS_PER_SCAN  # type: ignore
    from rate_limiter import rate_limiter  # type: ignore


def default_ai_meta() -> dict:
    """Return a fresh metadata payload for AI orchestration stats."""
    return {
        "ai_calls_made": 0,
        "ai_calls_skipped": 0,
        "ai_calls_deduped": 0,
        "budget_limit": MAX_AI_CALLS_PER_SCAN,
        "circuit_broken": False,
    }


def enforce_rate_limit(client_ip: str) -> None:
    """Raise HTTP 429 when the request exceeds configured limits."""
    allowed, message, retry_after = rate_limiter.check_rate_limit(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate Limit Exceeded",
                "message": message,
                "retry_after": retry_after,
            },
        )


def resolve_scan_path(temp_dir: str) -> str:
    """If ZIP has one root folder, scan inside that folder."""
    items = os.listdir(temp_dir)
    if len(items) == 1:
        single_item = os.path.join(temp_dir, items[0])
        if os.path.isdir(single_item):
            print(f"📁 Detected single root directory: {items[0]}")
            return single_item
    return temp_dir
