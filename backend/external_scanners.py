"""
External Scanner Integration - Gitleaks and TruffleHog

This module integrates industry-standard secret scanning tools:
- Gitleaks: Fast scanner with 100+ rules for secrets detection
- TruffleHog: Deep git history scanner with entropy analysis

The results are normalized into a common schema for unified reporting.
"""

import os
import json
import subprocess
import tempfile
import shutil
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class Severity(str, Enum):
    """Severity levels for detected secrets."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class Finding:
    """Normalized finding schema across all scanners."""

    secret_type: str
    file_path: str
    line_number: int
    confidence: str
    entropy: float
    raw_value: str  # Masked by default
    severity: Severity
    scanner_source: str
    description: Optional[str] = None
    commit_hash: Optional[str] = None
    author: Optional[str] = None
    code_snippet: Optional[str] = None
    language: Optional[str] = None
    leaked_line: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with proper enum serialization."""
        d = asdict(self)
        d["severity"] = self.severity.value
        return d


def mask_secret(secret: str, reveal_chars: int = 4) -> str:
    """
    Mask a secret value, showing only first and last few characters.

    Args:
        secret: The secret to mask
        reveal_chars: Number of characters to reveal at start and end

    Returns:
        Masked secret string
    """
    if not secret or len(secret) <= reveal_chars * 2:
        return "*" * len(secret) if secret else ""

    return f"{secret[:reveal_chars]}{'*' * (len(secret) - reveal_chars * 2)}{secret[-reveal_chars:]}"


def determine_severity(secret_type: str, confidence: str, entropy: float) -> Severity:
    """
    Determine severity level based on secret type, confidence, and entropy.

    Args:
        secret_type: Type of secret detected
        confidence: Confidence level (HIGH/MEDIUM/LOW)
        entropy: Shannon entropy value

    Returns:
        Severity enum value
    """
    # Critical severity for highly sensitive secrets
    critical_types = [
        "AWS Secret Access Key",
        "AWS Access Key ID",
        "RSA Private Key",
        "SSH Private Key",
        "PGP Private Key",
        "Stripe Live API Key",
        "Stripe Webhook Secret",
        "Google Cloud Service Account",
    ]

    # High severity secrets
    high_types = [
        "OpenAI API Key",
        "GitHub Token",
        "GitHub Fine-Grained Token",
        "Slack Token",
        "SendGrid API Key",
        "Twilio API Key",
        "MongoDB Connection String",
        "PostgreSQL Connection",
        "MySQL Connection",
        "JWT Token",
        "Bearer Token",
    ]

    # Medium severity
    medium_types = [
        "Google API Key",
        "Stripe Test API Key",
        "Stripe Publishable Key",
        "Heroku API Key",
        "Mailgun API Key",
        "Square Access Token",
    ]

    secret_type_lower = secret_type.lower()

    # Check critical
    for crit_type in critical_types:
        if (
            crit_type.lower() in secret_type_lower
            or secret_type_lower in crit_type.lower()
        ):
            return Severity.CRITICAL

    # Check high
    for high_type in high_types:
        if (
            high_type.lower() in secret_type_lower
            or secret_type_lower in high_type.lower()
        ):
            return Severity.HIGH

    # Check medium
    for med_type in medium_types:
        if (
            med_type.lower() in secret_type_lower
            or secret_type_lower in med_type.lower()
        ):
            return Severity.MEDIUM

    # Use confidence and entropy as fallback
    if confidence == "HIGH" and entropy > 4.0:
        return Severity.HIGH
    elif confidence == "HIGH" or entropy > 3.5:
        return Severity.MEDIUM
    else:
        return Severity.LOW


