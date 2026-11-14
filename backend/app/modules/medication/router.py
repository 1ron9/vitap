"""Router endpoints for Medication and Prescription OCR."""
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.medication.schemas import OcrJobResponse, PrescriptionUploadResponse
from app.modules.medication.service import MedicationOcrService
from app.shared.principal import Principal, get_principal

router = APIRouter(tags=["F2/M2 - Số hóa Đơn thuốc & Dược phẩm"])
ocr_service = MedicationOcrService()


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
    if principal.kind.upper() not in ("USER", "GUEST"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cần đăng nhập hoặc cung cấp phiên Guest để quét đơn thuốc",
        )

    content = await image_file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tệp ảnh tải lên bị rỗng",
        )

    return ocr_service.process_prescription_upload(
        image_bytes=content,
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
