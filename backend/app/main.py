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

from sqlalchemy import text

async def init_db_schema():
    retries = 20
    while retries > 0:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                # Ensure new columns exist on existing database instances
                await conn.execute(text("""
                    ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS actual_price FLOAT DEFAULT NULL;
                    ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'grocery';
                    ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS scope VARCHAR(50) DEFAULT 'group';
                    ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS beneficiary_id VARCHAR(36) REFERENCES event_members(id) ON DELETE SET NULL;
                """))
            logger.info("Database schema verified (Zero demo data initialized).")
            break
        except Exception as e:
            retries -= 1
            logger.warning(f"Database schema init waiting for PostgreSQL... ({e}), {retries} retries left")
            await asyncio.sleep(2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} ({settings.ENVIRONMENT})...")
    # Non-blocking schema initialization in background so Uvicorn binds immediately
    asyncio.create_task(init_db_schema())

    # Redis initialization
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

@app.get("/")
@app.get("/health")
def ping():
    return {"status": "ok", "app": settings.APP_NAME}

# Include Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(events_router)
app.include_router(invites_router)
app.include_router(groceries_router)
app.include_router(expenses_router)
app.include_router(ai_router)
app.include_router(uploads_router)
