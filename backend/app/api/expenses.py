from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_actor
from app.models.models import Event, EventMember, Expense, ExpenseSplit, Settlement
from app.schemas.schemas import (
    ExpenseCreate, ExpenseResponse, ExpenseSplitResponse,
    BalancesResponse, SettlementCreate, SettlementResponse
)
from app.services.debt_simplifier import DebtSimplifier
from app.services.supervisor_service import SupervisorService

router = APIRouter(prefix="/api/events/{event_id}", tags=["Dépenses & Soldes"])

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

@router.get("/expenses", response_model=List[ExpenseResponse])
async def list_expenses(
    event_id: str,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    await get_actor_member_or_403(event_id, actor, db)
    stmt = (
        select(Expense)
        .where(Expense.event_id == event_id)
        .options(
            selectinload(Expense.payer).selectinload(EventMember.user),
            selectinload(Expense.splits).selectinload(ExpenseSplit.member).selectinload(EventMember.user)
        )
        .order_by(Expense.date.desc(), Expense.created_at.desc())
    )
    expenses = (await db.execute(stmt)).scalars().all()

    results = []
    for exp in expenses:
        splits_resp = []
        for sp in exp.splits:
            splits_resp.append(
                ExpenseSplitResponse(
                    id=sp.id,
                    member_id=sp.member_id,
                    member_name=sp.member.display_title if sp.member else "Participant",
                    amount=sp.amount,
                    shares=sp.shares
                )
            )

        results.append(
            ExpenseResponse(
                id=exp.id,
                event_id=exp.event_id,
                title=exp.title,
                amount=exp.amount,
                currency=exp.currency,
                payer_id=exp.payer_id,
                payer_name=exp.payer.display_title if exp.payer else "Participant",
                category=exp.category,
                date=exp.date,
                split_mode=exp.split_mode,
                receipt_url=exp.receipt_url,
                receipt_drive_id=exp.receipt_drive_id,
                notes=exp.notes,
                created_at=exp.created_at,
                splits=splits_resp
            )
        )
    return results

@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    event_id: str,
    payload: ExpenseCreate,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    actor_member = await get_actor_member_or_403(event_id, actor, db)
    ev = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Événement introuvable.")

    expense = Expense(
        event_id=event_id,
        title=payload.title.strip(),
        amount=round(float(payload.amount), 2),
        currency=payload.currency or ev.currency,
        payer_id=payload.payer_id or actor_member.id,
        category=payload.category,
        date=payload.date or datetime.now(timezone.utc),
        split_mode=payload.split_mode,
        receipt_url=payload.receipt_url,
        receipt_drive_id=payload.receipt_drive_id,
        notes=payload.notes
    )
    db.add(expense)
    await db.flush()

    # Calculate splits
    active_members = (await db.execute(
        select(EventMember).where(EventMember.event_id == event_id, EventMember.status == "active")
    )).scalars().all()

    if payload.splits and len(payload.splits) > 0:
        if payload.split_mode == "exact":
            for sp_data in payload.splits:
                sp = ExpenseSplit(
                    expense_id=expense.id,
                    member_id=sp_data.member_id,
                    amount=round(float(sp_data.amount or 0.0), 2),
                    shares=1.0
                )
                db.add(sp)
        elif payload.split_mode == "shares":
            total_shares = sum(sp_data.shares or 1.0 for sp_data in payload.splits)
            unit_val = expense.amount / max(0.01, total_shares)
            for sp_data in payload.splits:
                shares = sp_data.shares or 1.0
                sp = ExpenseSplit(
                    expense_id=expense.id,
                    member_id=sp_data.member_id,
                    amount=round(unit_val * shares, 2),
                    shares=shares
                )
                db.add(sp)
        else: # equal among subset
            each = round(expense.amount / max(1, len(payload.splits)), 2)
            for sp_data in payload.splits:
                sp = ExpenseSplit(
                    expense_id=expense.id,
                    member_id=sp_data.member_id,
                    amount=each,
                    shares=1.0
                )
                db.add(sp)
    else:
        # Default equal split among ALL active event members
        n = max(1, len(active_members))
        each = round(expense.amount / n, 2)
        for m in active_members:
            sp = ExpenseSplit(
                expense_id=expense.id,
                member_id=m.id,
                amount=each,
                shares=1.0
            )
            db.add(sp)

    await db.commit()
    await db.refresh(expense)

    await SupervisorService.record_event(
        event_type="expense_added",
        actor_sub=actor["user"].sso_sub if actor.get("user") else None,
        actor_email=actor["user"].email if actor.get("user") else None,
        actor_name=actor["display_name"],
        resource_type="expense",
        resource_id=expense.id,
        resource_name=expense.title,
        metadata={"amount": expense.amount, "currency": expense.currency, "category": expense.category}
    )

    # Re-fetch with relationships
    stmt = (
        select(Expense)
        .where(Expense.id == expense.id)
        .options(
            selectinload(Expense.payer).selectinload(EventMember.user),
            selectinload(Expense.splits).selectinload(ExpenseSplit.member).selectinload(EventMember.user)
        )
    )
    full_exp = (await db.execute(stmt)).scalar_one()

    return ExpenseResponse(
        id=full_exp.id,
        event_id=full_exp.event_id,
        title=full_exp.title,
        amount=full_exp.amount,
        currency=full_exp.currency,
        payer_id=full_exp.payer_id,
        payer_name=full_exp.payer.display_title if full_exp.payer else "Participant",
        category=full_exp.category,
        date=full_exp.date,
        split_mode=full_exp.split_mode,
        receipt_url=full_exp.receipt_url,
        receipt_drive_id=full_exp.receipt_drive_id,
        notes=full_exp.notes,
        created_at=full_exp.created_at,
        splits=[
            ExpenseSplitResponse(
                id=s.id,
                member_id=s.member_id,
                member_name=s.member.display_title if s.member else "Participant",
                amount=s.amount,
                shares=s.shares
            )
            for s in full_exp.splits
        ]
    )

@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    event_id: str,
    expense_id: str,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    await get_actor_member_or_403(event_id, actor, db)
    exp = (await db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.event_id == event_id)
    )).scalar_one_or_none()
    if exp:
        await db.delete(exp)
        await db.commit()

