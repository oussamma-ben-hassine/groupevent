import uuid
import logging
import asyncio
from datetime import datetime, timezone
import httpx
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class SupervisorService:
    @staticmethod
    async def record_event(
        event_type: str,
        actor_sub: Optional[str] = None,
        actor_email: Optional[str] = None,
        actor_name: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        resource_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Send telemetry events asynchronously to Ecosystem Supervisor.
        Errors are safely logged and will never fail user requests.
        """
        asyncio.create_task(
            SupervisorService._send_event_async(
                event_type=event_type,
                actor_sub=actor_sub,
                actor_email=actor_email,
                actor_name=actor_name,
                resource_type=resource_type,
                resource_id=resource_id,
                resource_name=resource_name,
                metadata=metadata or {}
            )
        )

    @staticmethod
    async def _send_event_async(
        event_type: str,
        actor_sub: Optional[str],
        actor_email: Optional[str],
        actor_name: Optional[str],
        resource_type: Optional[str],
        resource_id: Optional[str],
        resource_name: Optional[str],
        metadata: Dict[str, Any]
    ) -> None:
        if not settings.SUPERVISOR_BASE_URL:
            return

        endpoint = f"{settings.SUPERVISOR_BASE_URL.rstrip('/')}/api/v1/events"
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": settings.SUPERVISOR_API_KEY
        }

        actor = None
        if actor_sub:
            actor = {
                "issuer": settings.SSO_BASE_URL,
                "sub": actor_sub,
                "email": actor_email,
                "name": actor_name
            }

        resource = None
        if resource_type and resource_id:
            resource = {
                "type": resource_type,
                "id": resource_id,
                "name": resource_name
            }

        payload = {
            "event_id": str(uuid.uuid4()),
            "event_type": f"groupevent.{event_type}",
            "event_version": 1,
            "application": "groupevent",
            "actor": actor,
            "resource": resource,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "outcome": "success",
            "metadata": metadata
        }

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.post(endpoint, headers=headers, json=payload)
                if res.status_code not in (200, 201, 202):
                    logger.debug(f"[SUPERVISOR] Event dispatch status: {res.status_code}")
        except Exception as e:
            logger.debug(f"[SUPERVISOR] Ingestion skipped: {e}")
