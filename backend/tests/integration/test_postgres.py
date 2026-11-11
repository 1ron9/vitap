"""Run only against a disposable migrated PostgreSQL database."""
import os
from uuid import uuid4
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

pytestmark=pytest.mark.skipif(not os.getenv('TEST_POSTGRES_URL'),reason='Requires disposable PostgreSQL')

@pytest.fixture
def engine():
    db=create_engine(os.environ['TEST_POSTGRES_URL'])
    yield db
    db.dispose()

def test_migration_matches_model_columns(engine):
    from app.core.model_registry import Base
    inspector=inspect(engine)
    for table in Base.metadata.sorted_tables:
        actual={c['name'] for c in inspector.get_columns(table.name)}
        assert actual == set(table.columns.keys()), table.name
    with engine.connect() as db:
        assert db.scalar(text('SELECT version_num FROM alembic_version')) == '20261111_dev_v3_1'
        assert db.scalar(text("SELECT atttypmod FROM pg_attribute WHERE attrelid='knowledge_chunks'::regclass AND attname='embedding'")) == 768

def test_constraints_on_real_database(engine):
    with engine.connect() as db:
        transaction=db.begin()
        user=str(uuid4())
        db.execute(text("INSERT INTO users (id,email,password_hash) VALUES (:id,:email,'unused')"),{'id':user,'email':user+'@example.test'})
        row=db.execute(text("INSERT INTO health_conditions (user_id,condition_name) VALUES (:id,'fixture') RETURNING verified"),{'id':user}).scalar_one()
        assert row is False
        with pytest.raises(IntegrityError):
            with db.begin_nested():
                db.execute(text("INSERT INTO prescriptions (is_guest,original_file_url) VALUES (false,'opaque-key')"))
        transaction.rollback()

def test_seed_idempotent_and_auth_uses_migrated_tables(engine):
    from data_seed.seed_dev import seed
    from app.main import app
    from app.core.database import get_db
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import Session
    seed(); seed()
    with engine.connect() as db:
        assert db.scalar(text("SELECT count(*) FROM drugs WHERE source_id='00000000-0000-4000-8000-000000000001'"))==2
    def session():
        with Session(engine) as db: yield db
    app.dependency_overrides[get_db]=session
    try:
        with TestClient(app) as client:
            email=f'{uuid4()}@example.test'
            payload={'email':email,'password':'integration-password','consent':{'version':'health-ai-v1','scope':'HEALTH_DATA_AND_AI_PROCESSING','is_accepted':True}}
            assert client.post('/api/v1/auth/register',json=payload).status_code==201
            pair=client.post('/api/v1/auth/login',json={'email':email,'password':payload['password']}).json()
            assert client.get('/api/v1/auth/me',headers={'Authorization':'Bearer '+pair['access_token']}).status_code==200
    finally:
        app.dependency_overrides.clear()

def test_worker_claim_delete_and_failed_job(engine,tmp_path,monkeypatch):
    from app.workers import runner
    from app.integrations.storage import LocalPrivateStorage
    monkeypatch.setattr(runner,'engine',engine)
    monkeypatch.setattr(runner.settings,'STORAGE_ROOT',str(tmp_path))
    key=LocalPrivateStorage(str(tmp_path)).put(b'private fixture')
    good,bad=str(uuid4()),str(uuid4())
    with engine.begin() as db:
        db.execute(text("INSERT INTO background_jobs(id,kind,payload) VALUES (:id,'DELETE_FILE',jsonb_build_object('storage_key',CAST(:key AS text)))"),{'id':good,'key':key})
    assert runner.run_once()
    assert not (tmp_path/key).exists()
    with engine.begin() as db:
        assert db.scalar(text('SELECT status FROM background_jobs WHERE id=:id'),{'id':good})=='COMPLETED'
        db.execute(text("INSERT INTO background_jobs(id,kind,payload,max_attempts) VALUES (:id,'NOT_IMPLEMENTED','{}',1)"),{'id':bad})
    assert runner.run_once()
    with engine.begin() as db:
        assert db.scalar(text('SELECT status FROM background_jobs WHERE id=:id'),{'id':bad})=='FAILED'
        db.execute(text('DELETE FROM background_jobs WHERE id IN (:good,:bad)'),{'good':good,'bad':bad})

def test_cascade_and_vector_index(engine):
    info=inspect(engine)
    fk=next(f for f in info.get_foreign_keys('health_observations') if f['constrained_columns']==['entry_id'])
    assert fk['options']['ondelete']=='CASCADE'
    with engine.connect() as db:
        definition=db.scalar(text("SELECT indexdef FROM pg_indexes WHERE indexname='idx_knowledge_chunks_vector_hnsw'"))
        assert 'hnsw' in definition and 'vector_cosine_ops' in definition
