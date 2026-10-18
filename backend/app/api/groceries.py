import os
import re
import unicodedata
import difflib
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_actor
from app.models.models import Event, EventMember, GroceryItem, Expense, ExpenseSplit
from app.schemas.schemas import (
    GroceryItemCreate, GroceryItemUpdate, GroceryItemResponse,
    GroceryClaimRequest, ReceiptScanResponse, ReceiptExtractedItem,
    ReceiptItemMatch, ApplyReceiptRequest
)
from app.services.litellm_service import LiteLLMService
from app.services.drive_service import DriveService
from app.services.supervisor_service import SupervisorService

router = APIRouter(prefix="/api/events/{event_id}/groceries", tags=["Courses & Matériel"])


def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text).encode("ASCII", "ignore").decode("utf-8")
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    return " ".join(text.split())


def calculate_similarity(a: str, b: str) -> float:
    norm_a = normalize_text(a)
    norm_b = normalize_text(b)
    if not norm_a or not norm_b:
        return 0.0
    if norm_a == norm_b:
        return 1.0
    if norm_a in norm_b or norm_b in norm_a:
        return 0.85
    words_a = set([w for w in norm_a.split() if len(w) > 2])
    words_b = set([w for w in norm_b.split() if len(w) > 2])
    if words_a and words_b:
        overlap = len(words_a.intersection(words_b))
        if overlap > 0:
            word_sim = overlap / max(len(words_a), len(words_b))
            seq_sim = difflib.SequenceMatcher(None, norm_a, norm_b).ratio()
            return round(max(word_sim, seq_sim), 2)
    return round(difflib.SequenceMatcher(None, norm_a, norm_b).ratio(), 2)


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


def serialize_grocery_item(it: GroceryItem) -> GroceryItemResponse:
    return GroceryItemResponse(
        id=it.id,
        event_id=it.event_id,
        name=it.name,
        quantity=it.quantity,
        unit=it.unit,
        category=it.category,
        item_type=it.item_type or "grocery",
        scope=it.scope or "group",
        beneficiary_id=it.beneficiary_id,
        beneficiary_name=it.beneficiary.display_title if it.beneficiary else None,
        estimated_price=it.estimated_price,
        actual_price=it.actual_price,
        is_bought=it.is_bought,
        bought_by_id=it.bought_by_id,
        bought_by_name=it.bought_by.display_title if it.bought_by else None,
        assigned_to_id=it.assigned_to_id,
        assigned_to_name=it.assigned_to.display_title if it.assigned_to else None,
        notes=it.notes,
        created_at=it.created_at
    )


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
            selectinload(GroceryItem.assigned_to).selectinload(EventMember.user),
            selectinload(GroceryItem.beneficiary).selectinload(EventMember.user)
        )
        .order_by(GroceryItem.is_bought.asc(), GroceryItem.category.asc(), GroceryItem.created_at.desc())
    )
    items = (await db.execute(stmt)).scalars().all()
    return [serialize_grocery_item(it) for it in items]


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
        item_type=payload.item_type or "grocery",
        scope=payload.scope or "group",
        beneficiary_id=payload.beneficiary_id if payload.scope == "personal" else None,
        estimated_price=payload.estimated_price,
        actual_price=payload.actual_price,
        assigned_to_id=payload.assigned_to_id,
        notes=payload.notes,
        is_bought=False
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    stmt = (
        select(GroceryItem)
        .where(GroceryItem.id == item.id)
        .options(
            selectinload(GroceryItem.bought_by).selectinload(EventMember.user),
            selectinload(GroceryItem.assigned_to).selectinload(EventMember.user),
            selectinload(GroceryItem.beneficiary).selectinload(EventMember.user)
        )
    )
    loaded = (await db.execute(stmt)).scalar_one()
    return serialize_grocery_item(loaded)


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
            selectinload(GroceryItem.assigned_to).selectinload(EventMember.user),
            selectinload(GroceryItem.beneficiary).selectinload(EventMember.user)
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

    # Ensure scope/beneficiary consistency
    if item.scope != "personal":
        item.beneficiary_id = None

    await db.commit()
    await db.refresh(item)
    return serialize_grocery_item(item)


