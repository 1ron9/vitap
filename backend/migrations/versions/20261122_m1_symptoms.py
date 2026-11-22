"""Index symptoms by their owning entry for Journal reads."""

from alembic import op

revision = '20261122_m1_symptoms'
down_revision = '20261117_m1_phase_a'
branch_labels = depends_on = None


def upgrade():
    op.create_index('ix_symptoms_entry_created', 'symptoms', ['entry_id', 'created_at', 'id'])


def downgrade():
    op.drop_index('ix_symptoms_entry_created', table_name='symptoms')
