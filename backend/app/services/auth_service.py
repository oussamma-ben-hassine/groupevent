import urllib.parse
import httpx
import logging
from typing import Dict, Any, Tuple
from fastapi import HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import generate_random_token, hash_token, create_access_token
from app.models.models import User
from app.services.supervisor_service import SupervisorService

logger = logging.getLogger(__name__)

class AuthService:
    @staticmethod
    def generate_sso_auth_url(return_to: str = "/") -> Tuple[str, str, str]:
        """
        Generates PKCE authorization URL for sso-a.oussamma.tn.
        Returns (auth_url, state, code_verifier).
        """
        state = f"{generate_random_token(16)}:{urllib.parse.quote(return_to)}"
        code_verifier = generate_random_token(48)
        code_challenge = hash_token(code_verifier)

        params = {
            "response_type": "code",
            "client_id": settings.SSO_CLIENT_ID,
            "redirect_uri": settings.SSO_REDIRECT_URI,
            "scope": settings.SSO_SCOPES,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        query_string = urllib.parse.urlencode(params)
        auth_url = f"{settings.SSO_BASE_URL.rstrip('/')}/oauth/authorize?{query_string}"
        return auth_url, state, code_verifier

    @staticmethod
    async def handle_sso_callback(
        code: str,
        code_verifier: str,
        db: AsyncSession
    ) -> User:
        token_endpoint = f"{settings.SSO_BASE_URL.rstrip('/')}/oauth/token"
        userinfo_endpoint = f"{settings.SSO_BASE_URL.rstrip('/')}/oauth/userinfo"

        token_data = {
            "grant_type": "authorization_code",
            "client_id": settings.SSO_CLIENT_ID,
            "client_secret": settings.SSO_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.SSO_REDIRECT_URI,
            "code_verifier": code_verifier,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.post(
                token_endpoint,
                data=token_data,
                headers={"Accept": "application/json"}
            )
            if token_resp.status_code != 200:
                logger.error(f"[SSO] Token exchange failed: {token_resp.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Échec de l'échange de jeton SSO ({token_resp.status_code})"
                )

            token_json = token_resp.json()
            access_token = token_json.get("access_token")

            # Fetch user info
            userinfo_resp = await client.get(
                userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if userinfo_resp.status_code != 200:
                logger.error(f"[SSO] UserInfo failed: {userinfo_resp.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Échec de récupération du profil utilisateur SSO"
                )

            user_data = userinfo_resp.json()

        # Provision or update local user
        sso_sub = user_data.get("sub") or user_data.get("id")
        email = user_data.get("email")
        name = user_data.get("name") or user_data.get("preferred_username") or (email.split("@")[0] if email else "Utilisateur")
        avatar_url = user_data.get("picture") or user_data.get("avatar_url")

        is_super = email and (email.lower() in settings.super_admins)

        result = await db.execute(select(User).where(User.sso_sub == sso_sub))
        user = result.scalars().first()

        if not user and email:
            # Check by email
            result_email = await db.execute(select(User).where(User.email == email))
            user = result_email.scalars().first()

        if not user:
            user = User(
                email=email,
                display_name=name,
                avatar_url=avatar_url,
                sso_sub=sso_sub,
                sso_issuer=settings.SSO_BASE_URL,
                role="superadmin" if is_super else "user",
                is_active=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

            await SupervisorService.record_event(
                event_type="user_registered",
                actor_sub=sso_sub,
                actor_email=email,
                actor_name=name,
                resource_type="user",
                resource_id=user.id,
                resource_name=user.display_name
            )
        else:
            # Sync updated details
            user.display_name = name
            if avatar_url:
                user.avatar_url = avatar_url
            if is_super:
                user.role = "superadmin"
            user.sso_sub = sso_sub
            await db.commit()
            await db.refresh(user)

            await SupervisorService.record_event(
                event_type="user_login",
                actor_sub=sso_sub,
                actor_email=email,
                actor_name=name,
                resource_type="user",
                resource_id=user.id,
                resource_name=user.display_name
            )

        return user

    @staticmethod
    def set_session_cookie(response: Response, token: str) -> None:
        response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=token,
            httponly=True,
            secure=settings.ENVIRONMENT == "production",
            samesite="lax",
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/"
        )

    @staticmethod
    def clear_session_cookie(response: Response) -> None:
        response.delete_cookie(
            key=settings.SESSION_COOKIE_NAME,
            path="/"
        )
