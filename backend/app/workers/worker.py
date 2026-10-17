import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select, update
from app.core.database import async_session_maker
from app.core.redis import init_redis, close_redis
from app.models.models import InviteToken

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("worker")

async def cleanup_expired_invites():
    now = datetime.now(timezone.utc)
    async with async_session_maker() as session:
        stmt = (
            update(InviteToken)
            .where(InviteToken.expires_at < now, InviteToken.is_revoked == False)
            .values(is_revoked=True)
        )
        res = await session.execute(stmt)
        if res.rowcount > 0:
            await session.commit()
            logger.info(f"[WORKER] Revoked {res.rowcount} expired invite tokens.")

async def worker_loop():
    logger.info("[WORKER] GroupEvent Background Worker starting...")
    await init_redis()
    while True:
        try:
            await cleanup_expired_invites()
        except Exception as e:
            logger.error(f"[WORKER] Error in cleanup loop: {e}")
        await asyncio.sleep(60)

if __name__ == "__main__":
    try:
        asyncio.run(worker_loop())
    except KeyboardInterrupt:
        logger.info("[WORKER] Worker stopped.")
