from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any


class ScanRequest(BaseModel):
    """Request model for repository scanning."""

    repo_url: str = Field(
        ...,
        description="Public repository URL to scan (GitHub, GitLab, or Bitbucket)",
        min_length=1,
        max_length=500,
        example="https://github.com/username/repository",
    )

    @validator("repo_url")
    def validate_url(cls, value: str) -> str:
        """Validate repository URL format."""
        if not value or not value.strip():
            raise ValueError("Repository URL cannot be empty")
        return value.strip()

    class Config:
        json_schema_extra = {
            "example": {"repo_url": "https://github.com/username/repository"}
        }


class ExportRequest(BaseModel):
    """Request model for exporting scan results."""

    findings: List[Dict[str, Any]] = Field(
        ..., description="List of findings to export"
    )
    repo_url: str = Field(default="", description="Scanned repository URL")
    scan_duration: float = Field(0.0, description="Scan duration in seconds")
    severity_breakdown: dict = Field(
        default_factory=dict, description="Severity breakdown"
    )
    scan_source: Optional[str] = Field(
        default=None,
        description="Source of scan (e.g. repository_url or upload)",
    )
    scan_target: Optional[str] = Field(
        default=None,
        description="Primary scan target shown to user (repository URL or uploaded file)",
    )
    scanned_filename: Optional[str] = Field(
        default=None,
        description="Uploaded ZIP filename when scan source is upload",
    )
    uploaded_file_size_mb: Optional[float] = Field(
        default=None,
        description="Uploaded ZIP size in MB when available",
    )
    scanners_used: List[str] = Field(default_factory=list, description="Scanners used")
    files_affected: int = Field(0, description="Number of files affected")
    total_findings: Optional[int] = Field(
        default=None,
        description="Total findings before pagination/truncation",
    )
    displayed_findings: Optional[int] = Field(
        default=None,
        description="Number of findings included in payload",
    )
    findings_truncated: bool = Field(
        default=False,
        description="Whether findings in payload were truncated for performance",
    )
