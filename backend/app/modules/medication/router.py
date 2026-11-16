"""Router endpoints for Medication and Prescription OCR."""
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.medication.schemas import OcrJobResponse, PrescriptionUploadResponse
from app.modules.medication.service import MAX_UPLOAD_BYTES, MedicationOcrService
from app.shared.principal import Principal, get_principal

router = APIRouter(tags=["F2/M2 - Số hóa Đơn thuốc & Dược phẩm"])
ocr_service = MedicationOcrService()
_READ_CHUNK_BYTES = 64 * 1024


@router.post(
    "/prescriptions/ocr",
    response_model=PrescriptionUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload ảnh đơn thuốc và chạy nhận dạng OCR/VLM",
)
async def upload_prescription_ocr(
    image_file: UploadFile = File(..., description="Tệp ảnh đơn thuốc JPEG/PNG (tối đa 10 MiB)"),
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
):
    await run_in_threadpool(ocr_service.verify_ocr_consent, principal, db)

    if image_file.size is not None and image_file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Tệp quá lớn, tối đa 10 MiB")

    buf = bytearray()
    while chunk := await image_file.read(_READ_CHUNK_BYTES):
        buf.extend(chunk)
        if len(buf) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Tệp quá lớn, tối đa 10 MiB")

    if not buf:
        raise HTTPException(
            status_code=422,
            detail="INVALID_IMAGE: Tệp ảnh tải lên bị rỗng",
        )

    return await run_in_threadpool(
        ocr_service.process_prescription_upload,
        image_bytes=bytes(buf),
        principal=principal,
        db=db,
    )


@router.get(
    "/ocr-jobs/{job_id}",
    response_model=OcrJobResponse,
    summary="Lấy kết quả bóc tách từng dòng thuốc của tác vụ OCR",
)
def get_ocr_job_status(
    job_id: UUID,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
):
    if principal.kind.upper() not in ("USER", "GUEST"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cần đăng nhập hoặc cung cấp phiên Guest để xem kết quả OCR",
        )

    return ocr_service.get_ocr_job(job_id=job_id, principal=principal, db=db)
