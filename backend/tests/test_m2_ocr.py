import io
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone
from PIL import Image
import pytest
from sqlalchemy.orm import Session

from app.integrations.providers import OcrProvider, PrescriptionOcrProvider
from app.modules.auth.models import GuestSession, User
from app.modules.medication.models import Drugs, OcrJobItems, OcrJobs, Prescriptions
from app.workers.models import BackgroundJob
from app.services.ocr.scanner import extract_drugs_from_image, extract_full_prescription


@pytest.fixture(autouse=True)
def _force_mock_ai(monkeypatch):
    monkeypatch.setenv("USE_MOCK_AI", "True")


def make_dummy_jpeg() -> bytes:
    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def make_dummy_png() -> bytes:
    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def create_test_guest(client) -> str:
    res = client.post(
        "/api/v1/guest-sessions",
        json={"consent_accepted": True, "consent_version": "guest-processing-v1"},
    )
    assert res.status_code == 201, res.text
    return res.json()["guest_token"]


def test_ocr_provider_protocol_conformance():
    provider = PrescriptionOcrProvider(use_mock=True)
    assert isinstance(provider, OcrProvider)
    result = provider.extract(make_dummy_jpeg())
    assert isinstance(result, list)
    assert len(result) > 0
    assert "raw_name" in result[0]
    assert "confidence" in result[0]


def test_ocr_scanner_service():
    jpeg_bytes = make_dummy_jpeg()
    data = extract_full_prescription(jpeg_bytes, use_mock=True)
    assert len(data.medications) >= 4
    assert any("Omeprazole" in med.drug_name for med in data.medications)

    raw_items = extract_drugs_from_image(jpeg_bytes)
    assert len(raw_items) >= 4
    assert any("Omeprazole" in item["raw_name"] for item in raw_items)


def test_paddle_v3_result_is_converted_to_backend_line_contract(monkeypatch):
    from types import SimpleNamespace
    from app.services.ocr import ocr

    class FakePaddleOCR:
        def __init__(self, **kwargs):
            assert kwargs["lang"] == "vi"
            assert kwargs["device"] == "cpu"

        def predict(self, input):
            return [SimpleNamespace(json={"res": {
                "rec_texts": ["1. Paracetamol 500mg"],
                "rec_scores": [0.91],
                "rec_boxes": [[1, 2, 30, 12]],
            }})]

    monkeypatch.setattr(ocr, "HAS_PADDLE", True)
    monkeypatch.setattr(ocr, "PaddleOCR", FakePaddleOCR, raising=False)
    engine = ocr.PrintedOCREngine(use_mock=False)
    lines = engine.extract_lines(make_dummy_jpeg())
    assert lines == [{
        "text": "1. Paracetamol 500mg",
        "confidence": 0.91,
        "bbox": [1, 2, 30, 12],
    }]


def test_missing_paddle_fails_instead_of_returning_mock(monkeypatch):
    from app.services.ocr import ocr

    monkeypatch.setattr(ocr, "HAS_PADDLE", False)
    with pytest.raises(RuntimeError, match="PaddleOCR is unavailable"):
        ocr.PrintedOCREngine(use_mock=False)


def test_gemini_errors_are_not_converted_to_mock(monkeypatch):
    import requests
    from app.services.ocr.vision_model import VisionModelEngine

    engine = VisionModelEngine(provider="gemini", api_key="test-key", use_mock=False)
    monkeypatch.setattr(engine, "_call_gemini", lambda image: (_ for _ in ()).throw(requests.ConnectionError("Gemini unavailable")))
    with pytest.raises(requests.ConnectionError):
        engine.analyze_image(make_dummy_jpeg())


def test_gemini_provider_requires_api_key(monkeypatch):
    from app.services.ocr.vision_model import VisionModelEngine

    monkeypatch.setattr("app.services.ocr.vision_model._resolve_gemini_api_key", lambda: "")
    engine = VisionModelEngine(provider="gemini", use_mock=False)
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY is required"):
        engine.analyze_image(make_dummy_jpeg())


