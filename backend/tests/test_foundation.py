import pytest
from app.integrations.storage import LocalPrivateStorage
from app.integrations.providers import validate_embeddings
from app.shared.principal import require_ai_consent
from app.modules.auth.router import AuthError
from app.modules.auth.models import UserConsent

def test_validation_never_echoes_password(client):
    secret='do-not-echo'
    response=client.post('/api/v1/auth/register',json={'password':secret})
    assert response.status_code == 422
    assert secret not in response.text
    assert response.json()['error']['request_id'] == response.headers['X-Request-ID']

def test_legacy_stub_not_exposed(client):
    assert client.get('/api/v1/ddi/check?drug_ids=1').status_code == 404
    assert client.post('/api/v1/chatbot/ask?question=demo').status_code == 404

def test_storage_rejects_traversal_and_deletes_idempotently(tmp_path):
    store=LocalPrivateStorage(str(tmp_path))
    with pytest.raises(ValueError): store.read('../secret')
    key=store.put(b'fixture')
    assert store.read(key) == b'fixture'
    store.delete(key); store.delete(key)

def test_embedding_contract():
    validate_embeddings([[0.0]*768],1)
    with pytest.raises(ValueError): validate_embeddings([[0.0]*1024],1)
    with pytest.raises(ValueError): validate_embeddings([[float('nan')]*768],1)

def test_revoked_consent_blocks_internal_ai_service(client,db_session):
    from uuid import uuid4
    from datetime import datetime, timezone
    from app.modules.auth.models import User
    user=User(id=uuid4(),email='consent@example.test',password_hash='unused',role='USER',status='ACTIVE')
    db_session.add(user)
    db_session.flush()
    consent=UserConsent(user_id=user.id,consent_version='health-ai-v1',scope='HEALTH_DATA_AND_AI_PROCESSING',is_accepted=True)
    db_session.add(consent); db_session.commit()
    assert require_ai_consent(user,db_session).id == user.id
    consent.revoked_at=datetime.now(timezone.utc)
    db_session.commit()
    with pytest.raises(AuthError) as exc: require_ai_consent(user,db_session)
    assert exc.value.code == 'CONSENT_REQUIRED'
