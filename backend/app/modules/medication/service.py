"""Medication and Prescription OCR domain service."""
from datetime import datetime, timezone
import io
import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from app.core.config import settings
from app.integrations.storage import LocalPrivateStorage
from app.modules.auth.models import GuestSession, User
from app.modules.auth.router import AuthError, Principal
from app.modules.medication.models import Drugs, OcrJobItems, OcrJobs, Prescriptions
from app.modules.medication.schemas import OcrJobItemDTO, OcrJobResponse, PrescriptionUploadResponse
from app.services.fuzzy_matcher import calculate_similarity
from app.services.ocr.scanner import extract_full_prescription
from app.shared.principal import require_ai_consent

logger = logging.getLogger(__name__)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


class MedicationOcrService:
    def __init__(self, storage_root: Optional[str] = None):
        self.storage = LocalPrivateStorage(storage_root or settings.STORAGE_ROOT)

    @staticmethod
    def verify_ocr_consent(principal: Principal, db: Session) -> None:
        """Ensure USER has active AI-processing consent or GUEST accepted consent."""
        kind = principal.kind.upper()
        if kind == "USER":
            user = db.get(User, principal.id)
            if user is None:
                raise AuthError(401, "INVALID_TOKEN", "Token không hợp lệ")
            require_ai_consent(user, db)
        elif kind == "GUEST":
            session = db.get(GuestSession, principal.id)
            if session is None or not session.consent_accepted:
                raise AuthError(403, "CONSENT_REQUIRED", "Cần đồng ý xử lý dữ liệu AI")
        else:
            raise AuthError(401, "AUTH_REQUIRED", "Cần đăng nhập hoặc cung cấp phiên Guest để quét đơn thuốc")

    @staticmethod
    def validate_image_bytes(image_bytes: bytes) -> str:
        """Validate size (<= 10 MiB), magic bytes, and full image decode integrity."""
        if not image_bytes:
            raise HTTPException(status_code=422, detail="INVALID_IMAGE: Tệp ảnh tải lên bị rỗng")
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Tệp quá lớn, tối đa 10 MiB")

        if image_bytes.startswith(b"\xff\xd8\xff"):
            expected_format = "JPEG"
            mime_type = "image/jpeg"
        elif image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            expected_format = "PNG"
            mime_type = "image/png"
        else:
            raise HTTPException(status_code=415, detail="Định dạng tệp không được hỗ trợ (chỉ nhận JPEG/PNG)")

        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                if img.format != expected_format:
                    raise HTTPException(status_code=415, detail="Định dạng tệp không khớp (chỉ nhận JPEG/PNG)")
                img.load()
        except HTTPException:
            raise
        except (UnidentifiedImageError, OSError, ValueError):
            raise HTTPException(status_code=422, detail="INVALID_IMAGE: Tệp ảnh bị hỏng hoặc không thể giải mã")

        return mime_type

    def process_prescription_upload(
        self,
        image_bytes: bytes,
        principal: Principal,
        db: Session,
        use_mock: Optional[bool] = None,
    ) -> PrescriptionUploadResponse:
        """Upload prescription image, persist records, run OCR and match drug entities."""
        self.verify_ocr_consent(principal, db)
        file_type = self.validate_image_bytes(image_bytes)
        storage_key = self.storage.put(image_bytes)

        now = datetime.now(timezone.utc)
        is_user = (principal.kind.upper() == "USER")
        is_guest = (principal.kind.upper() == "GUEST")
        prescription_id = uuid4()
        job_id = uuid4()

        prescription = Prescriptions(
            id=prescription_id,
            user_id=principal.id if is_user else None,
            guest_session_id=principal.id if is_guest else None,
            is_guest=is_guest,
            original_file_url=storage_key,
            file_type=file_type,
            status="UPLOADED",
            source_type="IMAGE_UPLOAD",
            created_at=now,
        )

        job = OcrJobs(
            id=job_id,
            prescription_id=prescription_id,
            model_name="Gemini-1.5-Flash-Vision",
            model_version="v1",
            status="PROCESSING",
            started_at=now,
            created_at=now,
        )

        try:
            db.add(prescription)
            db.flush()
            db.add(job)
            db.flush()
            parsed = extract_full_prescription(image_bytes, use_mock=use_mock)
            prescription.raw_ocr_text = parsed.raw_text
            prescription.healthcare_facility = parsed.facility_name

            # Query available drugs for fuzzy entity resolution
            known_drugs = db.query(Drugs).all()

            job_items: List[OcrJobItems] = []
            confidences: List[float] = []

            for idx, med in enumerate(parsed.medications):
                med_conf = med.confidence or 0.9
                confidences.append(med_conf)

                # Entity matching against drugs in database
                best_match_id = None
                best_score = 0.0
                candidates_list = []

                for d in known_drugs:
                    target_name = d.normalized_brand_name or d.brand_name
                    score = calculate_similarity(med.drug_name, target_name)
                    if score >= 0.6:
                        candidates_list.append({
                            "drug_id": str(d.id),
                            "brand_name": d.brand_name,
                            "score": round(score, 3),
                        })
                    if score > best_score:
                        best_score = score
                        best_match_id = d.id

                candidates_list.sort(key=lambda x: x["score"], reverse=True)
                top_candidates = candidates_list[:3]

                if best_score >= 0.85:
                    resolution_status = "MATCHED"
                    candidate_drug_id = best_match_id
                elif best_score >= 0.60:
                    resolution_status = "AMBIGUOUS"
                    candidate_drug_id = best_match_id
                else:
                    resolution_status = "UNRESOLVED_DRUG"
                    candidate_drug_id = None

                dosage_str = f"{med.quantity} {med.unit}" if (med.quantity and med.unit) else med.unit
                item = OcrJobItems(
                    id=uuid4(),
                    ocr_job_id=job.id,
                    item_order=idx + 1,
                    extracted_name=med.drug_name,
                    extracted_strength=med.strength,
                    extracted_dosage=dosage_str,
                    instructions=med.instructions,
                    confidence=med_conf,
                    candidate_drug_id=candidate_drug_id,
                    resolution_status=resolution_status,
                    candidates=top_candidates if top_candidates else None,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(item)
                job_items.append(item)

            avg_conf = sum(confidences) / len(confidences) if confidences else 1.0
            job.status = "COMPLETED"
            job.confidence = round(avg_conf, 4)
            job.completed_at = datetime.now(timezone.utc)
            prescription.status = "PENDING_REVIEW"
            prescription.updated_at = datetime.now(timezone.utc)

            db.commit()

            items_dto = [
                OcrJobItemDTO(
                    id=item.id,
                    item_order=item.item_order,
                    extracted_name=item.extracted_name,
                    extracted_strength=item.extracted_strength,
                    extracted_dosage=item.extracted_dosage,
                    instructions=item.instructions,
                    confidence=float(item.confidence) if item.confidence is not None else None,
                    candidate_drug_id=item.candidate_drug_id,
                    resolution_status=item.resolution_status,
                    candidates=item.candidates,
                )
                for item in job_items
            ]

            return PrescriptionUploadResponse(
                prescription_id=prescription.id,
                job_id=job.id,
                prescription_status=prescription.status,
                job_status=job.status,
                poll_after_seconds=2,
                items=items_dto,
            )

        except Exception:
            logger.exception("Prescription OCR processing failed for prescription_id=%s job_id=%s", prescription_id, job_id)
            db.rollback()
            self.storage.delete(storage_key)

            failed_at = datetime.now(timezone.utc)
            try:
                failed_prescription = Prescriptions(
                    id=prescription_id,
                    user_id=principal.id if is_user else None,
                    guest_session_id=principal.id if is_guest else None,
                    is_guest=is_guest,
                    original_file_url=None,
                    file_type=file_type,
                    status="FAILED",
                    source_type="IMAGE_UPLOAD",
                    created_at=now,
                    updated_at=failed_at,
                )
                failed_job = OcrJobs(
                    id=job_id,
                    prescription_id=prescription_id,
                    model_name="Gemini-1.5-Flash-Vision",
                    model_version="v1",
                    status="FAILED",
                    error_message="OCR_PROCESSING_FAILED",
                    started_at=now,
                    completed_at=failed_at,
                    created_at=now,
                )
                db.add(failed_prescription)
                db.flush()
                db.add(failed_job)
                db.commit()
            except Exception:
                logger.exception("Failed to persist FAILED status for job_id=%s", job_id)
                db.rollback()

            raise HTTPException(status_code=500, detail="Không thể xử lý nhận dạng đơn thuốc lúc này")

    def get_ocr_job(self, job_id: UUID, principal: Principal, db: Session) -> OcrJobResponse:
        """Fetch OCR job details ensuring ownership boundary."""
        job = db.query(OcrJobs).filter(OcrJobs.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Không tìm thấy tác vụ OCR")

        prescription = db.query(Prescriptions).filter(Prescriptions.id == job.prescription_id).first()
        if not prescription:
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn thuốc tương ứng")

        # Check ownership: User or Guest must match
        is_user = (principal.kind.upper() == "USER")
        is_guest = (principal.kind.upper() == "GUEST")
        if is_user and prescription.user_id != principal.id:
            raise HTTPException(status_code=404, detail="Không tìm thấy tác vụ OCR")
        if is_guest and prescription.guest_session_id != principal.id:
            raise HTTPException(status_code=404, detail="Không tìm thấy tác vụ OCR")

        items = db.query(OcrJobItems).filter(OcrJobItems.ocr_job_id == job.id).order_by(OcrJobItems.item_order).all()

        items_dto = [
            OcrJobItemDTO(
                id=item.id,
                item_order=item.item_order,
                extracted_name=item.extracted_name,
                extracted_strength=item.extracted_strength,
                extracted_dosage=item.extracted_dosage,
                instructions=item.instructions,
                confidence=float(item.confidence) if item.confidence is not None else None,
                candidate_drug_id=item.candidate_drug_id,
                resolution_status=item.resolution_status,
                candidates=item.candidates,
            )
            for item in items
        ]

        return OcrJobResponse(
            id=job.id,
            prescription_id=job.prescription_id,
            status=job.status,
            model_name=job.model_name,
            model_version=job.model_version,
            confidence=float(job.confidence) if job.confidence is not None else None,
            error_message=job.error_message,
            items=items_dto,
        )