def is_gitleaks_installed() -> bool:
    """Check if gitleaks is installed and available in PATH."""
    try:
        result = subprocess.run(
            ["gitleaks", "version"], capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        return False


def is_trufflehog_installed() -> bool:
    """Check if trufflehog is installed and available in PATH."""
    try:
        result = subprocess.run(
            ["trufflehog", "--version"], capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        return False


def run_gitleaks(repo_path: str, timeout: int = 120) -> List[Finding]:
    """
    Run Gitleaks scanner on a repository.

    Args:
        repo_path: Path to the cloned repository
        timeout: Maximum seconds to run

    Returns:
        List of normalized Finding objects
    """
    if not is_gitleaks_installed():
        print("⚠️ Gitleaks not installed, skipping...")
        return []

    findings: List[Finding] = []
    report_path = tempfile.mktemp(suffix=".json")

    try:
        cmd = [
            "gitleaks",
            "detect",
            "--source",
            repo_path,
            "--report-path",
            report_path,
            "--report-format",
            "json",
            "--no-git",  # Scan files, not git history
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)

        # Gitleaks returns exit code 1 when secrets are found
        if os.path.exists(report_path):
            with open(report_path, "r") as f:
                gitleaks_results = json.load(f)

            for item in gitleaks_results:
                # Calculate entropy for the secret
                from patterns import calculate_shannon_entropy

                secret = item.get("Secret", "")
                entropy = calculate_shannon_entropy(secret)

                # Determine severity
                secret_type = item.get("RuleID", "Unknown")
                severity = determine_severity(secret_type, "HIGH", entropy)

                finding = Finding(
                    secret_type=secret_type,
                    file_path=item.get("File", ""),
                    line_number=item.get("StartLine", 0),
                    confidence="HIGH",  # Gitleaks has strong patterns
                    entropy=round(entropy, 2),
                    raw_value=mask_secret(secret),
                    severity=severity,
                    scanner_source="gitleaks",
                    description=item.get("Description", ""),
                    commit_hash=item.get("Commit", None),
                    author=item.get("Author", None),
                    leaked_line=item.get("Match", ""),
                )
                findings.append(finding)
                print(
                    f"✅ [Gitleaks] Found {secret_type} in {finding.file_path}:{finding.line_number}"
                )

    except subprocess.TimeoutExpired:
        print(f"⚠️ Gitleaks timeout after {timeout}s")
    except Exception as e:
        print(f"⚠️ Gitleaks error: {e}")
    finally:
        if os.path.exists(report_path):
            os.remove(report_path)

    return findings


def run_trufflehog(repo_path: str, timeout: int = 120) -> List[Finding]:
    """
    Run TruffleHog scanner on a repository.

    Args:
        repo_path: Path to the cloned repository
        timeout: Maximum seconds to run

    Returns:
        List of normalized Finding objects
    """
    if not is_trufflehog_installed():
        print("⚠️ TruffleHog not installed, skipping...")
        return []

    findings: List[Finding] = []

    try:
        cmd = [
            "trufflehog",
            "filesystem",
            "--directory",
            repo_path,
            "--json",
            "--no-update",
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)

        # Parse JSON Lines output
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            try:
                item = json.loads(line)

                # Extract relevant fields
                source_metadata = (
                    item.get("SourceMetadata", {}).get("Data", {}).get("Filesystem", {})
                )
                extra_data = item.get("ExtraData", {})

                from patterns import calculate_shannon_entropy

                secret = item.get("Raw", "")
                entropy = calculate_shannon_entropy(secret)

                secret_type = item.get("DetectorName", "Unknown")
                severity = determine_severity(secret_type, "HIGH", entropy)

                finding = Finding(
                    secret_type=secret_type,
                    file_path=source_metadata.get("file", ""),
                    line_number=source_metadata.get("line", 0),
                    confidence="HIGH",
                    entropy=round(entropy, 2),
                    raw_value=mask_secret(secret),
                    severity=severity,
                    scanner_source="trufflehog",
                    description=item.get("DecoderName", ""),
                    leaked_line=secret[:100] + "..." if len(secret) > 100 else secret,
                )
                findings.append(finding)
                print(
                    f"✅ [TruffleHog] Found {secret_type} in {finding.file_path}:{finding.line_number}"
                )

            except json.JSONDecodeError:
                continue

    except subprocess.TimeoutExpired:
        print(f"⚠️ TruffleHog timeout after {timeout}s")
    except Exception as e:
        print(f"⚠️ TruffleHog error: {e}")

    return findings


def deduplicate_findings(findings: List[Finding]) -> List[Finding]:
    """
    Remove duplicate findings across scanners.

    Uses (file_path, line_number, secret_type) as the unique key.
    Prefers findings with higher severity and more context.

    Args:
        findings: List of findings from all scanners

    Returns:
        Deduplicated list of findings
    """
    seen: Dict[tuple, Finding] = {}

    for finding in findings:
        key = (
            finding.file_path.strip("/"),
            finding.line_number,
            finding.secret_type.lower().replace(" ", "_"),
        )

        if key not in seen:
            seen[key] = finding
        else:
            existing = seen[key]
            # Keep the finding with higher severity
            severity_order = [
                Severity.LOW,
                Severity.MEDIUM,
                Severity.HIGH,
                Severity.CRITICAL,
            ]
            if severity_order.index(finding.severity) > severity_order.index(
                existing.severity
            ):
                seen[key] = finding
            # Or if same severity, prefer the one with more context
            elif finding.code_snippet and not existing.code_snippet:
                seen[key] = finding

    return list(seen.values())


def get_scanner_status() -> Dict[str, bool]:
    """
    Check which external scanners are available.

    Returns:
        Dict with scanner availability status
    """
    return {
        "gitleaks": is_gitleaks_installed(),
        "trufflehog": is_trufflehog_installed(),
        "regex": True,  # Always available
    }
