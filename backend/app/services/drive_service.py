import os
import uuid
import httpx
import logging
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class DriveService:
    @staticmethod
    async def upload_receipt(
        file_bytes: bytes,
        filename: str,
        content_type: str = "image/jpeg",
        access_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Attempts upload to ByteVault Drive (https://drive.oussamma.tn/api/files/upload).
        Falls back seamlessly to local persistent storage if Drive is unreachable.
        """
        # Ensure local fallback directory exists
        os.makedirs(settings.STORAGE_DIR, exist_ok=True)
        safe_filename = f"{uuid.uuid4()}_{os.path.basename(filename)}"
        local_path = os.path.join(settings.STORAGE_DIR, safe_filename)

        # Always save locally first for resilience
        try:
            with open(local_path, "wb") as f:
                f.write(file_bytes)
        except Exception as e:
            logger.error(f"Failed local file save: {e}")

        local_url = f"/api/uploads/{safe_filename}"

        # Attempt remote Drive upload
        if settings.DRIVE_BASE_URL:
            try:
                headers = {}
                if access_token:
                    headers["Authorization"] = f"Bearer {access_token}"

                files = {"file": (filename, file_bytes, content_type)}
                drive_url = f"{settings.DRIVE_BASE_URL.rstrip('/')}/api/files/upload"

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(drive_url, headers=headers, files=files)
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        return {
                            "url": data.get("download_url") or local_url,
                            "drive_id": data.get("id"),
                            "is_drive": True
                        }
            except Exception as e:
                logger.warning(f"[DRIVE] Remote upload failed, keeping local fallback: {e}")

        return {
            "url": local_url,
            "drive_id": None,
            "is_drive": False
        }
