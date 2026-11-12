"""Initial VitaP Schema v2, plus AU-01 refresh and Guest consent storage.

Timestamps use UTC timestamptz as required by the API contract. This revision targets
an empty PostgreSQL database; it does not transform the discarded demo tables.
"""
from alembic import op

revision = "20261109_schema_v2"
down_revision = None
branch_labels = None
depends_on = None

STATEMENTS = [
  "CREATE TABLE users (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    email varchar(255) NOT NULL UNIQUE,\n    password_hash varchar(255) NOT NULL,\n    role varchar(30) NOT NULL DEFAULT 'USER',\n    status varchar(30) NOT NULL DEFAULT 'ACTIVE',\n    email_verified_at timestamptz,\n    created_at timestamptz DEFAULT now(),\n    updated_at timestamptz,\n    deleted_at timestamptz\n)",
  "CREATE TABLE user_profiles (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id uuid NOT NULL UNIQUE,\n    full_name varchar(255),\n    date_of_birth date,\n    biological_sex varchar(20),\n    phone varchar(30),\n    height_cm decimal(5,2),\n    created_at timestamptz DEFAULT now(),\n    updated_at timestamptz\n)",
  "CREATE TABLE user_consents (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id uuid NOT NULL,\n    consent_version varchar(50) NOT NULL,\n    scope varchar(100) NOT NULL DEFAULT 'HEALTH_DATA_AND_AI_PROCESSING',\n    is_accepted boolean NOT NULL DEFAULT true,\n    ip_address varchar(45),\n    consented_at timestamptz NOT NULL DEFAULT now(),\n    revoked_at timestamptz\n)",
  "CREATE TABLE guest_sessions (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    session_token_hash varchar(255) NOT NULL UNIQUE,\n    consent_accepted boolean NOT NULL DEFAULT true,\n    expires_at timestamptz NOT NULL,\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE health_conditions (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id uuid NOT NULL,\n    condition_name varchar(255) NOT NULL,\n    icd10_code varchar(20),\n    description text,\n    diagnosed_at date,\n    status varchar(30) DEFAULT 'ACTIVE',\n    source_type varchar(30) DEFAULT 'MANUAL',\n    verified boolean DEFAULT true,\n    created_at timestamptz DEFAULT now(),\n    updated_at timestamptz\n)",
  "CREATE TABLE allergies (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id uuid NOT NULL,\n    ingredient_id uuid,\n    allergen_name varchar(255) NOT NULL,\n    reaction text,\n    severity varchar(30),\n    source_type varchar(30) DEFAULT 'MANUAL',\n    verified boolean DEFAULT true,\n    created_at timestamptz DEFAULT now(),\n    updated_at timestamptz\n)",
  "CREATE TABLE health_entries (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id uuid NOT NULL,\n    title varchar(255),\n    content text,\n    entry_type varchar(30) DEFAULT 'DAILY',\n    mood varchar(30),\n    recorded_at timestamptz NOT NULL,\n    created_at timestamptz DEFAULT now(),\n    updated_at timestamptz\n)",
  "CREATE TABLE health_observations (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id uuid NOT NULL,\n    entry_id uuid,\n    observation_type varchar(50) NOT NULL,\n    value decimal(12,4) NOT NULL,\n    secondary_value decimal(12,4),\n    unit varchar(30) NOT NULL,\n    measured_at timestamptz NOT NULL,\n    source_type varchar(30) DEFAULT 'MANUAL',\n    source_reference varchar(255),\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE symptoms (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    entry_id uuid NOT NULL,\n    symptom_name varchar(255) NOT NULL,\n    severity integer,\n    duration_minutes integer,\n    notes text,\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE drug_sources (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    source_name varchar(255) NOT NULL,\n    version varchar(100),\n    source_url text,\n    license_info text,\n    published_at date,\n    updated_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE ingredients (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    name varchar(255) NOT NULL,\n    normalized_name varchar(255) NOT NULL UNIQUE,\n    atc_code varchar(30),\n    description text,\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE drugs (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    brand_name varchar(255) NOT NULL,\n    normalized_brand_name varchar(255),\n    generic_name varchar(255),\n    dosage_form varchar(100),\n    strength varchar(100),\n    route varchar(100),\n    manufacturer varchar(255),\n    country varchar(100),\n    registration_number varchar(100),\n    indications text,\n    contraindications text,\n    side_effects text,\n    precautions text,\n    source_id uuid,\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE drug_ingredients (\n    drug_id uuid NOT NULL,\n    ingredient_id uuid NOT NULL,\n    amount decimal(12,4),\n    unit varchar(30)\n)",
  "CREATE TABLE drug_interactions (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    ingredient_a_id uuid NOT NULL,\n    ingredient_b_id uuid NOT NULL,\n    severity varchar(30) NOT NULL,\n    description text NOT NULL,\n    mechanism text,\n    recommendation text,\n    evidence_level varchar(50),\n    source_id uuid,\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE prescriptions (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id uuid,\n    guest_session_id uuid,\n    is_guest boolean NOT NULL DEFAULT false,\n    original_file_url text NOT NULL,\n    file_type varchar(30),\n    prescription_date date,\n    prescriber_name varchar(255),\n    healthcare_facility varchar(255),\n    raw_ocr_text text,\n    status varchar(30) DEFAULT 'PENDING_REVIEW',\n    expires_at timestamptz,\n    created_at timestamptz DEFAULT now(),\n    updated_at timestamptz\n)",
  "CREATE TABLE ocr_jobs (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    prescription_id uuid NOT NULL,\n    model_name varchar(100),\n    model_version varchar(100),\n    status varchar(30) NOT NULL DEFAULT 'PENDING',\n    confidence decimal(5,4),\n    error_message text,\n    started_at timestamptz,\n    completed_at timestamptz,\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE ocr_job_items (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    ocr_job_id uuid NOT NULL,\n    item_order integer,\n    extracted_name varchar(255),\n    extracted_strength varchar(100),\n    extracted_dosage text,\n    frequency varchar(255),\n    duration_days integer,\n    route varchar(100),\n    instructions text,\n    confidence decimal(5,4),\n    bounding_box jsonb,\n    candidate_drug_id uuid,\n    resolution_status varchar(40) DEFAULT 'UNRESOLVED_DRUG',\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE prescription_items (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    prescription_id uuid NOT NULL,\n    drug_id uuid,\n    extracted_name varchar(255) NOT NULL,\n    extracted_strength varchar(100),\n    extracted_dosage text,\n    frequency varchar(255),\n    duration_days integer,\n    route varchar(100),\n    instructions text,\n    confidence decimal(5,4),\n    resolution_status varchar(40) NOT NULL DEFAULT 'UNRESOLVED_DRUG',\n    verification_status varchar(30) NOT NULL DEFAULT 'PENDING',\n    created_at timestamptz DEFAULT now(),\n    updated_at timestamptz\n)",
  "CREATE TABLE medication_courses (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id uuid NOT NULL,\n    prescription_item_id uuid,\n    drug_id uuid,\n    dosage text,\n    frequency varchar(255),\n    start_date date,\n    end_date date,\n    status varchar(30) DEFAULT 'ACTIVE',\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE medication_logs (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    course_id uuid NOT NULL,\n    scheduled_at timestamptz,\n    taken_at timestamptz,\n    status varchar(30) NOT NULL,\n    notes text,\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE chat_sessions (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id uuid NOT NULL,\n    title varchar(255),\n    context_mode varchar(30) DEFAULT 'PERSONAL',\n    created_at timestamptz DEFAULT now(),\n    updated_at timestamptz\n)",
  "CREATE TABLE chat_messages (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    session_id uuid NOT NULL,\n    role varchar(20) NOT NULL,\n    content text NOT NULL,\n    answer_status varchar(40),\n    context_used jsonb,\n    model_name varchar(100),\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE message_citations (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    message_id uuid NOT NULL,\n    document_id uuid,\n    chunk_id uuid,\n    drug_id uuid,\n    citation_type varchar(30) NOT NULL,\n    source_title varchar(255),\n    excerpt text\n)",
  "CREATE TABLE ai_feedback (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    message_id uuid NOT NULL,\n    user_id uuid NOT NULL,\n    rating varchar(20) NOT NULL,\n    comment text,\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE knowledge_documents (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    title varchar(500) NOT NULL,\n    document_type varchar(100),\n    source_name varchar(255) NOT NULL,\n    source_url text,\n    version varchar(100),\n    published_at date,\n    effective_from date,\n    effective_until date,\n    status varchar(30) DEFAULT 'ACTIVE',\n    license_info text,\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE knowledge_chunks (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    document_id uuid NOT NULL,\n    chunk_index integer NOT NULL,\n    content text NOT NULL,\n    embedding vector(1024),\n    metadata jsonb,\n    created_at timestamptz DEFAULT now()\n)",
  "CREATE TABLE audit_logs (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id uuid,\n    guest_session_id uuid,\n    action varchar(100) NOT NULL,\n    resource_type varchar(100),\n    resource_id uuid,\n    ip_address varchar(45),\n    created_at timestamptz DEFAULT now()\n)",
  "ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE user_consents ADD CONSTRAINT fk_user_consents_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE health_conditions ADD CONSTRAINT fk_health_conditions_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE allergies ADD CONSTRAINT fk_allergies_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE allergies ADD CONSTRAINT fk_allergies_ingredient_id FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)",
  "ALTER TABLE health_entries ADD CONSTRAINT fk_health_entries_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE health_observations ADD CONSTRAINT fk_health_observations_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE health_observations ADD CONSTRAINT fk_health_observations_entry_id FOREIGN KEY (entry_id) REFERENCES health_entries (id)",
  "ALTER TABLE symptoms ADD CONSTRAINT fk_symptoms_entry_id FOREIGN KEY (entry_id) REFERENCES health_entries (id)",
  "ALTER TABLE drugs ADD CONSTRAINT fk_drugs_source_id FOREIGN KEY (source_id) REFERENCES drug_sources (id)",
  "ALTER TABLE drug_ingredients ADD CONSTRAINT fk_drug_ingredients_drug_id FOREIGN KEY (drug_id) REFERENCES drugs (id)",
  "ALTER TABLE drug_ingredients ADD CONSTRAINT fk_drug_ingredients_ingredient_id FOREIGN KEY (ingredient_id) REFERENCES ingredients (id)",
  "ALTER TABLE drug_interactions ADD CONSTRAINT fk_drug_interactions_ingredient_a_id FOREIGN KEY (ingredient_a_id) REFERENCES ingredients (id)",
  "ALTER TABLE drug_interactions ADD CONSTRAINT fk_drug_interactions_ingredient_b_id FOREIGN KEY (ingredient_b_id) REFERENCES ingredients (id)",
  "ALTER TABLE drug_interactions ADD CONSTRAINT fk_drug_interactions_source_id FOREIGN KEY (source_id) REFERENCES drug_sources (id)",
  "ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_guest_session_id FOREIGN KEY (guest_session_id) REFERENCES guest_sessions (id)",
  "ALTER TABLE ocr_jobs ADD CONSTRAINT fk_ocr_jobs_prescription_id FOREIGN KEY (prescription_id) REFERENCES prescriptions (id)",
  "ALTER TABLE ocr_job_items ADD CONSTRAINT fk_ocr_job_items_ocr_job_id FOREIGN KEY (ocr_job_id) REFERENCES ocr_jobs (id)",
  "ALTER TABLE ocr_job_items ADD CONSTRAINT fk_ocr_job_items_candidate_drug_id FOREIGN KEY (candidate_drug_id) REFERENCES drugs (id)",
  "ALTER TABLE prescription_items ADD CONSTRAINT fk_prescription_items_prescription_id FOREIGN KEY (prescription_id) REFERENCES prescriptions (id)",
  "ALTER TABLE prescription_items ADD CONSTRAINT fk_prescription_items_drug_id FOREIGN KEY (drug_id) REFERENCES drugs (id)",
  "ALTER TABLE medication_courses ADD CONSTRAINT fk_medication_courses_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE medication_courses ADD CONSTRAINT fk_medication_courses_prescription_item_id FOREIGN KEY (prescription_item_id) REFERENCES prescription_items (id)",
  "ALTER TABLE medication_courses ADD CONSTRAINT fk_medication_courses_drug_id FOREIGN KEY (drug_id) REFERENCES drugs (id)",
  "ALTER TABLE medication_logs ADD CONSTRAINT fk_medication_logs_course_id FOREIGN KEY (course_id) REFERENCES medication_courses (id)",
  "ALTER TABLE chat_sessions ADD CONSTRAINT fk_chat_sessions_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_session_id FOREIGN KEY (session_id) REFERENCES chat_sessions (id)",
  "ALTER TABLE message_citations ADD CONSTRAINT fk_message_citations_message_id FOREIGN KEY (message_id) REFERENCES chat_messages (id)",
  "ALTER TABLE message_citations ADD CONSTRAINT fk_message_citations_document_id FOREIGN KEY (document_id) REFERENCES knowledge_documents (id)",
  "ALTER TABLE message_citations ADD CONSTRAINT fk_message_citations_chunk_id FOREIGN KEY (chunk_id) REFERENCES knowledge_chunks (id)",
  "ALTER TABLE message_citations ADD CONSTRAINT fk_message_citations_drug_id FOREIGN KEY (drug_id) REFERENCES drugs (id)",
  "ALTER TABLE ai_feedback ADD CONSTRAINT fk_ai_feedback_message_id FOREIGN KEY (message_id) REFERENCES chat_messages (id)",
  "ALTER TABLE ai_feedback ADD CONSTRAINT fk_ai_feedback_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE knowledge_chunks ADD CONSTRAINT fk_knowledge_chunks_document_id FOREIGN KEY (document_id) REFERENCES knowledge_documents (id)",
  "ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_user_id FOREIGN KEY (user_id) REFERENCES users (id)",
  "ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_guest_session_id FOREIGN KEY (guest_session_id) REFERENCES guest_sessions (id)",
  "CREATE UNIQUE INDEX ix_users_email ON users (email)",
  "CREATE INDEX ix_users_status ON users (status)",
  "CREATE INDEX ix_user_consents_user_id_consent_version ON user_consents (user_id, consent_version)",
  "CREATE INDEX ix_guest_sessions_expires_at ON guest_sessions (expires_at)",
  "CREATE INDEX ix_health_conditions_user_id_status ON health_conditions (user_id, status)",
  "CREATE INDEX ix_allergies_user_id ON allergies (user_id)",
  "CREATE INDEX ix_allergies_user_id_ingredient_id ON allergies (user_id, ingredient_id)",
  "CREATE INDEX ix_health_entries_user_id_recorded_at ON health_entries (user_id, recorded_at)",
  "CREATE INDEX ix_health_observations_user_id_observation_type_measured_at ON health_observations (user_id, observation_type, measured_at)",
  "CREATE INDEX ix_health_observations_entry_id ON health_observations (entry_id)",
  "CREATE UNIQUE INDEX ix_ingredients_normalized_name ON ingredients (normalized_name)",
  "CREATE INDEX ix_drugs_brand_name ON drugs (brand_name)",
  "CREATE INDEX ix_drugs_registration_number ON drugs (registration_number)",
  "CREATE INDEX ix_drug_ingredients_drug_id_ingredient_id ON drug_ingredients (drug_id, ingredient_id)",
  "CREATE INDEX ix_drug_ingredients_ingredient_id ON drug_ingredients (ingredient_id)",
  "CREATE UNIQUE INDEX ix_drug_interactions_ingredient_a_id_ingredient_b_id ON drug_interactions (ingredient_a_id, ingredient_b_id)",
  "CREATE INDEX ix_prescriptions_user_id ON prescriptions (user_id)",
  "CREATE INDEX ix_prescriptions_guest_session_id ON prescriptions (guest_session_id)",
  "CREATE INDEX ix_prescriptions_is_guest_expires_at ON prescriptions (is_guest, expires_at)",
  "CREATE INDEX ix_ocr_jobs_prescription_id_created_at ON ocr_jobs (prescription_id, created_at)",
  "CREATE INDEX ix_ocr_jobs_status ON ocr_jobs (status)",
  "CREATE INDEX ix_ocr_job_items_ocr_job_id ON ocr_job_items (ocr_job_id)",
  "CREATE INDEX ix_prescription_items_prescription_id ON prescription_items (prescription_id)",
  "CREATE INDEX ix_prescription_items_drug_id ON prescription_items (drug_id)",
  "CREATE INDEX ix_medication_courses_user_id_status ON medication_courses (user_id, status)",
  "CREATE INDEX ix_chat_sessions_user_id_updated_at ON chat_sessions (user_id, updated_at)",
  "CREATE INDEX ix_chat_messages_session_id_created_at ON chat_messages (session_id, created_at)",
  "CREATE INDEX ix_message_citations_message_id ON message_citations (message_id)",
  "CREATE UNIQUE INDEX ix_knowledge_chunks_document_id_chunk_index ON knowledge_chunks (document_id, chunk_index)",
  "CREATE TABLE refresh_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash varchar(64) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())",
  "CREATE INDEX ix_refresh_sessions_user_id ON refresh_sessions (user_id)",
  "ALTER TABLE guest_sessions ADD COLUMN consent_version varchar(50) NOT NULL DEFAULT 'guest-processing-v1'",
  "ALTER TABLE guest_sessions ADD COLUMN consented_at timestamptz NOT NULL DEFAULT now()",
  "ALTER TABLE drug_interactions ADD CONSTRAINT chk_ingredient_canonical_order CHECK (ingredient_a_id < ingredient_b_id)",
  "ALTER TABLE prescriptions ADD CONSTRAINT chk_prescription_owner CHECK ((is_guest = false AND user_id IS NOT NULL AND guest_session_id IS NULL) OR (is_guest = true AND user_id IS NULL AND guest_session_id IS NOT NULL))",
  "ALTER TABLE ocr_jobs ADD CONSTRAINT chk_ocr_jobs_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))",
  "ALTER TABLE ocr_job_items ADD CONSTRAINT chk_ocr_job_items_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))",
  "ALTER TABLE prescription_items ADD CONSTRAINT chk_prescription_items_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))",
  "CREATE INDEX idx_knowledge_chunks_vector_hnsw ON knowledge_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)",
  "CREATE INDEX idx_drugs_brand_name_trgm ON drugs USING gin (brand_name gin_trgm_ops)",
  "CREATE INDEX idx_drugs_generic_name_trgm ON drugs USING gin (generic_name gin_trgm_ops)",
  "CREATE INDEX idx_ingredients_name_trgm ON ingredients USING gin (normalized_name gin_trgm_ops)",
  "CREATE INDEX idx_observations_timeseries ON health_observations (user_id, observation_type, measured_at DESC)",
  "CREATE INDEX idx_prescriptions_guest_ttl ON prescriptions (expires_at) WHERE is_guest = true"
]


def upgrade():
    for extension in ("pgcrypto", "vector", "pg_trgm", "unaccent"):
        op.execute(f'CREATE EXTENSION IF NOT EXISTS "{extension}"')
    for statement in STATEMENTS:
        op.execute(statement)


def downgrade():
    op.execute("DROP TABLE IF EXISTS refresh_sessions")
    for name in ["audit_logs","knowledge_chunks","knowledge_documents","ai_feedback","message_citations","chat_messages","chat_sessions","medication_logs","medication_courses","prescription_items","ocr_job_items","ocr_jobs","prescriptions","drug_interactions","drug_ingredients","drugs","ingredients","drug_sources","symptoms","health_observations","health_entries","allergies","health_conditions","guest_sessions","user_consents","user_profiles","users"]:
        op.execute(f"DROP TABLE IF EXISTS {name} CASCADE")
