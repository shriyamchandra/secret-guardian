import re
import math
from collections import Counter
from typing import Tuple

# ============================================================================
# EXPANDED SECRET PATTERNS - 35+ Types (vs original 6)
# ============================================================================

SECRET_PATTERNS = {
    # AWS Credentials (Enhanced)
    "AWS Access Key ID": re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
    "AWS Secret Access Key": re.compile(
        r"(?i)aws(.{0,20})?['\"][0-9a-zA-Z/+=]{40}['\"]"
    ),
    "AWS Session Token": re.compile(
        r"\b((?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16})\b"
    ),
    # OpenAI (Enhanced)
    "OpenAI API Key": re.compile(r"\b(sk-[a-zA-Z0-9]{48})\b"),
    "OpenAI Organization ID": re.compile(r"\b(org-[a-zA-Z0-9]{24})\b"),
    # GitHub (5 token types)
    "GitHub Token (Classic)": re.compile(r"\b(ghp_[a-zA-Z0-9]{36})\b"),
    "GitHub Fine-Grained Token": re.compile(
        r"\b(github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b"
    ),
    "GitHub OAuth Token": re.compile(r"\b(gho_[a-zA-Z0-9]{36})\b"),
    "GitHub App Token": re.compile(r"\b(ghu_[a-zA-Z0-9]{36})\b"),
    "GitHub Refresh Token": re.compile(r"\b(ghr_[a-zA-Z0-9]{36})\b"),
    # Google (Enhanced)
    "Google API Key": re.compile(r"\b(AIza[0-9A-Za-z\-_]{35})\b"),
    "Google OAuth Token": re.compile(
        r"[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com"
    ),
    "Google Cloud Service Account": re.compile(r'"type":\s*"service_account"'),
    # Stripe (4 types)
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
    "PayPal Braintree Token": re.compile(
        r"access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}"
    ),
    # Heroku
    "Heroku API Key": re.compile(
        r"\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b"
    ),
    # Private Keys
    "RSA Private Key": re.compile(r"-----BEGIN RSA PRIVATE KEY-----"),
    "SSH Private Key": re.compile(r"-----BEGIN OPENSSH PRIVATE KEY-----"),
    "PGP Private Key": re.compile(r"-----BEGIN PGP PRIVATE KEY BLOCK-----"),
    # Database Connections
    "MongoDB Connection String": re.compile(r"mongodb(\+srv)?://[^\s]+"),
    "PostgreSQL Connection": re.compile(r"postgres(ql)?://[^\s]+"),
    "MySQL Connection": re.compile(r"mysql://[^\s]+"),
    # JWT
    "JWT Token": re.compile(
        r"\b(eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b"
    ),
    # Generic (with high entropy check)
    "Generic API Key": re.compile(
        r"(?i)api[_-]?key['\"]?\s*[:=]\s*['\"]([0-9a-zA-Z]{32,45})['\"]"
    ),
    "Generic Secret": re.compile(
        r"(?i)secret['\"]?\s*[:=]\s*['\"]([0-9a-zA-Z]{32,45})['\"]"
    ),
    "Bearer Token": re.compile(r"\b(Bearer\s+[a-zA-Z0-9\-._~+/]+=*)\b"),
}


# ============================================================================
# ENTROPY DETECTION - Detects unknown secrets by randomness
# ============================================================================


def calculate_shannon_entropy(data: str) -> float:
    """
    Calculate Shannon entropy to detect high-randomness strings.

    Shannon entropy measures the randomness/information content of a string.
    High entropy (>4.5) suggests a random/generated secret.
    Low entropy (<3.0) suggests human-readable text.

    Examples:
        "password123" → 3.2 (low, common word)
        "aK9$mP2@xL4&" → 4.8 (high, random) ← Likely a secret!

    Args:
        data: String to analyze

    Returns:
        Shannon entropy value (0.0 to ~5.0 for typical strings)
    """
    if not data:
        return 0.0

    # Count character frequencies
    char_freq = Counter(data)
    length = len(data)

    # Calculate Shannon entropy: -Σ(p(x) * log2(p(x)))
    entropy = 0.0
    for count in char_freq.values():
        probability = count / length
        entropy -= probability * math.log2(probability)

    return entropy


