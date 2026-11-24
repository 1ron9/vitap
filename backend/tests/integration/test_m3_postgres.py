"""Exercise mounted M3 routes against a disposable migrated PostgreSQL database."""

import asyncio
import os
from importlib import import_module
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.modules.ai_assistant.db import build_async_database_url
from app.modules.ai_assistant.repositories.knowledge_repo import KnowledgeRepository
from data_seed import seed_m3_fixture

TEST_POSTGRES_URL = os.getenv("TEST_POSTGRES_URL")
pytestmark = pytest.mark.skipif(not TEST_POSTGRES_URL, reason="Requires disposable PostgreSQL")
SESSIONS = "/api/v1/ai/chat/sessions"


@pytest.fixture
def m3_api(monkeypatch):
    monkeypatch.setattr(settings, "POSTGRES_HOST", None)
    monkeypatch.setattr(settings, "DATABASE_URL", TEST_POSTGRES_URL)
    engine = create_engine(TEST_POSTGRES_URL)
    sessions = sessionmaker(engine)

    def get_test_db():
        with sessions() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, get_test_db)
    try:
        with TestClient(app) as client:
            yield client, engine
    finally:
        engine.dispose()


def _register(client):
    credentials = {"email": f"m3-{uuid4()}@example.test", "password": "m3-integration-password"}
    consent = {
        "version": settings.USER_CONSENT_VERSION,
        "scope": "HEALTH_DATA_AND_AI_PROCESSING",
        "is_accepted": True,
    }
    response = client.post("/api/v1/auth/register", json={**credentials, "consent": consent})
    assert response.status_code == 201, response.text
    login = client.post("/api/v1/auth/login", json=credentials)
    assert login.status_code == 200, login.text
    return response.json()["id"], {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_mounted_chat_consent_ownership_and_offline_answers(m3_api):
    client, engine = m3_api
    missing = client.get(SESSIONS)
    assert (missing.status_code, missing.json()["error"]["code"]) == (401, "AUTH_REQUIRED")
    guest = client.post("/api/v1/guest-sessions", json={
        "consent_accepted": True, "consent_version": settings.GUEST_CONSENT_VERSION,
    })
    assert guest.status_code == 201
    denied = client.get(SESSIONS, headers={"X-Guest-Token": guest.json()["guest_token"]})
    assert (denied.status_code, denied.json()["error"]["code"]) == (403, "LOGIN_REQUIRED")

    user_id, owner = _register(client)
    _, other = _register(client)
    session = client.post(SESSIONS, json={"context_mode": "GENERAL"}, headers=owner)
    assert session.status_code == 201, session.text
    session_id = session.json()["id"]
    resource = f"{SESSIONS}/{session_id}"
    messages = f"{resource}/messages"
    listing = client.get(SESSIONS, headers=owner).json()
    assert [item["id"] for item in listing["items"]] == [session_id]
    assert listing["pagination"]["total"] == 1
    assert client.get(messages, headers=other).status_code == 404
    assert client.delete(resource, headers=other).status_code == 404
    assert client.get("/openapi.json").json()["paths"].get("/api/v1/ai/explain/interaction") is None

    cases = [
        ("Thông tin tổng quan về chỉ số A1C", "INSUFFICIENT_EVIDENCE", "INFO"),
        ("Tôi tức ngực và khó thở dữ dội, không nằm xuống được", "EMERGENCY_REDIRECT", "CRITICAL"),
        ("Hai thuốc này có tương tác không?", "INSUFFICIENT_EVIDENCE", "INFO"),
    ]
    assistant_ids = []
    for content, status, warning in cases:
        sent = client.post(messages, headers=owner, json={"content": content})
        assert sent.status_code == 200, sent.text
        assistant = sent.json()["assistant_message"]
        assert assistant["answer"]["answer_status"] == status
        assert assistant["answer"]["warning_level"] == warning
        assert assistant["model_used"] is None
        assistant_ids.append(assistant["id"])

    feedback = client.post(
        f"/api/v1/ai/chat/messages/{assistant_ids[0]}/feedback", json={"rating": "THUMBS_UP"}, headers=owner,
    )
    assert feedback.status_code == 200, feedback.text
    history = client.get(messages, headers=owner).json()
    assert [message["id"] for message in history["items"] if message["role"] == "ASSISTANT"] == assistant_ids
    assert history["items"][1]["answer"]["feedback"]["rating"] == "THUMBS_UP"
    assert client.delete(resource, headers=owner).status_code == 204
    assert client.get(messages, headers=owner).status_code == 404

    with engine.begin() as db:
        assert db.scalar(text("SELECT count(*) FROM chat_messages WHERE session_id = :id"), {"id": session_id}) == 0
        db.execute(text("UPDATE user_consents SET revoked_at = now() WHERE user_id = :id"), {"id": user_id})
    revoked = client.get(SESSIONS, headers=owner)
    assert (revoked.status_code, revoked.json()["error"]["code"]) == (403, "CONSENT_REQUIRED")


def test_offline_seed_is_repeatable_and_ineligible_for_retrieval(monkeypatch, m3_api):
    _, engine = m3_api
    monkeypatch.setattr(seed_m3_fixture, "engine", engine)
    seed_m3_fixture.seed()
    seed_m3_fixture.seed()

    with engine.connect() as db:
        rows = db.execute(text("""
            SELECT c.chunk_index, vector_dims(c.embedding), d.status
            FROM knowledge_documents d JOIN knowledge_chunks c ON c.document_id = d.id
            WHERE d.source_name = :source AND d.external_id = :external_id
            ORDER BY c.chunk_index
        """), {"source": seed_m3_fixture.SOURCE_NAME, "external_id": seed_m3_fixture.EXTERNAL_ID}).all()
    assert rows == [(0, 768, "DEV_FIXTURE"), (1, 768, "DEV_FIXTURE")]

    async def check_retrieval():
        engine = create_async_engine(build_async_database_url(TEST_POSTGRES_URL))
        repo = KnowledgeRepository()
        query = "Synthetic VitaP pgvector fixture chunk 1"
        try:
            async with AsyncSession(engine) as db:
                lexical = await repo.lexical_search(db, query)
                hybrid = await repo.hybrid_search(db, query, [1.0] + [0.0] * 767)
                assert not any(chunk.source_name == seed_m3_fixture.SOURCE_NAME for chunk in lexical + hybrid)
        finally:
            await engine.dispose()

    asyncio.run(check_retrieval())


def test_citation_migration_numbers_existing_rows(m3_api):
    _, engine = m3_api
    revision = import_module("migrations.versions.20261124_m3_citations")
    message_id = str(uuid4())
    rows = [
        {"id": "00000000-0000-4000-8000-000000000012", "message_id": message_id},
        {"id": "00000000-0000-4000-8000-000000000011", "message_id": str(uuid4())},
        {"id": "00000000-0000-4000-8000-000000000013", "message_id": message_id},
    ]

    with engine.begin() as db:
        # PostgreSQL resolves the unqualified migration table to this connection's temp table.
        db.execute(text("""
            CREATE TEMP TABLE message_citations (
                id uuid PRIMARY KEY, message_id uuid NOT NULL
            ) ON COMMIT DROP
        """))
        assert db.scalar(text("SELECT 'message_citations'::regclass = 'pg_temp.message_citations'::regclass"))
        db.execute(text("INSERT INTO message_citations (id, message_id) VALUES (:id, :message_id)"), rows)
        with Operations.context(MigrationContext.configure(db)):
            revision.upgrade()
        result = db.execute(text("SELECT id::text, citation_index FROM message_citations ORDER BY id")).all()
        assert result == [(rows[1]["id"], 1), (rows[0]["id"], 1), (rows[2]["id"], 2)]
