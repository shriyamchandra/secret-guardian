"""
Secret Guardian API - AI-Powered Secret Detection & Remediation

This API provides secure scanning of public GitHub repositories for leaked secrets.
It uses multiple detection methods (regex, Gitleaks, TruffleHog) and provides
AI-powered remediation suggestions.

DISCLAIMER:
- Read-only scanning only
- No data is stored permanently
- Temporary files are deleted after each scan
- Only public repositories are supported (v1)
"""

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, validator
import time
import traceback
import json
import io
import zipfile
import tempfile
import shutil
import os
from datetime import datetime

try:
    from .scanner import scan_repo, scan_directory, get_scanner_status
    from .ai_fixer import get_gemini_fix, analyze_threat_context
    from .cache import scan_cache
    from .rate_limiter import rate_limiter
    from .validators import validate_scan_request, ValidationError
    from .performance import performance_monitor
except Exception:
    from scanner import scan_repo, scan_directory, get_scanner_status  # type: ignore
    from ai_fixer import get_gemini_fix, analyze_threat_context  # type: ignore
    from cache import scan_cache  # type: ignore
    from rate_limiter import rate_limiter  # type: ignore
    from validators import validate_scan_request, ValidationError  # type: ignore
    from performance import performance_monitor  # type: ignore

import asyncio


class ScanRequest(BaseModel):
    """Request model for repository scanning."""

    repo_url: str = Field(
        ...,
        description="GitHub repository URL to scan",
        min_length=1,
        max_length=500,
        example="https://github.com/username/repository",
    )

    @validator("repo_url")
    def validate_url(cls, v):
        """Validate repository URL format."""
        if not v or not v.strip():
            raise ValueError("Repository URL cannot be empty")
        return v.strip()

    class Config:
        json_schema_extra = {
            "example": {"repo_url": "https://github.com/username/repository"}
        }


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
import os

# Get frontend URL from environment variable (for production)
frontend_url = os.getenv("FRONTEND_URL", "")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Add production frontend URL if configured
if frontend_url:
    origins.append(frontend_url)
    # Also add without trailing slash
    if frontend_url.endswith("/"):
        origins.append(frontend_url.rstrip("/"))
    else:
        origins.append(frontend_url + "/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler for better error reporting
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
    """
    Health check endpoint.

    Returns:
        dict: API status message with system metrics
    """
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


@app.post("/scan", tags=["Scanning"])
async def start_scan(request: ScanRequest, req: Request):
    """
    Scan a GitHub repository for leaked secrets.

    This endpoint clones the specified repository, scans all files for potential
    secret leakage (API keys, credentials, tokens, etc.), and uses Google Gemini AI
    to provide security recommendations for each finding.

    Features:
    - 🔍 Advanced pattern matching (35+ secret types)
    - 🧮 Shannon entropy detection for unknown secrets
    - 🎯 Confidence scoring (HIGH/MEDIUM/LOW)
    - 🤖 AI-powered remediation suggestions
    - 💾 Intelligent caching (1 hour TTL)
    - 🚦 Rate limiting (10/min, 100/hour)
    - ⚡ Performance monitoring

    Args:
        request (ScanRequest): Contains the GitHub repository URL to scan

    Returns:
        dict: Scan results containing:
            - repo_url: The scanned repository URL
            - findings: List of detected secrets with AI-powered fix suggestions
            - total_findings: Number of secrets found
            - scan_time: Time taken to scan
            - cached: Whether result was cached

    Raises:
        HTTPException: If repository is invalid, inaccessible, or scan fails

    Example:
        ```json
        {
            "repo_url": "https://github.com/username/repository"
        }
        ```
    """
    # Get client IP for rate limiting
    client_ip = req.client.host if req.client else "unknown"

    # 1. RATE LIMITING
    allowed, message, retry_after = rate_limiter.check_rate_limit(client_ip)
    if not allowed:
        print(f"🚫 Rate limit exceeded for {client_ip}")
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate Limit Exceeded",
                "message": message,
                "retry_after": retry_after,
            },
        )

    # 2. INPUT VALIDATION
    try:
        validated_url = validate_scan_request(request.repo_url)
        print(f"✅ Validated URL: {validated_url}")
    except ValidationError as e:
        print(f"❌ Validation failed: {str(e)}")
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Invalid Repository URL",
                "message": str(e),
            },
        )

    # 3. CACHE CHECK
    cached_result = scan_cache.get(validated_url)
    if cached_result:
        print(f"💨 Returning cached result for {validated_url[:50]}...")
        return {
            **cached_result,
            "cached": True,
            "cache_age_seconds": int(
                time.time() - cached_result.get("scan_timestamp", time.time())
            ),
        }

    # 4. PERFORMANCE MONITORING + SCAN
    print(f"🔍 Starting fresh scan for: {validated_url}")

    try:
        with performance_monitor.measure_scan() as metrics:
            # Run the scan
            results = scan_repo(validated_url)

            if "error" in results:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "Scan Failed",
                        "message": results["error"],
                    },
                )

            findings = results.get("findings", [])
            metrics["findings"] = len(findings)

            # 5. THREAT CONTEXT ANALYSIS (Pre-compute for all findings)
            for f in findings:
                f["threat_context"] = analyze_threat_context(f)

            # 6. AI REMEDIATION (Concurrent)
            if findings:
                print(f"🤖 Getting AI suggestions for {len(findings)} findings...")
                tasks = [asyncio.to_thread(get_gemini_fix, f) for f in findings]
                suggestions = await asyncio.gather(*tasks)

                for i, f in enumerate(findings):
                    f["ai_fix"] = suggestions[i]

        # Add metadata (after context manager exits so duration is available)
        results["scan_time"] = round(metrics.get("duration", 0), 2)
        results["cached"] = False
        results["scan_timestamp"] = time.time()
        results["performance"] = {
            "duration": round(metrics.get("duration", 0), 2),
            "memory_delta_mb": round(metrics.get("memory_delta", 0), 2),
        }

        # 6. CACHE THE RESULT
        scan_cache.set(validated_url, results)

        return results

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Scan error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": f"An error occurred during scanning: {str(e)}",
            },
        )


