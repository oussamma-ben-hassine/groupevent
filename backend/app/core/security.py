import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from fastapi import Request, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.models.models import User, EventMember

security = HTTPBearer(auto_error=False)

def hash_token(token: str) -> str:
    """Hash a token using SHA-256 for secure storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def generate_random_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        return None

def extract_token_from_request(request: Request, auth: Optional[HTTPAuthorizationCredentials] = None) -> Optional[str]:
    # 1. Bearer header
    if auth and auth.credentials:
        return auth.credentials
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    # 2. Cookie
    cookie_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    return None

async def get_current_user_optional(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    token = extract_token_from_request(request, auth)
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalars().first()
    if not user and payload.get("email"):
        email = payload.get("email")
        res_email = await db.execute(select(User).where(User.email == email))
        user = res_email.scalars().first()
        if not user:
            user = User(
                id=user_id,
                email=email,
                display_name=payload.get("name") or email.split("@")[0],
                role=payload.get("role", "user"),
                is_active=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
    return user

async def get_current_user(
    user: Optional[User] = Depends(get_current_user_optional)
) -> User:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Connexion requise.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def get_current_actor(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns actor information: either an authenticated SSO User or a Guest Member session.
    """
    token = extract_token_from_request(request, auth)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session requise.")
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Jeton invalide ou expiré.")

    actor_type = payload.get("type", "user")
    if actor_type == "guest":
        member_id = payload.get("member_id")
        event_id = payload.get("event_id")
        result = await db.execute(
            select(EventMember).where(EventMember.id == member_id, EventMember.event_id == event_id)
        )
        member = result.scalars().first()
        if not member:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invité invalide.")
        return {
            "type": "guest",
            "member_id": member.id,
            "event_id": event_id,
            "display_name": member.guest_name or "Invité",
            "member": member,
            "user": None
        }
    else:
        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
        user = result.scalars().first()
        if not user and payload.get("email"):
            email = payload.get("email")
            res_email = await db.execute(select(User).where(User.email == email))
            user = res_email.scalars().first()
            if not user:
                user = User(
                    id=user_id,
                    email=email,
                    display_name=payload.get("name") or email.split("@")[0],
                    role=payload.get("role", "user"),
                    is_active=True
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable.")
        return {
            "type": "user",
            "user_id": user.id,
            "display_name": user.display_name,
            "user": user,
            "member": None
        }
