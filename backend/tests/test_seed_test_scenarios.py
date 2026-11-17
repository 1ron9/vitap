import json
from uuid import UUID
from sqlalchemy.orm import Session
from app.modules.auth.models import User
from app.modules.medication.models import Prescriptions
from app.modules.health.models import HealthObservations, HealthEntries, UserHealthSettings, MedicationCourses, Allergies
from app.core.security import verify_password
from data_seed.seed_test_scenarios import seed_test_scenarios, generate_fixtures_dict

def test_seed_test_scenarios_creates_three_personas(db_session: Session):
    user_ids = seed_test_scenarios(db_session)
    assert "patient.chronic@vitap.vn" in user_ids
    assert "patient.ddi@vitap.vn" in user_ids
    assert "patient.empty@vitap.vn" in user_ids

    # Verify password hash
    chronic_user = db_session.query(User).filter_by(email="patient.chronic@vitap.vn").first()
    assert chronic_user is not None
    assert verify_password("Vitap@Dev2026", chronic_user.password_hash)

    # Verify prescription status complies with chk_prescription_status
    chronic_rx = db_session.query(Prescriptions).filter_by(user_id=chronic_user.id).first()
    assert chronic_rx is not None
    assert chronic_rx.status == "CONFIRMED"

def test_m1_seed_is_repeatable_and_covers_phase_a_states(db_session: Session):
    ids = seed_test_scenarios(db_session)
    models = (HealthEntries, HealthObservations, UserHealthSettings, MedicationCourses, Allergies)
    before = {model: db_session.query(model).count() for model in models}
    chronic_id = UUID(ids['patient.chronic@vitap.vn'])
    readings = db_session.query(HealthObservations).filter_by(user_id=chronic_id).all()
    assert {r.observation_type for r in readings} == {'BLOOD_PRESSURE', 'GLUCOSE', 'WEIGHT', 'HEART_RATE'}
    assert {r.entered_unit for r in readings if r.observation_type == 'GLUCOSE'} == {'mmol/L', 'mg/dL'}
    assert any(sum(x.entry_id == r.entry_id and x.observation_type == r.observation_type for x in readings) > 1 for r in readings)
    assert {c.status for c in db_session.query(MedicationCourses).filter_by(user_id=chronic_id)} == {'ACTIVE', 'COMPLETED', 'STOPPED'}
    ddi = db_session.get(UserHealthSettings, UUID(ids['patient.ddi@vitap.vn']))
    empty = db_session.get(UserHealthSettings, UUID(ids['patient.empty@vitap.vn']))
    assert not ddi.allow_ai_health_context and ddi.no_known_allergies_confirmed_at is not None
    assert empty.allow_ai_health_context and empty.no_known_allergies_confirmed_at is None
    # Existing user edits survive a repeat seed.
    empty.enable_allergy_alerts = False
    db_session.commit()
    seed_test_scenarios(db_session)
    assert before == {model: db_session.query(model).count() for model in models}
    assert db_session.get(UserHealthSettings, empty.user_id).enable_allergy_alerts is False

def test_generate_fixtures_dict_structure():
    fixtures = generate_fixtures_dict()
    assert "patient.chronic@vitap.vn" in fixtures
    assert len(fixtures["patient.chronic@vitap.vn"]["entries"]) >= 20
    assert len(fixtures["patient.ddi@vitap.vn"]["prescriptions"]) >= 1
    assert fixtures["patient.empty@vitap.vn"]["entries"] == []

