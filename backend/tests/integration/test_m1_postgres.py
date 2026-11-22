"""Real migrated PostgreSQL checks: transactions, row locks and persisted M1 fields."""
import os
import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import UUID, uuid4
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token
from app.modules.auth.models import User, UserProfile, UserConsent
from app.modules.health.models import UserHealthSettings, HealthEntries, HealthObservations
from app.modules.health.repositories import HealthRepository
from app.modules.auth.router import Principal

pytestmark = pytest.mark.skipif(not os.getenv('TEST_POSTGRES_URL'), reason='Requires disposable migrated PostgreSQL')


def test_phase_a_revision_preserves_legacy_and_backfills_missing_shells():
    """Execute the actual revision on isolated pre-M1 tables, never on public schema."""
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy.exc import IntegrityError, InternalError
    engine = create_engine(os.environ['TEST_POSTGRES_URL'])
    schema = 'test_m1_' + uuid4().hex
    spec = importlib.util.spec_from_file_location('m1_revision', Path(__file__).parents[2] / 'migrations/versions/20261117_m1_phase_a.py')
    revision = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(revision)
    a, b, entry, reading = (uuid4() for _ in range(4))
    try:
        with engine.begin() as db:
            db.execute(text(f'CREATE SCHEMA {schema}'))
            db.execute(text(f'SET LOCAL search_path TO {schema}, public'))
            db.execute(text('CREATE TABLE users(id uuid PRIMARY KEY)'))
            db.execute(text('CREATE TABLE user_profiles(id uuid PRIMARY KEY, user_id uuid REFERENCES users(id), full_name text, phone text)'))
            db.execute(text('CREATE TABLE allergies(id uuid PRIMARY KEY, user_id uuid, allergen_name text)'))
            db.execute(text('CREATE TABLE health_entries(id uuid PRIMARY KEY, user_id uuid)'))
            db.execute(text('CREATE TABLE health_observations(id uuid PRIMARY KEY, entry_id uuid, user_id uuid, observation_type text, value numeric(12,4), unit text)'))
            db.execute(text('INSERT INTO users VALUES (:a),(:b)'), {'a':a,'b':b})
            db.execute(text("INSERT INTO user_profiles VALUES (gen_random_uuid(),:a,'Keep name','Keep phone')"), {'a':a})
            db.execute(text("INSERT INTO allergies VALUES (gen_random_uuid(),:a,'Legacy allergy')"), {'a':a})
            db.execute(text('INSERT INTO health_entries VALUES (:entry,:a)'), {'entry':entry,'a':a})
            db.execute(text("INSERT INTO health_observations VALUES (:reading,:entry,:b,'SPO2',98,'%')"), {'reading':reading,'entry':entry,'b':b})
            # Mismatched ownership fails before adding columns or inventing a new owner.
            with pytest.raises(InternalError):
                with db.begin_nested(), Operations.context(MigrationContext.configure(db)):
                    revision.upgrade()
            db.execute(text('UPDATE health_observations SET user_id=:a WHERE id=:reading'), {'a':a,'reading':reading})
            with Operations.context(MigrationContext.configure(db)):
                revision.upgrade()
            assert db.scalar(text('SELECT count(*) FROM user_health_settings')) == 2
            assert db.scalar(text('SELECT count(*) FROM user_profiles')) == 2
            assert tuple(db.execute(text('SELECT full_name,phone FROM user_profiles WHERE user_id=:a'), {'a':a}).one()) == ('Keep name','Keep phone')
            assert db.scalar(text('SELECT full_name FROM user_profiles WHERE user_id=:b'), {'b':b}) is None
            assert db.scalar(text('SELECT no_known_allergies_confirmed_at FROM user_health_settings WHERE user_id=:b'), {'b':b}) is None
            legacy = db.execute(text('SELECT observation_type,value,entered_value,entered_unit FROM health_observations WHERE id=:reading'), {'reading':reading}).one()
            assert tuple(legacy) == ('SPO2',98,None,None)
            assert db.scalar(text('SELECT allergen_type FROM allergies')) is None
            with pytest.raises(IntegrityError):
                with db.begin_nested():
                    db.execute(text("UPDATE health_observations SET entered_value=98,entered_unit='mg/dL'"))
    finally:
        with engine.begin() as db:
            db.execute(text(f'DROP SCHEMA IF EXISTS {schema} CASCADE'))
        engine.dispose()


@pytest.fixture
def pg():
    engine = create_engine(os.environ['TEST_POSTGRES_URL'])
    user_id = uuid4()
    with Session(engine) as db:
        db.add(User(id=user_id,email=f'm1-{user_id}@example.test',password_hash='unused',role='USER',status='ACTIVE'));db.flush()
        db.add_all([UserProfile(user_id=user_id),UserHealthSettings(user_id=user_id),UserConsent(user_id=user_id,consent_version='health-ai-v1',scope='HEALTH_DATA_AND_AI_PROCESSING',is_accepted=True)])
        db.commit()
    def sessions():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = sessions
    try:
        yield engine, user_id, {'Authorization':'Bearer '+create_access_token({'sub':str(user_id)})}
    finally:
        app.dependency_overrides.clear()
        with engine.begin() as db:
            for table in ('health_entries','health_conditions','allergies','medication_courses','user_health_settings','user_profiles','user_consents','refresh_sessions'):
                db.execute(text(f'DELETE FROM {table} WHERE user_id=:id'),{'id':user_id})
            db.execute(text('DELETE FROM users WHERE id=:id'),{'id':user_id})
        engine.dispose()


