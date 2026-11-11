"""AU-01 identity endpoints and reusable User/Guest principal dependency."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, Request, Response
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, create_opaque_token, get_password_hash, hash_token, verify_password
from app.models.user_models import (
    GuestSession, GuestSessionCreated, GuestSessionRequest, LoginRequest,
    RefreshRequest, RefreshSession, RegisterRequest, TokenPair, User,
    UserConsent, UserIdentity, UserProfile, utc_now,
)

router = APIRouter()
guest_router = APIRouter()


class AuthError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


@dataclass(frozen=True)
class Principal:
    kind: str
    id: UUID | None = None


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def get_principal(
    authorization: str | None = Header(default=None),
    x_guest_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Principal:
    if authorization is not None and x_guest_token is not None:
        raise AuthError(400, "AMBIGUOUS_PRINCIPAL", "Chỉ gửi một loại token")
    if authorization is not None:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise AuthError(401, "INVALID_TOKEN", "Bearer token không hợp lệ")
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if payload.get("type") != "access":
                raise ValueError("wrong token type")
            user_id = UUID(payload["sub"])
        except ExpiredSignatureError:
            raise AuthError(401, "TOKEN_EXPIRED", "Token đã hết hạn")
        except (JWTError, ValueError, KeyError):
            raise AuthError(401, "INVALID_TOKEN", "Token không hợp lệ hoặc đã hết hạn")
        user = db.get(User, user_id)
        if user is None:
            raise AuthError(401, "INVALID_TOKEN", "Token không hợp lệ")
        if user.status != "ACTIVE":
            raise AuthError(403, "ACCOUNT_INACTIVE", "Tài khoản không hoạt động")
        return Principal("USER", user.id)
    if x_guest_token is not None:
        session = db.query(GuestSession).filter_by(session_token_hash=hash_token(x_guest_token)).first()
        if session is None or not session.consent_accepted:
            raise AuthError(401, "INVALID_TOKEN", "Phiên Guest không hợp lệ")
        if _aware(session.expires_at) <= utc_now():
            raise AuthError(401, "TOKEN_EXPIRED", "Phiên Guest đã hết hạn")
        return Principal("GUEST", session.id)
    return Principal("PUBLIC")


def require_user(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> User:
    if principal.kind == "PUBLIC":
        raise AuthError(401, "AUTH_REQUIRED", "Cần đăng nhập")
    if principal.kind == "GUEST":
        raise AuthError(403, "LOGIN_REQUIRED", "Cần tài khoản User")
    return db.get(User, principal.id)


def _issue_pair(user: User, db: Session) -> TokenPair:
    raw = create_opaque_token()
    db.add(RefreshSession(
        id=uuid4(), user_id=user.id, token_hash=hash_token(raw),
        created_at=utc_now(), expires_at=utc_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()
    return TokenPair(
        access_token=create_access_token({"sub": str(user.id)}),
        refresh_token=raw,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/register", status_code=201, response_model=UserIdentity)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    consent = payload.consent
    if not consent.is_accepted or consent.version != settings.USER_CONSENT_VERSION or consent.scope != "HEALTH_DATA_AND_AI_PROCESSING":
        raise AuthError(403, "CONSENT_REQUIRED", "Cần đồng ý phiên bản consent hiện hành")
    user = User(id=uuid4(), email=payload.email, password_hash=get_password_hash(payload.password), role="USER", status="ACTIVE", created_at=utc_now())
    db.add(user)
    db.add(UserProfile(id=uuid4(), user_id=user.id, full_name=payload.full_name, created_at=utc_now()))
    db.add(UserConsent(id=uuid4(), user_id=user.id, consent_version=consent.version, scope=consent.scope,
                       is_accepted=True, ip_address=request.client.host if request.client else None, consented_at=utc_now()))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AuthError(409, "RESOURCE_CONFLICT", "Không thể đăng ký tài khoản này")
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter_by(email=email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AuthError(401, "INVALID_CREDENTIALS", "Thông tin đăng nhập không hợp lệ")
    if user.status != "ACTIVE":
        raise AuthError(403, "ACCOUNT_INACTIVE", "Tài khoản không hoạt động")
    return _issue_pair(user, db)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.refresh_token)
    old = db.query(RefreshSession).filter_by(token_hash=token_hash).first()
    if old is None or old.revoked_at is not None or _aware(old.expires_at) <= utc_now():
        raise AuthError(401, "INVALID_TOKEN", "Refresh token không hợp lệ hoặc đã hết hạn")
    user = db.get(User, old.user_id)
    if user is None or user.status != "ACTIVE":
        raise AuthError(403, "ACCOUNT_INACTIVE", "Tài khoản không hoạt động")
    updated = db.query(RefreshSession).filter(
        RefreshSession.id == old.id, RefreshSession.revoked_at.is_(None)
    ).update({RefreshSession.revoked_at: utc_now()}, synchronize_session=False)
    if updated != 1:
        db.rollback()
        raise AuthError(401, "INVALID_TOKEN", "Refresh token đã được sử dụng")
    return _issue_pair(user, db)


@router.post("/logout", status_code=204)
def logout(payload: RefreshRequest, user: User = Depends(require_user), db: Session = Depends(get_db)):
    session = db.query(RefreshSession).filter_by(token_hash=hash_token(payload.refresh_token), user_id=user.id).first()
    if session is None or session.revoked_at is not None or _aware(session.expires_at) <= utc_now():
        raise AuthError(401, "INVALID_TOKEN", "Refresh token không hợp lệ")
    session.revoked_at = utc_now()
    db.commit()
    return Response(status_code=204)


@router.get("/me", response_model=UserIdentity)
def me(user: User = Depends(require_user)):
    return user


@guest_router.post("/guest-sessions", status_code=201, response_model=GuestSessionCreated)
def create_guest_session(payload: GuestSessionRequest, db: Session = Depends(get_db)):
    if not payload.consent_accepted or payload.consent_version != settings.GUEST_CONSENT_VERSION:
        raise AuthError(403, "CONSENT_REQUIRED", "Cần đồng ý phiên bản consent Guest hiện hành")
    raw = create_opaque_token()
    now = utc_now()
    session = GuestSession(
        id=uuid4(), session_token_hash=hash_token(raw), consent_accepted=True,
        consent_version=payload.consent_version, consented_at=now,
        created_at=now, expires_at=now + timedelta(hours=settings.GUEST_TOKEN_EXPIRE_HOURS),
    )
    db.add(session)
    db.commit()
    return GuestSessionCreated(id=session.id, guest_token=raw, consent_accepted=True,
                               consent_version=session.consent_version, created_at=now, expires_at=session.expires_at)
