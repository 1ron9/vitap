"""
OCR Scanner Service
Phụ trách: VT1 (Data & Medical AI) & VT3 (Vision / Clinical DDI)
Trích xuất tên thuốc, hàm lượng, liều dùng có cấu trúc từ hình ảnh đơn thuốc.
"""

import os
from typing import Any, Dict, List, Optional
from .extraction import extract_prescription
from .schemas import MedicationItem, PrescriptionData


def extract_full_prescription(
    image_bytes: bytes,
    mode: Optional[str] = None,
    use_mock: Optional[bool] = None,
) -> PrescriptionData:
    """End-to-end extraction from image bytes to validated PrescriptionData."""
    if use_mock is None:
        from app.core.config import settings
        env_mock = os.environ.get("USE_MOCK_AI")
        use_mock = (
            env_mock.strip().lower() in {"1", "true", "yes", "on"}
            if env_mock is not None
            else settings.USE_MOCK_AI
        )

    return extract_prescription(
        image_source=image_bytes,
        mode=mode,
        preprocess=True,
        use_mock=use_mock,
    )


def extract_drugs_from_image(
    image_bytes: bytes,
    mode: Optional[str] = None,
    use_mock: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    """Legacy compatibility interface returning list of raw drug items."""
    prescription = extract_full_prescription(image_bytes, mode=mode, use_mock=use_mock)
    results = []
    for med in prescription.medications:
        name_with_strength = med.drug_name
        if med.strength:
            name_with_strength = f"{med.drug_name} {med.strength}"
        results.append({
            "raw_name": name_with_strength,
            "drug_name": med.drug_name,
            "strength": med.strength,
            "quantity": med.quantity,
            "unit": med.unit,
            "instructions": med.instructions,
            "confidence": med.confidence,
        })
    return results
