import asyncio
import contextlib
import io
import os
import shutil
import tempfile
import time
import traceback
import zipfile

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

try:
    from ..ai_fixer import run_ai_remediation
    from ..scanner import scan_directory
    from ..services.streaming import (
        format_sse,
        normalize_callback_finding,
        recalibrate_and_sort_findings,
        recalibrate_finding,
    )
    from ..services.zip_security import MAX_UPLOAD_SIZE, safe_extract_zip
    from .scan_shared import default_ai_meta, enforce_rate_limit, resolve_scan_path
except Exception:
    from ai_fixer import run_ai_remediation  # type: ignore
    from scanner import scan_directory  # type: ignore
    from services.streaming import (  # type: ignore
        format_sse,
        normalize_callback_finding,
        recalibrate_and_sort_findings,
        recalibrate_finding,
    )
    from services.zip_security import MAX_UPLOAD_SIZE, safe_extract_zip  # type: ignore
    from api.scan_shared import (  # type: ignore
        default_ai_meta,
        enforce_rate_limit,
        resolve_scan_path,
    )


router = APIRouter(tags=["Scanning"])


@router.post("/scan/upload")
async def scan_uploaded_file(
    request: Request,
    file: UploadFile = File(..., description="ZIP file containing code to scan"),
):
    """Scan an uploaded ZIP file for secrets."""
    start_time = time.time()
    temp_dir = None

    try:
        client_ip = request.client.host if request.client else "unknown"
        enforce_rate_limit(client_ip)

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
        temp_dir = tempfile.mkdtemp(prefix="secret-guardian-upload-")
        print(f"📂 Extracting to: {temp_dir}")

        try:
            with zipfile.ZipFile(io.BytesIO(contents), "r") as zip_ref:
                extracted_count = safe_extract_zip(zip_ref, temp_dir)
                print(f"✅ Extracted {extracted_count} files/directories")
        except zipfile.BadZipFile:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Invalid ZIP File",
                    "message": "The uploaded file is not a valid ZIP archive.",
                },
            )

        scan_path = resolve_scan_path(temp_dir)

        elapsed = time.time() - start_time
        remaining_timeout = max(60, 300 - elapsed)

        print("🔍 Starting scan of uploaded files...")
        results = scan_directory(
            scan_path,
            timeout=int(remaining_timeout),
            use_external_scanners=True,
            start_time=start_time,
            cleanup=False,
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

        results["scan_time"] = round(time.time() - start_time, 2)
        results["source"] = "upload"
        results["filename"] = file.filename
        results["file_size_mb"] = round(file_size / 1024 / 1024, 2)
        results["ai_stats"] = ai_meta

        print(
            f"✅ Scan complete: {results['total_findings']} findings in {results['scan_time']}s"
        )

        return results

    except HTTPException:
        raise
    except Exception as exc:
        print(f"❌ Upload scan error: {str(exc)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error",
                "message": f"An error occurred during scanning: {str(exc)}",
            },
        )
    finally:
        if temp_dir and os.path.exists(temp_dir):
            print(f"🧹 Cleaning up: {temp_dir}")
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
                print("✅ Cleanup complete")
            except Exception as cleanup_exc:
                print(f"⚠️ Cleanup warning: {cleanup_exc}")


@router.post("/scan/upload/stream")
async def stream_uploaded_file_scan(
    request: Request,
    file: UploadFile = File(..., description="ZIP file containing code to scan"),
):
    """Stream ZIP upload scan progress and incremental AI updates using SSE."""
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()
    start_time = time.time()
    temp_dir = None
    file_size = 0

    def emit(event_name: str, payload: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, (event_name, payload))

    async def producer() -> None:
        nonlocal temp_dir, file_size
        try:
            client_ip = request.client.host if request.client else "unknown"
            allowed, message, retry_after = enforce_rate_limit_stream(client_ip)
            if not allowed:
                emit(
                    "scan_error",
                    {
                        "message": message,
                        "retry_after": retry_after,
                    },
                )
                return

            if not file.filename:
                emit("scan_error", {"message": "No filename provided"})
                return

            if not file.filename.lower().endswith(".zip"):
                emit(
                    "scan_error",
                    {
                        "message": "Only ZIP files are supported. Please upload a .zip file.",
                    },
                )
                return

            emit("progress", {"stage": "upload", "message": "Receiving upload..."})
            contents = await file.read()
            file_size = len(contents)
            if file_size > MAX_UPLOAD_SIZE:
                emit(
                    "scan_error",
                    {
                        "message": f"File size ({file_size / 1024 / 1024:.1f}MB) exceeds maximum allowed size (50MB)."
                    },
                )
                return

            if file_size == 0:
                emit("scan_error", {"message": "The uploaded file is empty."})
                return

            emit("progress", {"stage": "extract", "message": "Extracting ZIP securely..."})
            temp_dir = tempfile.mkdtemp(prefix="secret-guardian-upload-stream-")
            try:
                with zipfile.ZipFile(io.BytesIO(contents), "r") as zip_ref:
                    safe_extract_zip(zip_ref, temp_dir)
            except zipfile.BadZipFile:
                emit("scan_error", {"message": "The uploaded file is not a valid ZIP archive."})
                return

            scan_path = resolve_scan_path(temp_dir)

            elapsed = time.time() - start_time
            remaining_timeout = max(60, 300 - elapsed)

            emit("progress", {"stage": "scan", "message": "Scanning uploaded files..."})

            def on_progress(stage: str, message: str) -> None:
                emit("progress", {"stage": stage, "message": message})

            def on_finding(finding_obj) -> None:
                try:
                    streamed_finding = recalibrate_finding(
                        normalize_callback_finding(finding_obj)
                    )
                    emit("scan_finding", {"finding": streamed_finding})
                except Exception as stream_exc:
                    print(f"⚠️ upload scan_finding emit failed: {stream_exc}")

            results = await asyncio.to_thread(
                scan_directory,
                scan_path,
                timeout=int(remaining_timeout),
                use_external_scanners=True,
                start_time=start_time,
                cleanup=False,
                on_finding=on_finding,
                on_progress=on_progress,
            )

            if "error" in results:
                emit("scan_error", {"message": results["error"]})
                return

            findings = results.get("findings", [])
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

            results["scan_time"] = round(time.time() - start_time, 2)
            results["source"] = "upload"
            results["filename"] = file.filename
            results["file_size_mb"] = round(file_size / 1024 / 1024, 2)
            results["ai_stats"] = ai_meta

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
            print(f"❌ Upload streaming scan error: {str(exc)}")
            print(traceback.format_exc())
            emit(
                "scan_error",
                {"message": f"An error occurred during upload scanning: {str(exc)}"},
            )
        finally:
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                except Exception as cleanup_exc:
                    print(f"⚠️ Upload stream cleanup warning: {cleanup_exc}")
            emit("end", {})
            with contextlib.suppress(Exception):
                await file.close()

    async def event_generator():
        producer_task = asyncio.create_task(producer())
        try:
            while True:
                if await request.is_disconnected():
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


def enforce_rate_limit_stream(client_ip: str):
    """Return tuple instead of raising for stream emit-based error handling."""
    try:
        enforce_rate_limit(client_ip)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        return False, detail.get("message", "Rate limit exceeded"), detail.get(
            "retry_after"
        )
    return True, "", None
