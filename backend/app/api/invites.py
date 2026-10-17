import io
import qrcode
import qrcode.image.svg
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    generate_random_token, hash_token, get_current_actor,
    get_current_user_optional, create_access_token
)
from app.models.models import Event, EventMember, InviteToken, User
from app.schemas.schemas import (
    InviteCreate, InviteResponse, PublicInviteInfo, JoinGuestRequest
)
from app.services.auth_service import AuthService
from app.services.supervisor_service import SupervisorService

router = APIRouter(tags=["Invitations"])

def render_qr_svg(url: str) -> str:
    factory = qrcode.image.svg.SvgPathImage
    img = qrcode.make(url, image_factory=factory, box_size=10, border=1)
    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode("utf-8")

@router.post("/api/events/{event_id}/invites", response_model=InviteResponse)
async def create_invite_link(
    event_id: str,
    payload: InviteCreate,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    ev = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Événement introuvable.")

    if actor["type"] != "user" or ev.organizer_id != actor["user_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Seul l'organisateur peut créer un lien de partage.")

    raw_token = generate_random_token(32)
    token_hashed = hash_token(raw_token)

    expires_at = None
    if payload.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)

    invite = InviteToken(
        event_id=ev.id,
        token_hash=token_hashed,
        mode=payload.mode,
        created_by_id=actor["user_id"],
        expires_at=expires_at,
        max_uses=payload.max_uses,
        uses_count=0,
        is_revoked=False
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    invite_url = f"{settings.APP_URL.rstrip('/')}/invite/{raw_token}"
    qr_svg = render_qr_svg(invite_url)

    return InviteResponse(
        token=raw_token,
        invite_url=invite_url,
        mode=invite.mode,
        expires_at=invite.expires_at,
        max_uses=invite.max_uses,
        uses_count=invite.uses_count,
        is_revoked=invite.is_revoked,
        created_at=invite.created_at,
        qr_svg=qr_svg
    )

@router.delete("/api/events/{event_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(
    event_id: str,
    invite_id: str,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    ev = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not ev or actor["type"] != "user" or ev.organizer_id != actor["user_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action non autorisée.")

    invite = (await db.execute(
        select(InviteToken).where(InviteToken.id == invite_id, InviteToken.event_id == event_id)
    )).scalar_one_or_none()
    if invite:
        invite.is_revoked = True
        await db.commit()

@router.get("/api/invites/{token}/info", response_model=PublicInviteInfo)
async def get_public_invite_info(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    token_hashed = hash_token(token)
    stmt = (
        select(InviteToken)
        .where(InviteToken.token_hash == token_hashed)
        .options(selectinload(InviteToken.event).selectinload(Event.organizer))
    )
    invite = (await db.execute(stmt)).scalar_one_or_none()

    if not invite:
        return PublicInviteInfo(valid=False, message="Lien d'invitation invalide ou introuvable.")

    if invite.is_revoked:
        return PublicInviteInfo(valid=False, message="Ce lien d'invitation a été révoqué par l'organisateur.")

    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        return PublicInviteInfo(valid=False, message="Ce lien d'invitation a expiré.")

    if invite.max_uses and invite.uses_count >= invite.max_uses:
        return PublicInviteInfo(valid=False, message="Le nombre maximal d'utilisations de ce lien a été atteint.")

    ev = invite.event
    return PublicInviteInfo(
        valid=True,
        event_id=ev.id,
        event_title=ev.title,
        event_description=ev.description,
        event_date=ev.date,
        event_location=ev.location,
        event_icon=ev.icon,
        organizer_name=ev.organizer.display_name if ev.organizer else "Organisateur",
        mode=invite.mode,
        require_approval=ev.require_approval
    )

@router.post("/api/invites/{token}/join")
async def join_event(
    token: str,
    payload: Optional[JoinGuestRequest] = None,
    response: Response = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    token_hashed = hash_token(token)
    stmt = (
        select(InviteToken)
        .where(InviteToken.token_hash == token_hashed)
        .options(selectinload(InviteToken.event))
    )
    invite = (await db.execute(stmt)).scalar_one_or_none()

    if not invite or invite.is_revoked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lien invalide ou révoqué.")

    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce lien a expiré.")

    if invite.max_uses and invite.uses_count >= invite.max_uses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nombre maximal d'utilisations atteint.")

    ev = invite.event

    # 1. Connected SSO User joining
    if current_user:
        # Check if already a member
        existing = (await db.execute(
            select(EventMember).where(EventMember.event_id == ev.id, EventMember.user_id == current_user.id)
        )).scalar_one_or_none()

        if not existing:
            new_mem = EventMember(
                event_id=ev.id,
                user_id=current_user.id,
                role="member",
                status="pending_approval" if ev.require_approval else "active"
            )
            db.add(new_mem)
            invite.uses_count += 1
            await db.commit()

            await SupervisorService.record_event(
                event_type="event_joined",
                actor_sub=current_user.sso_sub,
                actor_email=current_user.email,
                actor_name=current_user.display_name,
                resource_type="event",
                resource_id=ev.id,
                resource_name=ev.title
            )

        return {"status": "success", "event_id": ev.id, "type": "user"}

    # 2. Guest user joining
    if invite.mode == "guest" or ev.access_mode == "guest":
        if not payload or not payload.guest_name.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nom d'affichage requis pour le mode invité.")

        guest_token = generate_random_token(32)
        guest_hash = hash_token(guest_token)

        guest_member = EventMember(
            event_id=ev.id,
            user_id=None,
            guest_name=payload.guest_name.strip(),
            guest_token_hash=guest_hash,
            role="guest",
            status="pending_approval" if ev.require_approval else "active"
        )
        db.add(guest_member)
        invite.uses_count += 1
        await db.commit()
        await db.refresh(guest_member)

        # Generate guest session token
        guest_jwt = create_access_token({
            "sub": guest_member.id,
            "member_id": guest_member.id,
            "event_id": ev.id,
            "name": guest_member.guest_name,
            "type": "guest",
            "role": "guest"
        })

        if response:
            AuthService.set_session_cookie(response, guest_jwt)

        return {
            "status": "success",
            "event_id": ev.id,
            "type": "guest",
            "token": guest_jwt,
            "member_id": guest_member.id
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Connexion SSO obligatoire pour rejoindre cet événement."
    )
