import asyncio
import contextlib
import time
import traceback

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

try:
    from ..ai_fixer import run_ai_remediation
    from ..cache import scan_cache
    from ..performance import performance_monitor
    from ..scanner import scan_repo
    from ..schemas import ScanRequest
    from ..services.streaming import (
        format_sse,
        normalize_callback_finding,
        recalibrate_and_sort_findings,
        recalibrate_finding,
    )
    from ..validators import ValidationError, validate_scan_request
    from .scan_shared import default_ai_meta, enforce_rate_limit
except Exception:
    from ai_fixer import run_ai_remediation  # type: ignore
    from cache import scan_cache  # type: ignore
    from performance import performance_monitor  # type: ignore
    from scanner import scan_repo  # type: ignore
    from schemas import ScanRequest  # type: ignore
    from services.streaming import (  # type: ignore
        format_sse,
        normalize_callback_finding,
        recalibrate_and_sort_findings,
        recalibrate_finding,
    )
    from validators import ValidationError, validate_scan_request  # type: ignore
    from api.scan_shared import default_ai_meta, enforce_rate_limit  # type: ignore


router = APIRouter(tags=["Scanning"])


@router.post("/scan")
async def start_scan(request: ScanRequest, req: Request):
    """Scan a GitHub repository for leaked secrets."""
    client_ip = req.client.host if req.client else "unknown"
    enforce_rate_limit(client_ip)

    try:
        validated_url = validate_scan_request(request.repo_url)
        print(f"✅ Validated URL: {validated_url}")
    except ValidationError as exc:
        print(f"❌ Validation failed: {str(exc)}")
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Invalid Repository URL",
                "message": str(exc),
            },
        )

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

    print(f"🔍 Starting fresh scan for: {validated_url}")

    try:
        with performance_monitor.measure_scan() as metrics:
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

            if findings:
                severity_breakdown = recalibrate_and_sort_findings(findings)
                results["findings"] = findings
                results["severity_breakdown"] = severity_breakdown
                results["has_critical"] = severity_breakdown["CRITICAL"] > 0
                results["has_high"] = severity_breakdown["HIGH"] > 0

            ai_meta = default_ai_meta()
            if findings:
                print(f"🤖 Running smart AI remediation for {len(findings)} findings...")
                ai_meta = await run_ai_remediation(findings)
                print(
                    f"   AI calls: {ai_meta['ai_calls_made']} made, "
                    f"{ai_meta['ai_calls_skipped']} skipped, "
                    f"{ai_meta['ai_calls_deduped']} deduped"
                )

        results["scan_time"] = round(metrics.get("duration", 0), 2)
        results["cached"] = False
        results["scan_timestamp"] = time.time()
        results["ai_stats"] = ai_meta
        results["performance"] = {
            "duration": round(metrics.get("duration", 0), 2),
            "memory_delta_mb": round(metrics.get("memory_delta", 0), 2),
        }

        scan_cache.set(validated_url, results)
        return results

    except HTTPException:
        raise
    except Exception as exc:
        print(f"❌ Scan error: {str(exc)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": f"An error occurred during scanning: {str(exc)}",
            },
        )


@router.get("/scan/stream")
async def stream_scan(req: Request, repo_url: str = Query(..., min_length=1)):
    """Stream repository scan progress and incremental AI updates using SSE."""
    client_ip = req.client.host if req and req.client else "unknown"
    enforce_rate_limit(client_ip)

    try:
        validated_url = validate_scan_request(repo_url)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Invalid Repository URL",
                "message": str(exc),
            },
        )

    cached_result = scan_cache.get(validated_url)
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def emit(event_name: str, payload: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, (event_name, payload))

    async def producer() -> None:
        findings = []
        try:
            if cached_result:
                cache_age_seconds = int(
                    time.time() - cached_result.get("scan_timestamp", time.time())
                )
                emit(
                    "progress",
                    {
                        "stage": "cache",
                        "message": "Returning cached scan result.",
                    },
                )
                emit(
                    "scan_result",
                    {
                        **cached_result,
                        "cached": True,
                        "cache_age_seconds": cache_age_seconds,
                    },
                )
                emit(
                    "complete",
                    {
                        "cached": True,
                        "cache_age_seconds": cache_age_seconds,
                    },
                )
                return

            def on_progress(stage: str, message: str) -> None:
                emit("progress", {"stage": stage, "message": message})

            def on_finding(finding_obj) -> None:
                try:
                    streamed_finding = recalibrate_finding(
                        normalize_callback_finding(finding_obj)
                    )
                    emit("scan_finding", {"finding": streamed_finding})
                except Exception as stream_exc:
                    print(f"⚠️ scan_finding emit failed: {stream_exc}")

            emit("progress", {"stage": "scan_start", "message": "Cloning repository..."})

            with performance_monitor.measure_scan() as metrics:
                results = await asyncio.to_thread(
                    scan_repo,
                    validated_url,
                    on_finding=on_finding,
                    on_progress=on_progress,
                )
                if "error" in results:
                    emit("scan_error", {"message": results["error"]})
                    return

                findings = results.get("findings", [])
                metrics["findings"] = len(findings)

                if findings:
                    severity_breakdown = recalibrate_and_sort_findings(findings)
                    results["findings"] = findings
                    results["severity_breakdown"] = severity_breakdown
                    results["has_critical"] = severity_breakdown["CRITICAL"] > 0
                    results["has_high"] = severity_breakdown["HIGH"] > 0

                emit("scan_result", {**results, "cached": False})

                ai_meta = default_ai_meta()
                if findings:
                    emit(
                        "progress",
                        {
                            "stage": "ai",
                            "message": f"Generating AI remediation for {len(findings)} findings...",
                        },
                    )

                    def on_finding_processed(index: int, finding: dict) -> None:
                        emit(
                            "ai_finding",
                            {
                                "index": index,
                                "ai_fix": finding.get("ai_fix"),
                            },
                        )

                    ai_meta = await run_ai_remediation(
                        findings, on_finding_processed=on_finding_processed
                    )

            results["scan_time"] = round(metrics.get("duration", 0), 2)
            results["cached"] = False
            results["scan_timestamp"] = time.time()
            results["ai_stats"] = ai_meta
            results["performance"] = {
                "duration": round(metrics.get("duration", 0), 2),
                "memory_delta_mb": round(metrics.get("memory_delta", 0), 2),
            }

            scan_cache.set(validated_url, results)

            emit("ai_complete", {"ai_stats": ai_meta})
            emit(
                "complete",
                {
                    "cached": False,
                    "scan_time": results["scan_time"],
                    "total_findings": results.get("total_findings", len(findings)),
                },
            )
        except Exception as exc:
            print(f"❌ Streaming scan error: {str(exc)}")
            print(traceback.format_exc())
            emit("scan_error", {"message": f"An error occurred during scanning: {str(exc)}"})
        finally:
            emit("end", {})

    async def event_generator():
        producer_task = asyncio.create_task(producer())
        try:
            while True:
                if req and await req.is_disconnected():
                    producer_task.cancel()
                    break
                try:
                    event_name, payload = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue

                if event_name == "end":
                    break
                yield format_sse(event_name, payload)
        finally:
            if not producer_task.done():
                producer_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await producer_task

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