# ============================================================================
# ZIP FILE UPLOAD ENDPOINT
# ============================================================================

# Maximum upload size: 50MB
MAX_UPLOAD_SIZE = 50 * 1024 * 1024


@app.post("/scan/upload", tags=["Scanning"])
async def scan_uploaded_file(
    request: Request,
    file: UploadFile = File(..., description="ZIP file containing code to scan"),
):
    """
    Scan an uploaded ZIP file for secrets.

    This endpoint allows local code scanning without GitHub:
    1. Upload a ZIP file containing your codebase
    2. The file is extracted to a temporary directory
    3. All scanners run on the extracted files
    4. AI remediation suggestions are generated
    5. Temporary files are deleted after scanning

    **Limitations:**
    - Maximum file size: 50MB
    - Only ZIP files are accepted
    - Files are not stored after scanning

    Args:
        file: ZIP file to scan

    Returns:
        dict: Scan results with findings, severity breakdown, and AI suggestions
    """
    start_time = time.time()
    temp_dir = None

    try:
        # 1. RATE LIMITING
        client_ip = request.client.host if request.client else "unknown"
        allowed, message, retry_after = rate_limiter.is_allowed(client_ip)

        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate Limit Exceeded",
                    "message": message,
                    "retry_after": retry_after,
                },
            )

        # 2. VALIDATE FILE
        if not file.filename:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Invalid File",
                    "message": "No filename provided",
                },
            )

        if not file.filename.lower().endswith(".zip"):
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Invalid File Type",
                    "message": "Only ZIP files are supported. Please upload a .zip file.",
                },
            )

        # 3. READ AND VALIDATE SIZE
        print(f"📤 Receiving upload: {file.filename}")
        contents = await file.read()
        file_size = len(contents)

        if file_size > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail={
                    "error": "File Too Large",
                    "message": f"File size ({file_size / 1024 / 1024:.1f}MB) exceeds maximum allowed size (50MB).",
                },
            )

        if file_size == 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Empty File",
                    "message": "The uploaded file is empty.",
                },
            )

        print(f"📦 File size: {file_size / 1024 / 1024:.2f}MB")

        # 4. EXTRACT ZIP FILE
        temp_dir = tempfile.mkdtemp(prefix="secret-guardian-upload-")
        print(f"📂 Extracting to: {temp_dir}")

        try:
            with zipfile.ZipFile(io.BytesIO(contents), "r") as zip_ref:
                # Security check: prevent path traversal
                for member in zip_ref.namelist():
                    member_path = os.path.join(temp_dir, member)
                    abs_path = os.path.abspath(member_path)
                    if not abs_path.startswith(os.path.abspath(temp_dir)):
                        raise HTTPException(
                            status_code=422,
                            detail={
                                "error": "Invalid ZIP File",
                                "message": "ZIP file contains invalid paths (potential path traversal attack).",
                            },
                        )

                zip_ref.extractall(temp_dir)
                extracted_count = len(zip_ref.namelist())
                print(f"✅ Extracted {extracted_count} files/directories")

        except zipfile.BadZipFile:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Invalid ZIP File",
                    "message": "The uploaded file is not a valid ZIP archive.",
                },
            )

        # 5. CHECK FOR NESTED ZIP DIRECTORY
        # If the zip contains a single root directory, scan inside it
        items = os.listdir(temp_dir)
        if len(items) == 1:
            single_item = os.path.join(temp_dir, items[0])
            if os.path.isdir(single_item):
                print(f"📁 Detected single root directory: {items[0]}")
                scan_path = single_item
            else:
                scan_path = temp_dir
        else:
            scan_path = temp_dir

        # 6. RUN SCAN
        elapsed = time.time() - start_time
        remaining_timeout = max(60, 300 - elapsed)

        print(f"🔍 Starting scan of uploaded files...")
        results = scan_directory(
            scan_path,
            timeout=int(remaining_timeout),
            use_external_scanners=True,
            start_time=start_time,
            cleanup=False,  # We'll clean up in finally block
        )

        if "error" in results:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Scan Failed",
                    "message": results["error"],
                },
            )

        findings = results.get("findings", [])

        # 7. THREAT CONTEXT ANALYSIS
        for f in findings:
            f["threat_context"] = analyze_threat_context(f)

        # 8. AI REMEDIATION
        if findings:
            print(f"🤖 Getting AI suggestions for {len(findings)} findings...")
            tasks = [asyncio.to_thread(get_gemini_fix, f) for f in findings]
            suggestions = await asyncio.gather(*tasks)

            for i, f in enumerate(findings):
                f["ai_fix"] = suggestions[i]

        # Add metadata
        results["scan_time"] = round(time.time() - start_time, 2)
        results["source"] = "upload"
        results["filename"] = file.filename
        results["file_size_mb"] = round(file_size / 1024 / 1024, 2)

        print(
            f"✅ Scan complete: {results['total_findings']} findings in {results['scan_time']}s"
        )

        return results

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Upload scan error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": f"An error occurred during scanning: {str(e)}",
            },
        )
    finally:
        # Always clean up temp directory
        if temp_dir and os.path.exists(temp_dir):
            print(f"🧹 Cleaning up: {temp_dir}")
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
                print("✅ Cleanup complete")
            except Exception as e:
                print(f"⚠️ Cleanup warning: {e}")


