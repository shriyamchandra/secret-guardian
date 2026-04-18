# Advanced Secret Detection Patterns
# This module implements enterprise-grade secret detection with:
# - 30+ secret types (vs your current 6)
# - Entropy-based detection for generic secrets
# - Context-aware filtering (comments, tests, examples)
# - Confidence scoring
# - False positive reduction

import re
from typing import Dict, Pattern, Tuple
import math
from collections import Counter

# ============================================================================
# BASIC SECRET PATTERNS (Your Current Patterns - Enhanced)
# ============================================================================

SECRET_PATTERNS: Dict[str, Pattern] = {
    # AWS Credentials
    "AWS Access Key ID": re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
    "AWS Secret Access Key": re.compile(
        r"(?i)aws(.{0,20})?['\"][0-9a-zA-Z/+=]{40}['\"]"
    ),
    "AWS Session Token": re.compile(
        r"\b((?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16})\b"
    ),
    # OpenAI
    "OpenAI API Key": re.compile(r"\b(sk-[a-zA-Z0-9]{48})\b"),
    "OpenAI Organization ID": re.compile(r"\b(org-[a-zA-Z0-9]{24})\b"),
    # GitHub
    "GitHub Token (Classic)": re.compile(r"\b(ghp_[a-zA-Z0-9]{36})\b"),
    "GitHub Fine-Grained Token": re.compile(
        r"\b(github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b"
    ),
    "GitHub OAuth Token": re.compile(r"\b(gho_[a-zA-Z0-9]{36})\b"),
    "GitHub App Token": re.compile(r"\b(ghu_[a-zA-Z0-9]{36})\b"),
    "GitHub Refresh Token": re.compile(r"\b(ghr_[a-zA-Z0-9]{36})\b"),
    # Google
    "Google API Key": re.compile(r"\b(AIza[0-9A-Za-z\-_]{35})\b"),
    "Google OAuth Token": re.compile(
        r"[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com"
    ),
    "Google Cloud Service Account": re.compile(r'"type":\s*"service_account"'),
    # Stripe
    "Stripe Live API Key": re.compile(r"\b(sk_live_[0-9a-zA-Z]{24,99})\b"),
    "Stripe Test API Key": re.compile(r"\b(sk_test_[0-9a-zA-Z]{24,99})\b"),
    "Stripe Publishable Key": re.compile(r"\b(pk_live_[0-9a-zA-Z]{24,99})\b"),
    "Stripe Webhook Secret": re.compile(r"\b(whsec_[0-9a-zA-Z]{32,99})\b"),
    # Slack
    "Slack Token": re.compile(r"\b(xox[baprs]-[0-9a-zA-Z]{10,72})\b"),
    "Slack Webhook": re.compile(
        r"https://hooks\.slack\.com/services/T[a-zA-Z0-9_]+/B[a-zA-Z0-9_]+/[a-zA-Z0-9_]+"
    ),
    # Twilio
    "Twilio API Key": re.compile(r"\b(SK[a-z0-9]{32})\b"),
    "Twilio Account SID": re.compile(r"\b(AC[a-z0-9]{32})\b"),
    # SendGrid
    "SendGrid API Key": re.compile(r"\b(SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43})\b"),
    # Mailgun
    "Mailgun API Key": re.compile(r"\b(key-[0-9a-zA-Z]{32})\b"),
    # Square
    "Square Access Token": re.compile(r"\b(sq0atp-[0-9A-Za-z\-_]{22})\b"),
    "Square OAuth Secret": re.compile(r"\b(sq0csp-[0-9A-Za-z\-_]{43})\b"),
    # PayPal
    "PayPal Braintree Access Token": re.compile(
        r"access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}"
    ),
    # Heroku (requires heroku context to avoid matching random UUIDs)
    "Heroku API Key": re.compile(
        r"(?i)(?:heroku[_\s-]*(?:api[_\s-]*)?(?:key|token)|HEROKU_API_KEY)\s*[:=]\s*['\"]?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})['\"]?"
    ),
    # Generic Patterns
    "Generic API Key": re.compile(
        r"(?i)api[_-]?key['\"]?\s*[:=]\s*['\"]([0-9a-zA-Z\-]{32,45})['\"]"
    ),
    "Generic Secret": re.compile(
        r"(?i)secret['\"]?\s*[:=]\s*['\"]([0-9a-zA-Z\-]{32,45})['\"]"
    ),
    "Bearer Token": re.compile(r"\b(Bearer\s+[a-zA-Z0-9\-._~+/]+=*)\b"),
    # Private Keys
    "RSA Private Key": re.compile(r"-----BEGIN RSA PRIVATE KEY-----"),
    "SSH Private Key": re.compile(r"-----BEGIN OPENSSH PRIVATE KEY-----"),
    "PGP Private Key": re.compile(r"-----BEGIN PGP PRIVATE KEY BLOCK-----"),
    # Database Connection Strings
    "MongoDB Connection String": re.compile(r"mongodb(\+srv)?://[^\s]+"),
    "PostgreSQL Connection String": re.compile(r"postgres(ql)?://[^\s]+"),
    "MySQL Connection String": re.compile(r"mysql://[^\s]+"),
    # JWT Tokens
    "JWT Token": re.compile(
        r"\b(eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b"
    ),
}


# ============================================================================
# ENTROPY-BASED DETECTION (Advanced Feature)
# ============================================================================