@router.get("/balances", response_model=BalancesResponse)
async def get_balances(
    event_id: str,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    await get_actor_member_or_403(event_id, actor, db)
    ev = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Événement introuvable.")

    members = (await db.execute(
        select(EventMember)
        .where(EventMember.event_id == event_id)
        .options(selectinload(EventMember.user))
    )).scalars().all()

    expenses = (await db.execute(
        select(Expense)
        .where(Expense.event_id == event_id)
        .options(selectinload(Expense.splits))
    )).scalars().all()

    settlements = (await db.execute(
        select(Settlement).where(Settlement.event_id == event_id)
    )).scalars().all()

    members_data = [
        {"id": m.id, "display_title": m.display_title, "role": m.role}
        for m in members
    ]
    expenses_data = [
        {
            "payer_id": e.payer_id,
            "amount": e.amount,
            "splits": [{"member_id": s.member_id, "amount": s.amount} for s in e.splits]
        }
        for e in expenses
    ]
    settlements_data = [
        {"from_member_id": s.from_member_id, "to_member_id": s.to_member_id, "amount": s.amount}
        for s in settlements
    ]

    member_balances, suggested_settlements, total_spent = DebtSimplifier.calculate_balances(
        members=members_data,
        expenses=expenses_data,
        settlements=settlements_data,
        currency=ev.currency
    )

    return BalancesResponse(
        currency=ev.currency,
        total_spent=total_spent,
        members=member_balances,
        suggested_settlements=suggested_settlements
    )

@router.post("/settlements", response_model=SettlementResponse, status_code=status.HTTP_201_CREATED)
async def record_settlement(
    event_id: str,
    payload: SettlementCreate,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    await get_actor_member_or_403(event_id, actor, db)
    ev = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Événement introuvable.")

    settlement = Settlement(
        event_id=event_id,
        from_member_id=payload.from_member_id,
        to_member_id=payload.to_member_id,
        amount=round(float(payload.amount), 2),
        currency=payload.currency or ev.currency,
        notes=payload.notes,
        settled_at=datetime.now(timezone.utc)
    )
    db.add(settlement)
    await db.commit()
    await db.refresh(settlement)

    from_m = (await db.execute(
        select(EventMember).where(EventMember.id == settlement.from_member_id).options(selectinload(EventMember.user))
    )).scalar_one()
    to_m = (await db.execute(
        select(EventMember).where(EventMember.id == settlement.to_member_id).options(selectinload(EventMember.user))
    )).scalar_one()

    await SupervisorService.record_event(
        event_type="debt_settled",
        actor_name=actor["display_name"],
        resource_type="settlement",
        resource_id=settlement.id,
        metadata={"amount": settlement.amount, "currency": settlement.currency}
    )

    return SettlementResponse(
        id=settlement.id,
        event_id=settlement.event_id,
        from_member_id=settlement.from_member_id,
        from_member_name=from_m.display_title,
        to_member_id=settlement.to_member_id,
        to_member_name=to_m.display_title,
        amount=settlement.amount,
        currency=settlement.currency,
        settled_at=settlement.settled_at,
        notes=settlement.notes
    )

@router.get("/settlements", response_model=List[SettlementResponse])
async def list_settlements(
    event_id: str,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    await get_actor_member_or_403(event_id, actor, db)
    stmt = (
        select(Settlement)
        .where(Settlement.event_id == event_id)
        .options(
            selectinload(Settlement.from_member).selectinload(EventMember.user),
            selectinload(Settlement.to_member).selectinload(EventMember.user)
        )
        .order_by(Settlement.settled_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    return [
        SettlementResponse(
            id=s.id,
            event_id=s.event_id,
            from_member_id=s.from_member_id,
            from_member_name=s.from_member.display_title if s.from_member else "Participant",
            to_member_id=s.to_member_id,
            to_member_name=s.to_member.display_title if s.to_member else "Participant",
            amount=s.amount,
            currency=s.currency,
            settled_at=s.settled_at,
            notes=s.notes
        )
        for s in rows
    ]
