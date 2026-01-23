"""
Secret Guardian - Core Scanning Engine

This module provides the main scanning functionality:
- Clones repositories to temporary directories
- Runs multiple scanners (regex, Gitleaks, TruffleHog)
- Normalizes and deduplicates findings
- Enforces timeouts and cleanup

All repository content is temporary and deleted after scanning.
NO DATA IS STORED.
"""

import os
import shutil
import tempfile
import time
from typing import Dict, List, Any
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from git import Repo

try:
    from .patterns import (
        SECRET_PATTERNS,
        calculate_confidence_score,
        calculate_shannon_entropy,
    )
    from .external_scanners import (
        Finding,
        Severity,
        determine_severity,
        mask_secret,
        run_gitleaks,
        run_trufflehog,
        deduplicate_findings,
        get_scanner_status,
    )
except Exception:
    from patterns import (
        SECRET_PATTERNS,
        calculate_confidence_score,
        calculate_shannon_entropy,
    )
    from external_scanners import (
        Finding,
        Severity,
        determine_severity,
        mask_secret,
        run_gitleaks,
        run_trufflehog,
        deduplicate_findings,
        get_scanner_status,
    )


# Configuration
DEFAULT_SCAN_TIMEOUT = 300  # 5 minutes
MAX_FILE_SIZE = 1024 * 1024  # 1MB max file size to scan
MAX_FILES_TO_SCAN = 5000  # Maximum files to scan

# Simple mapping of file extensions to languages
LANGUAGE_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".jsx": "JavaScript",
    ".java": "Java",
    ".go": "Go",
    ".rb": "Ruby",
    ".php": "PHP",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".json": "JSON",
    ".sh": "Shell Script",
    ".bash": "Shell Script",
    ".zsh": "Shell Script",
    ".env": "Environment",
    ".cfg": "Config",
    ".ini": "Config",
    ".conf": "Config",
    ".toml": "TOML",
    ".xml": "XML",
    ".properties": "Properties",
    ".gradle": "Gradle",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".rs": "Rust",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".h": "C Header",
}

# Binary file extensions to skip
BINARY_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".ico",
    ".pdf",
    ".zip",
    ".gz",
    ".tar",
    ".7z",
    ".rar",
    ".bz2",
    ".mp3",
    ".mp4",
    ".mov",
    ".webm",
    ".avi",
    ".mkv",
    ".wasm",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
    ".svg",
    ".class",
    ".jar",
    ".bin",
    ".exe",
    ".dll",
    ".so",
    ".pyc",
    ".pyo",
    ".o",
    ".a",
    ".lib",
    ".dylib",
    ".lock",
    ".min.js",
    ".min.css",
}

# Directories to skip
SKIP_DIRS = {
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "vendor",
    "bower_components",
    "venv",
    ".venv",
    "env",
    ".env",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    "dist",
    "build",
    "target",
    "out",
    ".idea",
    ".vscode",
    ".vs",
    "coverage",
    ".nyc_output",
}


def get_language(file_path: str) -> str:
    """Detect programming language from file extension."""
    _, ext = os.path.splitext(file_path)
    return LANGUAGE_MAP.get(ext.lower(), "Text")


def should_skip_file(file_path: str, filename: str) -> bool:
    """Determine if a file should be skipped during scanning."""
    _, ext = os.path.splitext(filename)
    if ext.lower() in BINARY_EXTENSIONS:
        return True

    skip_patterns = [
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "composer.lock",
        "Gemfile.lock",
        "Cargo.lock",
        "poetry.lock",
    ]
    if filename.lower() in skip_patterns:
        return True

    try:
        if os.path.getsize(file_path) > MAX_FILE_SIZE:
            return True
    except OSError:
        return True

    return False