def test_atomic_rollback_precision_and_cascade(pg):
    engine,owner,h=pg
    with TestClient(app) as client:
        row=client.post('/api/v1/health/entries',headers=h,json={'title':'Original','observations':[{'observation_type':'GLUCOSE','value':100,'unit':'mg/dL'}]})
        assert row.status_code==201,row.text
        obj=row.json();rid=obj['observations'][0]['id'];path='/api/v1/health/entries/'+obj['id']
        failed=client.patch(path+'/aggregate',headers=h,json={'entry':{'title':'Must rollback'},'observations':{'update':[{'id':rid,'value':-1}]}})
        assert failed.status_code==422
        assert client.get(path,headers=h).json()['title']=='Original'
        with engine.connect() as db:
            stored=db.execute(text('SELECT value,entered_value,entered_unit FROM health_observations WHERE id=:id'),{'id':UUID(rid)}).one()
            assert str(stored.value)=='5.5556' and stored.entered_value==100 and stored.entered_unit=='mg/dL'
        assert client.delete(path,headers=h).status_code==204
        with engine.connect() as db:
            assert db.scalar(text('SELECT count(*) FROM health_observations WHERE id=:id'),{'id':UUID(rid)})==0


def test_raw_observation_pages_match_postgres_and_time_index_can_serve_query(pg):
    engine, owner, headers = pg
    start = datetime(2020, 1, 1, 17, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    with Session(engine) as db:
        entry_ids = [uuid4(), uuid4()]
        db.add_all(HealthEntries(id=id, user_id=owner, recorded_at=start - timedelta(days=3)) for id in entry_ids)
        db.flush()
        db.add_all(HealthObservations(
            entry_id=entry_ids[i % 2], user_id=owner, observation_type='HEART_RATE', value=60 + i,
            unit='bpm', measured_at=start + timedelta(seconds=i // 3),
        ) for i in range(205))
        db.add_all(HealthObservations(
            entry_id=entry_ids[0], user_id=owner, observation_type='HEART_RATE', value=60,
            unit='bpm', measured_at=t,
        ) for t in (start - timedelta(microseconds=1), end))
        db.commit()

        expected = db.execute(text('''
            SELECT id, entry_id, value, measured_at FROM health_observations
            WHERE user_id=:owner AND observation_type='HEART_RATE' AND measured_at>=:start AND measured_at<:end
            ORDER BY measured_at, id
        '''), {'owner': owner, 'start': start, 'end': end}).all()
        assert len(expected) == 205

        # With a small test database, disabling seqscan lets us check whether the existing
        # index is eligible. PostgreSQL remains free to select a different plan in production.
        db.execute(text('SET LOCAL enable_seqscan = off'))
        query = HealthRepository(db, Principal('USER', owner)).observation_series('HEART_RATE', start, end)
        sql = query.limit(100).statement.compile(engine, compile_kwargs={'literal_binds': True})
        explain = '\n'.join(db.execute(text(f'EXPLAIN (ANALYZE, BUFFERS) {sql}')).scalars())
        assert 'measured_at' in explain
        assert any(index in explain for index in (
            'idx_observations_timeseries', 'ix_health_observations_user_id_observation_type_measured_at',
        )), explain

    actual = []
    with TestClient(app) as client:
        for number, length in ((1, 100), (2, 100), (3, 5), (4, 0)):
            response = client.get('/api/v1/health/observations', headers=headers, params={
                'observation_type': 'HEART_RATE', 'from': start.isoformat(), 'to': end.isoformat(),
                'page': number, 'page_size': 100,
            })
            assert response.status_code == 200, response.text
            result = response.json()
            assert result['pagination'] == {'page': number, 'page_size': 100, 'total': 205}
            assert len(result['items']) == length
            actual.extend((UUID(o['id']), UUID(o['entry_id']), o['value'], datetime.fromisoformat(o['measured_at']))
                          for o in result['items'])
    assert actual == [tuple(row) for row in expected]


def test_phase_a_persona_seed_on_postgres(pg):
    from data_seed.seed_test_scenarios import seed_test_scenarios
    engine, _, _ = pg
    with Session(engine) as db:
        ids = seed_test_scenarios(db)
        readings = db.query(HealthObservations).filter_by(user_id=UUID(ids['patient.chronic@vitap.vn'])).all()
        before = len(readings)
        assert {r.entered_unit for r in readings if r.observation_type == 'GLUCOSE'} == {'mmol/L','mg/dL'}
        seed_test_scenarios(db)
        assert db.query(HealthObservations).filter_by(user_id=UUID(ids['patient.chronic@vitap.vn'])).count() == before


def test_analytics_matches_dense_postgres_rows_and_uses_owner_time_filter(pg):
    engine, owner, headers = pg
    start = datetime(2020, 1, 1, 17, tzinfo=timezone.utc)
    with Session(engine) as db:
        item = HealthEntries(user_id=owner, recorded_at=start - timedelta(days=5))
        db.add(item)
        db.flush()
        db.add_all(HealthObservations(
            entry_id=item.id, user_id=owner, observation_type='HEART_RATE', value=60 + i,
            unit='bpm', measured_at=start + timedelta(seconds=i),
        ) for i in range(205))
        db.add(HealthObservations(entry_id=item.id, user_id=owner, observation_type='HEART_RATE',
                                  value=500, unit='bpm', measured_at=start + timedelta(days=1)))
        db.commit()
    with TestClient(app) as client:
        response = client.get('/api/v1/health/analytics', headers=headers, params={
            'observation_type': 'HEART_RATE', 'from': '2020-01-02', 'to': '2020-01-03',
            'granularity': 'day', 'timezone': 'Asia/Ho_Chi_Minh',
        })
    assert response.status_code == 200, response.text
    data = response.json()
    assert data['excluded_count'] == 0
    assert data['buckets'] == [{
        'period_start': '2020-01-02', 'period_end': '2020-01-03', 'count': 205,
        'average': 162, 'minimum': 60, 'maximum': 264,
        'secondary_average': None, 'secondary_minimum': None, 'secondary_maximum': None,
    }]


def test_declaration_races_with_add(pg):
    engine,owner,h=pg
    barrier=Barrier(2)
    def add():
        with TestClient(app) as client:
            barrier.wait(timeout=10)
            return client.post('/api/v1/health/allergies',headers=h,json={'allergen_name':'Synthetic allergen','allergen_type':'OTHER'}).status_code
    def confirm():
        with TestClient(app) as client:
            barrier.wait(timeout=10)
            return client.put('/api/v1/health/allergy-declaration',headers=h,json={'state':'NO_KNOWN_ALLERGIES'}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        a=pool.submit(add);b=pool.submit(confirm)
        assert a.result(timeout=20)==201
        assert b.result(timeout=20) in (200,409)
    with TestClient(app) as client:
        assert client.get('/api/v1/health/allergy-declaration',headers=h).json()=={'state':'HAS_ALLERGIES','confirmed_at':None}
    with engine.connect() as db:
        assert db.scalar(text('SELECT no_known_allergies_confirmed_at FROM user_health_settings WHERE user_id=:id'),{'id':owner}) is None


def test_concurrent_last_observation_deletes_preserve_entry(pg):
    engine,owner,h=pg
    with TestClient(app) as client:
        created=client.post('/api/v1/health/entries',headers=h,json={'observations':[
            {'observation_type':'HEART_RATE','value':60},{'observation_type':'HEART_RATE','value':61}]})
        assert created.status_code==201,created.text
        row=created.json()
    barrier=Barrier(2)
    def remove(reading):
        with TestClient(app) as client:
            barrier.wait(timeout=10)
            return client.delete(f"/api/v1/health/entries/{row['id']}/observations/{reading['id']}",headers=h).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(remove,r) for r in row['observations']]
        assert sorted(f.result(timeout=20) for f in futures)==[204,409]
    with TestClient(app) as client:
        assert len(client.get('/api/v1/health/entries/'+row['id'],headers=h).json()['observations'])==1


def test_last_symptom_and_last_reading_share_postgres_lock(pg):
    engine, _, headers = pg
    with TestClient(app) as client:
        response = client.post('/api/v1/health/entries', headers=headers, json={
            'symptoms':[{'symptom_name':'Synthetic symptom'}],
            'observations':[{'observation_type':'HEART_RATE','value':72}],
        })
        assert response.status_code == 201, response.text
        row = response.json()
    path = f"/api/v1/health/entries/{row['id']}"
    barrier = Barrier(2)

    def remove(child_path):
        with TestClient(app) as client:
            barrier.wait(timeout=10)
            return client.delete(path+child_path, headers=headers).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        tasks = [
            pool.submit(remove, '/symptoms/'+row['symptoms'][0]['id']),
            pool.submit(remove, '/observations/'+row['observations'][0]['id']),
        ]
        assert sorted(task.result(timeout=20) for task in tasks) == [204, 409]
    with TestClient(app) as client:
        item = client.get(path, headers=headers).json()
        assert len(item['symptoms']) + len(item['observations']) == 1
        assert client.delete(path, headers=headers).status_code == 204
    with engine.connect() as db:
        actual = db.scalar(text('SELECT count(*) FROM symptoms WHERE entry_id=:id'), {'id':UUID(row['id'])})
        assert actual == 0
