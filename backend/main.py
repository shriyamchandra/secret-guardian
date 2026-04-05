"""
Secret Guardian API bootstrap.

This module now focuses on app wiring:
- FastAPI app setup
- middleware and global handlers
- core health/info endpoints
- router registration
"""

import os
import time
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from .api.routes_admin import router as admin_router
    from .api.routes_export import router as export_router
    from .api.routes_scan import router as scan_router
    from .cache import scan_cache
    from .performance import performance_monitor
    from .scanner import get_scanner_status
    from .validators import ValidationError
except Exception:
    from api.routes_admin import router as admin_router  # type: ignore
    from api.routes_export import router as export_router  # type: ignore
    from api.routes_scan import router as scan_router  # type: ignore
    from cache import scan_cache  # type: ignore
    from performance import performance_monitor  # type: ignore
    from scanner import get_scanner_status  # type: ignore
    from validators import ValidationError  # type: ignore


app = FastAPI(
    title="Secret Guardian API",
    description="AI-Powered Secret Detection & Remediation API - Scans GitHub repositories for leaked secrets and provides AI-powered security recommendations.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    contact={
        "name": "Secret Guardian",
        "url": "https://github.com/yourusername/secret-guardian",
    },
    license_info={
        "name": "MIT",
    },
)


# CORS: allow local Next.js app and production deployments
frontend_url = os.getenv("FRONTEND_URL", "").strip()
if os.getenv("RENDER") and not frontend_url:
    raise RuntimeError(
        "FRONTEND_URL environment variable is required in production (RENDER) to securely configure CORS."
    )

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if frontend_url:
    clean_url = frontend_url.rstrip("/")
    if clean_url not in origins:
        origins.append(clean_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    """Handle validation errors with detailed messages."""
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "message": str(exc),
            "type": "validation_error",
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors gracefully."""
    error_id = f"ERR_{int(time.time())}"
    print(f"\n❌ ERROR {error_id}:")
    print(traceback.format_exc())

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred. Please try again.",
            "error_id": error_id,
            "type": "internal_error",
        },
    )


@app.get("/", tags=["Health"])
def read_root():
    """Basic health endpoint with key runtime stats."""
    stats = performance_monitor.get_statistics()
    cache_stats = scan_cache.get_stats()

    return {
        "message": "Secret Guardian API is running!",
        "version": "1.0.0",
        "status": "healthy",
        "statistics": {
            "total_scans": stats.get("total_scans", 0),
            "total_findings": stats.get("total_findings", 0),
            "cache_hit_rate": cache_stats.get("hit_rate", "0.00%"),
            "uptime_seconds": stats.get("uptime_seconds", 0),
        },
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Detailed health check with system status."""
    import psutil

    process = psutil.Process(os.getpid())

    return {
        "status": "healthy",
        "version": "1.0.0",
        "system": {
            "memory_mb": round(process.memory_info().rss / 1024 / 1024, 2),
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "uptime_seconds": performance_monitor._get_uptime(),
        },
        "features": {
            "caching": True,
            "rate_limiting": True,
            "ai_suggestions": True,
            "entropy_detection": True,
            "confidence_scoring": True,
            "external_scanners": get_scanner_status(),
        },
    }


@app.get("/info", tags=["Info"])
def get_info():
    """Get information about Secret Guardian capabilities."""
    return {
        "name": "Secret Guardian",
        "version": "1.0.0",
        "description": "AI-Powered Secret Detection & Remediation Tool",
        "what_it_does": [
            "Scans public GitHub repositories for leaked secrets",
            "Detects 35+ types of secrets (API keys, tokens, credentials)",
            "Uses Shannon entropy to find unknown secrets",
            "Provides AI-powered remediation suggestions",
            "Supports multiple scanners (regex, Gitleaks, TruffleHog)",
        ],
        "what_it_does_not_do": [
            "Does NOT store repository content",
            "Does NOT require GitHub authentication",
            "Does NOT scan private repositories (v1 limitation)",
            "Does NOT modify your code",
        ],
        "limitations": {
            "private_repos": "Not supported in v1 - only public repos",
            "rate_limiting": "10 scans/minute, 100 scans/hour per IP",
            "max_file_size": "1MB per file",
            "max_files": "5000 files per repository",
            "timeout": "5 minutes per scan",
        },
        "disclaimer": "Read-only scanning. No data is stored. Temporary files are deleted after each scan.",
        "scanners_available": get_scanner_status(),
    }


# Register feature routers
app.include_router(scan_router)
app.include_router(admin_router)
app.include_router(export_router)
