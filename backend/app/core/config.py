import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "GroupEvent"
    APP_URL: str = "https://group.oussamma.tn"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    SECRET_KEY: str = "groupevent_secure_master_secret_jwt_key_2026"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days

    # PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://groupevent_user:groupevent_secure_pass_2026@postgres:5432/groupevent_db"
    POSTGRES_USER: str = "groupevent_user"
    POSTGRES_PASSWORD: str = "groupevent_secure_pass_2026"
    POSTGRES_DB: str = "groupevent_db"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # SSO OIDC (sso-a.oussamma.tn)
    SSO_BASE_URL: str = "https://sso-a.oussamma.tn"
    SSO_CLIENT_ID: str = "client_groupevent_app"
    SSO_CLIENT_SECRET: str = "sec_groupevent_platform_secret_2026"
    SSO_REDIRECT_URI: str = "https://group.oussamma.tn/auth/callback"
    SSO_SCOPES: str = "openid profile email"
    SUPER_ADMIN_EMAILS: str = "contact@oussamma.tn"

    # LiteLLM AI Gateway (ai.oussamma.tn)
    LITELLM_BASE_URL: str = "https://ai.oussamma.tn/v1"
    LITELLM_API_KEY: str = "sk-oussamma-master-gateway-2026"
    LITELLM_DEFAULT_MODEL: str = "gpt-4o-mini"

    # ByteVault Drive (drive.oussamma.tn)
    DRIVE_BASE_URL: str = "https://drive.oussamma.tn"

    # Ecosystem Supervisor (supervisor.oussamma.tn)
    SUPERVISOR_BASE_URL: str = "https://supervisor.oussamma.tn"
    SUPERVISOR_API_KEY: str = "sec_supervisor_key_2026"

    # Storage for receipts/justificatifs
    STORAGE_DIR: str = "/data/storage"

    # Session cookie name
    SESSION_COOKIE_NAME: str = "groupevent_session"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def super_admins(self) -> List[str]:
        return [e.strip().lower() for e in self.SUPER_ADMIN_EMAILS.split(",") if e.strip()]

settings = Settings()