def test_expired_prescription_image_is_enqueued_for_private_file_deletion(db_session, monkeypatch):
    from app.modules.medication.models import OcrJobs
    from app.workers import runner

    prescription = Prescriptions(
        id=uuid4(), is_guest=False, original_file_url="a" * 32,
        status="PENDING_REVIEW", expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    db_session.add(prescription)
    db_session.flush()
    db_session.add(OcrJobs(
        id=uuid4(), prescription_id=prescription.id, status="COMPLETED",
    ))
    db_session.commit()
    monkeypatch.setattr(runner, "SessionLocal", lambda: Session(bind=db_session.get_bind()))

    runner._queue_expired_prescription_files()

    db_session.expire_all()
    assert db_session.get(Prescriptions, prescription.id).original_file_url is None
    delete_job = db_session.query(BackgroundJob).filter_by(kind="DELETE_FILE").one()
    assert delete_job.payload == {"storage_key": "a" * 32}


def test_ocr_upload_unauthorized_without_principal(client):
    response = client.post(
        "/api/v1/prescriptions/ocr",
        files={"image_file": ("prescription.jpg", make_dummy_jpeg(), "image/jpeg")},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_REQUIRED"


def test_ocr_upload_invalid_mime_type_and_empty(client, db_session):
    token = create_test_guest(client)

    # Test empty file
    res_empty = client.post(
        "/api/v1/prescriptions/ocr",
        headers={"X-Guest-Token": token},
        files={"image_file": ("empty.jpg", b"", "image/jpeg")},
    )
    assert res_empty.status_code == 422

    # Test invalid file (text file disguised as jpeg)
    res_invalid = client.post(
        "/api/v1/prescriptions/ocr",
        headers={"X-Guest-Token": token},
        files={"image_file": ("test.txt", b"plain text content", "text/plain")},
    )
    assert res_invalid.status_code == 415


def test_ocr_upload_with_guest_and_polling(client, db_session, monkeypatch):
    from datetime import datetime, timezone
    # Seed a drug for candidate matching
    drug = Drugs(
        id=uuid4(),
        brand_name="Omeprazole 20mg",
        normalized_brand_name="omeprazole 20mg",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(drug)
    db_session.commit()

    token = create_test_guest(client)

    # Upload valid JPEG image
    upload_res = client.post(
        "/api/v1/prescriptions/ocr",
        headers={"X-Guest-Token": token},
        files={"image_file": ("prescription.jpg", make_dummy_jpeg(), "image/jpeg")},
    )
    assert upload_res.status_code == 202
    body = upload_res.json()
    assert "prescription_id" in body
    assert "job_id" in body
    assert body["job_status"] == "PENDING"
    assert body["expires_at"] is not None
    assert body["items"] == []

    job_id = body["job_id"]
    from app.modules.medication import service as medication_service
    from app.modules.medication.service import MedicationOcrService
    from app.services.ocr.schemas import MedicationItem, PrescriptionData
    observed = {}

    def engine_boundary(image_bytes, mode, use_mock):
        observed.update(mode=mode, use_mock=use_mock, image_bytes=image_bytes)
        return PrescriptionData(medications=[
            MedicationItem(drug_name="Omeprazole", strength="20mg", confidence=0.95),
            MedicationItem(drug_name="Amlodipine", strength="5mg", confidence=0.91),
            MedicationItem(drug_name="Simvastatin", strength="10mg", confidence=0.89),
            MedicationItem(drug_name="Metformin", strength="500mg", confidence=0.87),
        ])

    monkeypatch.setattr(medication_service, "extract_full_prescription", engine_boundary)
    MedicationOcrService().process_ocr_job(UUID(job_id), db_session)
    assert observed["use_mock"] is False
    assert observed["image_bytes"]

    assert upload_res.headers.get("location") == f"/api/v1/ocr-jobs/{job_id}"

    # Poll OCR job result
    poll_res = client.get(
        f"/api/v1/ocr-jobs/{job_id}",
        headers={"X-Guest-Token": token},
    )
    assert poll_res.status_code == 200
    poll_body = poll_res.json()
    assert poll_body["status"] == "COMPLETED"
    assert poll_body["started_at"] is not None
    assert poll_body["completed_at"] is not None
    assert poll_body["created_at"] is not None
    assert poll_body["error"] is None
    assert len(poll_body["items"]) >= 4
    assert "route" in poll_body["items"][0]

    # Verify drug candidate resolution
    omeprazole_item = next(
        (it for it in poll_body["items"] if "Omeprazole" in it["extracted_name"]),
        None,
    )
    assert omeprazole_item is not None
    assert omeprazole_item["candidate_drug_id"] == str(drug.id)
    assert omeprazole_item["resolution_status"] in ("MATCHED", "AMBIGUOUS")

    review_res = client.post(
        f"/api/v1/ocr-jobs/{job_id}/review",
        headers={"X-Guest-Token": token},
        json={"items": [{
            "source_ocr_item_id": omeprazole_item["id"],
            "item_order": 1,
            "extracted_name": "Omeprazole",
            "extracted_strength": "20mg",
            "confidence": 0.95,
            "unresolved": False,
        }]},
    )
    assert review_res.status_code == 200
    assert review_res.json()["saved_items"] == 1


def test_ocr_job_ownership_boundary(client, db_session):
    token1 = create_test_guest(client)
    token2 = create_test_guest(client)

    # Guest 1 uploads prescription
    upload_res = client.post(
        "/api/v1/prescriptions/ocr",
        headers={"X-Guest-Token": token1},
        files={"image_file": ("rx.png", make_dummy_png(), "image/png")},
    )
    job_id = upload_res.json()["job_id"]

    # Guest 2 tries to access Guest 1's job -> 404 RESOURCE_NOT_FOUND
    res_forbidden = client.get(
        f"/api/v1/ocr-jobs/{job_id}",
        headers={"X-Guest-Token": token2},
    )
    assert res_forbidden.status_code == 404
    assert res_forbidden.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_queued_ocr_rechecks_guest_consent_before_model_call(client, db_session, tmp_path, monkeypatch):
    from app.integrations.storage import LocalPrivateStorage
    from app.modules.medication import router as med_router
    from app.modules.medication import service as med_service
    from app.modules.auth.router import AuthError

    storage = LocalPrivateStorage(str(tmp_path))
    monkeypatch.setattr(med_router.ocr_service, "storage", storage)
    token = create_test_guest(client)
    response = client.post(
        "/api/v1/prescriptions/ocr",
        headers={"X-Guest-Token": token},
        files={"image_file": ("rx.jpg", make_dummy_jpeg(), "image/jpeg")},
    )
    assert response.status_code == 202
    guest = db_session.query(GuestSession).one()
    guest.consent_accepted = False
    db_session.commit()

    def should_not_run(*args, **kwargs):
        pytest.fail("OCR model ran after guest consent was revoked")

    monkeypatch.setattr(med_service, "extract_full_prescription", should_not_run)
    with pytest.raises(AuthError):
        med_router.ocr_service.process_ocr_job(UUID(response.json()["job_id"]), db_session)

    stored_key = db_session.query(Prescriptions).one().original_file_url
    storage.delete(stored_key)


def test_provider_forwards_mode_and_use_mock(monkeypatch):
    from app.services.ocr import scanner

    captured = {}

    def fake_extract_full(image_bytes, mode="vlm", use_mock=None):
        captured["mode"] = mode
        captured["use_mock"] = use_mock
        from app.services.ocr.schemas import PrescriptionData
        return PrescriptionData(raw_text="demo", medications=[])

    monkeypatch.setattr(scanner, "extract_full_prescription", fake_extract_full)

    provider = PrescriptionOcrProvider(mode="ocr", use_mock=False)
    assert provider.extract(b"fake-bytes") == []
    assert captured == {"mode": "ocr", "use_mock": False}


def test_user_ai_consent_enforced_before_upload(client, db_session):
    from datetime import datetime, timezone
    from app.core.security import create_access_token
    from app.modules.auth.models import UserConsent

    user = User(
        id=uuid4(),
        email="ocr-consent@example.test",
        password_hash="unused",
        role="USER",
        status="ACTIVE",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    db_session.commit()

    headers = {"Authorization": f"Bearer {create_access_token({'sub': str(user.id)})}"}

    # User without consent -> 403 CONSENT_REQUIRED
    res_no_consent = client.post(
        "/api/v1/prescriptions/ocr",
        headers=headers,
        files={"image_file": ("rx.jpg", make_dummy_jpeg(), "image/jpeg")},
    )
    assert res_no_consent.status_code == 403
    assert res_no_consent.json()["error"]["code"] == "CONSENT_REQUIRED"

    # Grant consent -> 202 Accepted
    consent = UserConsent(
        id=uuid4(),
        user_id=user.id,
        consent_version="health-ai-v1",
        scope="HEALTH_DATA_AND_AI_PROCESSING",
        is_accepted=True,
        consented_at=datetime.now(timezone.utc),
    )
    db_session.add(consent)
    db_session.commit()

    res_ok = client.post(
        "/api/v1/prescriptions/ocr",
        headers=headers,
        files={"image_file": ("rx.jpg", make_dummy_jpeg(), "image/jpeg")},
    )
    assert res_ok.status_code == 202

    # Revoke consent -> 403 CONSENT_REQUIRED
    consent.revoked_at = datetime.now(timezone.utc)
    db_session.commit()

    res_revoked = client.post(
        "/api/v1/prescriptions/ocr",
        headers=headers,
        files={"image_file": ("rx.jpg", make_dummy_jpeg(), "image/jpeg")},
    )
    assert res_revoked.status_code == 403
    assert res_revoked.json()["error"]["code"] == "CONSENT_REQUIRED"


def test_corrupt_and_oversized_image_rejected(client, db_session):
    token = create_test_guest(client)

    # Corrupt JPEG (valid magic header, truncated/invalid body) -> 422
    res_corrupt = client.post(
        "/api/v1/prescriptions/ocr",
        headers={"X-Guest-Token": token},
        files={"image_file": ("corrupt.jpg", b"\xff\xd8\xff\xe0not-a-valid-jpeg", "image/jpeg")},
    )
    assert res_corrupt.status_code == 422

    # Oversized payload (> 10 MiB) -> 413
    oversized = b"\xff\xd8\xff" + (b"\x00" * (10 * 1024 * 1024 + 100))
    res_large = client.post(
        "/api/v1/prescriptions/ocr",
        headers={"X-Guest-Token": token},
        files={"image_file": ("huge.jpg", oversized, "image/jpeg")},
    )
    assert res_large.status_code == 413


def test_failed_ocr_persists_failure_and_queues_private_file_cleanup(client, db_session, tmp_path, monkeypatch):
    from app.integrations.storage import LocalPrivateStorage
    from app.modules.medication import router as med_router
    from app.modules.medication import service as med_service

    storage = LocalPrivateStorage(str(tmp_path))
    monkeypatch.setattr(med_router.ocr_service, "storage", storage)

    def boom(*args, **kwargs):
        raise RuntimeError("INTERNAL_SECRET_DB_PASSWORD_LEAK")

    monkeypatch.setattr(med_service, "extract_full_prescription", boom)

    token = create_test_guest(client)
    res = client.post(
        "/api/v1/prescriptions/ocr",
        headers={"X-Guest-Token": token},
        files={"image_file": ("rx.jpg", make_dummy_jpeg(), "image/jpeg")},
    )

    assert res.status_code == 202
    queued_job_id = res.json()["job_id"]
    monkeypatch.setattr(med_router.ocr_service, "storage", storage)
    with pytest.raises(RuntimeError, match="INTERNAL_SECRET_DB_PASSWORD_LEAK"):
        med_router.ocr_service.process_ocr_job(UUID(queued_job_id), db_session)

    bg_job = db_session.query(BackgroundJob).filter_by(kind="PROCESS_OCR").one()
    failed_job_id = db_session.query(OcrJobs).one().id
    from app.workers import runner
    monkeypatch.setattr(runner, "engine", db_session.get_bind())
    monkeypatch.setattr(runner, "LocalPrivateStorage", lambda root: storage)
    runner._record_failure(
        {"id": str(bg_job.id), "kind": bg_job.kind, "payload": {"ocr_job_id": failed_job_id.hex},
         "attempts": 3, "max_attempts": 3},
        retry=False,
    )

    db_session.expire_all()
    assert len(list(tmp_path.iterdir())) == 1
    delete_job = db_session.query(BackgroundJob).filter_by(kind="DELETE_FILE").one()
    assert delete_job.payload["storage_key"] == next(tmp_path.iterdir()).name
    failed_rx = db_session.query(Prescriptions).first()
    failed_job = db_session.query(OcrJobs).first()
    assert failed_rx is not None
    assert failed_rx.status == "FAILED"
    assert failed_rx.original_file_url is None
    assert failed_job is not None
    assert failed_job.status == "FAILED"
    assert failed_job.error_message == "OCR_PROCESSING_FAILED"
    assert "INTERNAL_SECRET_DB_PASSWORD_LEAK" not in (failed_job.error_message or "")

    # Polling failed job must return 200 with structured error object
    poll_failed = client.get(
        f"/api/v1/ocr-jobs/{failed_job.id}",
        headers={"X-Guest-Token": token},
    )
    assert poll_failed.status_code == 200
    failed_payload = poll_failed.json()
    assert failed_payload["status"] == "FAILED"
    assert failed_payload["error"] == {
        "code": "OCR_PROCESSING_FAILED",
        "message": "Không thể xử lý nhận dạng đơn thuốc",
    }


def test_exif_gps_metadata_is_stripped_before_storage(client, db_session, tmp_path, monkeypatch):
    from app.integrations.storage import LocalPrivateStorage
    from app.modules.medication import router as med_router

    storage = LocalPrivateStorage(str(tmp_path))
    monkeypatch.setattr(med_router.ocr_service, "storage", storage)

    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    exif = img.getexif()
    exif[0x010E] = "Patient secret note"
    exif[0x8825] = {1: "N", 2: (10.0, 45.0, 0.0), 3: "E", 4: (106.0, 40.0, 0.0)}
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif.tobytes())
    raw_with_exif = buf.getvalue()

    with Image.open(io.BytesIO(raw_with_exif)) as before:
        assert len(before.getexif()) > 0

    token = create_test_guest(client)
    res = client.post(
        "/api/v1/prescriptions/ocr",
        headers={"X-Guest-Token": token},
        files={"image_file": ("gps.jpg", raw_with_exif, "image/jpeg")},
    )
    assert res.status_code == 202

    stored_rx = db_session.query(Prescriptions).one()
    stored_bytes = storage.read(stored_rx.original_file_url)
    with Image.open(io.BytesIO(stored_bytes)) as after:
        assert len(after.getexif()) == 0


def test_generic_name_matching_and_lasa_safety_guard(db_session):
    from app.modules.medication.service import MedicationOcrService
    from app.services.ocr.schemas import MedicationItem

    now = datetime.now(timezone.utc)
    panadol = Drugs(
        id=uuid4(),
        brand_name="Panadol Extra",
        normalized_brand_name="panadol extra",
        generic_name="Paracetamol",
        strength="500mg",
        created_at=now,
    )
    flucofast = Drugs(
        id=uuid4(),
        brand_name="Flucofast",
        normalized_brand_name="flucofast",
        generic_name="Fluconazole",
        strength="150mg",
        created_at=now,
    )
    db_session.add_all([panadol, flucofast])
    db_session.commit()

    # 1. Generic name match ("Paracetamol") must resolve to MATCHED
    cand_id, status, _ = MedicationOcrService._resolve_drug_entity(
        MedicationItem(drug_name="Paracetamol", strength="500mg"),
        db_session,
    )
    assert status == "MATCHED"
    assert cand_id == panadol.id

    # 2. LASA safety guard: "GLUCOFAST" (Metformin) vs "Flucofast" (Fluconazole) must NOT auto-MATCH
    lasa_id, lasa_status, lasa_cands = MedicationOcrService._resolve_drug_entity(
        MedicationItem(drug_name="GLUCOFAST", strength="850mg"),
        db_session,
    )
    assert lasa_status == "AMBIGUOUS"
    assert lasa_id == flucofast.id
    assert len(lasa_cands) == 1


def test_parse_compound_strength_and_multiline_dosage():
    from app.services.ocr.extraction import parse_ocr_lines_to_prescription

    lines = [
        {"text": "1) RENAPRIL 5MG 5mg", "confidence": 0.95},
        {"text": "SL: 28 Viên", "confidence": 0.95},
        {"text": "Ghi chú Uống:", "confidence": 0.95},
        {"text": "Sáng 1 Viên", "confidence": 0.95},
        {"text": "3) HOẠT HUYẾT DƯỠNG NÃO 150mg+20mg", "confidence": 0.95},
        {"text": "SL: 20 Viên", "confidence": 0.95},
        {"text": "Tối 2 Viên", "confidence": 0.95},
        {"text": "Cộng khoản: 3 khoản", "confidence": 0.95},
    ]
    parsed = parse_ocr_lines_to_prescription(lines)
    assert len(parsed.medications) == 2
    assert parsed.medications[0].drug_name == "RENAPRIL"
    assert parsed.medications[0].quantity == 28
    assert "Sáng 1 Viên" in (parsed.medications[0].instructions or "")
    assert parsed.medications[1].drug_name == "HOẠT HUYẾT DƯỠNG NÃO"
    assert parsed.medications[1].strength == "150mg+20mg"
    assert parsed.medications[1].quantity == 20
    assert "Tối 2 Viên" in (parsed.medications[1].instructions or "")
    assert "Cộng khoản" not in (parsed.medications[1].instructions or "")
