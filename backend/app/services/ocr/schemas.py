"""M4/M5 Data Schemas for Prescription OCR (Pydantic v2)."""

from typing import List, Optional
from pydantic import BaseModel, Field


class MedicationItem(BaseModel):
    """Single medication line extracted from a prescription."""

    drug_name: str = Field(..., min_length=1, description="Tên thuốc (VD: Omeprazole, Augmentine)")
    strength: Optional[str] = Field(default=None, description="Hàm lượng (VD: 20mg, 500mg)")
    quantity: Optional[int] = Field(default=None, ge=1, description="Số lượng (VD: 6, 10)")
    unit: Optional[str] = Field(default=None, description="Đơn vị tính (VD: Viên, Hộp, Gói)")
    instructions: Optional[str] = Field(default=None, description="Cách dùng / Ghi chú (VD: uống trước khi ăn 30 phút)")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Độ tin cậy nhận dạng (0.0 - 1.0)")


class PrescriptionData(BaseModel):
    """Structured output for a full medical prescription."""

    prescription_code: Optional[str] = Field(default=None, description="Mã đơn thuốc nếu có")
    facility_name: Optional[str] = Field(default=None, description="Tên bệnh viện / phòng khám")
    diagnosis: Optional[str] = Field(default=None, description="Chẩn đoán bệnh")
    raw_text: str = Field(default="", description="Văn bản thô nhận dạng được")
    medications: List[MedicationItem] = Field(default_factory=list, description="Danh sách thuốc trích xuất")
