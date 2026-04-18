import io
import json
import time
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

try:
    from ..schemas import ExportRequest
except Exception:
    from schemas import ExportRequest  # type: ignore


router = APIRouter(tags=["Export"])


def _mask_secret_value(value: str) -> str:
    """Mask secret-like values in export logs by default."""
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"


def _resolve_scan_source_label(request: ExportRequest) -> str:
    source = (request.scan_source or "").strip().lower()
    if source == "upload":
        return "ZIP Upload"
    if source in {"repository_url", "repo_url", "url", "repository"}:
        return "Repository URL"
    if source:
        return source.replace("_", " ").title()
    return "Repository URL" if request.repo_url else "Unknown"


def _resolve_scan_target(request: ExportRequest) -> str:
    if request.scan_target:
        return request.scan_target
    if request.scanned_filename:
        return request.scanned_filename
    if request.repo_url:
        return request.repo_url
    return "Unknown"


def _finding_location_lines(finding: Dict[str, Any]) -> List[str]:
    occurrences = finding.get("occurrences")
    if isinstance(occurrences, list) and occurrences:
        lines = []
        for occ in occurrences:
            if not isinstance(occ, dict):
                continue
            file_path = occ.get("file_path", "Unknown")
            line_number = occ.get("line_number", "?")
            lines.append(f"  - {file_path}:{line_number}")
        return lines or [
            f"  - {finding.get('file_path', 'Unknown')}:{finding.get('line_number', '?')}"
        ]

    return [
        f"  - {finding.get('file_path', 'Unknown')}:{finding.get('line_number', '?')}"
    ]


@router.post("/export/json")
async def export_json(request: ExportRequest):
    """Export scan results as JSON file."""
    scan_source_label = _resolve_scan_source_label(request)
    scan_target = _resolve_scan_target(request)

    export_data = {
        "tool": "Secret Guardian",
        "version": "1.0.0",
        "exported_at": datetime.now().isoformat(),
        "scan_source": scan_source_label,
        "scan_target": scan_target,
        "repository": request.repo_url,
        "uploaded_filename": request.scanned_filename,
        "uploaded_file_size_mb": request.uploaded_file_size_mb,
        "scan_duration_seconds": request.scan_duration,
        "total_findings": request.total_findings or len(request.findings),
        "displayed_findings": request.displayed_findings or len(request.findings),
        "findings_truncated": request.findings_truncated,
        "files_affected": request.files_affected,
        "scanners_used": request.scanners_used,
        "severity_breakdown": request.severity_breakdown,
        "findings": request.findings,
        "disclaimer": "This report is for informational purposes only. Secrets should be rotated immediately.",
    }

    json_str = json.dumps(export_data, indent=2)

    return StreamingResponse(
        io.BytesIO(json_str.encode("utf-8")),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=secret-guardian-report-{int(time.time())}.json"
        },
    )


@router.post("/export/summary")
async def export_summary(request: ExportRequest):
    """Generate a text summary of scan results for clipboard copying."""
    severity = request.severity_breakdown
    scan_source_label = _resolve_scan_source_label(request)
    scan_target = _resolve_scan_target(request)
    total_findings = request.total_findings or len(request.findings)
    displayed_findings = request.displayed_findings or len(request.findings)

    summary_lines = [
        "=" * 50,
        "🛡️ SECRET GUARDIAN - SCAN REPORT",
        "=" * 50,
        f"Source: {scan_source_label}",
        f"Target: {scan_target}",
        f"Scan Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Duration: {request.scan_duration:.2f}s",
        "",
        "📊 SUMMARY",
        "-" * 30,
        f"Total Findings: {total_findings}",
        f"Displayed Findings: {displayed_findings}",
        f"Files Affected: {request.files_affected}",
        f"  🔴 Critical: {severity.get('CRITICAL', 0)}",
        f"  🟠 High: {severity.get('HIGH', 0)}",
        f"  🟡 Medium: {severity.get('MEDIUM', 0)}",
        f"  🟢 Low: {severity.get('LOW', 0)}",
        "",
    ]

    if request.findings_truncated:
        summary_lines.append(
            "⚠️ Note: Findings list was truncated in this payload for performance."
        )
        summary_lines.append("")

    if request.findings:
        summary_lines.append("📋 FINDINGS BY FILE")
        summary_lines.append("-" * 30)

        files: dict = {}
        for finding in request.findings:
            file_path = finding.get("file_path", "Unknown")
            if file_path not in files:
                files[file_path] = []
            files[file_path].append(finding)

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