def run_regex_scanner(repo_path: str) -> List[Finding]:
    """
    Run the built-in regex-based scanner.

    Args:
        repo_path: Path to the cloned repository

    Returns:
        List of Finding objects
    """
    findings: List[Finding] = []
    files_scanned = 0

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for filename in files:
            if files_scanned >= MAX_FILES_TO_SCAN:
                print(f"⚠️ Reached maximum file limit ({MAX_FILES_TO_SCAN})")
                break

            file_path = os.path.join(root, filename)

            if should_skip_file(file_path, filename):
                continue

            files_scanned += 1

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()

                language = get_language(filename)
                rel_path = os.path.relpath(file_path, repo_path)

                for i, line in enumerate(lines):
                    for secret_type, pattern in SECRET_PATTERNS.items():
                        if match := pattern.search(line):
                            matched_text = (
                                match.group(1) if match.groups() else match.group(0)
                            )

                            confidence_level, confidence_score = (
                                calculate_confidence_score(
                                    secret_type, matched_text, line, file_path
                                )
                            )

                            if confidence_level == "LOW":
                                continue

                            start = max(0, i - 2)
                            end = min(len(lines), i + 3)
                            code_snippet = "".join(lines[start:end])

                            entropy = calculate_shannon_entropy(matched_text)
                            severity = determine_severity(
                                secret_type, confidence_level, entropy
                            )

                            finding = Finding(
                                secret_type=secret_type,
                                file_path=rel_path,
                                line_number=i + 1,
                                confidence=confidence_level,
                                entropy=round(entropy, 2),
                                raw_value=mask_secret(matched_text),
                                severity=severity,
                                scanner_source="regex",
                                language=language,
                                code_snippet=code_snippet,
                                leaked_line=line.strip(),
                            )
                            findings.append(finding)
                            print(
                                f"✅ [Regex] Found {secret_type} in {rel_path}:{i + 1} "
                                f"[{confidence_level}, entropy: {entropy:.2f}]"
                            )
                            break

            except Exception as e:
                print(f"⚠️ Could not read file {file_path}: {e}")

    return findings


def clone_repository(repo_url: str, target_dir: str, timeout: int = 120) -> bool:
    """
    Clone a repository with timeout.
    """
    try:
        print(f"📥 Cloning {repo_url}...")

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(
                Repo.clone_from,
                repo_url,
                target_dir,
                depth=1,
                single_branch=True,
            )
            future.result(timeout=timeout)

        print("✅ Clone successful")
        return True

    except FuturesTimeoutError:
        print(f"❌ Clone timeout after {timeout}s")
        return False
    except Exception as e:
        print(f"❌ Clone failed: {e}")
        return False


