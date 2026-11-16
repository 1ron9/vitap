import io
from uuid import uuid4
from PIL import Image
import pytest

from app.integrations.providers import OcrProvider, PrescriptionOcrProvider
from app.modules.auth.models import GuestSession, User
from app.modules.medication.models import Drugs, OcrJobItems, OcrJobs, Prescriptions
from app.services.ocr.scanner import extract_drugs_from_image, extract_full_prescription


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


def test_ocr_upload_with_guest_and_polling(client, db_session):
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
    assert body["job_status"] == "COMPLETED"
    assert len(body["items"]) >= 4

    job_id = body["job_id"]

    # Poll OCR job result
    poll_res = client.get(
        f"/api/v1/ocr-jobs/{job_id}",
        headers={"X-Guest-Token": token},
    )
    assert poll_res.status_code == 200
    poll_body = poll_res.json()
    assert poll_body["status"] == "COMPLETED"
    assert len(poll_body["items"]) >= 4

    # Verify drug candidate resolution
    omeprazole_item = next(
        (it for it in poll_body["items"] if "Omeprazole" in it["extracted_name"]),
        None,
    )
    assert omeprazole_item is not None
    assert omeprazole_item["candidate_drug_id"] == str(drug.id)
    assert omeprazole_item["resolution_status"] in ("MATCHED", "AMBIGUOUS")


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


def test_failed_ocr_cleans_storage_persists_failed_job_and_hides_internal_error(client, db_session, tmp_path, monkeypatch):
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

    assert res.status_code == 500
    assert "INTERNAL_SECRET_DB_PASSWORD_LEAK" not in res.text

    # Stored image must be cleaned up (no orphan files left)
    assert list(tmp_path.iterdir()) == []

    # FAILED status must be persisted cleanly in DB
    failed_rx = db_session.query(Prescriptions).first()
    failed_job = db_session.query(OcrJobs).first()
    assert failed_rx is not None
    assert failed_rx.status == "FAILED"
    assert failed_rx.original_file_url is None
    assert failed_job is not None
    assert failed_job.status == "FAILED"
    assert failed_job.error_message == "OCR_PROCESSING_FAILED"
    assert "INTERNAL_SECRET_DB_PASSWORD_LEAK" not in (failed_job.error_message or "")
