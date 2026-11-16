"""Medication and Prescription OCR domain service."""
from datetime import datetime, timedelta, timezone
import io
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from app.core.config import settings
from app.integrations.storage import LocalPrivateStorage
from app.modules.auth.models import GuestSession, User
from app.modules.auth.router import AuthError, Principal
from app.modules.medication.models import Drugs, OcrJobItems, OcrJobs, PrescriptionItems, Prescriptions
from app.modules.medication.schemas import (
    OcrJobErrorDTO,
    OcrJobItemDTO,
    OcrJobResponse,
    PrescriptionUploadResponse,
    OcrReviewRequest,
    OcrReviewResponse,
)
from app.services.fuzzy_matcher import calculate_similarity
from app.services.ocr.scanner import extract_full_prescription
from app.services.ocr.schemas import MedicationItem
from app.shared.principal import require_ai_consent
from app.workers.models import BackgroundJob

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
DEFAULT_DRAFT_TTL_HOURS = 24


def _to_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _to_item_dto(item: OcrJobItems) -> OcrJobItemDTO:
    return OcrJobItemDTO(
        id=item.id,
        item_order=item.item_order,
        extracted_name=item.extracted_name,
        extracted_strength=item.extracted_strength,
        extracted_dosage=item.extracted_dosage,
        frequency=item.frequency,
        duration_days=item.duration_days,
        route=item.route,
        instructions=item.instructions,
        confidence=float(item.confidence) if item.confidence is not None else None,
        bounding_box=item.bounding_box,
        candidate_drug_id=item.candidate_drug_id,
        resolution_status=item.resolution_status,
        field_confidences=item.field_confidences,
        candidates=item.candidates,
    )


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

    @classmethod
    def sanitize_image_bytes(cls, image_bytes: bytes) -> Tuple[str, bytes]:
        """Validate image and re-encode without EXIF/GPS or ancillary metadata."""
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
                oriented = ImageOps.exif_transpose(img)
                out = io.BytesIO()
                if expected_format == "JPEG":
                    clean_img = Image.fromarray(np.asarray(oriented.convert("RGB")))
                    clean_img.save(out, format="JPEG", quality=95)
                else:
                    clean_img = Image.fromarray(np.asarray(oriented))
                    clean_img.save(out, format="PNG")
                sanitized_bytes = out.getvalue()
        except HTTPException:
            raise
        except (UnidentifiedImageError, OSError, ValueError):
            raise HTTPException(status_code=422, detail="INVALID_IMAGE: Tệp ảnh bị hỏng hoặc không thể giải mã")

        return mime_type, sanitized_bytes

    @classmethod
    def validate_image_bytes(cls, image_bytes: bytes) -> str:
        """Validate size (<= 10 MiB), magic bytes, and full image decode integrity."""
        mime_type, _ = cls.sanitize_image_bytes(image_bytes)
        return mime_type

    @staticmethod
    def _query_candidate_drugs(db: Session, query_name: str) -> List[Drugs]:
        """Query candidate drugs via PostgreSQL pg_trgm GIN indexes or SQLite trigram LIKE filters."""
        cleaned = (query_name or "").strip().lower()
        if not cleaned:
            return []

        dialect = db.bind.dialect.name if db.bind is not None else ""
        if dialect == "postgresql":
            sim_brand = func.similarity(func.coalesce(Drugs.normalized_brand_name, Drugs.brand_name), cleaned)
            sim_generic = func.similarity(func.coalesce(Drugs.generic_name, ""), cleaned)
            best_sim = func.greatest(sim_brand, sim_generic)
            return (
                db.query(Drugs)
                .filter(
                    or_(
                        sim_brand >= 0.3,
                        sim_generic >= 0.3,
                        Drugs.brand_name.ilike(f"%{cleaned}%"),
                        Drugs.generic_name.ilike(f"%{cleaned}%"),
                    )
                )
                .order_by(best_sim.desc(), Drugs.brand_name.asc())
                .limit(25)
                .all()
            )

        # SQLite / generic SQL prefilter: Tier 1 exact/prefix match + Tier 2 trigram fallback
        results: List[Drugs] = []
        seen_ids = set()

        tokens = [t for t in cleaned.replace("-", " ").replace(".", " ").split() if len(t) >= 2]
        primary_tok = tokens[0] if tokens else cleaned
        tier1_filters = [
            Drugs.normalized_brand_name.ilike(f"{cleaned}%"),
            Drugs.brand_name.ilike(f"{cleaned}%"),
            Drugs.generic_name.ilike(f"{cleaned}%"),
            Drugs.normalized_brand_name.ilike(f"%{cleaned}%"),
            Drugs.brand_name.ilike(f"%{cleaned}%"),
            Drugs.generic_name.ilike(f"%{cleaned}%"),
        ]
        if primary_tok and primary_tok != cleaned:
            tier1_filters.extend([
                Drugs.normalized_brand_name.ilike(f"{primary_tok}%"),
                Drugs.brand_name.ilike(f"{primary_tok}%"),
                Drugs.generic_name.ilike(f"{primary_tok}%"),
            ])

        for drug in db.query(Drugs).filter(or_(*tier1_filters)).limit(50).all():
            if drug.id not in seen_ids:
                seen_ids.add(drug.id)
                results.append(drug)

        alnum = "".join(ch for ch in cleaned if ch.isalnum())
        grams = set()
        if len(alnum) <= 3:
            grams.add(alnum or cleaned)
        else:
            grams.add(alnum[:4] if len(alnum) >= 4 else alnum[:3])
            grams.add(alnum[1:4])
            grams.add(alnum[-4:] if len(alnum) >= 4 else alnum[-3:])
        for tok in tokens:
            if len(tok) >= 3:
                grams.add(tok[:4] if len(tok) >= 4 else tok[:3])

        filters = []
        for g in grams:
            if not g:
                continue
            pattern = f"%{g}%"
            filters.append(Drugs.normalized_brand_name.ilike(pattern))
            filters.append(Drugs.brand_name.ilike(pattern))
            filters.append(Drugs.generic_name.ilike(pattern))

        if filters and len(results) < 100:
            for drug in db.query(Drugs).filter(or_(*filters)).limit(100 - len(results)).all():
                if drug.id not in seen_ids:
                    seen_ids.add(drug.id)
                    results.append(drug)
        return results

    @classmethod
    def _resolve_drug_entity(cls, med: Any, db: Session) -> Tuple[Optional[UUID], str, List[Dict[str, Any]]]:
        """Resolve extracted medication against brand_name and generic_name with LASA safety guard."""
        raw_name = (med.drug_name or "").strip()
        raw_strength = (med.strength or "").strip()
        q_norm = raw_name.lower()
        q_first = next((ch for ch in q_norm if ch.isalnum()), "")

        query_variants = [raw_name]
        if raw_strength:
            compact_str = raw_strength.replace(" ", "")
            num_prefix = "".join(ch for ch in compact_str if ch.isdigit() or ch in ".,/")
            for variant in (
                f"{raw_name} {raw_strength}".strip(),
                f"{raw_name} {compact_str}".strip(),
                f"{raw_name} {num_prefix}".strip() if num_prefix else "",
            ):
                if variant and variant not in query_variants:
                    query_variants.append(variant)

        candidate_drugs = cls._query_candidate_drugs(db, raw_name)
        best_match_id: Optional[UUID] = None
        best_score = 0.0
        best_first_char_ok = False
        candidates_list: List[Dict[str, Any]] = []

        for drug in candidate_drugs:
            brand_target = drug.normalized_brand_name or drug.brand_name or ""
            generic_target = drug.generic_name or ""

            scores: List[Tuple[float, str]] = []
            for qv in query_variants:
                if brand_target:
                    scores.append((calculate_similarity(qv, brand_target), brand_target))
                if generic_target:
                    scores.append((calculate_similarity(qv, generic_target), generic_target))

            if not scores:
                continue

            score, matched_target = max(scores, key=lambda item: item[0])
            t_norm = matched_target.strip().lower()
            t_first = next((ch for ch in t_norm if ch.isalnum()), "")
            first_char_ok = bool(q_first and t_first and q_first == t_first)

            if score >= 0.6:
                candidates_list.append({
                    "drug_id": str(drug.id),
                    "brand_name": drug.brand_name,
                    "generic_name": drug.generic_name,
                    "score": round(score, 3),
                })
            if score > best_score:
                best_score = score
                best_match_id = drug.id
                best_first_char_ok = first_char_ok

        candidates_list.sort(key=lambda item: item["score"], reverse=True)
        if best_score >= 0.85 and (best_score >= 0.99 or best_first_char_ok):
            resolution_status = "MATCHED"
            candidate_drug_id = best_match_id
        elif best_score >= 0.60:
            resolution_status = "AMBIGUOUS"
            candidate_drug_id = best_match_id
        else:
            resolution_status = "UNRESOLVED_DRUG"
            candidate_drug_id = None

        return candidate_drug_id, resolution_status, candidates_list[:3]

    def process_prescription_upload(
        self,
        image_bytes: bytes,
        principal: Principal,
        db: Session,
    ) -> PrescriptionUploadResponse:
        """Persist an image and enqueue durable OCR work."""
        self.verify_ocr_consent(principal, db)
        file_type, sanitized_bytes = self.sanitize_image_bytes(image_bytes)
        storage_key = self.storage.put(sanitized_bytes)

        now = datetime.now(timezone.utc)
        is_user = principal.kind.upper() == "USER"
        is_guest = principal.kind.upper() == "GUEST"
        expires_at = now + timedelta(hours=DEFAULT_DRAFT_TTL_HOURS)
        if is_guest:
            guest_session = db.get(GuestSession, principal.id)
            if guest_session and guest_session.expires_at:
                expires_at = min(expires_at, _to_utc(guest_session.expires_at))

        prescription = Prescriptions(
            id=uuid4(),
            user_id=principal.id if is_user else None,
            guest_session_id=principal.id if is_guest else None,
            is_guest=is_guest,
            original_file_url=storage_key,
            file_type=file_type,
            status="UPLOADED",
            source_type="IMAGE_UPLOAD",
            expires_at=expires_at,
            created_at=now,
        )
        mode = settings.OCR_MODE.lower()
        if mode == "printed":
            model_name, model_version = "PaddleOCR", "3.3.0"
        else:
            model_name = settings.GEMINI_VISION_MODEL
            model_version = model_name
        ocr_job = OcrJobs(
            id=uuid4(),
            prescription_id=prescription.id,
            model_name=model_name,
            model_version=model_version,
            status="PENDING",
            created_at=now,
        )
        try:
            db.add(prescription)
            db.flush()
            db.add(ocr_job)
            db.flush()
            db.add(BackgroundJob(
                kind="PROCESS_OCR",
                payload={"ocr_job_id": str(ocr_job.id)},
                status="PENDING",
            ))
            db.commit()
        except Exception:
            db.rollback()
            self.storage.delete(storage_key)
            raise

        return PrescriptionUploadResponse(
            prescription_id=prescription.id,
            job_id=ocr_job.id,
            prescription_status=prescription.status,
            job_status=ocr_job.status,
            expires_at=_to_utc(prescription.expires_at),
            poll_after_seconds=2,
            items=[],
        )

    def process_ocr_job(self, ocr_job_id: UUID, db: Session) -> None:
        """Run one queued OCR job. Safe to retry after a worker lease expires."""
        job = db.get(OcrJobs, ocr_job_id)
        if job is None:
            raise ValueError("OCR_JOB_NOT_FOUND")
        if job.status == "COMPLETED":
            return
        prescription = db.get(Prescriptions, job.prescription_id)
        if prescription is None or not prescription.original_file_url:
            raise ValueError("OCR_IMAGE_NOT_FOUND")
        if prescription.user_id:
            self.verify_ocr_consent(Principal(kind="USER", id=prescription.user_id), db)
        elif prescription.guest_session_id:
            self.verify_ocr_consent(Principal(kind="GUEST", id=prescription.guest_session_id), db)
            guest_session = db.get(GuestSession, prescription.guest_session_id)
            if guest_session.expires_at and _to_utc(guest_session.expires_at) <= datetime.now(timezone.utc):
                raise ValueError("GUEST_SESSION_EXPIRED")
        else:
            raise ValueError("OCR_OWNER_NOT_FOUND")

        job.status = "PROCESSING"
        job.started_at = datetime.now(timezone.utc)
        job.error_message = None
        db.query(OcrJobItems).filter(OcrJobItems.ocr_job_id == job.id).delete(synchronize_session=False)
        db.commit()

        image_bytes = self.storage.read(prescription.original_file_url)
        # OCR must always process the uploaded image; global demo AI settings never
        # substitute fixture output for a user's prescription.
        parsed = extract_full_prescription(image_bytes, mode=settings.OCR_MODE, use_mock=False)
        prescription.raw_ocr_text = parsed.raw_text
        prescription.healthcare_facility = parsed.facility_name

        confidences: List[float] = []
        for idx, med in enumerate(parsed.medications):
            med_conf = med.confidence if med.confidence is not None else 0.9
            confidences.append(med_conf)
            candidate_drug_id, resolution_status, top_candidates = self._resolve_drug_entity(med, db)

            dosage = f"{med.quantity} {med.unit}" if med.quantity and med.unit else med.unit
            db.add(OcrJobItems(
                id=uuid4(),
                ocr_job_id=job.id,
                item_order=idx + 1,
                extracted_name=med.drug_name,
                extracted_strength=med.strength,
                extracted_dosage=dosage,
                instructions=med.instructions,
                confidence=med_conf,
                candidate_drug_id=candidate_drug_id,
                resolution_status=resolution_status,
                candidates=top_candidates or None,
                created_at=datetime.now(timezone.utc),
            ))

        job.status = "COMPLETED"
        job.confidence = round(sum(confidences) / len(confidences), 4) if confidences else 1.0
        job.completed_at = datetime.now(timezone.utc)
        prescription.status = "PENDING_REVIEW"
        prescription.updated_at = datetime.now(timezone.utc)
        db.commit()

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

        items_dto = [_to_item_dto(item) for item in items]

        error_dto = None
        if job.status == "FAILED" and job.error_message:
            error_dto = OcrJobErrorDTO(
                code=job.error_message,
                message="Không thể xử lý nhận dạng đơn thuốc",
            )

        return OcrJobResponse(
            id=job.id,
            prescription_id=job.prescription_id,
            status=job.status,
            model_name=job.model_name,
            model_version=job.model_version,
            confidence=float(job.confidence) if job.confidence is not None else None,
            started_at=_to_utc(job.started_at),
            completed_at=_to_utc(job.completed_at),
            created_at=_to_utc(job.created_at),
            error=error_dto,
            items=items_dto,
        )

    def save_ocr_review(self, job_id: UUID, principal: Principal, request: OcrReviewRequest, db: Session) -> OcrReviewResponse:
        job = db.get(OcrJobs, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy tác vụ OCR")
        prescription = db.get(Prescriptions, job.prescription_id)
        if prescription is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn thuốc")
        kind = principal.kind.upper()
        owned = (kind == "USER" and prescription.user_id == principal.id) or (
            kind == "GUEST" and prescription.guest_session_id == principal.id
        )
        if not owned:
            raise HTTPException(status_code=404, detail="Không tìm thấy tác vụ OCR")
        if job.status != "COMPLETED":
            raise HTTPException(status_code=409, detail="Tác vụ OCR chưa hoàn tất")
        if kind == "USER":
            self.verify_ocr_consent(principal, db)
        source_ids = [row.source_ocr_item_id for row in request.items if row.source_ocr_item_id]
        if len(source_ids) != len(set(source_ids)):
            raise HTTPException(status_code=422, detail="Mục OCR nguồn bị lặp")
        source_items_by_id: Dict[UUID, OcrJobItems] = {}
        if source_ids:
            source_rows = (
                db.query(OcrJobItems)
                .filter(
                    OcrJobItems.ocr_job_id == job.id,
                    OcrJobItems.id.in_(source_ids),
                )
                .all()
            )
            source_items_by_id = {item.id: item for item in source_rows}
            if set(source_items_by_id.keys()) != set(source_ids):
                raise HTTPException(status_code=422, detail="Mục OCR nguồn không thuộc tác vụ này")

        db.query(PrescriptionItems).filter(PrescriptionItems.prescription_id == prescription.id).delete(synchronize_session=False)
        now = datetime.now(timezone.utc)
        for row in request.items:
            name = row.extracted_name.strip()
            if not name:
                raise HTTPException(status_code=422, detail="Tên thuốc không được để trống")
            if row.unresolved:
                drug_id, resolution_status = None, "UNRESOLVED_DRUG"
            else:
                drug_id, resolution_status, _ = self._resolve_drug_entity(
                    MedicationItem(
                        drug_name=name,
                        strength=row.extracted_strength,
                        confidence=row.confidence if row.confidence is not None else 1.0,
                        instructions=row.instructions,
                    ),
                    db,
                )
                if resolution_status != "MATCHED":
                    drug_id, resolution_status = None, "UNRESOLVED_DRUG"

            src_item = source_items_by_id.get(row.source_ocr_item_id) if row.source_ocr_item_id else None
            if src_item is not None:
                unchanged = (
                    name == (src_item.extracted_name or "").strip()
                    and (row.extracted_strength or None) == (src_item.extracted_strength or None)
                    and (row.extracted_dosage or None) == (src_item.extracted_dosage or None)
                    and (row.instructions or None) == (src_item.instructions or None)
                )
                verification_status = "VERIFIED_BY_USER" if unchanged else "EDITED_BY_USER"
                source_type = "OCR" if unchanged else "MANUAL_EDIT"
                item_confidence = float(src_item.confidence) if src_item.confidence is not None else row.confidence
            else:
                verification_status = "EDITED_BY_USER"
                source_type = "MANUAL_ENTRY"
                item_confidence = None

            db.add(PrescriptionItems(
                prescription_id=prescription.id,
                drug_id=drug_id,
                extracted_name=name,
                extracted_strength=row.extracted_strength,
                extracted_dosage=row.extracted_dosage,
                frequency=row.frequency,
                duration_days=row.duration_days,
                route=row.route,
                instructions=row.instructions,
                confidence=item_confidence,
                resolution_status=resolution_status,
                verification_status=verification_status,
                source_ocr_item_id=row.source_ocr_item_id,
                source_type=source_type,
                created_at=now,
                updated_at=now,
            ))
        prescription.status = "PENDING_REVIEW"
        prescription.updated_at = now
        db.commit()
        return OcrReviewResponse(prescription_id=prescription.id, saved_items=len(request.items), status=prescription.status)
