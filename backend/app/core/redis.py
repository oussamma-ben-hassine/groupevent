import redis.asyncio as aioredis
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

redis_client: Optional[aioredis.Redis] = None

async def init_redis() -> Optional[aioredis.Redis]:
    global redis_client
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
        await redis_client.ping()
        logger.info("[REDIS] Connected to Redis successfully.")
        return redis_client
    except Exception as e:
        logger.warning(f"[REDIS] Redis connection failed, fallback memory mode: {e}")
        redis_client = None
        return None

async def get_redis() -> Optional[aioredis.Redis]:
    global redis_client
    if redis_client is None:
        await init_redis()
    return redis_client

async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.close()
