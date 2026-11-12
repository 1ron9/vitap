from uuid import uuid4
from sqlalchemy import Column, Uuid, String, Integer, DateTime, JSON, text
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base

class BackgroundJob(Base):
    __tablename__ = 'background_jobs'
    id = Column(Uuid, primary_key=True, default=uuid4)
    kind = Column(String(40), nullable=False)
    payload = Column(JSON().with_variant(JSONB, 'postgresql'), nullable=False)
    status = Column(String(20), nullable=False, server_default='PENDING')
    attempts = Column(Integer, nullable=False, server_default='0')
    max_attempts = Column(Integer, nullable=False, server_default='3')
    available_at = Column(DateTime(timezone=True), nullable=False, server_default=text('now()'))
    locked_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    error_code = Column(String(100))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text('now()'))