def scan_repo(
    repo_url: str,
    timeout: int = DEFAULT_SCAN_TIMEOUT,
    use_external_scanners: bool = True,
) -> Dict[str, Any]:
    """
    Clone a repository and scan for secrets.

    This is the main entry point for scanning. It:
    1. Creates a temporary directory
    2. Clones the repository (with timeout)
    3. Runs all available scanners
    4. Deduplicates findings
    5. Cleans up temporary files

    Args:
        repo_url: GitHub repository URL to scan
        timeout: Maximum total scan time in seconds
        use_external_scanners: Whether to use Gitleaks/TruffleHog if available

    Returns:
        Dict with scan results
    """
    start_time = time.time()
    temp_dir = tempfile.mkdtemp(prefix="secret-guardian-")

    try:
        clone_timeout = min(120, timeout // 3)
        if not clone_repository(repo_url, temp_dir, clone_timeout):
            return {
                "error": "Failed to clone repository. Please check the URL and ensure it's a public repository.",
                "scan_duration": round(time.time() - start_time, 2),
            }

        elapsed = time.time() - start_time
        remaining_timeout = max(30, timeout - elapsed)

        return scan_directory(
            temp_dir,
            timeout=int(remaining_timeout),
            use_external_scanners=use_external_scanners,
            start_time=start_time,
        )

    except Exception as e:
        print(f"❌ Scan error: {e}")
        import traceback

        traceback.print_exc()
        return {
            "error": f"Scan failed: {str(e)}",
            "scan_duration": round(time.time() - start_time, 2),
        }

    finally:
        print(f"🧹 Cleaning up temporary directory: {temp_dir}")
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
            print("✅ Cleanup complete")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")


def scan_directory(
    directory_path: str,
    timeout: int = DEFAULT_SCAN_TIMEOUT,
    use_external_scanners: bool = True,
    start_time: float = None,
    cleanup: bool = False,
) -> Dict[str, Any]:
    """
    Scan an existing directory for secrets.

    This is used for scanning uploaded ZIP files or local directories.

    Args:
        directory_path: Path to the directory to scan
        timeout: Maximum scan time in seconds
        use_external_scanners: Whether to use Gitleaks/TruffleHog if available
        start_time: Optional start time for duration calculation
        cleanup: Whether to delete the directory after scanning

    Returns:
        Dict with scan results
    """
    if start_time is None:
        start_time = time.time()

    all_findings: List[Finding] = []
    scanners_used = []

    try:
        scanner_timeout = timeout // 3

        print("🔍 Running regex scanner...")
        scanners_used.append("regex")
        regex_findings = run_regex_scanner(directory_path)
        all_findings.extend(regex_findings)

        if use_external_scanners:
            scanner_status = get_scanner_status()

            if scanner_status.get("gitleaks"):
                print("🔍 Running Gitleaks scanner...")
                scanners_used.append("gitleaks")
                gitleaks_findings = run_gitleaks(
                    directory_path, timeout=int(scanner_timeout)
                )
                all_findings.extend(gitleaks_findings)

            if scanner_status.get("trufflehog"):
                print("🔍 Running TruffleHog scanner...")
                scanners_used.append("trufflehog")
                trufflehog_findings = run_trufflehog(
                    directory_path, timeout=int(scanner_timeout)
                )
                all_findings.extend(trufflehog_findings)

        print(f"🔄 Deduplicating {len(all_findings)} findings...")
        deduplicated = deduplicate_findings(all_findings)
        print(f"✅ {len(deduplicated)} unique findings after deduplication")

        findings_list = [f.to_dict() for f in deduplicated]

        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        findings_list.sort(
            key=lambda x: (
                severity_order.get(x.get("severity", "LOW"), 4),
                x.get("file_path", ""),
                x.get("line_number", 0),
            )
        )

        scan_duration = round(time.time() - start_time, 2)
        files_affected = len(set(f.get("file_path") for f in findings_list))

        severity_breakdown = {
            "CRITICAL": sum(
                1 for f in findings_list if f.get("severity") == "CRITICAL"
            ),
            "HIGH": sum(1 for f in findings_list if f.get("severity") == "HIGH"),
            "MEDIUM": sum(1 for f in findings_list if f.get("severity") == "MEDIUM"),
            "LOW": sum(1 for f in findings_list if f.get("severity") == "LOW"),
        }

        return {
            "findings": findings_list,
            "total_findings": len(findings_list),
            "files_affected": files_affected,
            "severity_breakdown": severity_breakdown,
            "scan_duration": scan_duration,
            "scanners_used": scanners_used,
            "scanner_status": (
                get_scanner_status() if use_external_scanners else {"regex": True}
            ),
            "has_critical": severity_breakdown["CRITICAL"] > 0,
            "has_high": severity_breakdown["HIGH"] > 0,
        }

    except Exception as e:
        print(f"❌ Scan error: {e}")
        import traceback

        traceback.print_exc()
        return {
            "error": f"Scan failed: {str(e)}",
            "scan_duration": round(time.time() - start_time, 2),
        }

    finally:
        if cleanup:
            print(f"🧹 Cleaning up directory: {directory_path}")
            try:
                shutil.rmtree(directory_path, ignore_errors=True)
                print("✅ Cleanup complete")
            except Exception as e:
                print(f"⚠️ Cleanup warning: {e}")


__all__ = [
    "scan_repo",
    "scan_directory",
    "get_scanner_status",
    "mask_secret",
    "Severity",
    "Finding",
]