# ============================================================================
# ADMIN / MONITORING ENDPOINTS
# ============================================================================


@app.get("/admin/stats", tags=["Admin"])
def get_system_stats():
    """
    Get comprehensive system statistics.

    Returns performance metrics, cache statistics, and rate limiting info.
    Useful for monitoring and debugging.

    Returns:
        dict: System statistics including:
            - performance: Scan performance metrics
            - cache: Cache hit/miss statistics
            - recent_scans: Last 10 scans with timing info
    """
    return {
        "performance": performance_monitor.get_statistics(),
        "cache": scan_cache.get_stats(),
        "recent_scans": performance_monitor.get_recent_scans(limit=10),
    }


@app.get("/admin/cache", tags=["Admin"])
def get_cache_info():
    """
    Get detailed cache statistics.

    Returns:
        dict: Cache performance metrics
    """
    return scan_cache.get_stats()


@app.post("/admin/cache/clear", tags=["Admin"])
def clear_cache():
    """
    Clear all cached scan results.

    Use this to force fresh scans or free memory.

    Returns:
        dict: Success message
    """
    scan_cache.clear()
    return {
        "message": "Cache cleared successfully",
        "status": "success",
    }


@app.get("/admin/rate-limits/{client_ip}", tags=["Admin"])
def get_rate_limit_info(client_ip: str):
    """
    Get rate limit status for a specific client IP.

    Args:
        client_ip: Client IP address to check

    Returns:
        dict: Rate limit statistics for the client
    """
    return rate_limiter.get_stats(client_ip)


