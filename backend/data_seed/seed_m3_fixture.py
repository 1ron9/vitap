"""Seed synthetic chunks for offline pgvector checks."""

from uuid import UUID

from sqlalchemy.dialects.postgresql import insert

from app.core.database import engine
from app.modules.ai_assistant.models import KnowledgeChunks, KnowledgeDocuments

SOURCE_NAME = "VitaP dev fixture"
EXTERNAL_ID = "sprint4-m3-pgvector"
VECTOR_DIMENSION = 768


def seed():
    documents = KnowledgeDocuments.__table__
    chunks = KnowledgeChunks.__table__
    document = insert(documents).values(
        id=UUID("00000000-0000-4000-8000-000000000301"),
        title="VitaP offline pgvector fixture",
        document_type="DEV_FIXTURE",
        source_name=SOURCE_NAME,
        version="1",
        status="DEV_FIXTURE",
        external_id=EXTERNAL_ID,
    )
    document = document.on_conflict_do_update(
        constraint="uq_knowledge_source_external",
        set_={"title": document.excluded.title, "status": document.excluded.status},
    )
    with engine.begin() as db:
        document_id = db.scalar(document.returning(documents.c.id))
        for index in range(2):
            vector = [0.0] * VECTOR_DIMENSION
            vector[index] = 1.0
            chunk = insert(chunks).values(
                document_id=document_id,
                chunk_index=index,
                content=f"Synthetic VitaP pgvector fixture chunk {index + 1}.",
                embedding=vector,
                metadata={"dev_fixture": True},
            )
            db.execute(chunk.on_conflict_do_update(
                index_elements=[chunks.c.document_id, chunks.c.chunk_index],
                set_={
                    "content": chunk.excluded.content,
                    "embedding": chunk.excluded.embedding,
                    "metadata": chunk.excluded.metadata,
                },
            ))


if __name__ == "__main__":
    seed()
