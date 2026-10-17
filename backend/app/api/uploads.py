import os
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import FileResponse
from app.core.security import get_current_actor
from app.core.config import settings
from app.services.drive_service import DriveService

router = APIRouter(prefix="/api/uploads", tags=["Fichiers & Justificatifs"])

@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    actor: dict = Depends(get_current_actor)
):
    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:  # 15 MB limit
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Fichier trop volumineux (max 15 Mo).")

    res = await DriveService.upload_receipt(
        file_bytes=contents,
        filename=file.filename,
        content_type=file.content_type or "image/jpeg"
    )
    return res

@router.get("/{filename}")
async def get_uploaded_file(filename: str):
    safe_path = os.path.join(settings.STORAGE_DIR, os.path.basename(filename))
    if not os.path.isfile(safe_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier introuvable.")
    return FileResponse(safe_path)