@app.post("/admin/rate-limits/reset", tags=["Admin"])
def reset_rate_limits(client_ip: str = None):
    """
    Reset rate limits for a client or all clients.

    Args:
        client_ip: Optional IP to reset, or None to reset all

    Returns:
        dict: Success message
    """
    rate_limiter.reset(client_ip)
    return {
        "message": f"Rate limits reset for {client_ip or 'all clients'}",
        "status": "success",
    }


@app.get("/admin/performance", tags=["Admin"])
def get_performance_metrics():
    """
    Get detailed performance metrics.

    Returns:
        dict: Performance statistics including timing and resource usage
    """
    return performance_monitor.get_statistics()


@app.get("/health", tags=["Health"])
def health_check():
    """
    Detailed health check with system status.

    Returns:
        dict: Detailed health information
    """
    import psutil
    import os

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


# ============================================================================
# EXPORT ENDPOINTS
# ============================================================================


class ExportRequest(BaseModel):
    """Request model for exporting scan results."""

    findings: list = Field(..., description="List of findings to export")
    repo_url: str = Field(..., description="Scanned repository URL")
    scan_duration: float = Field(0.0, description="Scan duration in seconds")
    severity_breakdown: dict = Field(
        default_factory=dict, description="Severity breakdown"
    )


@app.post("/export/json", tags=["Export"])
async def export_json(request: ExportRequest):
    """
    Export scan results as JSON file.

    Returns a downloadable JSON file with all scan findings.
    """
    export_data = {
        "tool": "Secret Guardian",
        "version": "1.0.0",
        "exported_at": datetime.now().isoformat(),
        "repository": request.repo_url,
        "scan_duration_seconds": request.scan_duration,
        "total_findings": len(request.findings),
        "severity_breakdown": request.severity_breakdown,
        "findings": request.findings,
        "disclaimer": "This report is for informational purposes only. Secrets should be rotated immediately.",
    }

    json_str = json.dumps(export_data, indent=2)

    return StreamingResponse(
        io.BytesIO(json_str.encode()),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=secret-guardian-report-{int(time.time())}.json"
        },
    )


@app.post("/export/summary", tags=["Export"])
async def export_summary(request: ExportRequest):
    """
    Generate a text summary of scan results for clipboard copying.
    """
    severity = request.severity_breakdown

    summary_lines = [
        "=" * 50,
        "🛡️ SECRET GUARDIAN - SCAN REPORT",
        "=" * 50,
        f"Repository: {request.repo_url}",
        f"Scan Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Duration: {request.scan_duration:.2f}s",
        "",
        "📊 SUMMARY",
        "-" * 30,
        f"Total Findings: {len(request.findings)}",
        f"  🔴 Critical: {severity.get('CRITICAL', 0)}",
        f"  🟠 High: {severity.get('HIGH', 0)}",
        f"  🟡 Medium: {severity.get('MEDIUM', 0)}",
        f"  🟢 Low: {severity.get('LOW', 0)}",
        "",
    ]

    if request.findings:
        summary_lines.append("📋 FINDINGS BY FILE")
        summary_lines.append("-" * 30)

        # Group by file
        files: dict = {}
        for f in request.findings:
            file_path = f.get("file_path", "Unknown")
            if file_path not in files:
                files[file_path] = []
            files[file_path].append(f)

        for file_path, file_findings in files.items():
            summary_lines.append(f"\n📄 {file_path}")
            for finding in file_findings:
                severity_emoji = {
                    "CRITICAL": "🔴",
                    "HIGH": "🟠",
                    "MEDIUM": "🟡",
                    "LOW": "🟢",
                }.get(finding.get("severity", "LOW"), "⚪")
                summary_lines.append(
                    f"  {severity_emoji} Line {finding.get('line_number', '?')}: "
                    f"{finding.get('secret_type', 'Unknown')}"
                )

    summary_lines.extend(
        [
            "",
            "=" * 50,
            "⚠️ IMPORTANT: Rotate all exposed secrets immediately!",
            "Generated by Secret Guardian - https://github.com/secret-guardian",
        ]
    )

    return {"summary": "\n".join(summary_lines)}


@app.get("/info", tags=["Info"])
def get_info():
    """
    Get information about Secret Guardian capabilities.

    Returns tool information, limitations, and features.
    """
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
