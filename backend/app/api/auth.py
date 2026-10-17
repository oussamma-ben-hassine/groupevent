import urllib.parse
from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    get_current_actor,
    get_current_user_optional,
    create_access_token
)
from app.models.models import User
from app.services.auth_service import AuthService
from app.core.redis import get_redis

import logging
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentification"])

@router.get("/auth/login")
async def login_sso(return_to: str = "/"):
    auth_url, state, code_verifier = AuthService.generate_sso_auth_url(return_to)
    
    # Store PKCE verifier in Redis with state key (TTL 10 mins)
    r = await get_redis()
    if r:
        try:
            await r.setex(f"sso_verifier:{state}", 600, code_verifier)
        except Exception as e:
            logger.warning(f"[SSO] Redis setex failed: {e}")

    redirect = RedirectResponse(url=auth_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    # Also set as secure HTTP-only cookie for robust fallback
    redirect.set_cookie(
        key="sso_pkce_verifier",
        value=code_verifier,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=600,
        path="/"
    )
    return redirect

@router.get("/auth/callback")
async def auth_callback(
    request: Request,
    response: Response,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    if error:
        err_msg = error_description or error or "Erreur reçue du serveur SSO."
        logger.error(f"[SSO] Callback received error from SSO: {err_msg}")
        return RedirectResponse(url=f"/?auth_error={urllib.parse.quote(err_msg)}", status_code=status.HTTP_302_FOUND)

    if not code or not state:
        logger.error("[SSO] Callback missing code or state parameters.")
        return RedirectResponse(url="/?auth_error=Parametres+code+ou+state+manquants", status_code=status.HTTP_302_FOUND)

    r = await get_redis()
    code_verifier = None
    if r:
        try:
            code_verifier = await r.get(f"sso_verifier:{state}")
            if code_verifier:
                await r.delete(f"sso_verifier:{state}")
        except Exception as e:
            logger.warning(f"[SSO] Redis get failed: {e}")

    # Fallback verifier from cookie if redis was offline
    if not code_verifier:
        code_verifier = request.cookies.get("sso_pkce_verifier")

    if not code_verifier:
        code_verifier = ""

    try:
        user = await AuthService.handle_sso_callback(code, code_verifier, db)
    except Exception as e:
        logger.error(f"[SSO] handle_sso_callback failed: {e}")
        err_detail = getattr(e, "detail", str(e))
        clean_msg = err_detail if isinstance(err_detail, str) else str(err_detail)
        return RedirectResponse(url=f"/?auth_error={urllib.parse.quote(clean_msg)}", status_code=status.HTTP_302_FOUND)

    # Create JWT access token
    token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "name": user.display_name,
        "type": "user",
        "role": user.role
    })

    # Extract return_to from state
    return_to = "/"
    if ":" in state:
        try:
            return_to = urllib.parse.unquote(state.split(":", 1)[1])
        except Exception:
            return_to = "/"

    redirect = RedirectResponse(url=return_to, status_code=status.HTTP_302_FOUND)
    AuthService.set_session_cookie(redirect, token)
    redirect.delete_cookie(key="sso_pkce_verifier", path="/")
    return redirect

@router.get("/auth/logout")
async def logout(response: Response):
    redirect = RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    AuthService.clear_session_cookie(redirect)
    return redirect

@router.get("/api/auth/me")
async def get_me(actor: dict = Depends(get_current_actor)):
    if actor["type"] == "user":
        u: User = actor["user"]
        return {
            "authenticated": True,
            "type": "user",
            "id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "role": u.role
        }
    else:
        return {
            "authenticated": True,
            "type": "guest",
            "id": actor["member_id"],
            "event_id": actor["event_id"],
            "display_name": actor["display_name"],
            "avatar_url": None,
            "role": "guest"
        }
