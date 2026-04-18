import os
from copy import deepcopy

from fastapi import HTTPException

try:
    from ..ai_fixer import MAX_AI_CALLS_PER_SCAN
    from ..rate_limiter import rate_limiter
except Exception:
    from ai_fixer import MAX_AI_CALLS_PER_SCAN  # type: ignore
    from rate_limiter import rate_limiter  # type: ignore


MAX_FINDINGS_RETURNED = int(os.getenv("MAX_FINDINGS_RETURNED", "1200"))
MAX_STREAM_FINDINGS_EMITTED = int(
    os.getenv("MAX_STREAM_FINDINGS_EMITTED", str(MAX_FINDINGS_RETURNED))
)

SEVERITY_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
CONFIDENCE_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}


def default_ai_meta() -> dict:
    """Return a fresh metadata payload for AI orchestration stats."""
    return {
        "ai_calls_made": 0,
        "ai_calls_qwen": 0,
        "ai_calls_skipped": 0,
        "ai_calls_deduped": 0,
        "budget_limit": MAX_AI_CALLS_PER_SCAN,
        "qwen_budget_limit": 0,
        "circuit_broken": False,
        "qwen_available": False,
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


def apply_findings_limit(results: dict, limit: int = MAX_FINDINGS_RETURNED) -> dict:
    """Cap findings payload size while preserving full totals and breakdown."""
    findings = results.get("findings")
    if not isinstance(findings, list):
        return results

    full_total = int(results.get("total_findings", len(findings)) or len(findings))
    displayed = min(len(findings), limit)
    limited_findings = findings[:limit]
    truncated = full_total > displayed

    payload = {
        **results,
        "findings": limited_findings,
        "total_findings": full_total,
        "displayed_findings": displayed,
        "findings_truncated": truncated,
        "truncated_findings": max(full_total - displayed, 0),
        "findings_limit": limit,
    }
    return payload


def _rank_severity(value: str) -> int:
    return SEVERITY_RANK.get(str(value or "").upper(), 0)


def _rank_confidence(value: str) -> int:
    return CONFIDENCE_RANK.get(str(value or "").upper(), 0)


def _looks_aggregated(findings: list[dict]) -> bool:
    """Detect whether incoming findings already include occurrence arrays."""
    if not findings:
        return False
    sample = findings[0]
    return isinstance(sample.get("occurrences"), list)


def aggregate_findings_by_secret(findings: list[dict]) -> list[dict]:
    """Collapse finding list into unique incidents keyed by raw secret value."""
    grouped: dict[str, dict] = {}
    occurrence_sets: dict[str, set[tuple[str, int]]] = {}

    for index, finding in enumerate(findings):
        if not isinstance(finding, dict):
            continue

        raw_secret = str(finding.get("raw_value") or "").strip()
        if raw_secret:
            key = raw_secret
        else:
            # Keep entries without raw secret distinct to avoid over-merging.
            key = "::".join(
                [
                    "missing-secret",
                    str(finding.get("file_path") or ""),
                    str(finding.get("line_number") or ""),
                    str(finding.get("secret_type") or ""),
                    str(index),
                ]
            )

        file_path = str(finding.get("file_path") or "")
        try:
            line_number = int(finding.get("line_number") or 0)
        except (TypeError, ValueError):
            line_number = 0
        occurrence_key = (file_path, line_number)

        if key not in grouped:
            base = deepcopy(finding)
            base["occurrences"] = []
            base["occurrence_count"] = 0
            base["source_scanners"] = []
            grouped[key] = base
            occurrence_sets[key] = set()

        aggregate = grouped[key]
        seen_occurrences = occurrence_sets[key]

        if occurrence_key not in seen_occurrences:
            aggregate["occurrences"].append(
                {"file_path": file_path, "line_number": line_number}
            )
            seen_occurrences.add(occurrence_key)

        aggregate["occurrence_count"] = len(aggregate["occurrences"])

        scanner_source = finding.get("scanner_source")
        if scanner_source and scanner_source not in aggregate["source_scanners"]:
            aggregate["source_scanners"].append(scanner_source)

        incoming_severity = str(finding.get("severity") or "")
        if _rank_severity(incoming_severity) > _rank_severity(
            str(aggregate.get("severity") or "")
        ):
            aggregate["severity"] = incoming_severity

        incoming_confidence = str(finding.get("confidence") or "")
        if _rank_confidence(incoming_confidence) > _rank_confidence(
            str(aggregate.get("confidence") or "")
        ):
            aggregate["confidence"] = incoming_confidence

        if finding.get("entropy") is not None:
            try:
                incoming_entropy = float(finding.get("entropy") or 0)
                existing_entropy = float(aggregate.get("entropy") or 0)
                if incoming_entropy > existing_entropy:
                    aggregate["entropy"] = round(incoming_entropy, 2)
            except (TypeError, ValueError):
                pass

    aggregated_findings = list(grouped.values())
    for finding in aggregated_findings:
        occurrences = finding.get("occurrences") or []
        if occurrences:
            primary = occurrences[0]
            finding["file_path"] = primary.get("file_path") or finding.get("file_path")
            finding["line_number"] = primary.get("line_number") or finding.get(
                "line_number"
            )

    return aggregated_findings


def apply_finding_aggregation(results: dict) -> dict:
    """Convert per-occurrence findings into per-secret aggregated incidents."""
    findings = results.get("findings")
    if not isinstance(findings, list):
        return results

    if findings and _looks_aggregated(findings):
        files_affected = len(
            {
                occ.get("file_path")
                for finding in findings
                for occ in (finding.get("occurrences") or [])
                if isinstance(occ, dict) and occ.get("file_path")
            }
        )
        return {
            **results,
            "findings": findings,
            "total_findings": int(results.get("total_findings", len(findings))),
            "files_affected": files_affected or int(results.get("files_affected", 0)),
            "aggregated_findings": True,
        }

    aggregated = aggregate_findings_by_secret(findings)
    files_affected = len(
        {
            occ.get("file_path")
            for finding in aggregated
            for occ in (finding.get("occurrences") or [])
            if isinstance(occ, dict) and occ.get("file_path")
        }
    )

    return {
        **results,
        "findings": aggregated,
        "total_findings": len(aggregated),
        "files_affected": files_affected,
        "aggregated_findings": True,
    }