@router.post("/{item_id}/claim", response_model=GroceryItemResponse)
async def claim_grocery_item(
    event_id: str,
    item_id: str,
    payload: GroceryClaimRequest,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    """
    1-click claim / release item ("Je m'en charge" / "Je libère").
    Allows any participant to claim responsibility for buying or bringing an item.
    """
    member = await get_actor_member_or_403(event_id, actor, db)

    stmt = (
        select(GroceryItem)
        .where(GroceryItem.id == item_id, GroceryItem.event_id == event_id)
        .options(
            selectinload(GroceryItem.bought_by).selectinload(EventMember.user),
            selectinload(GroceryItem.assigned_to).selectinload(EventMember.user),
            selectinload(GroceryItem.beneficiary).selectinload(EventMember.user)
        )
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article introuvable.")

    if payload.action == "claim":
        item.assigned_to_id = member.id
    elif payload.action == "release":
        item.assigned_to_id = None

    await db.commit()
    await db.refresh(item)
    return serialize_grocery_item(item)


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


@router.post("/scan-receipt", response_model=ReceiptScanResponse)
async def scan_receipt(
    event_id: str,
    file: UploadFile = File(...),
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads supermarket receipt photo, runs AI Vision OCR via LiteLLM (ai.oussamma.tn/v1),
    and fuzzy-matches receipt lines against the event's existing grocery items.
    """
    await get_actor_member_or_403(event_id, actor, db)

    image_bytes = await file.read()
    if len(image_bytes) > 15 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Photo trop volumineuse (max 15 Mo).")

    # Store receipt photo
    content_type = file.content_type or "image/jpeg"
    upload_res = await DriveService.upload_receipt(
        file_bytes=image_bytes,
        filename=file.filename or "receipt.jpg",
        content_type=content_type
    )
    receipt_image_url = upload_res.get("url")

    # Call AI OCR Vision
    parsed_receipt = await LiteLLMService.parse_receipt_image(
        image_bytes=image_bytes,
        mime_type=content_type
    )

    store_name = parsed_receipt.get("store_name") or "Magasin"
    receipt_date = parsed_receipt.get("date")
    receipt_total = parsed_receipt.get("total")
    raw_extracted = parsed_receipt.get("items") or []

    extracted_items: List[ReceiptExtractedItem] = []
    for raw in raw_extracted:
        try:
            p = float(raw.get("price", 0.0))
            q = float(raw.get("quantity", 1.0))
            name = str(raw.get("name", "")).strip()
            if name and p >= 0:
                extracted_items.append(ReceiptExtractedItem(name=name, price=p, quantity=q))
        except (ValueError, TypeError):
            continue

    # Fetch event's existing grocery items
    stmt = (
        select(GroceryItem)
        .where(GroceryItem.event_id == event_id)
        .options(
            selectinload(GroceryItem.beneficiary)
        )
    )
    existing_items = (await db.execute(stmt)).scalars().all()

    matches: List[ReceiptItemMatch] = []
    unmatched_extracted: List[ReceiptExtractedItem] = []
    used_extracted_indices = set()

    # For each existing grocery item, find the best matching receipt line item
    for g_item in existing_items:
        best_sim = 0.0
        best_idx = -1

        for idx, r_item in enumerate(extracted_items):
            if idx in used_extracted_indices:
                continue
            sim = calculate_similarity(g_item.name, r_item.name)
            if sim > best_sim:
                best_sim = sim
                best_idx = idx

        if best_sim >= 0.45 and best_idx >= 0:
            matched_r = extracted_items[best_idx]
            used_extracted_indices.add(best_idx)
            matches.append(
                ReceiptItemMatch(
                    item_id=g_item.id,
                    item_name=g_item.name,
                    item_type=g_item.item_type or "grocery",
                    scope=g_item.scope or "group",
                    beneficiary_id=g_item.beneficiary_id,
                    current_estimated_price=g_item.estimated_price,
                    matched_receipt_name=matched_r.name,
                    matched_price=matched_r.price,
                    confidence=best_sim
                )
            )

    # Remaining extracted items are unmatched
    for idx, r_item in enumerate(extracted_items):
        if idx not in used_extracted_indices:
            unmatched_extracted.append(r_item)

    return ReceiptScanResponse(
        store_name=store_name,
        receipt_date=receipt_date,
        receipt_total=receipt_total,
        extracted_items=extracted_items,
        matches=matches,
        unmatched_receipt_items=unmatched_extracted,
        receipt_image_url=receipt_image_url
    )


@router.post("/apply-receipt", response_model=dict)
async def apply_receipt(
    event_id: str,
    payload: ApplyReceiptRequest,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    """
    Applies prices from receipt to matched grocery items, creates new items if desired,
    marks them as bought, and optionally generates an Expense record with accurate personal vs group split.
    """
    member = await get_actor_member_or_403(event_id, actor, db)
    ev = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Événement introuvable.")

    payer_id = payload.payer_id or member.id

    # 1. Update matched existing items
    updated_items = []
    for item_data in payload.items:
        g_item = (await db.execute(
            select(GroceryItem).where(GroceryItem.id == item_data.item_id, GroceryItem.event_id == event_id)
        )).scalar_one_or_none()
        if g_item:
            g_item.actual_price = float(item_data.actual_price)
            if g_item.estimated_price is None:
                g_item.estimated_price = g_item.actual_price
            g_item.is_bought = item_data.is_bought
            if item_data.is_bought:
                g_item.bought_by_id = payer_id
            updated_items.append(g_item)

    # 2. Add new items from receipt if user chose to include them
    new_created_items = []
    for n_item in payload.new_items:
        new_g = GroceryItem(
            event_id=event_id,
            name=n_item.name.strip(),
            quantity=1.0,
            unit="pièce",
            category=n_item.category or "Autre",
            item_type=n_item.item_type or "grocery",
            scope=n_item.scope or "group",
            beneficiary_id=n_item.beneficiary_id if n_item.scope == "personal" else None,
            estimated_price=float(n_item.price),
            actual_price=float(n_item.price),
            is_bought=True,
            bought_by_id=payer_id
        )
        db.add(new_g)
        new_created_items.append(new_g)

    await db.flush()

    all_bought = [it for it in (updated_items + new_created_items) if it.is_bought]

    # 3. Create Expense if requested
    expense_id = None
    total_expense_amount = 0.0

    if payload.create_expense and all_bought:
        total_expense_amount = sum(
            (it.actual_price if it.actual_price is not None else (it.estimated_price or 0.0))
            for it in all_bought
        )
        total_expense_amount = round(max(0.5, total_expense_amount), 2)

        # Retrieve active members
        active_members = (await db.execute(
            select(EventMember).where(EventMember.event_id == event_id, EventMember.status == "active")
        )).scalars().all()
        active_member_ids = [m.id for m in active_members]

        expense = Expense(
            event_id=event_id,
            title=payload.expense_title or "Ticket de caisse supermarché",
            amount=total_expense_amount,
            currency=ev.currency,
            payer_id=payer_id,
            category="Courses",
            split_mode="exact",
            receipt_url=payload.receipt_url,
            notes=f"Créé automatiquement depuis l'import de ticket ({len(all_bought)} articles)."
        )
        db.add(expense)
        await db.flush()
        expense_id = expense.id

        # Calculate splits: personal items 100% to beneficiary, remainder split equally among all members
        member_debts: Dict[str, float] = {mid: 0.0 for mid in active_member_ids}
        group_total = 0.0

        for it in all_bought:
            price = it.actual_price if it.actual_price is not None else (it.estimated_price or 0.0)
            if it.scope == "personal" and it.beneficiary_id and it.beneficiary_id in member_debts:
                # Personal purchase: directly allocated to beneficiary
                member_debts[it.beneficiary_id] += price
            else:
                # Group purchase
                group_total += price

        # Distribute group purchase equally
        n = max(1, len(active_member_ids))
        group_share = round(group_total / n, 2)
        for mid in member_debts:
            member_debts[mid] += group_share

        # Create split entries
        for mid, debt_amt in member_debts.items():
            split = ExpenseSplit(
                expense_id=expense.id,
                member_id=mid,
                amount=round(debt_amt, 2),
                shares=1.0
            )
            db.add(split)

    await db.commit()

    return {
        "status": "success",
        "updated_count": len(updated_items),
        "new_count": len(new_created_items),
        "expense_created": bool(expense_id),
        "expense_id": expense_id,
        "total_amount": total_expense_amount
    }


@router.post("/to-expense", response_model=dict)
async def convert_groceries_to_expense(
    event_id: str,
    title: str = "Ticket de caisse supermarché",
    total_amount: Optional[float] = None,
    actor: dict = Depends(get_current_actor),
    db: AsyncSession = Depends(get_db)
):
    """
    Converts all checked-off/bought items into a unified Expense with personal purchase awareness.
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
    calculated_total = sum(
        (it.actual_price if it.actual_price is not None else (it.estimated_price or 0.0))
        for it in bought_items
    )
    if total_amount is None or total_amount <= 0:
        total_amount = round(max(0.5, calculated_total), 2)
    else:
        total_amount = round(float(total_amount), 2)

    active_members = (await db.execute(
        select(EventMember).where(EventMember.event_id == event_id, EventMember.status == "active")
    )).scalars().all()
    active_member_ids = [m.id for m in active_members]

    expense = Expense(
        event_id=event_id,
        title=title,
        amount=total_amount,
        currency=ev.currency,
        payer_id=member.id,
        category="Courses",
        split_mode="exact",
        notes=f"Créé à partir de {len(bought_items)} articles cochés dans la liste de courses."
    )
    db.add(expense)
    await db.flush()

    # Calculate splits: personal items 100% to beneficiary, remainder split equally
    member_debts: Dict[str, float] = {mid: 0.0 for mid in active_member_ids}
    group_total = 0.0

    for it in bought_items:
        price = it.actual_price if it.actual_price is not None else (it.estimated_price or 0.0)
        if it.scope == "personal" and it.beneficiary_id and it.beneficiary_id in member_debts:
            member_debts[it.beneficiary_id] += price
        else:
            group_total += price

    # Adjust group share if total_amount was overridden
    personal_sum = sum(member_debts.values())
    remaining_group = max(0.0, total_amount - personal_sum)
    n = max(1, len(active_member_ids))
    group_share = round(remaining_group / n, 2)

    for mid in member_debts:
        member_debts[mid] += group_share

    for mid, debt_amt in member_debts.items():
        split = ExpenseSplit(
            expense_id=expense.id,
            member_id=mid,
            amount=round(debt_amt, 2),
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
