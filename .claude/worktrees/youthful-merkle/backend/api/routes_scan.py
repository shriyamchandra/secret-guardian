from fastapi import APIRouter

try:
    from .routes_scan_repo import router as repo_scan_router
    from .routes_scan_upload import router as upload_scan_router
except Exception:
    from api.routes_scan_repo import router as repo_scan_router  # type: ignore
    from api.routes_scan_upload import router as upload_scan_router  # type: ignore


router = APIRouter()
router.include_router(repo_scan_router)
router.include_router(upload_scan_router)
