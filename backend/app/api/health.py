from fastapi import APIRouter
from sqlalchemy import text
from app.core.database import async_session_maker
from app.core.redis import get_redis
from app.core.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health")
@router.get("/api/health")
async def health_check():
    # 1. DB ping
    db_ok = False
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False

    # 2. Redis ping
    redis_ok = False
    try:
        r = await get_redis()
        if r:
            await r.ping()
            redis_ok = True
    except Exception:
        redis_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if db_ok else "initializing",
        "redis": "connected" if redis_ok else "offline",
        "integrations": {
            "sso": settings.SSO_BASE_URL,
            "litellm": settings.LITELLM_BASE_URL,
            "drive": settings.DRIVE_BASE_URL,
            "supervisor": settings.SUPERVISOR_BASE_URL
        }
    }
