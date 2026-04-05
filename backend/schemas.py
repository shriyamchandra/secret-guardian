from pydantic import BaseModel, Field, validator


class ScanRequest(BaseModel):
    """Request model for repository scanning."""

    repo_url: str = Field(
        ...,
        description="GitHub repository URL to scan",
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

    findings: list = Field(..., description="List of findings to export")
    repo_url: str = Field(..., description="Scanned repository URL")
    scan_duration: float = Field(0.0, description="Scan duration in seconds")
    severity_breakdown: dict = Field(
        default_factory=dict, description="Severity breakdown"
    )
