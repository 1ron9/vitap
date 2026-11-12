"""Application ORM aligned with the dev schema contract (v3.1)."""
from uuid import uuid4
from sqlalchemy import Column, Uuid, Text, String, Date, DateTime, Integer, Boolean, Numeric, JSON, ForeignKey, UniqueConstraint, CheckConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector
from app.core.database import Base

class ChatSessions(Base):
    __tablename__ = "chat_sessions"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    title = Column(String(255))
    context_mode = Column(String(30), server_default=text("'PERSONAL'"))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    updated_at = Column(DateTime(timezone=True))

class ChatMessages(Base):
    __tablename__ = "chat_messages"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    session_id = Column(Uuid, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    answer_status = Column(String(40))
    context_used = Column(JSON().with_variant(JSONB, "postgresql"))
    model_name = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    warning_level = Column(String(20), nullable=False, server_default=text("'INFO'"))
    suggested_followups = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False, server_default=text("'[]'"))

class MessageCitations(Base):
    __tablename__ = "message_citations"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    message_id = Column(Uuid, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(Uuid, ForeignKey("knowledge_documents.id"))
    chunk_id = Column(Uuid, ForeignKey("knowledge_chunks.id"))
    drug_id = Column(Uuid, ForeignKey("drugs.id"))
    citation_type = Column(String(30), nullable=False)
    source_title = Column(String(255))
    excerpt = Column(Text)
    interaction_id = Column(Uuid, ForeignKey("drug_interactions.id"))
    source_url = Column(Text)

class AiFeedback(Base):
    __tablename__ = "ai_feedback"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    message_id = Column(Uuid, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    rating = Column(String(20), nullable=False)
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    updated_at = Column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_ai_feedback_message_user"),)

class KnowledgeDocuments(Base):
    __tablename__ = "knowledge_documents"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    title = Column(String(500), nullable=False)
    document_type = Column(String(100))
    source_name = Column(String(255), nullable=False)
    source_url = Column(Text)
    version = Column(String(100))
    published_at = Column(Date)
    effective_from = Column(Date)
    effective_until = Column(Date)
    status = Column(String(30), server_default=text("'ACTIVE'"))
    license_info = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    external_id = Column(String(255))
    content_hash = Column(String(64))
    language = Column(String(20))

class KnowledgeChunks(Base):
    __tablename__ = "knowledge_chunks"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    document_id = Column(Uuid, ForeignKey("knowledge_documents.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768))
    chunk_metadata = Column('metadata', JSON().with_variant(JSONB, "postgresql"))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
