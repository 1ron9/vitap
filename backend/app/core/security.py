from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
import hashlib
import secrets
import bcrypt
from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Xác thực mật khẩu sau SHA-256 để tránh giới hạn đầu vào 72 byte của bcrypt."""
    try:
        return bcrypt.checkpw(
            hashlib.sha256(plain_password.encode("utf-8")).hexdigest().encode("ascii"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Băm SHA-256 rồi bcrypt; dùng cùng cách xử lý ở verify_password."""
    salt = bcrypt.gensalt()
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest().encode("ascii")
    return bcrypt.hashpw(digest, salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Tạo JWT access token có thời hạn sử dụng."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
