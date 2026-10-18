import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Float, DateTime, ForeignKey, Integer, Enum
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, index=True, nullable=True)
    display_name = Column(String(255), nullable=False)
    avatar_url = Column(String(1024), nullable=True)
    sso_sub = Column(String(255), unique=True, index=True, nullable=True)
    sso_issuer = Column(String(255), nullable=True)
    role = Column(String(50), default="user")  # 'superadmin', 'user'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    organized_events = relationship("Event", back_populates="organizer", cascade="all, delete-orphan")
    memberships = relationship("EventMember", back_populates="user", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    date = Column(DateTime(timezone=True), nullable=True)
    location = Column(String(255), nullable=True)
    currency = Column(String(10), default="EUR")
    icon = Column(String(50), default="🎉")
    organizer_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="active")  # 'active', 'completed', 'archived'
    access_mode = Column(String(50), default="link_sso")  # 'private', 'link_sso', 'guest'
    require_approval = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    organizer = relationship("User", back_populates="organized_events")
    members = relationship("EventMember", back_populates="event", cascade="all, delete-orphan")
    invite_tokens = relationship("InviteToken", back_populates="event", cascade="all, delete-orphan")
    groceries = relationship("GroceryItem", back_populates="event", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="event", cascade="all, delete-orphan")
    settlements = relationship("Settlement", back_populates="event", cascade="all, delete-orphan")


class EventMember(Base):
    __tablename__ = "event_members"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    guest_name = Column(String(255), nullable=True)
    guest_token_hash = Column(String(64), nullable=True, index=True)
    role = Column(String(50), default="member")  # 'organizer', 'member', 'guest'
    status = Column(String(50), default="active")  # 'active', 'pending_approval'
    joined_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    event = relationship("Event", back_populates="members")
    user = relationship("User", back_populates="memberships")
    paid_expenses = relationship("Expense", back_populates="payer", foreign_keys=lambda: [Expense.payer_id])
    expense_splits = relationship("ExpenseSplit", back_populates="member", cascade="all, delete-orphan")

    @property
    def display_title(self) -> str:
        if self.user:
            return self.user.display_name
        return self.guest_name or "Invité"


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    mode = Column(String(50), default="link_sso")  # 'link_sso', 'guest'
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    max_uses = Column(Integer, nullable=True)
    uses_count = Column(Integer, default=0)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    event = relationship("Event", back_populates="invite_tokens")


class GroceryItem(Base):
    __tablename__ = "grocery_items"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    quantity = Column(Float, default=1.0)
    unit = Column(String(50), default="pièce")
    category = Column(String(100), default="Autre")
    estimated_price = Column(Float, nullable=True)
    actual_price = Column(Float, nullable=True)
    item_type = Column(String(50), default="grocery")  # 'grocery', 'material'
    scope = Column(String(50), default="group")        # 'group', 'personal'
    beneficiary_id = Column(String(36), ForeignKey("event_members.id", ondelete="SET NULL"), nullable=True)
    is_bought = Column(Boolean, default=False)
    bought_by_id = Column(String(36), ForeignKey("event_members.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(String(36), ForeignKey("event_members.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    event = relationship("Event", back_populates="groceries")
    bought_by = relationship("EventMember", foreign_keys=lambda: [GroceryItem.bought_by_id])
    assigned_to = relationship("EventMember", foreign_keys=lambda: [GroceryItem.assigned_to_id])
    beneficiary = relationship("EventMember", foreign_keys=lambda: [GroceryItem.beneficiary_id])


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="EUR")
    payer_id = Column(String(36), ForeignKey("event_members.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(100), default="Courses")
    date = Column(DateTime(timezone=True), default=utcnow)
    split_mode = Column(String(50), default="equal")  # 'equal', 'exact', 'shares'
    receipt_url = Column(String(1024), nullable=True)
    receipt_drive_id = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    event = relationship("Event", back_populates="expenses")
    payer = relationship("EventMember", back_populates="paid_expenses", foreign_keys=lambda: [Expense.payer_id])
    splits = relationship("ExpenseSplit", back_populates="expense", cascade="all, delete-orphan")


class ExpenseSplit(Base):
    __tablename__ = "expense_splits"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    expense_id = Column(String(36), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(String(36), ForeignKey("event_members.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    shares = Column(Float, default=1.0)

    expense = relationship("Expense", back_populates="splits")
    member = relationship("EventMember", back_populates="expense_splits")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    from_member_id = Column(String(36), ForeignKey("event_members.id", ondelete="CASCADE"), nullable=False)
    to_member_id = Column(String(36), ForeignKey("event_members.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="EUR")
    settled_at = Column(DateTime(timezone=True), default=utcnow)
    notes = Column(Text, nullable=True)

    event = relationship("Event", back_populates="settlements")
    from_member = relationship("EventMember", foreign_keys=lambda: [Settlement.from_member_id])
    to_member = relationship("EventMember", foreign_keys=lambda: [Settlement.to_member_id])
