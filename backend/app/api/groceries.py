from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_actor
from app.models.models import Event, EventMember, GroceryItem, Expense, ExpenseSplit
from app.schemas.schemas import (
    GroceryItemCreate, GroceryItemUpdate, GroceryItemResponse, ExpenseResponse
)
from app.services.supervisor_service import SupervisorService

router = APIRouter(prefix="/api/events/{event_id}/groceries", tags=["Courses"])

async def get_actor_member_or_403(event_id: str, actor: dict, db: AsyncSession) -> EventMember:
    if actor["type"] == "guest":
        if actor["event_id"] != event_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès non autorisé.")
        return actor["member"]
    else:
        user_id = actor["user_id"]
        stmt = select(EventMember).where(EventMember.event_id == event_id, EventMember.user_id == user_id)
        member = (await db.execute(stmt)).scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous n'êtes pas membre de cet événement.")
        return member

@router.get("", response_model=List[GroceryItemResponse])
async def list_grocery_items(
    event_id: str,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    await get_actor_member_or_403(event_id, actor, db)
    stmt = (
        select(GroceryItem)
        .where(GroceryItem.event_id == event_id)
        .options(
            selectinload(GroceryItem.bought_by).selectinload(EventMember.user),
            selectinload(GroceryItem.assigned_to).selectinload(EventMember.user)
        )
        .order_by(GroceryItem.is_bought.asc(), GroceryItem.category.asc(), GroceryItem.created_at.desc())
    )
    items = (await db.execute(stmt)).scalars().all()

    results = []
    for it in items:
        results.append(
            GroceryItemResponse(
                id=it.id,
                event_id=it.event_id,
                name=it.name,
                quantity=it.quantity,
                unit=it.unit,
                category=it.category,
                estimated_price=it.estimated_price,
                is_bought=it.is_bought,
                bought_by_id=it.bought_by_id,
                bought_by_name=it.bought_by.display_title if it.bought_by else None,
                assigned_to_id=it.assigned_to_id,
                assigned_to_name=it.assigned_to.display_title if it.assigned_to else None,
                notes=it.notes,
                created_at=it.created_at
            )
        )
    return results

@router.post("", response_model=GroceryItemResponse, status_code=status.HTTP_201_CREATED)
async def add_grocery_item(
    event_id: str,
    payload: GroceryItemCreate,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    member = await get_actor_member_or_403(event_id, actor, db)

    item = GroceryItem(
        event_id=event_id,
        name=payload.name.strip(),
        quantity=payload.quantity,
        unit=payload.unit,
        category=payload.category,
        estimated_price=payload.estimated_price,
        assigned_to_id=payload.assigned_to_id,
        notes=payload.notes,
        is_bought=False
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return GroceryItemResponse(
        id=item.id,
        event_id=item.event_id,
        name=item.name,
        quantity=item.quantity,
        unit=item.unit,
        category=item.category,
        estimated_price=item.estimated_price,
        is_bought=item.is_bought,
        bought_by_id=item.bought_by_id,
        assigned_to_id=item.assigned_to_id,
        notes=item.notes,
        created_at=item.created_at
    )

@router.patch("/{item_id}", response_model=GroceryItemResponse)
async def update_grocery_item(
    event_id: str,
    item_id: str,
    payload: GroceryItemUpdate,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    member = await get_actor_member_or_403(event_id, actor, db)

    stmt = (
        select(GroceryItem)
        .where(GroceryItem.id == item_id, GroceryItem.event_id == event_id)
        .options(
            selectinload(GroceryItem.bought_by).selectinload(EventMember.user),
            selectinload(GroceryItem.assigned_to).selectinload(EventMember.user)
        )
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article introuvable.")

    updates = payload.model_dump(exclude_unset=True)
    if "is_bought" in updates:
        item.is_bought = updates["is_bought"]
        if item.is_bought:
            item.bought_by_id = member.id
        else:
            item.bought_by_id = None

    for field, val in updates.items():
        if field != "is_bought":
            setattr(item, field, val)

    await db.commit()
    await db.refresh(item)

    return GroceryItemResponse(
        id=item.id,
        event_id=item.event_id,
        name=item.name,
        quantity=item.quantity,
        unit=item.unit,
        category=item.category,
        estimated_price=item.estimated_price,
        is_bought=item.is_bought,
        bought_by_id=item.bought_by_id,
        bought_by_name=item.bought_by.display_title if item.bought_by else None,
        assigned_to_id=item.assigned_to_id,
        assigned_to_name=item.assigned_to.display_title if item.assigned_to else None,
        notes=item.notes,
        created_at=item.created_at
    )

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grocery_item(
    event_id: str,
    item_id: str,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    await get_actor_member_or_403(event_id, actor, db)
    item = (await db.execute(
        select(GroceryItem).where(GroceryItem.id == item_id, GroceryItem.event_id == event_id)
    )).scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()

@router.post("/to-expense", response_model=dict)
async def convert_groceries_to_expense(
    event_id: str,
    title: str = "Ticket de caisse supermarché",
    total_amount: Optional[float] = None,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    """
    Converts all checked-off/bought items into a unified Expense.
    """
    member = await get_actor_member_or_403(event_id, actor, db)
    ev = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Événement introuvable.")

    bought_items = (await db.execute(
        select(GroceryItem).where(GroceryItem.event_id == event_id, GroceryItem.is_bought == True)
    )).scalars().all()

    if not bought_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucun article coché dans le caddie.")

    # Calculate or use provided amount
    if total_amount is None or total_amount <= 0:
        total_amount = sum(it.estimated_price or 0.0 for it in bought_items)
        if total_amount <= 0:
            total_amount = 1.0  # Fallback minimum

    # Get all active event members to split equally
    active_members = (await db.execute(
        select(EventMember).where(EventMember.event_id == event_id, EventMember.status == "active")
    )).scalars().all()

    expense = Expense(
        event_id=event_id,
        title=title,
        amount=round(float(total_amount), 2),
        currency=ev.currency,
        payer_id=member.id,
        category="Courses",
        split_mode="equal",
        notes=f"Créé à partir de {len(bought_items)} articles cochés dans la liste de courses."
    )
    db.add(expense)
    await db.flush()

    each_share = round(total_amount / max(1, len(active_members)), 2)
    for m in active_members:
        split = ExpenseSplit(
            expense_id=expense.id,
            member_id=m.id,
            amount=each_share,
            shares=1.0
        )
        db.add(split)

    await db.commit()

    return {
        "status": "success",
        "expense_id": expense.id,
        "amount": expense.amount,
        "converted_items_count": len(bought_items)
    }
