import asyncio
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.core.redis import init_redis, close_redis
import app.models.models

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.events import router as events_router
from app.api.invites import router as invites_router
from app.api.groceries import router as groceries_router
from app.api.expenses import router as expenses_router
from app.api.ai import router as ai_router
from app.api.uploads import router as uploads_router

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("groupevent")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} ({settings.ENVIRONMENT})...")
    # 1. Initialize schema in PostgreSQL with retries
    retries = 10
    while retries > 0:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database schema verified (Zero demo data initialized).")
            break
        except Exception as e:
            retries -= 1
            logger.warning(f"Database connection waiting... ({e}), {retries} retries left")
            if retries == 0:
                raise
            await asyncio.sleep(2)

    # 2. Initialize Redis
    try:
        await init_redis()
    except Exception as e:
        logger.warning(f"Redis initialization warning: {e}")

    yield

    await close_redis()
    await engine.dispose()
    logger.info(f"{settings.APP_NAME} shut down gracefully.")

app = FastAPI(
    title=f"{settings.APP_NAME} API",
    description="API REST de GroupEvent — Organisation d'événements, listes de courses partagées et gestion équitable des dépenses pour l'écosystème oussamma.tn",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*(oussamma\.tn|localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(events_router)
app.include_router(invites_router)
app.include_router(groceries_router)
app.include_router(expenses_router)
app.include_router(ai_router)
app.include_router(uploads_router)
