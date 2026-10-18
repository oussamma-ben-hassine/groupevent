from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ==================== USER SCHEMAS ====================
class UserBase(BaseModel):
    email: Optional[str] = None
    display_name: str
    avatar_url: Optional[str] = None

class UserResponse(UserBase):
    id: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== EVENT SCHEMAS ====================
class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    date: Optional[datetime] = None
    location: Optional[str] = None
    currency: str = Field(default="EUR", max_length=10)
    icon: str = Field(default="🎉", max_length=50)
    access_mode: str = Field(default="link_sso")  # 'private', 'link_sso', 'guest'
    require_approval: bool = False

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    location: Optional[str] = None
    currency: Optional[str] = None
    icon: Optional[str] = None
    status: Optional[str] = None
    access_mode: Optional[str] = None
    require_approval: Optional[bool] = None

class MemberResponse(BaseModel):
    id: str
    event_id: str
    user_id: Optional[str] = None
    guest_name: Optional[str] = None
    display_title: str
    role: str
    status: str
    joined_at: datetime
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class EventResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    date: Optional[datetime]
    location: Optional[str]
    currency: str
    icon: str
    organizer_id: str
    status: str
    access_mode: str
    require_approval: bool
    created_at: datetime
    updated_at: datetime
    member_count: int = 0
    grocery_count: int = 0
    total_expenses: float = 0.0

    class Config:
        from_attributes = True

class EventDetailResponse(EventResponse):
    members: List[MemberResponse] = []
    is_organizer: bool = False
    current_member_id: Optional[str] = None


# ==================== INVITATION SCHEMAS ====================
class InviteCreate(BaseModel):
    mode: str = Field(default="link_sso")  # 'link_sso', 'guest'
    expires_in_days: Optional[int] = None
    max_uses: Optional[int] = None

class InviteResponse(BaseModel):
    token: str
    invite_url: str
    mode: str
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    uses_count: int
    is_revoked: bool
    created_at: datetime
    qr_svg: Optional[str] = None

class PublicInviteInfo(BaseModel):
    valid: bool
    event_id: Optional[str] = None
    event_title: Optional[str] = None
    event_description: Optional[str] = None
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    event_icon: Optional[str] = None
    organizer_name: Optional[str] = None
    mode: str = "link_sso"
    require_approval: bool = False
    message: Optional[str] = None

class JoinGuestRequest(BaseModel):
    guest_name: str = Field(..., min_length=2, max_length=100)


# ==================== GROCERY SCHEMAS ====================
class GroceryItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    quantity: float = 1.0
    unit: str = "pièce"
    category: str = "Autre"
    item_type: str = "grocery"   # 'grocery' (courses), 'material' (matériel/équipement)
    scope: str = "group"         # 'group' (partagé), 'personal' (achat perso)
    beneficiary_id: Optional[str] = None
    estimated_price: Optional[float] = None
    actual_price: Optional[float] = None
    assigned_to_id: Optional[str] = None
    notes: Optional[str] = None

class GroceryItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    item_type: Optional[str] = None
    scope: Optional[str] = None
    beneficiary_id: Optional[str] = None
    estimated_price: Optional[float] = None
    actual_price: Optional[float] = None
    is_bought: Optional[bool] = None
    bought_by_id: Optional[str] = None
    assigned_to_id: Optional[str] = None
    notes: Optional[str] = None

class GroceryClaimRequest(BaseModel):
    action: str = "claim"  # 'claim' or 'release'

class GroceryItemResponse(BaseModel):
    id: str
    event_id: str
    name: str
    quantity: float
    unit: str
    category: str
    item_type: str = "grocery"
    scope: str = "group"
    beneficiary_id: Optional[str] = None
    beneficiary_name: Optional[str] = None
    estimated_price: Optional[float]
    actual_price: Optional[float] = None
    is_bought: bool
    bought_by_id: Optional[str]
    bought_by_name: Optional[str] = None
    assigned_to_id: Optional[str]
    assigned_to_name: Optional[str] = None
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ==================== RECEIPT OCR & MATCHING SCHEMAS ====================
class ReceiptExtractedItem(BaseModel):
    name: str
    price: float
    quantity: float = 1.0
    raw_line: Optional[str] = None

