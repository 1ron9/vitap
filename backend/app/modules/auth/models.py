"""Identity tables and API DTOs from the VitaP Schema v2 contract."""
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False, default="USER")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="ACTIVE", index=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=utc_now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    profile: Mapped["UserProfile"] = relationship(back_populates="user", uselist=False)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    biological_sex: Mapped[str | None] = mapped_column(String(20))
    phone: Mapped[str | None] = mapped_column(String(30))
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=utc_now)
    user: Mapped[User] = relationship(back_populates="profile")


class UserConsent(Base):
    __tablename__ = "user_consents"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    consent_version: Mapped[str] = mapped_column(String(50), nullable=False)
    scope: Mapped[str] = mapped_column(String(100), nullable=False)
    is_accepted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GuestSession(Base):
    __tablename__ = "guest_sessions"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    session_token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    consent_accepted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    consent_version: Mapped[str] = mapped_column(String(50), nullable=False)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StrictDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConsentInput(StrictDTO):
    version: str
    scope: str
    is_accepted: bool


class RegisterRequest(StrictDTO):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=12, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)
    consent: ConsentInput

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if value.count("@") != 1 or "." not in value.split("@", 1)[1]:
            raise ValueError("Email không hợp lệ")
        return value


class LoginRequest(StrictDTO):
    email: str
    password: str


class RefreshRequest(StrictDTO):
    refresh_token: str


class GuestSessionRequest(StrictDTO):
    consent_accepted: bool
    consent_version: str


class UserIdentity(BaseModel):
    id: UUID
    email: str
    role: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class GuestSessionCreated(BaseModel):
    id: UUID
    guest_token: str
    consent_accepted: bool
    consent_version: str
    created_at: datetime
    expires_at: datetime
