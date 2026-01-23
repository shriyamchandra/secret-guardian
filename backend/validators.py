"""
Input validation and security utilities.
Prevents malicious inputs and ensures data integrity.
"""

import re
from typing import Tuple
from urllib.parse import urlparse


class ValidationError(Exception):
    """Custom exception for validation errors."""

    pass


class RepoValidator:
    """Validator for GitHub repository URLs and inputs."""

    # Allowed GitHub URL patterns
    GITHUB_PATTERNS = [
        r"^https?://github\.com/[\w\-]+/[\w\-\.]+/?$",
        r"^https?://github\.com/[\w\-]+/[\w\-\.]+\.git$",
        r"^git@github\.com:[\w\-]+/[\w\-\.]+\.git$",
    ]

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
    MAX_REPO_NAME_LENGTH = 100

    @classmethod
    def validate_github_url(cls, url: str) -> Tuple[bool, str]:
        """
        Validate GitHub repository URL.

        Args:
            url: Repository URL to validate

        Returns:
            Tuple of (is_valid: bool, error_message: str)
        """
        # Check if empty
        if not url or not url.strip():
            return False, "Repository URL cannot be empty"

        url = url.strip()

        # Check length
        if len(url) > cls.MAX_URL_LENGTH:
            return False, f"URL too long (max {cls.MAX_URL_LENGTH} characters)"

        # Check for dangerous patterns
        for pattern in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, url, re.IGNORECASE):
                return False, "Invalid URL: contains potentially dangerous characters"

        # Validate URL structure
        try:
            parsed = urlparse(url)
            if parsed.scheme not in ["http", "https", "git"]:
                return False, "Invalid URL scheme (use http, https, or git)"
        except Exception:
            return False, "Malformed URL"

        # Check against GitHub patterns
        is_valid_github = any(re.match(pattern, url) for pattern in cls.GITHUB_PATTERNS)

        if not is_valid_github:
            return (
                False,
                "Invalid GitHub URL format. Expected: https://github.com/owner/repo",
            )

        # Extract owner/repo and validate
        try:
            if "github.com/" in url:
                path = url.split("github.com/")[1].rstrip("/").replace(".git", "")
                parts = path.split("/")

                if len(parts) < 2:
                    return False, "Invalid repository path"

                owner, repo = parts[0], parts[1]

                # Validate owner and repo names
                if not cls._is_valid_github_name(owner):
                    return False, f"Invalid owner name: {owner}"

                if not cls._is_valid_github_name(repo):
                    return False, f"Invalid repository name: {repo}"

        except Exception as e:
            return False, f"Error parsing repository URL: {str(e)}"

        return True, "Valid GitHub URL"

    @staticmethod
    def _is_valid_github_name(name: str) -> bool:
        """
        Check if name follows GitHub username/repo naming rules.

        Args:
            name: Username or repository name

        Returns:
            True if valid
        """
        if not name or len(name) > 100:
            return False

        # GitHub allows alphanumeric, hyphens, dots (but not starting/ending with them)
        return bool(re.match(r"^[a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9]$", name))

    @classmethod
    def sanitize_url(cls, url: str) -> str:
        """
        Sanitize GitHub URL to standard format.

        Args:
            url: Raw repository URL

        Returns:
            Standardized HTTPS URL
        """
        url = url.strip()

        # Convert git@ to https://
        if url.startswith("git@github.com:"):
            url = url.replace("git@github.com:", "https://github.com/")

        # Remove .git suffix if present
        if url.endswith(".git"):
            url = url[:-4]

        # Ensure https://
        if url.startswith("http://"):
            url = url.replace("http://", "https://", 1)

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
    is_valid, error_message = RepoValidator.validate_github_url(repo_url)

    if not is_valid:
        raise ValidationError(error_message)

    # Sanitize and return
    return RepoValidator.sanitize_url(repo_url)
