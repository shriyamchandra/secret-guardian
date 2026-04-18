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
    "/.git/",
    "/.hg/",
    "/.svn/",
)

# Paths that are ALWAYS fixture/example data — any finding here is almost
# certainly intentional test data, not a real leaked secret.
ALWAYS_FIXTURE_PATHS = (
    "/testdata/",
    "/test-data/",
    "/test_data/",
    "/fixtures/",
    "/__fixtures__/",
    "/test-fixtures/",
    "/testfixtures/",
    "/examples/",
    "/example/",
    "/samples/",
    "/sample/",
    "/__snapshots__/",
    "/snapshots/",
    "/pkg/detectors/",
    "/pkg/analyzer/analyzers/",
)

# Directories that are part of a *secret-detection tool's own test suite*.
# A finding inside one of these directories AND inside a test file is
# virtually guaranteed to be an intentional test fixture — not a real leak.
# These get strict-dropped when both conditions match (Option C: balanced).
DETECTOR_TEST_SUITE_PATHS = (
    "/pkg/detectors/",
    "/pkg/analyzer/analyzers/",
    "/pkg/decoders/",
    "/detectors/",
    "/internal/detectors/",
    "/pkg/engine/",
    "/pkg/sources/",
    "/pkg/gitparse/",
    "/pkg/handlers/",
    "/pkg/custom_detectors/",
)

# File basenames / suffixes that are almost always captured test output or
# golden-file fixtures. Treated as always-fixture regardless of directory.
FIXTURE_FILE_SUFFIXES = (
    "/result_output.json",
    "/expected_output.json",
    "/expected.json",
    "/golden.json",
    "/output.json",
    ".golden",
    ".snap",
    ".snapshot",
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
    "_tests.",
    "test_",
    "/tests/",
    "/test/",
    "/spec/",
    "/specs/",
    "__tests__",
    "__test__",
    "__mocks__",
    "/mocks/",
    "mock_",
    ".mock.",
    ".stories.",
    ".fixture.",
    ".fixtures.",
)

# Substrings inside the detected secret value that strongly suggest it is a
# placeholder / fixture rather than a real exploitable credential.
FIXTURE_VALUE_HINTS_RE = re.compile(
    r"(?i)("
    r"fake|dummy|placeholder|example|sample|todo|"
    r"your[_\- ]?(?:key|token|secret|password)|"
    r"testkey|testtoken|testsecret|test.?value|test.?secret|test.?key|"
    r"redacted|masked|invalid|expired|"
    r"xxxxx|aaaaa|bbbbb|zzzzz|"
    r"abcdef|1234567890|abc123|def456|123abc|"
    r"secret.?test|my.?secret|longer.?encoded.?secret"
    r")"
)

# Values that are obviously NOT secrets — domain names, common identifiers,
# code references, etc. These are strict-dropped regardless of context.
NON_SECRET_VALUE_RE = re.compile(
    r"(?i)^"
    r"(?:"
    r"(?:https?://)?[a-z0-9.-]+\.(?:com|org|net|io|dev|ai)$|"  # Domain names
    r"[a-z]+\.(?:Scanner|Client|Server|Handler|Manager|Factory|Builder)$|"  # Code refs
    r"Bearer\s+token$|"  # Literal "Bearer token" text
    r"[A-Za-z]+\s+[A-Za-z]+$"  # Two plain words (e.g., "Bearer token")
    r")"
)

FILE_PATH_KEYS = ("File", "file", "file_path", "Path", "path")
SECRET_KEYS = ("Secret", "secret", "raw_value", "Raw", "raw")

UPPERCASE_VARIABLE_RE = re.compile(r"^[A-Z_]+$")
DOLLAR_VARIABLE_RE = re.compile(r"^\$[A-Za-z_][A-Za-z0-9_]*$")
# camelCase / PascalCase identifiers: at least one upper and one lower letter,
# only alphabet + underscore + optional trailing digits (to accept version
# suffixes like V2, V3, Client10). Real secrets have digits interleaved or
# high-entropy random characters, so this shouldn't match genuine tokens.
IDENTIFIER_RE = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])[A-Za-z][A-Za-z_]*[0-9]{0,3}$"
)


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


def _is_identifier_like(secret_value: str) -> bool:
    """Return True when the value looks like a code identifier, not a credential.

    Examples that should match: `getAllProjectReposV2`, `GitlabProjectsPerPage`,
    `useState`, `MAX_RETRIES`. Real tokens always contain digits or punctuation
    (dashes, dots, slashes) mixed with letters, so we require the value to be
    alphabet-only, length 8-64, with at least one upper and one lower case letter.
    """
    stripped = (secret_value or "").strip().strip("'\"`")
    if not (8 <= len(stripped) <= 64):
        return False
    return bool(IDENTIFIER_RE.fullmatch(stripped))


def _has_fixture_value_hint(secret_value: str) -> bool:
    stripped = (secret_value or "").strip()
    if not stripped:
        return False
    return bool(FIXTURE_VALUE_HINTS_RE.search(stripped))


