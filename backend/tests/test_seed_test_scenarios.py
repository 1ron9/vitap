import json
from sqlalchemy.orm import Session
from app.modules.auth.models import User
from app.modules.medication.models import Prescriptions
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

def test_generate_fixtures_dict_structure():
    fixtures = generate_fixtures_dict()
    assert "patient.chronic@vitap.vn" in fixtures
    assert len(fixtures["patient.chronic@vitap.vn"]["entries"]) >= 20
    assert len(fixtures["patient.ddi@vitap.vn"]["prescriptions"]) >= 1
    assert fixtures["patient.empty@vitap.vn"]["entries"] == []

