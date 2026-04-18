"""
Post-processing heuristics for strict-drop filtering and noise grading.

This module supports two modes:
1) strict drop (boolean keep/delete)
2) noise grading (severity override + metadata)
"""

import re
from functools import lru_cache
from typing import Any, Dict


HEX_ONLY_RE = re.compile(r"^[a-fA-F0-9]+$")
HASH_LENGTHS = {32, 40, 64}

STRICT_DROP_PATH_SEGMENTS = (
    "/.i18n/",
    "/.lock/",
    "/node_modules/",
)

TEMPLATE_INDICATORS = (
    "{{",
    "}}",
    "${",
    "%>",
    "<%=",
    "process.env.",
    "os.environ",
)

NOISE_DOC_EXTENSIONS = (".md", ".txt", ".rst")

TEST_FILE_INDICATORS = (
    ".test.",
    ".spec.",
    "_test.",
    "/tests/",
    "__tests__",
    "/mocks/",
    "mock_",
)

FILE_PATH_KEYS = ("File", "file", "file_path", "Path", "path")
SECRET_KEYS = ("Secret", "secret", "raw_value", "Raw", "raw")

UPPERCASE_VARIABLE_RE = re.compile(r"^[A-Z_]+$")
DOLLAR_VARIABLE_RE = re.compile(r"^\$[A-Za-z_][A-Za-z0-9_]*$")


def _compile_contains_regex(values: tuple[str, ...]) -> re.Pattern[str]:
    escaped_values = [re.escape(value.casefold()) for value in values if value]
    if not escaped_values:
        return re.compile(r"(?!x)x")
    return re.compile("|".join(sorted(escaped_values, key=len, reverse=True)))


STRICT_DROP_PATH_SEGMENTS_RE = _compile_contains_regex(STRICT_DROP_PATH_SEGMENTS)
TEST_FILE_INDICATORS_RE = _compile_contains_regex(TEST_FILE_INDICATORS)


def _extract_file_path(finding: Dict[str, Any]) -> str:
    for key in FILE_PATH_KEYS:
        value = finding.get(key)
        if value is not None:
            return str(value)

    source_metadata = finding.get("SourceMetadata")
    if isinstance(source_metadata, dict):
        data = source_metadata.get("Data")
        if isinstance(data, dict):
            filesystem = data.get("Filesystem")
            if isinstance(filesystem, dict):
                fs_path = filesystem.get("file")
                if fs_path is not None:
                    return str(fs_path)

    return ""


def _extract_secret(finding: Dict[str, Any]) -> str:
    for key in SECRET_KEYS:
        value = finding.get(key)
        if value is not None:
            return str(value).strip()
    return ""


def _extract_entropy(finding: Dict[str, Any]) -> float:
    entropy = finding.get("entropy")
    if entropy is None:
        return 0.0
    try:
        return float(entropy)
    except (TypeError, ValueError):
        return 0.0


@lru_cache(maxsize=2048)
def _normalize_path(path: str) -> str:
    normalized = (path or "").replace("\\", "/").casefold()
    if normalized and not normalized.startswith("/"):
        return f"/{normalized}"
    return normalized


def _is_template_reference(secret_value: str) -> bool:
    stripped = (secret_value or "").strip()
    lower_secret = stripped.casefold()

    if any(indicator.casefold() in lower_secret for indicator in TEMPLATE_INDICATORS):
        return True

    if DOLLAR_VARIABLE_RE.fullmatch(stripped):
        return True

    if "_" in stripped and UPPERCASE_VARIABLE_RE.fullmatch(stripped):
        return True

    return False


def grade_finding_noise(finding: dict) -> Dict[str, Any]:
    """
    Return strict-drop and noise-grading metadata for a finding.

    Strict-drop rules remove findings entirely:
    - Ignored path segments (/.i18n/, /.lock/, /node_modules/)
    - Pure hex hashes (32/40/64)
    - Template/variable references ({{ }}, ${VAR}, $VAR, UPPER_CASE_VAR)

    Noise grading rules keep findings but lower priority:
    - Documentation files (.md/.txt/.rst) => LOW + DOCUMENTATION_TEMPLATE
    - Test fixtures => MEDIUM + TEST_FIXTURE
    - High-entropy secrets in tests (>5.5) => HIGH (no downgrade)
    """
    path = _normalize_path(_extract_file_path(finding))
    secret_value = _extract_secret(finding)

    is_strict_drop_path = bool(path) and bool(STRICT_DROP_PATH_SEGMENTS_RE.search(path))
    is_hex_hash = (
        bool(secret_value)
        and bool(HEX_ONLY_RE.fullmatch(secret_value))
        and len(secret_value) in HASH_LENGTHS
    )
    is_template = bool(secret_value) and _is_template_reference(secret_value)

    if is_strict_drop_path or is_hex_hash or is_template:
        return {
            "drop": True,
            "is_noise": True,
            "noise_type": "STRICT_DROP",
            "severity_override": None,
            "ai_remediation_eligible": False,
            "is_template": is_template,
        }

    is_documentation_file = bool(path) and path.endswith(NOISE_DOC_EXTENSIONS)
    is_test_file = bool(path) and bool(TEST_FILE_INDICATORS_RE.search(path))
    entropy = _extract_entropy(finding)

    if is_documentation_file:
        return {
            "drop": False,
            "is_noise": True,
            "noise_type": "DOCUMENTATION_TEMPLATE",
            "severity_override": "LOW",
            "ai_remediation_eligible": False,
            "is_template": is_template,
        }

    if is_test_file:
        if entropy > 5.5:
            return {
                "drop": False,
                "is_noise": False,
                "noise_type": None,
                "severity_override": "HIGH",
                "ai_remediation_eligible": True,
                "is_template": is_template,
            }

        return {
            "drop": False,
            "is_noise": True,
            "noise_type": "TEST_FIXTURE",
            "severity_override": "MEDIUM",
            "ai_remediation_eligible": True,
            "is_template": is_template,
        }

    return {
        "drop": False,
        "is_noise": False,
        "noise_type": None,
        "severity_override": None,
        "ai_remediation_eligible": True,
        "is_template": is_template,
    }


def is_false_positive(finding: dict) -> bool:
    """
    Backward-compatible boolean API for callers that only support drop/keep.

    This now only reflects strict-drop decisions.
    """
    decision = grade_finding_noise(finding)
    return bool(decision.get("drop"))
