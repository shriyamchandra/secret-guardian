"""
Input validation and security utilities.
Prevents malicious inputs and ensures data integrity.
"""

import os
import re
from typing import Iterable, Tuple
from urllib.parse import urlparse


class ValidationError(Exception):
    """Custom exception for validation errors."""

    pass


class RepoValidator:
    """Validator for supported Git hosting repository URLs and inputs."""

    DEFAULT_ALLOWED_HOSTS = ("github.com", "gitlab.com", "bitbucket.org")
    SEGMENT_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\-]{0,99}$")
    SSH_PATTERN = re.compile(
        r"^git@(?P<host>[A-Za-z0-9\-.]+):(?P<path>[A-Za-z0-9._\-/]+?)(?:\.git)?/?$"
    )

    # Blocked/dangerous patterns
    DANGEROUS_PATTERNS = [
        r"\.\.\/",  # Directory traversal
        r";\s*rm\s+-rf",  # Command injection
        r"\$\(",  # Command substitution
        r"`.*`",  # Backtick execution
        r"&&",  # Command chaining
        r"\|",  # Pipe commands
        r"<script",  # XSS attempts
    ]

    MAX_URL_LENGTH = 500
    MAX_PATH_SEGMENTS = 8

    @classmethod
    def _configured_allowed_hosts(cls) -> set[str]:
        raw = os.getenv("ALLOWED_REPO_HOSTS", "")
        if not raw.strip():
            return set(cls.DEFAULT_ALLOWED_HOSTS)

        hosts = {
            cls._normalize_host(entry)
            for entry in raw.split(",")
            if cls._normalize_host(entry)
        }
        return hosts or set(cls.DEFAULT_ALLOWED_HOSTS)

    @staticmethod
    def _normalize_host(host: str) -> str:
        host = (host or "").strip().lower().rstrip(".")
        if host.startswith("www."):
            host = host[4:]
        return host

    @classmethod
    def _valid_segments(cls, segments: Iterable[str]) -> bool:
        for segment in segments:
            if segment in {".", ".."}:
                return False
            if not cls.SEGMENT_PATTERN.fullmatch(segment):
                return False
        return True

    @classmethod
    def validate_repository_url(cls, url: str) -> Tuple[bool, str]:
        """
        Validate repository URL for supported Git hosting providers.

        Args:
            url: Repository URL to validate

        Returns:
            Tuple of (is_valid: bool, error_message: str)
        """
        # Check if empty
        if not url or not url.strip():
            return False, "Repository URL cannot be empty"

        url = url.strip()
        allowed_hosts = cls._configured_allowed_hosts()

        # Check length
        if len(url) > cls.MAX_URL_LENGTH:
            return False, f"URL too long (max {cls.MAX_URL_LENGTH} characters)"

        # Check for dangerous patterns
        for pattern in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, url, re.IGNORECASE):
                return False, "Invalid URL: contains potentially dangerous characters"

        # Validate SSH-style URLs: git@host:owner/repo(.git)
        ssh_match = cls.SSH_PATTERN.fullmatch(url)
        if ssh_match:
            host = cls._normalize_host(ssh_match.group("host"))
            if host not in allowed_hosts:
                hosts = ", ".join(sorted(allowed_hosts))
                return False, f"Unsupported repository host. Allowed hosts: {hosts}"

            raw_path = ssh_match.group("path").strip("/")
            path_segments = [segment for segment in raw_path.split("/") if segment]
            if len(path_segments) < 2:
                return False, "Invalid repository path: expected owner/repository"
            if len(path_segments) > cls.MAX_PATH_SEGMENTS:
                return False, "Invalid repository path: too many path segments"
            if not cls._valid_segments(path_segments):
                return False, "Invalid repository path: malformed owner or repository"

            return True, "Valid repository URL"

        # Validate HTTPS/HTTP URLs via URL parsing
        try:
            parsed = urlparse(url)
        except Exception:
            return False, "Malformed URL"

        if parsed.scheme != "https":
            return False, "Invalid URL scheme (use https)"

        if parsed.username or parsed.password:
            return False, "Credentials in repository URL are not allowed"

        if parsed.query or parsed.fragment:
            return (
                False,
                "Repository URL must not include query parameters or fragments",
            )

        if parsed.port is not None:
            return False, "Custom ports are not allowed in repository URLs"

        host = cls._normalize_host(parsed.hostname or "")
        if host not in allowed_hosts:
            hosts = ", ".join(sorted(allowed_hosts))
            return False, f"Unsupported repository host. Allowed hosts: {hosts}"

        path = parsed.path.strip("/")
        if not path:
            return False, "Invalid repository path: expected owner/repository"

        path_segments = [segment for segment in path.split("/") if segment]
        if path_segments and path_segments[-1].endswith(".git"):
            path_segments[-1] = path_segments[-1][:-4]

        if len(path_segments) < 2:
            return False, "Invalid repository path: expected owner/repository"
        if len(path_segments) > cls.MAX_PATH_SEGMENTS:
            return False, "Invalid repository path: too many path segments"
        if not cls._valid_segments(path_segments):
            return False, "Invalid repository path: malformed owner or repository"

        return True, "Valid repository URL"

    @classmethod
    def validate_github_url(cls, url: str) -> Tuple[bool, str]:
        """
        Backward-compatible wrapper.

        Historically this validator method was GitHub-only; it now validates
        all configured repository hosts.
        """
        return cls.validate_repository_url(url)

    @classmethod
    def sanitize_url(cls, url: str) -> str:
        """
        Sanitize supported repository URL to standard HTTPS format.

        Args:
            url: Raw repository URL

        Returns:
            Standardized HTTPS URL
        """
        url = url.strip()

        # Convert git@host:path to https://host/path
        ssh_match = cls.SSH_PATTERN.fullmatch(url)
        if ssh_match:
            host = cls._normalize_host(ssh_match.group("host"))
            path = ssh_match.group("path").strip("/")
            url = f"https://{host}/{path}"

        # Remove .git suffix if present
        if url.endswith(".git"):
            url = url[:-4]

        # Ensure https://
        if url.startswith("http://"):
            url = url.replace("http://", "https://", 1)

        # Drop trailing slash for stable cache keys
        url = url.rstrip("/")

        return url


def validate_scan_request(repo_url: str) -> str:
    """
    Validate and sanitize scan request.

    Args:
        repo_url: Repository URL to scan

    Returns:
        Sanitized repository URL

    Raises:
        ValidationError: If validation fails
    """
    # Validate
    is_valid, error_message = RepoValidator.validate_repository_url(repo_url)

    if not is_valid:
        raise ValidationError(error_message)

    # Sanitize and return
    return RepoValidator.sanitize_url(repo_url)
