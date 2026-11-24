"""Give stored M3 citations stable per-message numbers."""

from alembic import op
import sqlalchemy as sa

revision = "20261124_m3_citations"
down_revision = "20261122_m1_symptoms"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("message_citations", sa.Column("citation_index", sa.Integer()))
    op.execute("""
        WITH ranked AS (
            SELECT id, row_number() OVER (PARTITION BY message_id ORDER BY id) AS citation_index
            FROM message_citations
        )
        UPDATE message_citations AS citation
        SET citation_index = ranked.citation_index
        FROM ranked WHERE ranked.id = citation.id
    """)
    op.alter_column("message_citations", "citation_index", nullable=False)
    op.create_unique_constraint(
        "uq_message_citations_message_index", "message_citations", ["message_id", "citation_index"]
    )
    op.create_check_constraint("chk_message_citation_index", "message_citations", "citation_index > 0")


def downgrade():
    op.drop_constraint("chk_message_citation_index", "message_citations", type_="check")
    op.drop_constraint("uq_message_citations_message_index", "message_citations", type_="unique")
    op.drop_column("message_citations", "citation_index")