class ReceiptItemMatch(BaseModel):
    item_id: str
    item_name: str
    item_type: str = "grocery"
    scope: str = "group"
    beneficiary_id: Optional[str] = None
    current_estimated_price: Optional[float] = None
    matched_receipt_name: str
    matched_price: float
    confidence: float

class ReceiptScanResponse(BaseModel):
    store_name: Optional[str] = "Magasin inconnu"
    receipt_date: Optional[str] = None
    receipt_total: Optional[float] = None
    extracted_items: List[ReceiptExtractedItem] = []
    matches: List[ReceiptItemMatch] = []
    unmatched_receipt_items: List[ReceiptExtractedItem] = []
    receipt_image_url: Optional[str] = None

class ApplyReceiptItem(BaseModel):
    item_id: str
    actual_price: float
    is_bought: bool = True

class ApplyReceiptNewItem(BaseModel):
    name: str
    price: float
    category: str = "Autre"
    item_type: str = "grocery"
    scope: str = "group"
    beneficiary_id: Optional[str] = None

class ApplyReceiptRequest(BaseModel):
    items: List[ApplyReceiptItem] = []
    new_items: List[ApplyReceiptNewItem] = []
    create_expense: bool = True
    expense_title: str = "Ticket de caisse supermarché"
    payer_id: Optional[str] = None
    receipt_url: Optional[str] = None


# ==================== EXPENSE SCHEMAS ====================
class ExpenseSplitCreate(BaseModel):
    member_id: str
    amount: Optional[float] = None  # If custom amount
    shares: Optional[float] = 1.0   # If custom shares

class ExpenseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    amount: float = Field(..., gt=0)
    currency: str = "EUR"
    payer_id: str
    category: str = "Courses"
    date: Optional[datetime] = None
    split_mode: str = "equal"  # 'equal', 'exact', 'shares'
    splits: Optional[List[ExpenseSplitCreate]] = None
    receipt_url: Optional[str] = None
    receipt_drive_id: Optional[str] = None
    notes: Optional[str] = None

class ExpenseSplitResponse(BaseModel):
    id: str
    member_id: str
    member_name: str
    amount: float
    shares: float

class ExpenseResponse(BaseModel):
    id: str
    event_id: str
    title: str
    amount: float
    currency: str
    payer_id: str
    payer_name: str
    category: str
    date: datetime
    split_mode: str
    receipt_url: Optional[str]
    receipt_drive_id: Optional[str]
    notes: Optional[str]
    created_at: datetime
    splits: List[ExpenseSplitResponse] = []

    class Config:
        from_attributes = True


# ==================== BALANCES & SETTLEMENTS ====================
class MemberBalance(BaseModel):
    member_id: str
    display_name: str
    role: str
    paid_total: float
    owes_total: float
    net_balance: float  # + is owed money, - owes money

class DebtTransaction(BaseModel):
    from_member_id: str
    from_member_name: str
    to_member_id: str
    to_member_name: str
    amount: float
    currency: str

class BalancesResponse(BaseModel):
    currency: str
    total_spent: float
    members: List[MemberBalance]
    suggested_settlements: List[DebtTransaction]

class SettlementCreate(BaseModel):
    from_member_id: str
    to_member_id: str
    amount: float = Field(..., gt=0)
    currency: str = "EUR"
    notes: Optional[str] = None

class SettlementResponse(BaseModel):
    id: str
    event_id: str
    from_member_id: str
    from_member_name: str
    to_member_id: str
    to_member_name: str
    amount: float
    currency: str
    settled_at: datetime
    notes: Optional[str]


# ==================== AI ASSISTANT SCHEMAS ====================
class AIChatRequest(BaseModel):
    prompt: str
    event_id: Optional[str] = None
    context_type: Optional[str] = "general"  # 'general', 'groceries', 'budget', 'recipe'

class AIChatResponse(BaseModel):
    content: str
    suggested_groceries: Optional[List[GroceryItemCreate]] = None
    suggested_expenses: Optional[List[Dict[str, Any]]] = None