def calculate_shannon_entropy(string: str) -> float:
    """
    Calculate Shannon entropy to detect high-entropy strings (likely secrets).

    High entropy (>4.5) suggests randomness = potential secret
    Low entropy (<3.0) suggests human-readable text

    Example:
        "password123" -> entropy ~3.2 (low, common word)
        "aK9$mP2@xL4&" -> entropy ~3.8 (high, random)
    """
    if not string:
        return 0.0

    # Count character frequencies
    char_freq = Counter(string)
    length = len(string)

    # Calculate Shannon entropy
    entropy = 0.0
    for count in char_freq.values():
        probability = count / length
        entropy -= probability * math.log2(probability)

    return entropy


def is_high_entropy_string(
    string: str, min_length: int = 20, min_entropy: float = 4.5
) -> bool:
    """
    Detect potential secrets by analyzing string randomness.

    This catches secrets that don't match specific patterns but are
    suspiciously random (e.g., custom API keys, tokens).
    """
    if len(string) < min_length:
        return False

    entropy = calculate_shannon_entropy(string)
    return entropy >= min_entropy


# ============================================================================
# CONTEXT FILTERING (False Positive Reduction)
# ============================================================================

# Patterns that indicate false positives
FALSE_POSITIVE_INDICATORS = [
    # Common example/placeholder values
    r"(?i)(example|sample|test|demo|placeholder|your_key_here)",
    r"(?i)(fake|dummy|mock|xxx+|000+)",
    r"(?i)(insert.*here|replace.*with|add.*your)",
    # Documentation patterns
    r"(?i)(shown\s+below|as\s+follows|like\s+this)",
    # Variable/placeholder syntax
    r"[\{\}\[\]<>]",  # Has brackets/braces (likely a template)
    r"\$\{.*\}",  # ${VARIABLE} syntax
    r"%\w+%",  # %VARIABLE% syntax
    r"\{\{.*\}\}",  # {{variable}} syntax
]

FALSE_POSITIVE_PATTERNS = [re.compile(pattern) for pattern in FALSE_POSITIVE_INDICATORS]


def is_likely_false_positive(text: str, context: str = "") -> bool:
    """
    Check if detected secret is likely a false positive.

    Args:
        text: The detected secret string
        context: Surrounding code/text (3-5 lines)

    Returns:
        True if likely false positive, False if likely real secret
    """
    combined = f"{text} {context}".lower()

    # Check for false positive indicators
    for pattern in FALSE_POSITIVE_PATTERNS:
        if pattern.search(combined):
            return True

    # Check if it's in a comment
    if any(indicator in context for indicator in ["#", "//", "/*", "<!--", "'''"]):
        # Still flag it, but with lower confidence
        return False

    # Check if line contains words like "example" or "test"
    test_words = ["example", "test", "sample", "demo", "placeholder", "todo"]
    if any(word in combined for word in test_words):
        return True

    return False


# ============================================================================
# CONFIDENCE SCORING (Advanced Feature)
# ============================================================================


def calculate_confidence_score(
    secret_type: str, matched_text: str, line: str, file_path: str
) -> Tuple[str, float]:
    """
    Calculate confidence level (HIGH, MEDIUM, LOW) for detected secret.

    Factors:
    - Pattern specificity (AWS keys = HIGH, generic = MEDIUM)
    - Context clues (in .env = HIGH, in test file = LOW)
    - Entropy level
    - False positive indicators

    Returns:
        Tuple of (confidence_level, confidence_score)
    """
    score = 1.0

    # Factor 1: Pattern specificity
    high_confidence_types = [
        "AWS Access Key ID",
        "OpenAI API Key",
        "GitHub Token",
        "Stripe Live API Key",
        "SendGrid API Key",
    ]
    if secret_type in high_confidence_types:
        score *= 1.2
    elif "Generic" in secret_type:
        score *= 0.6

    # Factor 2: File context
    if any(
        name in file_path.lower() for name in [".env", "config", "secret", "credential"]
    ):
        score *= 1.3  # More likely in config files
    elif any(
        name in file_path.lower()
        for name in ["test", "spec", "mock", "fixture", "example"]
    ):
        score *= 0.4  # Less likely in test files

    # Factor 3: Line context
    if is_likely_false_positive(matched_text, line):
        score *= 0.3

    # Factor 4: Entropy check (for generic patterns)
    if "Generic" in secret_type or "Bearer" in secret_type:
        if is_high_entropy_string(matched_text):
            score *= 1.2
        else:
            score *= 0.5

    # Determine confidence level
    if score >= 1.0:
        return "HIGH", min(score, 1.5)
    elif score >= 0.5:
        return "MEDIUM", score
    else:
        return "LOW", score


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

"""
# In scanner.py, use like this:

for secret_type, pattern in SECRET_PATTERNS.items():
    if match := pattern.search(line):
        matched_text = match.group(1) if match.groups() else match.group(0)

        # Calculate confidence
        confidence_level, confidence_score = calculate_confidence_score(
            secret_type, matched_text, line, file_path
        )

        # Skip low-confidence findings (reduce noise)
        if confidence_level == "LOW":
            continue

        findings.append({
            "file_path": file_path,
            "secret_type": secret_type,
            "line_number": line_num,
            "leaked_line": line.strip(),
            "confidence": confidence_level,
            "confidence_score": f"{confidence_score:.2f}",
            "matched_text": matched_text[:20] + "..." if len(matched_text) > 20 else matched_text
        })
"""
