"""Dev contract alignment; preserves the v2 revision and existing data.

Preflight rejects unmapped observations and existing vectors: backfill entries
and re-ingest embeddings explicitly before upgrading a populated database.
"""
from alembic import op
import sqlalchemy as sa

revision = "20261111_dev_v3_1"
down_revision = "20261109_schema_v2"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM health_observations WHERE entry_id IS NULL) THEN
        RAISE EXCEPTION 'Backfill orphan observations before dev_v3_1';
      END IF;
      IF EXISTS (SELECT 1 FROM knowledge_chunks WHERE embedding IS NOT NULL) THEN
        RAISE EXCEPTION 'Export and re-ingest existing embeddings with the 768d model before dev_v3_1';
      END IF;
    END $$""")
    for table in ('health_conditions', 'allergies'):
        op.alter_column(table, 'verified', server_default=sa.text('false'))
    op.alter_column('health_observations', 'entry_id', nullable=False)
    for table, column, target, action in [
        ('health_observations','entry_id','health_entries','CASCADE'),
        ('symptoms','entry_id','health_entries','CASCADE'),
        ('chat_messages','session_id','chat_sessions','CASCADE'),
        ('message_citations','message_id','chat_messages','CASCADE'),
        ('ai_feedback','message_id','chat_messages','CASCADE'),
        ('medication_courses','prescription_item_id','prescription_items','SET NULL'),
    ]:
        name = f'fk_{table}_{column}'
        op.drop_constraint(name, table, type_='foreignkey')
        op.create_foreign_key(name, table, target, [column], ['id'], ondelete=action)
    op.create_primary_key('pk_drug_ingredients', 'drug_ingredients', ['drug_id','ingredient_id'])
    op.alter_column('prescriptions','original_file_url',nullable=True)
    op.add_column('prescriptions',sa.Column('source_type',sa.String(30),nullable=False,server_default='IMAGE_UPLOAD'))
    op.create_check_constraint('chk_prescription_source','prescriptions',"(source_type = 'IMAGE_UPLOAD' AND original_file_url IS NOT NULL) OR (source_type = 'MANUAL_ENTRY' AND original_file_url IS NULL)")
    op.create_check_constraint('chk_prescription_status','prescriptions',"status IN ('UPLOADED','PENDING_REVIEW','CONFIRMED','FAILED','DELETED')")
    for name in ('field_confidences','candidates'):
        op.execute(f'ALTER TABLE ocr_job_items ADD COLUMN {name} jsonb')
    op.add_column('prescription_items',sa.Column('source_ocr_item_id',sa.Uuid(),sa.ForeignKey('ocr_job_items.id')))
    op.add_column('prescription_items',sa.Column('source_type',sa.String(30),nullable=False,server_default='OCR'))
    op.execute('DROP INDEX IF EXISTS idx_knowledge_chunks_vector_hnsw')
    op.execute('ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE vector(768)')
    op.execute('CREATE INDEX idx_knowledge_chunks_vector_hnsw ON knowledge_chunks USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)')
    op.execute('CREATE INDEX idx_knowledge_chunks_content_trgm ON knowledge_chunks USING gin (content gin_trgm_ops)')
    for name, size in [('external_id',255),('content_hash',64),('language',20)]:
        op.add_column('knowledge_documents',sa.Column(name,sa.String(size)))
    op.create_unique_constraint('uq_knowledge_source_external','knowledge_documents',['source_name','external_id'])
    op.add_column('chat_messages',sa.Column('warning_level',sa.String(20),nullable=False,server_default='INFO'))
    op.execute("ALTER TABLE chat_messages ADD COLUMN suggested_followups jsonb NOT NULL DEFAULT '[]'::jsonb")
    op.create_check_constraint('chk_warning_level','chat_messages',"warning_level IN ('INFO','WARNING','CRITICAL')")
    op.add_column('ai_feedback',sa.Column('updated_at',sa.DateTime(timezone=True)))
    op.create_unique_constraint('uq_ai_feedback_message_user','ai_feedback',['message_id','user_id'])
    op.add_column('message_citations',sa.Column('interaction_id',sa.Uuid(),sa.ForeignKey('drug_interactions.id')))
    op.add_column('message_citations',sa.Column('source_url',sa.Text()))
    op.execute("""CREATE TABLE background_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind varchar(40) NOT NULL,
      payload jsonb NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING',
      attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3,
      available_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz,
      completed_at timestamptz, error_code varchar(100), created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED')))
    """)
    op.execute("CREATE INDEX idx_background_jobs_pending ON background_jobs (available_at) WHERE status = 'PENDING'")


def downgrade():
    raise RuntimeError('Data-preserving migration: restore a verified backup to revert dev_v3_1')