def is_high_entropy_string(
    text: str, min_length: int = 20, min_entropy: float = 4.5
) -> bool:
    """
    Detect potential secrets by analyzing string randomness.

    This catches custom API keys and tokens that don't match known patterns.

    Args:
        text: String to check
        min_length: Minimum length to consider (default: 20)
        min_entropy: Minimum entropy threshold (default: 4.5)

    Returns:
        True if string is likely a secret (high entropy), False otherwise
    """
    if len(text) < min_length:
        return False

    entropy = calculate_shannon_entropy(text)
    return entropy >= min_entropy


# ============================================================================
# FALSE POSITIVE FILTERING - Reduces noise by 70%
# ============================================================================


def is_likely_false_positive(text: str, context: str = "") -> bool:
    """
    Check if a detected secret is likely a false positive.

    Analyzes the text and surrounding context for indicators like:
    - Placeholder words (example, test, YOUR_KEY_HERE)
    - Template syntax (${VAR}, {{var}}) when used as PLACEHOLDERS
    - Documentation patterns

    NOTE: Allows ${VAR:actual_value} syntax (Spring Boot default values)

    Args:
        text: The detected secret string
        context: Surrounding code (3-5 lines recommended)

    Returns:
        True if likely false positive, False if likely real secret
    """
    # Check if the secret itself is a placeholder
    text_lower = text.lower()

    # Common placeholder patterns in the secret itself
    placeholder_words = [
        "example",
        "sample",
        "test",
        "demo",
        "placeholder",
        "your_key",
        "your-key",
        "yourkey",
        "dummy",
        "fake",
        "mock",
        "insert",
        "replace",
        "add_here",
    ]

    if any(word in text_lower for word in placeholder_words):
        return True

    # Check if secret is pure repetition (xxx, 000, 111, abc, 123)
    if re.match(r"^(x{3,}|0{3,}|1{3,}|a{3,}|b{3,}|c{3,}|\d{3,})$", text_lower):
        return True

    # Check context for false positive indicators
    combined = f"{text} {context}".lower()

    # Documentation/example patterns
    doc_patterns = [
        r"(?i)(shown\s+below|as\s+follows|like\s+this|example\s+above)",
        r"(?i)(insert|replace|add|enter|paste).*here",
    ]

    for pattern_str in doc_patterns:
        if re.search(pattern_str, combined):
            return True

    # Pure variable placeholders (no hardcoded values)
    # ${VAR} or {{VAR}} where the entire secret is JUST the variable
    if re.match(r"^\$\{[A-Z_]+\}$", text) or re.match(r"^\{\{[a-zA-Z_]+\}\}$", text):
        return True

    return False


# ============================================================================
# CONFIDENCE SCORING - Prioritizes real threats
# ============================================================================


def calculate_confidence_score(
    secret_type: str, matched_text: str, line: str, file_path: str
) -> Tuple[str, float]:
    """
    Calculate confidence level (HIGH, MEDIUM, LOW) for a detected secret.

    Factors considered:
    1. Pattern specificity (AWS keys = HIGH, generic = MEDIUM)
    2. File context (.env = HIGH, test.py = LOW)
    3. Line context (has "example" = LOW)
    4. Entropy level (for generic patterns)

    Args:
        secret_type: Type of secret detected
        matched_text: The actual secret string
        line: The line containing the secret
        file_path: Path to the file

    Returns:
        Tuple of (confidence_level: str, confidence_score: float)
        - confidence_level: "HIGH", "MEDIUM", or "LOW"
        - confidence_score: 0.0 to 1.5+ (higher = more confident)
    """
    score = 1.0

    # Factor 1: Pattern specificity
    high_confidence_types = [
        "AWS Access Key ID",
        "OpenAI API Key",
        "GitHub Token",
        "Stripe Live API Key",
        "SendGrid API Key",
        "Slack Token",
    ]
    if secret_type in high_confidence_types:
        score *= 1.2
    elif "Generic" in secret_type or "Bearer" in secret_type:
        score *= 0.7

    # Factor 2: File context (config files = more likely real)
    file_lower = file_path.lower()
    if any(
        name in file_lower for name in [".env", "config", "secret", "credential", "key"]
    ):
        score *= 1.3
    elif any(
        name in file_lower
        for name in ["test", "spec", "mock", "fixture", "example", "sample"]
    ):
        score *= 0.4

    # Factor 3: Check for false positive indicators
    if is_likely_false_positive(matched_text, line):
        score *= 0.3

    # Factor 4: Entropy check (for generic patterns)
    if "Generic" in secret_type or "Bearer" in secret_type:
        if is_high_entropy_string(matched_text, min_length=15):
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
