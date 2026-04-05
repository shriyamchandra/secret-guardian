import hmac
import os

from fastapi import APIRouter, Depends, Header, HTTPException

try:
    from ..cache import scan_cache
    from ..performance import performance_monitor
    from ..rate_limiter import rate_limiter
except Exception:
    from cache import scan_cache  # type: ignore
    from performance import performance_monitor  # type: ignore
    from rate_limiter import rate_limiter  # type: ignore


router = APIRouter(tags=["Admin"])


def verify_admin_key(x_admin_key: str = Header(None)):
    """Dependency to verify admin API key securely."""
    expected_key = os.getenv("ADMIN_API_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=503,
            detail="Admin endpoints are disabled (ADMIN_API_KEY not configured).",
        )
    if not x_admin_key or not hmac.compare_digest(
        x_admin_key.encode(), expected_key.encode()
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing admin API key.",
        )
    return True


@router.get("/admin/stats")
def get_system_stats(admin: bool = Depends(verify_admin_key)):
    return {
        "performance": performance_monitor.get_statistics(),
        "cache": scan_cache.get_stats(),
        "recent_scans": performance_monitor.get_recent_scans(limit=10),
    }


@router.get("/admin/cache")
def get_cache_info(admin: bool = Depends(verify_admin_key)):
    return scan_cache.get_stats()


@router.post("/admin/cache/clear")
def clear_cache(admin: bool = Depends(verify_admin_key)):
    scan_cache.clear()
    return {
        "message": "Cache cleared successfully",
        "status": "success",
    }


@router.get("/admin/rate-limits/{client_ip}")
def get_rate_limit_info(client_ip: str, admin: bool = Depends(verify_admin_key)):
    return rate_limiter.get_stats(client_ip)


@router.post("/admin/rate-limits/reset")
def reset_rate_limits(client_ip: str = None, admin: bool = Depends(verify_admin_key)):
    rate_limiter.reset(client_ip)
    return {
        "message": f"Rate limits reset for {client_ip or 'all clients'}",
        "status": "success",
    }


@router.get("/admin/performance")
def get_performance_metrics(admin: bool = Depends(verify_admin_key)):
    return performance_monitor.get_statistics()
