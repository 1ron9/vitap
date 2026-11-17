"""M1 controls and glucose input provenance; preserves existing health records."""
from alembic import op
import sqlalchemy as sa

revision = '20261117_m1_phase_a'
down_revision = '20261111_dev_v3_1'
branch_labels = depends_on = None


def upgrade():
    op.execute("""DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM health_observations o JOIN health_entries e ON e.id=o.entry_id
                 WHERE o.user_id<>e.user_id) THEN
        RAISE EXCEPTION 'Repair mismatched observation/entry ownership before M1 migration';
      END IF;
    END $$""")
    op.add_column('allergies', sa.Column('allergen_type', sa.String(20)))
    op.create_check_constraint('chk_allergen_type', 'allergies', "allergen_type IS NULL OR allergen_type IN ('DRUG','FOOD','OTHER')")
    op.add_column('health_observations', sa.Column('entered_value', sa.Numeric(12, 4)))
    op.add_column('health_observations', sa.Column('entered_unit', sa.String(30)))
    op.create_check_constraint('chk_glucose_entered_pair', 'health_observations',
        '(entered_value IS NULL AND entered_unit IS NULL) OR '
        "(observation_type='GLUCOSE' AND entered_value IS NOT NULL AND entered_unit IS NOT NULL AND entered_value>0 AND entered_unit IN ('mmol/L','mg/dL'))")
    op.create_table('user_health_settings',
        sa.Column('user_id', sa.Uuid(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('allow_ai_health_context', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('enable_allergy_alerts', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('no_known_allergies_confirmed_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)))
    op.execute('INSERT INTO user_health_settings(user_id) SELECT id FROM users')
    # Repair missing profile shells without inventing demographic information.
    op.execute('INSERT INTO user_profiles(id,user_id) SELECT gen_random_uuid(),u.id FROM users u '
               'WHERE NOT EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id=u.id)')


def downgrade():
    raise RuntimeError('Restore a verified backup; downgrade would discard M1 declarations and input provenance')
