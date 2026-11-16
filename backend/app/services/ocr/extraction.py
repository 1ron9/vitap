"""M4. Information Extraction Module (Convert OCR/VLM outputs into structured PrescriptionData)."""

import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .ocr import HAS_PADDLE, PrintedOCREngine
from .preprocessing import preprocess_image
from .schemas import MedicationItem, PrescriptionData
from .vision_model import VisionModelEngine, _resolve_gemini_api_key
from app.core.config import settings

STRENGTH_PATTERN = re.compile(
    r"\b(\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|ml|iu|ui|%)(?:\s*[\+/]\s*\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|ml|iu|ui|%)?)*)",
    re.IGNORECASE,
)
QTY_UNIT_PATTERN = re.compile(
    r"(?:số lượng|sl|x|:)?\s*(\d+)\s*(viên|hộp|gói|ống|lọ|chai|tuýp|vỉ)\b",
    re.IGNORECASE,
)
DOSAGE_SCHEDULE_KEYWORDS = ("sáng", "trưa", "chiều", "chiu", "tối", "uống", "ngày", "lần", "trước", "sau", "ghi chú")
LINE_PREFIX_PATTERN = re.compile(r"^\s*\d+\s*(?:[\.\)\-]\s*|\s+(?=[A-Za-zÀ-ỹ]{3,}))")


def _is_pure_quantity_part(part: str) -> bool:
    low = part.lower()
    if "số lượng" in low or low.startswith("sl:") or low.startswith("sl "):
        return True
    if any(kw in low for kw in DOSAGE_SCHEDULE_KEYWORDS):
        return False
    return bool(QTY_UNIT_PATTERN.search(part))


def parse_medication_line(text: str, confidence: float = 1.0) -> Optional[MedicationItem]:
    """Parse a single Vietnamese medication line into a structured MedicationItem."""
    cleaned = LINE_PREFIX_PATTERN.sub("", text).strip()
    if not cleaned:
        return None

    parts = [p.strip() for p in re.split(r"\s+-\s+", cleaned) if p.strip()]
    drug_part = parts[0]

    strength = None
    strength_match = STRENGTH_PATTERN.search(drug_part) or STRENGTH_PATTERN.search(cleaned)
    if strength_match:
        strength = re.sub(r"\s+", "", strength_match.group(1))

    quantity = None
    unit = None
    qty_source = next((p for p in parts if _is_pure_quantity_part(p)), cleaned)
    qty_match = QTY_UNIT_PATTERN.search(qty_source)
    if qty_match:
        quantity = int(qty_match.group(1))
        unit = qty_match.group(2).capitalize()

    # Extract instructions inside parentheses or after dash
    instructions = None
    paren_match = re.search(r"\(([^)]+)\)", cleaned)
    if paren_match:
        instructions = paren_match.group(1).strip()

    drug_part = re.sub(r"\([^)]*\)", "", drug_part)
    if strength_match:
        drug_part = STRENGTH_PATTERN.sub("", drug_part)
    drug_name = re.sub(r"\s+", " ", drug_part).strip(" -:,+")

    if not instructions and len(parts) > 1:
        extra_parts = [
            p for p in parts[1:] if not _is_pure_quantity_part(p)
        ]
        if extra_parts:
            instructions = "; ".join(extra_parts)

    if not drug_name:
        return None

    return MedicationItem(
        drug_name=drug_name,
        strength=strength,
        quantity=quantity,
        unit=unit,
        instructions=instructions,
        confidence=round(float(confidence), 4),
    )


def parse_ocr_lines_to_prescription(lines: List[Dict[str, Any]]) -> PrescriptionData:
    """Convert raw OCR text lines from M3 PrintedOCREngine into M4 PrescriptionData."""
    raw_lines: List[str] = []
    prescription_code = None
    facility_name = None
    diagnosis = None
    medications: List[MedicationItem] = []

    # Buffer for grouping multi-line medication blocks (e.g., Line 1: Drug Name, Line 2: SL, Line 3: Usage)
    current_block: List[Dict[str, Any]] = []

    def flush_block():
        if not current_block:
            return
        combined_text = " - ".join(item["text"] for item in current_block)
        avg_conf = sum(item.get("confidence", 1.0) for item in current_block) / len(current_block)
        med = parse_medication_line(combined_text, confidence=avg_conf)
        if med:
            medications.append(med)
        current_block.clear()

    stop_keywords = ("cộng khoản", "lời dặn", "ngày hẹn", "bệnh nhân ký", "bác sĩ điều trị", "tái khám")

    for item in lines:
        text = str(item.get("text", "")).strip()
        conf = float(item.get("confidence", 1.0))
        if not text:
            continue
        raw_lines.append(text)
        lower = text.lower()

        # Check if footer section reached
        if any(kw in lower for kw in stop_keywords):
            flush_block()
            continue

        if "đơn thuốc" in lower and not prescription_code:
            code_match = re.search(r"([A-Z0-9]+(?:\.[A-Z0-9]+)+)", text)
            if code_match:
                prescription_code = code_match.group(1)
            continue

        if ("bệnh viện" in lower or "phòng khám" in lower) and not facility_name:
            facility_name = text
            continue

        if "chẩn đoán" in lower or "chấn đoán" in lower:
            diagnosis = re.sub(r"^.*?ch[ẩấ]n đoán\s*[:\-]?\s*", "", text, flags=re.IGNORECASE).strip()
            continue

        # If a line starts with a medication index (1., 1), 2., 2), etc.)
        if LINE_PREFIX_PATTERN.match(text):
            flush_block()
            current_block.append({"text": text, "confidence": conf})
        elif current_block:
            # Continue accumulating details (e.g. SL: 20 Viên, Ghi chú, Sáng 1 viên)
            current_block.append({"text": text, "confidence": conf})
        elif STRENGTH_PATTERN.search(text) or QTY_UNIT_PATTERN.search(text):
            med = parse_medication_line(text, confidence=conf)
            if med:
                medications.append(med)

    flush_block()

    return PrescriptionData(
        prescription_code=prescription_code,
        facility_name=facility_name,
        diagnosis=diagnosis,
        raw_text="\n".join(raw_lines),
        medications=medications,
    )


def extract_prescription(
    image_source: Union[str, Path, Any],
    mode: Optional[str] = None,
    preprocess: bool = True,
    use_mock: bool = False,
) -> PrescriptionData:
    """End-to-end M2 -> M3 -> M4 pipeline returning validated PrescriptionData."""
    mode = (mode or settings.OCR_MODE).lower()
    img = preprocess_image(image_source) if preprocess else image_source

    if mode == "printed" and not use_mock and not HAS_PADDLE:
        api_key = _resolve_gemini_api_key()
        if api_key and api_key != "your_gemini_api_key_here":
            mode = "vlm"

    if mode == "printed":
        ocr_engine = PrintedOCREngine(
            lang=settings.OCR_LANG,
            device=settings.OCR_PADDLE_DEVICE,
            use_mock=use_mock,
        )
        lines = ocr_engine.extract_lines(img)
        return parse_ocr_lines_to_prescription(lines)

    if mode == "vlm":
        vlm_engine = VisionModelEngine(use_mock=use_mock)
        raw_dict = vlm_engine.analyze_image(img)
        return PrescriptionData.model_validate(raw_dict)

    raise ValueError(f"Unsupported extraction mode: '{mode}'. Choose 'vlm' or 'printed'.")
