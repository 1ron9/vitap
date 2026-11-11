"""Application ORM aligned with the dev schema contract (v3.1)."""
from uuid import uuid4
from sqlalchemy import Column, Uuid, Text, String, Date, DateTime, Integer, Boolean, Numeric, JSON, ForeignKey, UniqueConstraint, CheckConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector
from app.core.database import Base

class HealthConditions(Base):
    __tablename__ = "health_conditions"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    condition_name = Column(String(255), nullable=False)
    icd10_code = Column(String(20))
    description = Column(Text)
    diagnosed_at = Column(Date)
    status = Column(String(30), server_default=text("'ACTIVE'"))
    source_type = Column(String(30), server_default=text("'MANUAL'"))
    verified = Column(Boolean, server_default=text('false'))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    updated_at = Column(DateTime(timezone=True))

class Allergies(Base):
    __tablename__ = "allergies"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    ingredient_id = Column(Uuid, ForeignKey("ingredients.id"))
    allergen_name = Column(String(255), nullable=False)
    reaction = Column(Text)
    severity = Column(String(30))
    source_type = Column(String(30), server_default=text("'MANUAL'"))
    verified = Column(Boolean, server_default=text('false'))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    updated_at = Column(DateTime(timezone=True))

class HealthEntries(Base):
    __tablename__ = "health_entries"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    title = Column(String(255))
    content = Column(Text)
    entry_type = Column(String(30), server_default=text("'DAILY'"))
    mood = Column(String(30))
    recorded_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    updated_at = Column(DateTime(timezone=True))

class HealthObservations(Base):
    __tablename__ = "health_observations"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    entry_id = Column(Uuid, ForeignKey("health_entries.id", ondelete="CASCADE"), nullable=False)
    observation_type = Column(String(50), nullable=False)
    value = Column(Numeric(12,4), nullable=False)
    secondary_value = Column(Numeric(12,4))
    unit = Column(String(30), nullable=False)
    measured_at = Column(DateTime(timezone=True), nullable=False)
    source_type = Column(String(30), server_default=text("'MANUAL'"))
    source_reference = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))

class Symptoms(Base):
    __tablename__ = "symptoms"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    entry_id = Column(Uuid, ForeignKey("health_entries.id", ondelete="CASCADE"), nullable=False)
    symptom_name = Column(String(255), nullable=False)
    severity = Column(Integer)
    duration_minutes = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))

class MedicationCourses(Base):
    __tablename__ = "medication_courses"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    prescription_item_id = Column(Uuid, ForeignKey("prescription_items.id", ondelete="SET NULL"))
    drug_id = Column(Uuid, ForeignKey("drugs.id"))
    dosage = Column(Text)
    frequency = Column(String(255))
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(30), server_default=text("'ACTIVE'"))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))

class MedicationLogs(Base):
    __tablename__ = "medication_logs"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    course_id = Column(Uuid, ForeignKey("medication_courses.id"), nullable=False)
    scheduled_at = Column(DateTime(timezone=True))
    taken_at = Column(DateTime(timezone=True))
    status = Column(String(30), nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
