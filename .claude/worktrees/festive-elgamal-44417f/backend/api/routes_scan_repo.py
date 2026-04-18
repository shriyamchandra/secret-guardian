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
    from .scan_shared import (
        MAX_STREAM_FINDINGS_EMITTED,
        apply_finding_aggregation,
        apply_findings_limit,
        default_ai_meta,
        enforce_rate_limit,
    )
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
    from api.scan_shared import (  # type: ignore
        MAX_STREAM_FINDINGS_EMITTED,
        apply_finding_aggregation,
        apply_findings_limit,
        default_ai_meta,
        enforce_rate_limit,
    )


router = APIRouter(tags=["Scanning"])


def _build_cached_response(
    cached_result: dict, request_start: float, scan_target: str = ""
) -> dict:
    """Return cached payload with fresh retrieval timing metadata."""
    cached_result = apply_finding_aggregation(cached_result)
    retrieval_duration = max(round(time.perf_counter() - request_start, 3), 0.001)
    original_duration = cached_result.get(
        "scan_duration", cached_result.get("scan_time", 0.0)
    )
    cache_age_seconds = int(
        time.time() - cached_result.get("scan_timestamp", time.time())
    )

    payload = {
        **cached_result,
        "source": cached_result.get("source", "repository_url"),
        "scan_target": cached_result.get("scan_target") or scan_target,
        "cached": True,
        "cache_age_seconds": cache_age_seconds,
        "scan_duration": retrieval_duration,
        "scan_time": retrieval_duration,
        "cache_retrieval_duration": retrieval_duration,
        "original_scan_duration": original_duration,
    }

    performance = payload.get("performance")
    if isinstance(performance, dict):
        payload["performance"] = {**performance, "duration": retrieval_duration}

    return apply_findings_limit(payload)


@router.post("/scan")
async def start_scan(request: ScanRequest, req: Request):
    """Scan a supported repository URL for leaked secrets."""
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

    request_start = time.perf_counter()
    cached_result = scan_cache.get(validated_url)
    if cached_result:
        print(f"💨 Returning cached result for {validated_url[:50]}...")
        return _build_cached_response(cached_result, request_start, validated_url)

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

            results = apply_finding_aggregation(results)
            findings = results.get("findings", [])
            metrics["findings"] = len(findings)

            if findings:
                severity_breakdown = recalibrate_and_sort_findings(findings)
                results["findings"] = findings
                results["severity_breakdown"] = severity_breakdown
                results["has_critical"] = severity_breakdown["CRITICAL"] > 0
                results["has_high"] = severity_breakdown["HIGH"] > 0

            results = apply_findings_limit(results)
            findings = results.get("findings", [])
            if results.get("findings_truncated"):
                print(
                    "⚠️ Findings payload capped to "
                    f"{results.get('displayed_findings')} of {results.get('total_findings')}"
                )

            ai_meta = default_ai_meta()
            if findings:
                print(
                    f"🤖 Running smart AI remediation for {len(findings)} findings..."
                )
                ai_meta = await run_ai_remediation(findings)
                print(
                    f"   AI calls: {ai_meta['ai_calls_made']} made, "
                    f"{ai_meta['ai_calls_skipped']} skipped, "
                    f"{ai_meta['ai_calls_deduped']} deduped"
                )

        results["scan_time"] = round(metrics.get("duration", 0), 2)
        results["source"] = "repository_url"
        results["scan_target"] = validated_url
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

    request_start = time.perf_counter()
    cached_result = scan_cache.get(validated_url)
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def emit(event_name: str, payload: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, (event_name, payload))

    async def producer() -> None:
        findings = []
        stream_findings_emitted = 0
        stream_limit_notified = False
        try:
            if cached_result:
                cached_payload = _build_cached_response(
                    cached_result, request_start, validated_url
                )
                emit(
                    "progress",
                    {
                        "stage": "cache",
                        "message": "Returning cached scan result.",
                    },
                )
                emit("scan_result", cached_payload)
                emit(
                    "complete",
                    {
                        "cached": True,
                        "cache_age_seconds": cached_payload["cache_age_seconds"],
                        "scan_time": cached_payload["scan_time"],
                        "scan_duration": cached_payload["scan_duration"],
                        "cache_retrieval_duration": cached_payload[
                            "cache_retrieval_duration"
                        ],
                        "total_findings": cached_payload.get("total_findings", 0),
                    },
                )
                return

            def on_progress(stage: str, message: str) -> None:
                emit("progress", {"stage": stage, "message": message})

            def on_finding(finding_obj) -> None:
                nonlocal stream_findings_emitted, stream_limit_notified
                if stream_findings_emitted >= MAX_STREAM_FINDINGS_EMITTED:
                    if not stream_limit_notified:
                        emit(
                            "progress",
                            {
                                "stage": "stream_limit",
                                "message": (
                                    "High-volume scan detected. "
                                    f"Showing first {MAX_STREAM_FINDINGS_EMITTED} live findings."
                                ),
                            },
                        )
                        stream_limit_notified = True
                    return
                try:
                    streamed_finding = recalibrate_finding(
                        normalize_callback_finding(finding_obj)
                    )
                    emit("scan_finding", {"finding": streamed_finding})
                    stream_findings_emitted += 1
                except Exception as stream_exc:
                    print(f"⚠️ scan_finding emit failed: {stream_exc}")

            emit(
                "progress", {"stage": "scan_start", "message": "Cloning repository..."}
            )

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

                results = apply_finding_aggregation(results)
                findings = results.get("findings", [])
                metrics["findings"] = len(findings)

                if findings:
                    severity_breakdown = recalibrate_and_sort_findings(findings)
                    results["findings"] = findings
                    results["severity_breakdown"] = severity_breakdown
                    results["has_critical"] = severity_breakdown["CRITICAL"] > 0
                    results["has_high"] = severity_breakdown["HIGH"] > 0

                results = apply_findings_limit(results)
                findings = results.get("findings", [])
                if results.get("findings_truncated"):
                    emit(
                        "progress",
                        {
                            "stage": "result_limit",
                            "message": (
                                "Large result set detected. "
                                f"Returning {results.get('displayed_findings')} "
                                f"of {results.get('total_findings')} findings."
                            ),
                        },
                    )

                results["source"] = "repository_url"
                results["scan_target"] = validated_url
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
            results["source"] = "repository_url"
            results["scan_target"] = validated_url
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
            emit(
                "scan_error",
                {"message": f"An error occurred during scanning: {str(exc)}"},
            )
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
                    event_name, payload = await asyncio.wait_for(
                        queue.get(), timeout=15
                    )
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
