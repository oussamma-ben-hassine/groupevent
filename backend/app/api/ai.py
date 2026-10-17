from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_actor
from app.models.models import Event, EventMember, GroceryItem, Expense
from app.schemas.schemas import AIChatRequest, AIChatResponse
from app.services.litellm_service import LiteLLMService

router = APIRouter(prefix="/api/ai", tags=["Assistant IA"])

@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    payload: AIChatRequest,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    event_context = None
    if payload.event_id:
        ev = (await db.execute(
            select(Event)
            .where(Event.id == payload.event_id)
            .options(selectinload(Event.members), selectinload(Event.groceries), selectinload(Event.expenses))
        )).scalar_one_or_none()

        if ev:
            member_names = [m.display_title for m in ev.members]
            grocery_names = [f"{g.name} ({g.quantity} {g.unit})" for g in ev.groceries[:10]]
            total_spent = sum(e.amount for e in ev.expenses)
            event_context = (
                f"Titre : {ev.title}\n"
                f"Description : {ev.description or 'Non précisée'}\n"
                f"Nombre de participants : {len(member_names)} ({', '.join(member_names[:8])})\n"
                f"Devise : {ev.currency}\n"
                f"Articles déjà listés ({len(ev.groceries)}) : {', '.join(grocery_names)}\n"
                f"Dépenses actuelles : {total_spent:.2f} {ev.currency}"
            )

    result = await LiteLLMService.chat(prompt=payload.prompt, context=event_context)

    return AIChatResponse(
        content=result["content"],
        suggested_groceries=result.get("suggested_groceries"),
        suggested_expenses=None
    )
