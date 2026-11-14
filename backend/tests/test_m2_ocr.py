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
