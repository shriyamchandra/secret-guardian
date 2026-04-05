import json
from typing import Any, Dict, List

try:
    from ..ai_fixer import analyze_threat_context
except Exception:
    from ai_fixer import analyze_threat_context  # type: ignore


SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def format_sse(event: str, payload: Dict[str, Any]) -> str:
    """Format a Server-Sent Event payload."""
    return f"event: {event}\\ndata: {json.dumps(payload)}\\n\\n"


def normalize_callback_finding(finding_obj: Any) -> Dict[str, Any]:
    """Normalize callback finding object to plain dict."""
    if isinstance(finding_obj, dict):
        return dict(finding_obj)
    if hasattr(finding_obj, "to_dict"):
        return finding_obj.to_dict()
    return dict(finding_obj)


def recalibrate_finding(finding: Dict[str, Any]) -> Dict[str, Any]:
    """Apply threat context analysis and severity recalibration to one finding."""
    finding["threat_context"] = analyze_threat_context(finding)
    exploitability = finding["threat_context"].get("exploitability")

    if exploitability == "LIKELY_FALSE_POSITIVE":
        finding["severity"] = "LOW"
    elif exploitability == "BAD_PRACTICE":
        finding["severity"] = "MEDIUM"
    elif exploitability == "EXPLOITABLE_NOW" and finding.get("severity", "HIGH") not in [
        "CRITICAL",
        "HIGH",
    ]:
        finding["severity"] = "HIGH"

    return finding


def recalibrate_and_sort_findings(findings: List[Dict[str, Any]]) -> Dict[str, int]:
    """Recalibrate severities, compute breakdown, and sort findings by priority."""
    severity_breakdown = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}

    for finding in findings:
        recalibrate_finding(finding)
        severity = finding.get("severity", "HIGH")
        if severity in severity_breakdown:
            severity_breakdown[severity] += 1

    findings.sort(
        key=lambda finding: (
            SEVERITY_ORDER.get(finding.get("severity", "LOW"), 4),
            finding.get("file_path", ""),
            finding.get("line_number", 0),
        )
    )

    return severity_breakdown
