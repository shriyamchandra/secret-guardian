import os
import stat
import zipfile
from fastapi import HTTPException


# Maximum upload size: 50MB
MAX_UPLOAD_SIZE = 50 * 1024 * 1024


def copy_limited(
    source,
    target,
    max_file_bytes: int,
    remaining_total_budget: int,
) -> int:
    """Copy streamed bytes with strict accounting to prevent zip bombs."""
    bytes_written = 0
    chunk_size = 64 * 1024

    while True:
        chunk = source.read(chunk_size)
        if not chunk:
            break

        chunk_len = len(chunk)
        bytes_written += chunk_len

        if bytes_written > max_file_bytes:
            raise HTTPException(
                status_code=413,
                detail={
                    "error": "File Too Large",
                    "message": "Streamed file exceeds maximum allowed uncompressed size.",
                },
            )

        if bytes_written > remaining_total_budget:
            raise HTTPException(
                status_code=413,
                detail={
                    "error": "ZIP Too Large",
                    "message": "Streamed total uncompressed size exceeds limit.",
                },
            )

        target.write(chunk)

    return bytes_written


def safe_extract_zip(zip_ref: zipfile.ZipFile, temp_dir: str) -> int:
    """Securely extract zip with anti-traversal and anti-zip-bomb safeguards."""
    max_zip_entries = 10000
    max_uncompressed_total_size = 200 * 1024 * 1024  # 200MB
    max_uncompressed_file_size = 10 * 1024 * 1024  # 10MB
    max_ratio = 100

    total_uncompressed_size = 0
    extracted_count = 0
    temp_dir_abs = os.path.abspath(temp_dir)

    for zinfo in zip_ref.infolist():
        extracted_count += 1
        if extracted_count > max_zip_entries:
            raise HTTPException(
                status_code=413,
                detail={
                    "error": "ZIP Too Large",
                    "message": "Too many entries in ZIP archive.",
                },
            )

        filename = zinfo.filename.replace("\\", "/")
        parts = filename.split("/")
        if filename.startswith("/") or ".." in parts or (
            len(filename) > 1 and filename[1] == ":"
        ):
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Invalid ZIP File",
                    "message": "Malicious path structure detected.",
                },
            )

        target_path = os.path.abspath(os.path.join(temp_dir_abs, filename))
        if not target_path.startswith(temp_dir_abs):
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Invalid ZIP File",
                    "message": "Malicious path traversal escaped bounding directory.",
                },
            )

        mode = zinfo.external_attr >> 16
        file_type = mode & 0o170000
        if file_type != 0 and not stat.S_ISDIR(mode) and not stat.S_ISREG(mode):
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Invalid ZIP File",
                    "message": "Only regular files and directories are allowed.",
                },
            )

        if zinfo.is_dir():
            os.makedirs(target_path, exist_ok=True)
            continue

        if zinfo.compress_size > 0:
            ratio = zinfo.file_size / zinfo.compress_size
            if ratio > max_ratio and zinfo.file_size > 1024 * 1024:
                raise HTTPException(
                    status_code=413,
                    detail={
                        "error": "ZIP Bomb Detected",
                        "message": "Suspicious compression ratio detected.",
                    },
                )

        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        remaining_budget = max_uncompressed_total_size - total_uncompressed_size

        with zip_ref.open(zinfo) as source, open(target_path, "wb") as target:
            written = copy_limited(
                source,
                target,
                max_uncompressed_file_size,
                remaining_budget,
            )
            total_uncompressed_size += written

    return extracted_count
