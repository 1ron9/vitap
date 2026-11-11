"""Application ORM aligned with the dev schema contract (v3.1)."""
from uuid import uuid4
from sqlalchemy import Column, Uuid, Text, String, Date, DateTime, Integer, Boolean, Numeric, JSON, ForeignKey, UniqueConstraint, CheckConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector
from app.core.database import Base

class DrugSources(Base):
    __tablename__ = "drug_sources"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    source_name = Column(String(255), nullable=False)
    version = Column(String(100))
    source_url = Column(Text)
    license_info = Column(Text)
    published_at = Column(Date)
    updated_at = Column(DateTime(timezone=True), server_default=text('now()'))

class Ingredients(Base):
    __tablename__ = "ingredients"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    name = Column(String(255), nullable=False)
    normalized_name = Column(String(255), nullable=False, unique=True)
    atc_code = Column(String(30))
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))

class Drugs(Base):
    __tablename__ = "drugs"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    brand_name = Column(String(255), nullable=False)
    normalized_brand_name = Column(String(255))
    generic_name = Column(String(255))
    dosage_form = Column(String(100))
    strength = Column(String(100))
    route = Column(String(100))
    manufacturer = Column(String(255))
    country = Column(String(100))
    registration_number = Column(String(100))
    indications = Column(Text)
    contraindications = Column(Text)
    side_effects = Column(Text)
    precautions = Column(Text)
    source_id = Column(Uuid, ForeignKey("drug_sources.id"))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))

class DrugIngredients(Base):
    __tablename__ = "drug_ingredients"
    drug_id = Column(Uuid, ForeignKey("drugs.id"), primary_key=True, nullable=False)
    ingredient_id = Column(Uuid, ForeignKey("ingredients.id"), primary_key=True, nullable=False)
    amount = Column(Numeric(12,4), primary_key=True)
    unit = Column(String(30), primary_key=True)

class DrugInteractions(Base):
    __tablename__ = "drug_interactions"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    ingredient_a_id = Column(Uuid, ForeignKey("ingredients.id"), nullable=False)
    ingredient_b_id = Column(Uuid, ForeignKey("ingredients.id"), nullable=False)
    severity = Column(String(30), nullable=False)
    description = Column(Text, nullable=False)
    mechanism = Column(Text)
    recommendation = Column(Text)
    evidence_level = Column(String(50))
    source_id = Column(Uuid, ForeignKey("drug_sources.id"))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    __table_args__ = (UniqueConstraint("ingredient_a_id", "ingredient_b_id"), CheckConstraint("ingredient_a_id < ingredient_b_id", name="chk_ingredient_canonical_order"),)

class Prescriptions(Base):
    __tablename__ = "prescriptions"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    user_id = Column(Uuid, ForeignKey("users.id"))
    guest_session_id = Column(Uuid, ForeignKey("guest_sessions.id"))
    is_guest = Column(Boolean, nullable=False, server_default=text('false'))
    original_file_url = Column(Text)
    file_type = Column(String(30))
    prescription_date = Column(Date)
    prescriber_name = Column(String(255))
    healthcare_facility = Column(String(255))
    raw_ocr_text = Column(Text)
    status = Column(String(30), server_default=text("'PENDING_REVIEW'"))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    updated_at = Column(DateTime(timezone=True))
    source_type = Column(String(30), nullable=False, server_default=text("'IMAGE_UPLOAD'"))

class OcrJobs(Base):
    __tablename__ = "ocr_jobs"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    prescription_id = Column(Uuid, ForeignKey("prescriptions.id"), nullable=False)
    model_name = Column(String(100))
    model_version = Column(String(100))
    status = Column(String(30), nullable=False, server_default=text("'PENDING'"))
    confidence = Column(Numeric(5,4))
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))

class OcrJobItems(Base):
    __tablename__ = "ocr_job_items"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    ocr_job_id = Column(Uuid, ForeignKey("ocr_jobs.id"), nullable=False)
    item_order = Column(Integer)
    extracted_name = Column(String(255))
    extracted_strength = Column(String(100))
    extracted_dosage = Column(Text)
    frequency = Column(String(255))
    duration_days = Column(Integer)
    route = Column(String(100))
    instructions = Column(Text)
    confidence = Column(Numeric(5,4))
    bounding_box = Column(JSON().with_variant(JSONB, "postgresql"))
    candidate_drug_id = Column(Uuid, ForeignKey("drugs.id"))
    resolution_status = Column(String(40), server_default=text("'UNRESOLVED_DRUG'"))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    field_confidences = Column(JSON().with_variant(JSONB, "postgresql"))
    candidates = Column(JSON().with_variant(JSONB, "postgresql"))

class PrescriptionItems(Base):
    __tablename__ = "prescription_items"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    prescription_id = Column(Uuid, ForeignKey("prescriptions.id"), nullable=False)
    drug_id = Column(Uuid, ForeignKey("drugs.id"))
    extracted_name = Column(String(255), nullable=False)
    extracted_strength = Column(String(100))
    extracted_dosage = Column(Text)
    frequency = Column(String(255))
    duration_days = Column(Integer)
    route = Column(String(100))
    instructions = Column(Text)
    confidence = Column(Numeric(5,4))
    resolution_status = Column(String(40), nullable=False, server_default=text("'UNRESOLVED_DRUG'"))
    verification_status = Column(String(30), nullable=False, server_default=text("'PENDING'"))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
    updated_at = Column(DateTime(timezone=True))
    source_ocr_item_id = Column(Uuid, ForeignKey("ocr_job_items.id"))
    source_type = Column(String(30), nullable=False, server_default=text("'OCR'"))

class AuditLogs(Base):
    __tablename__ = "audit_logs"
    id = Column(Uuid, primary_key=True, default=uuid4, server_default=text('gen_random_uuid()'))
    user_id = Column(Uuid, ForeignKey("users.id"))
    guest_session_id = Column(Uuid, ForeignKey("guest_sessions.id"))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100))
    resource_id = Column(Uuid)
    ip_address = Column(String(45))
    created_at = Column(DateTime(timezone=True), server_default=text('now()'))
