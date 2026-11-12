"""Principal dependencies shared by HTTP routes and internal services."""
from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.auth.router import Principal, get_principal, require_user, AuthError
from app.modules.auth.models import User, UserConsent

def require_ai_consent(user: User = Depends(require_user), db: Session = Depends(get_db)) -> User:
    consent = db.query(UserConsent).filter_by(user_id=user.id, scope="HEALTH_DATA_AND_AI_PROCESSING").order_by(UserConsent.consented_at.desc(), UserConsent.id.desc()).first()
    if consent is None or not consent.is_accepted or consent.revoked_at is not None:
        raise AuthError(403, "CONSENT_REQUIRED", "Cần đồng ý xử lý dữ liệu AI")
    return user
