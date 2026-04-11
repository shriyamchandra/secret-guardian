"""
Post-processing heuristics for suppressing high-noise secret findings.

This module is intentionally conservative and is currently tuned for
Gitleaks-style finding payloads.
"""

import re
from functools import lru_cache
from typing import Any, Dict


HEX_ONLY_RE = re.compile(r"^[a-fA-F0-9]+$")
HASH_LENGTHS = {32, 40, 64}

IGNORED_EXTENSIONS = (
    ".baseline",
    ".lock",
    ".sum",
    ".svg",
    ".jsonl",
)

IGNORED_PATH_SEGMENTS = (
    "/.i18n/",
    "/locales/",
    "/test/",
    "/mock/",
)

PLACEHOLDER_MARKERS = (
    "example",
    "changeme",
    "your_api_key",
)

TEST_FILE_INDICATORS = (
    ".test.",
    ".spec.",
    "/tests/",
    "__tests__",
    "/mocks/",
    "mock_",
)

DUMMY_PATTERNS = (
    "12345",
    "67890",
    "00000",
    "99999",
    "abcdef",
    "qwerty",
    "asdfgh",
    "secret",
    "dummy",
    "mock",
    "token",
    "key",
)

DUMMY_DOMAINS = (
    "example.com",
    "example.org",
    "example.net",
    "test.com",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
)

DUMMY_AUTH_PAIRS = (
    "user:pass@",
    "username:password@",
    "admin:admin@",
    "admin:password@",
    "foo:bar@",
)

OOP_KEYWORDS = (
    "factory",
    "manager",
    "controller",
    "service",
    "provider",
    "websocket",
    "handler",
    "adapter",
    "wrapper",
    "interface",
    "config",
    "builder",
    "component",
    "module",
    "exception",
)

PLATFORM_NAME_MARKERS = ("mattermost",)

config_suffixes = (
    "=true",
    "=false",
    "=enabled",
    "=disabled",
    "=null",
    "=undefined",
    "=1",
    "=0",
)

config_prefixes = (
    "config=",
    "policy=",
    "mode=",
    "state=",
    "status=",
)

redaction_patterns = (
    "***",
    "xxx",
    "...",
    "<password>",
    "<secret>",
    "<token>",
    "<key>",
    "[password]",
    "{password}",
    "${password}",
    "@host:",
    "@localhost:",
)

doc_extensions = (
    ".md",
    ".txt",
    ".rst",
    ".template",
    ".sample",
    ".example",
)

FILE_PATH_KEYS = ("File", "file", "file_path", "Path", "path")
SECRET_KEYS = ("Secret", "secret", "raw_value", "Raw", "raw")


def _compile_contains_regex(values: tuple[str, ...]) -> re.Pattern[str]:
    """Compile a casefolded alternation regex for fast substring checks."""
    escaped_values = [re.escape(value.casefold()) for value in values if value]
    if not escaped_values:
        # Matches nothing.
        return re.compile(r"(?!x)x")
    return re.compile("|".join(sorted(escaped_values, key=len, reverse=True)))


IGNORED_PATH_SEGMENTS_RE = _compile_contains_regex(IGNORED_PATH_SEGMENTS)
PLACEHOLDER_MARKERS_RE = _compile_contains_regex(PLACEHOLDER_MARKERS)
TEST_FILE_INDICATORS_RE = _compile_contains_regex(TEST_FILE_INDICATORS)
DUMMY_PATTERNS_RE = _compile_contains_regex(DUMMY_PATTERNS)
DUMMY_DOMAINS_RE = _compile_contains_regex(DUMMY_DOMAINS)
DUMMY_AUTH_PAIRS_RE = _compile_contains_regex(DUMMY_AUTH_PAIRS)
OOP_KEYWORDS_RE = _compile_contains_regex(OOP_KEYWORDS)
PLATFORM_NAME_MARKERS_RE = _compile_contains_regex(PLATFORM_NAME_MARKERS)
CONFIG_SUFFIXES_RE = _compile_contains_regex(config_suffixes)
CONFIG_PREFIXES_RE = _compile_contains_regex(config_prefixes)
REDACTION_PATTERNS_RE = _compile_contains_regex(redaction_patterns)

URI_SCHEMA_MARKER = "://"


def _extract_file_path(finding: Dict[str, Any]) -> str:
    """Extract file path from raw or normalized scanner payloads."""
    for key in FILE_PATH_KEYS:
        value = finding.get(key)
        if value is not None:
            return str(value)

    # TruffleHog raw JSON shape
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
    """Extract raw secret value from raw or normalized scanner payloads."""
    for key in SECRET_KEYS:
        value = finding.get(key)
        if value is not None:
            return str(value).strip()
    return ""


@lru_cache(maxsize=2048)
def _normalize_path(path: str) -> str:
    normalized = (path or "").replace("\\", "/").casefold()
    if normalized and not normalized.startswith("/"):
        return f"/{normalized}"
    return normalized


def is_false_positive(finding: dict) -> bool:
    """
    Return True when a finding matches known high-noise false-positive patterns.

    Rules:
    1) Path & extension rule
    2) Pure-hex hash rule (32/40/64)
    3) Placeholder/dummy value rule
    4) Test/spec file rule
    5) Sequential/keyboard smash dummy-value rule
    6) Dummy URI/reserved-domain rule
    7) Class-name/OOP keyword rule
    8) Configuration-flag rule
    9) Explicitly redacted/documentation URI template rule
    """
    path = _normalize_path(_extract_file_path(finding))

    if path:
        if path.endswith(IGNORED_EXTENSIONS):
            return True
        if IGNORED_PATH_SEGMENTS_RE.search(path):
            return True

    is_test_file = bool(path) and bool(TEST_FILE_INDICATORS_RE.search(path))
    if is_test_file:
        return True

    secret = _extract_secret(finding)
    if not secret:
        return False

    lower_secret = secret.casefold()

    if HEX_ONLY_RE.fullmatch(secret) and len(secret) in HASH_LENGTHS:
        return True

    if PLACEHOLDER_MARKERS_RE.search(lower_secret):
        return True

    is_dummy_value = bool(DUMMY_PATTERNS_RE.search(lower_secret))
    has_dummy_domain = bool(DUMMY_DOMAINS_RE.search(lower_secret))
    has_dummy_auth_pair = bool(DUMMY_AUTH_PAIRS_RE.search(lower_secret))
    is_dummy_uri = has_dummy_domain or has_dummy_auth_pair
    has_oop_keyword = bool(OOP_KEYWORDS_RE.search(lower_secret))
    has_platform_literal = bool(PLATFORM_NAME_MARKERS_RE.search(lower_secret))
    is_class_name_false_positive = has_oop_keyword or has_platform_literal
    is_config_flag = bool(
        CONFIG_SUFFIXES_RE.search(lower_secret)
        or CONFIG_PREFIXES_RE.search(lower_secret)
    )
    has_redaction_pattern = bool(REDACTION_PATTERNS_RE.search(lower_secret))
    is_documentation_file = bool(path) and path.endswith(doc_extensions)
    is_doc_uri_template = is_documentation_file and URI_SCHEMA_MARKER in lower_secret

    if (
        is_test_file
        or is_dummy_value
        or is_dummy_uri
        or is_class_name_false_positive
        or is_config_flag
        or has_redaction_pattern
        or is_doc_uri_template
    ):
        return True

    return False