def _in_always_fixture_path(path: str) -> bool:
    if not path:
        return False
    if any(segment in path for segment in ALWAYS_FIXTURE_PATHS):
        return True
    return any(path.endswith(suffix) for suffix in FIXTURE_FILE_SUFFIXES)


def _in_detector_test_suite(path: str) -> bool:
    """Return True if path is inside a secret-detector tool's own test suite."""
    if not path:
        return False
    return any(segment in path for segment in DETECTOR_TEST_SUITE_PATHS)


def _is_non_secret_value(secret_value: str) -> bool:
    """Return True for values that are obviously not secrets (domains, code refs)."""
    stripped = (secret_value or "").strip()
    if not stripped:
        return False
    return bool(NON_SECRET_VALUE_RE.fullmatch(stripped))


def grade_finding_noise(finding: dict) -> Dict[str, Any]:
    """
    Return strict-drop and noise-grading metadata for a finding.

    Strict-drop rules remove findings entirely:
    - Ignored path segments (/.i18n/, /.lock/, /node_modules/, /.git/)
    - Pure hex hashes (32/40/64)
    - Template/variable references ({{ }}, ${VAR}, $VAR, UPPER_CASE_VAR)
    - Identifier-looking raw values (camelCase / PascalCase variable names)

    Noise grading rules keep findings but lower priority:
    - Documentation files (.md/.txt/.rst) => LOW + DOCUMENTATION_TEMPLATE
    - Always-fixture paths (testdata/, fixtures/, pkg/detectors/, etc.) => LOW
    - Fixture-valued secrets (FAKE/EXAMPLE/DUMMY/etc.) => LOW
    - Regular test files (*_test.*, .spec., __tests__) => MEDIUM cap
    """
    path = _normalize_path(_extract_file_path(finding))
    secret_value = _extract_secret(finding)

    # ── Phase 1: Strict drops (finding removed entirely) ──────────────

    is_strict_drop_path = bool(path) and bool(STRICT_DROP_PATH_SEGMENTS_RE.search(path))
    is_hex_hash = (
        bool(secret_value)
        and bool(HEX_ONLY_RE.fullmatch(secret_value))
        and len(secret_value) in HASH_LENGTHS
    )
    is_template = bool(secret_value) and _is_template_reference(secret_value)
    is_identifier = bool(secret_value) and _is_identifier_like(secret_value)
    is_non_secret = bool(secret_value) and _is_non_secret_value(secret_value)

    if is_strict_drop_path or is_hex_hash or is_template or is_identifier or is_non_secret:
        return {
            "drop": True,
            "is_noise": True,
            "noise_type": "STRICT_DROP",
            "severity_override": None,
            "ai_remediation_eligible": False,
            "is_template": is_template,
        }

    is_test_file = bool(path) and bool(TEST_FILE_INDICATORS_RE.search(path))
    is_always_fixture_path = _in_always_fixture_path(path)
    is_detector_test = _in_detector_test_suite(path)

    # Option C (balanced): If the file is in a detector test suite AND is a
    # test file, it's virtually guaranteed to be an intentional fixture.
    # Drop it entirely instead of just downgrading.
    if is_detector_test and is_test_file:
        return {
            "drop": True,
            "is_noise": True,
            "noise_type": "DETECTOR_TEST_FIXTURE",
            "severity_override": None,
            "ai_remediation_eligible": False,
            "is_template": is_template,
        }

    # If in a fixture path AND a test file, also drop — these are test
    # fixtures with intentionally planted secrets for validation.
    if is_always_fixture_path and is_test_file:
        return {
            "drop": True,
            "is_noise": True,
            "noise_type": "FIXTURE_TEST_DROP",
            "severity_override": None,
            "ai_remediation_eligible": False,
            "is_template": is_template,
        }

    is_fixture_value = _has_fixture_value_hint(secret_value)

    # If the value itself screams "fake" AND it's in a test file, drop it.
    if is_fixture_value and is_test_file:
        return {
            "drop": True,
            "is_noise": True,
            "noise_type": "FIXTURE_VALUE_IN_TEST",
            "severity_override": None,
            "ai_remediation_eligible": False,
            "is_template": is_template,
        }

    # ── Phase 2: Noise grading (keep but lower priority) ──────────────

    is_documentation_file = bool(path) and path.endswith(NOISE_DOC_EXTENSIONS)

    if is_documentation_file:
        return {
            "drop": False,
            "is_noise": True,
            "noise_type": "DOCUMENTATION_TEMPLATE",
            "severity_override": "LOW",
            "ai_remediation_eligible": False,
            "is_template": is_template,
        }

    if is_always_fixture_path:
        return {
            "drop": False,
            "is_noise": True,
            "noise_type": "FIXTURE_DATA",
            "severity_override": "LOW",
            "ai_remediation_eligible": False,
            "is_template": is_template,
        }

    if is_fixture_value:
        return {
            "drop": False,
            "is_noise": True,
            "noise_type": "FIXTURE_VALUE",
            "severity_override": "LOW",
            "ai_remediation_eligible": False,
            "is_template": is_template,
        }

    if is_test_file:
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