@router.post("/export/log")
async def export_scan_log(
    request: ExportRequest,
    include_raw: bool = Query(
        False,
        description="DEBUG: include raw secret values and code snippets (for false-positive triage).",
    ),
):
    """Export scan results as structured plain-text log file."""
    severity = request.severity_breakdown or {}
    scan_source_label = _resolve_scan_source_label(request)
    scan_target = _resolve_scan_target(request)
    total_findings = request.total_findings or len(request.findings)
    displayed_findings = request.displayed_findings or len(request.findings)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines: List[str] = [
        "=" * 80,
        "SECRET GUARDIAN - SCAN RESULTS LOG",
        "=" * 80,
        f"Generated At: {generated_at}",
        f"Source: {scan_source_label}",
        f"Target: {scan_target}",
    ]

    if include_raw:
        lines.extend(
            [
                "",
                "⚠️  DEBUG MODE: raw secret values included for false-positive triage.",
                "⚠️  DO NOT share this file externally — treat it like the secrets themselves.",
            ]
        )

    if request.scanned_filename:
        lines.append(f"Uploaded Filename: {request.scanned_filename}")
    if request.uploaded_file_size_mb is not None:
        lines.append(f"Uploaded Size (MB): {request.uploaded_file_size_mb:.2f}")

    lines.extend(
        [
            f"Duration (seconds): {request.scan_duration:.2f}",
            f"Files Affected: {request.files_affected}",
            f"Scanners Used: {', '.join(request.scanners_used) if request.scanners_used else 'Unknown'}",
            f"Total Findings: {total_findings}",
            f"Displayed Findings: {displayed_findings}",
            f"Findings Truncated: {'Yes' if request.findings_truncated else 'No'}",
            "",
            "Severity Breakdown:",
            f"  CRITICAL: {severity.get('CRITICAL', 0)}",
            f"  HIGH: {severity.get('HIGH', 0)}",
            f"  MEDIUM: {severity.get('MEDIUM', 0)}",
            f"  LOW: {severity.get('LOW', 0)}",
            "",
            "Findings:",
            "-" * 80,
        ]
    )

    if not request.findings:
        lines.append("No findings detected.")
    else:
        for index, finding in enumerate(request.findings, start=1):
            severity_level = finding.get("severity", "UNKNOWN")
            secret_type = finding.get("secret_type", "Unknown")
            confidence = finding.get("confidence", "Unknown")
            entropy = finding.get("entropy")
            entropy_text = f"{float(entropy):.2f}" if entropy is not None else "N/A"
            scanner_source = finding.get("scanner_source")
            scanner_sources = finding.get("source_scanners")

            if isinstance(scanner_sources, list) and scanner_sources:
                source_text = ", ".join(str(item) for item in scanner_sources)
            elif scanner_source:
                source_text = str(scanner_source)
            else:
                source_text = "Unknown"

            raw_value = str(finding.get("raw_value") or "")
            masked_value = _mask_secret_value(raw_value) if raw_value else "N/A"
            occurrence_count = finding.get("occurrence_count")
            if occurrence_count is None:
                occurrences = finding.get("occurrences")
                occurrence_count = (
                    len(occurrences) if isinstance(occurrences, list) else 1
                )

            lines.extend(
                [
                    f"[{index}] {severity_level} - {secret_type}",
                    f"  Confidence: {confidence}",
                    f"  Entropy: {entropy_text}",
                    f"  Scanner Source(s): {source_text}",
                    f"  Occurrences: {occurrence_count}",
                    f"  Value (masked): {masked_value}",
                ]
            )

            if include_raw:
                raw_display = raw_value if raw_value else "N/A"
                snippet = str(
                    finding.get("code_snippet")
                    or finding.get("leaked_line")
                    or ""
                ).strip()
                lines.append(f"  Value (RAW): {raw_display}")
                if snippet:
                    lines.append(f"  Code Snippet: {snippet}")
                threat_ctx = finding.get("threat_context")
                if isinstance(threat_ctx, dict):
                    exploitability = threat_ctx.get("exploitability")
                    if exploitability:
                        lines.append(f"  Exploitability: {exploitability}")
                    confidence_val = threat_ctx.get("confidence")
                    if confidence_val is not None:
                        lines.append(f"  Threat Confidence: {confidence_val}")

            lines.append("  Locations:")

            lines.extend(_finding_location_lines(finding))

            ai_fix = finding.get("ai_fix")
            if isinstance(ai_fix, dict):
                ai_status = ai_fix.get("ai_status")
                ai_generated = ai_fix.get("ai_generated")
                if ai_status is not None:
                    lines.append(f"  AI Status: {ai_status}")
                if ai_generated is not None:
                    lines.append(f"  AI Generated: {'Yes' if ai_generated else 'No'}")

            lines.append("")

    lines.extend(
        [
            "=" * 80,
            "IMPORTANT: Rotate exposed secrets immediately and remove secrets from source control.",
            "=" * 80,
            "",
        ]
    )

    content = "\n".join(lines)
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename=secret-guardian-scan-log-{int(time.time())}.log"
        },
    )
