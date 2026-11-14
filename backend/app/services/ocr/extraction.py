"""M4. Information Extraction Module (Convert OCR/VLM outputs into structured PrescriptionData)."""

import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .ocr import PrintedOCREngine
from .preprocessing import preprocess_image
from .schemas import MedicationItem, PrescriptionData
from .vision_model import VisionModelEngine

STRENGTH_PATTERN = re.compile(r"\b(\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|ml|iu|ui|%))\b", re.IGNORECASE)
QTY_UNIT_PATTERN = re.compile(
    r"(?:số lượng|sl|x|:)?\s*(\d+)\s*(viên|hộp|gói|ống|lọ|chai|tuýp|vỉ)\b",
    re.IGNORECASE,
)
LINE_PREFIX_PATTERN = re.compile(r"^\s*\d+[\.\)\-]\s*")


def parse_medication_line(text: str, confidence: float = 1.0) -> Optional[MedicationItem]:
    """Parse a single Vietnamese medication line into a structured MedicationItem."""
    cleaned = LINE_PREFIX_PATTERN.sub("", text).strip()
    if not cleaned:
        return None

    strength = None
    strength_match = STRENGTH_PATTERN.search(cleaned)
    if strength_match:
        strength = strength_match.group(1).replace(" ", "")

    quantity = None
    unit = None
    qty_match = QTY_UNIT_PATTERN.search(cleaned)
    if qty_match:
        quantity = int(qty_match.group(1))
        unit = qty_match.group(2).capitalize()

    # Extract instructions inside parentheses or after dash
    instructions = None
    paren_match = re.search(r"\(([^)]+)\)", cleaned)
    if paren_match:
        instructions = paren_match.group(1).strip()

    parts = [p.strip() for p in re.split(r"\s+-\s+", cleaned) if p.strip()]
    drug_part = parts[0]
    drug_part = re.sub(r"\([^)]*\)", "", drug_part)
    if strength_match:
        drug_part = drug_part.replace(strength_match.group(0), "")
    drug_name = re.sub(r"\s+", " ", drug_part).strip(" -:,")

    if not instructions and len(parts) > 1:
        extra_parts = [
            p for p in parts[1:] if not QTY_UNIT_PATTERN.search(p) and "số lượng" not in p.lower()
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

    stop_keywords = ("lời dặn", "ngày hẹn", "bệnh nhân ký", "bác sĩ điều trị", "tái khám")

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
    mode: str = "vlm",
    preprocess: bool = True,
    use_mock: bool = False,
) -> PrescriptionData:
    """End-to-end M2 -> M3 -> M4 pipeline returning validated PrescriptionData."""
    img = preprocess_image(image_source) if preprocess else image_source

    if mode == "printed":
        ocr_engine = PrintedOCREngine(use_mock=use_mock)
        lines = ocr_engine.extract_lines(img)
        return parse_ocr_lines_to_prescription(lines)

    if mode == "vlm":
        vlm_engine = VisionModelEngine(use_mock=use_mock)
        raw_dict = vlm_engine.analyze_image(img)
        return PrescriptionData.model_validate(raw_dict)

    raise ValueError(f"Unsupported extraction mode: '{mode}'. Choose 'vlm' or 'printed'.")
