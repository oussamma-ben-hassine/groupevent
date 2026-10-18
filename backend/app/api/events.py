from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user, get_current_actor
from app.models.models import User, Event, EventMember, GroceryItem, Expense
from app.schemas.schemas import (
    EventCreate, EventUpdate, EventResponse, EventDetailResponse, MemberResponse
)
from app.services.supervisor_service import SupervisorService

router = APIRouter(prefix="/api/events", tags=["Événements"])

@router.get("", response_model=List[EventResponse])
async def list_events(
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    if actor["type"] == "user":
        user_id = actor["user_id"]
        # Find events where user is organizer or active member
        stmt = (
            select(Event)
            .outerjoin(EventMember, EventMember.event_id == Event.id)
            .where(
                (Event.organizer_id == user_id) | 
                ((EventMember.user_id == user_id) & (EventMember.status == "active"))
            )
            .distinct()
            .order_by(Event.created_at.desc())
        )
    else:
        # Guest is restricted to their single authorized event
        event_id = actor["event_id"]
        stmt = select(Event).where(Event.id == event_id)

    res = await db.execute(stmt)
    events = res.scalars().all()

    results = []
    for ev in events:
        # Compute count of members, groceries and total expenses
        m_count = await db.scalar(
            select(func.count(EventMember.id)).where(EventMember.event_id == ev.id, EventMember.status == "active")
        ) or 0
        g_count = await db.scalar(
            select(func.count(GroceryItem.id)).where(GroceryItem.event_id == ev.id)
        ) or 0
        exp_sum = await db.scalar(
            select(func.sum(Expense.amount)).where(Expense.event_id == ev.id)
        ) or 0.0

        ev_dict = {
            "id": ev.id,
            "title": ev.title,
            "description": ev.description,
            "date": ev.date,
            "location": ev.location,
            "currency": ev.currency,
            "icon": ev.icon,
            "organizer_id": ev.organizer_id,
            "status": ev.status,
            "access_mode": ev.access_mode,
            "require_approval": ev.require_approval,
            "created_at": ev.created_at,
            "updated_at": ev.updated_at,
            "member_count": m_count,
            "grocery_count": g_count,
            "total_expenses": round(float(exp_sum), 2)
        }
        results.append(EventResponse(**ev_dict))

    return results

@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    ev = Event(
        title=payload.title,
        description=payload.description,
        date=payload.date,
        location=payload.location,
        currency=payload.currency,
        icon=payload.icon,
        organizer_id=current_user.id,
        access_mode=payload.access_mode,
        require_approval=payload.require_approval,
    )
    db.add(ev)
    await db.flush()

    # Automatically add organizer as active organizer member
    organizer_member = EventMember(
        event_id=ev.id,
        user_id=current_user.id,
        role="organizer",
        status="active"
    )
    db.add(organizer_member)
    await db.commit()
    await db.refresh(ev)

    await SupervisorService.record_event(
        event_type="event_created",
        actor_sub=current_user.sso_sub,
        actor_email=current_user.email,
        actor_name=current_user.display_name,
        resource_type="event",
        resource_id=ev.id,
        resource_name=ev.title,
        metadata={"currency": ev.currency, "access_mode": ev.access_mode}
    )

    return EventResponse(
        id=ev.id,
        title=ev.title,
        description=ev.description,
        date=ev.date,
        location=ev.location,
        currency=ev.currency,
        icon=ev.icon,
        organizer_id=ev.organizer_id,
        status=ev.status,
        access_mode=ev.access_mode,
        require_approval=ev.require_approval,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
        member_count=1,
        grocery_count=0,
        total_expenses=0.0
    )

@router.get("/{event_id}", response_model=EventDetailResponse)
async def get_event_detail(
    event_id: str,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    # Verify access
    if actor["type"] == "guest" and actor["event_id"] != event_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès non autorisé.")

    stmt = select(Event).where(Event.id == event_id).options(
        selectinload(Event.members).selectinload(EventMember.user)
    )
    res = await db.execute(stmt)
    ev = res.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Événement introuvable.")

    is_org = False
    cur_mem_id = None
    if actor["type"] == "user":
        is_org = (ev.organizer_id == actor["user_id"])
        for m in ev.members:
            if m.user_id == actor["user_id"]:
                cur_mem_id = m.id
                break
    else:
        cur_mem_id = actor["member_id"]

    member_responses = []
    for m in ev.members:
        member_responses.append(
            MemberResponse(
                id=m.id,
                event_id=m.event_id,
                user_id=m.user_id,
                guest_name=m.guest_name,
                display_title=m.display_title,
                role=m.role,
                status=m.status,
                joined_at=m.joined_at,
                avatar_url=m.user.avatar_url if m.user else None
            )
        )

    g_count = await db.scalar(
        select(func.count(GroceryItem.id)).where(GroceryItem.event_id == ev.id)
    ) or 0
    exp_sum = await db.scalar(
        select(func.sum(Expense.amount)).where(Expense.event_id == ev.id)
    ) or 0.0

    return EventDetailResponse(
        id=ev.id,
        title=ev.title,
        description=ev.description,
        date=ev.date,
        location=ev.location,
        currency=ev.currency,
        icon=ev.icon,
        organizer_id=ev.organizer_id,
        status=ev.status,
        access_mode=ev.access_mode,
        require_approval=ev.require_approval,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
        member_count=len(ev.members),
        grocery_count=g_count,
        total_expenses=round(float(exp_sum), 2),
        members=member_responses,
        is_organizer=is_org,
        current_member_id=cur_mem_id
    )

@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    payload: EventUpdate,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Event).where(Event.id == event_id)
    ev = (await db.execute(stmt)).scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Événement introuvable.")

    if actor["type"] != "user" or ev.organizer_id != actor["user_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Seul l'organisateur peut modifier cet événement.")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(ev, field, val)

    await db.commit()
    await db.refresh(ev)

    return EventResponse(
        id=ev.id,
        title=ev.title,
        description=ev.description,
        date=ev.date,
        location=ev.location,
        currency=ev.currency,
        icon=ev.icon,
        organizer_id=ev.organizer_id,
        status=ev.status,
        access_mode=ev.access_mode,
        require_approval=ev.require_approval,
        created_at=ev.created_at,
        updated_at=ev.updated_at
    )

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Event).where(Event.id == event_id)
    ev = (await db.execute(stmt)).scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Événement introuvable.")

    is_admin = actor.get("role") in ["admin", "superadmin"] or (actor.get("user") and getattr(actor["user"], "role", None) in ["admin", "superadmin"])
    if actor["type"] != "user" or (ev.organizer_id != actor["user_id"] and not is_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action réservée à l'organisateur.")

    await db.delete(ev)
    await db.commit()
