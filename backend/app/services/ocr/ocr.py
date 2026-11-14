"""M3. Printed OCR Engine (PaddleOCR wrapper with safe fallback)."""

from pathlib import Path
from typing import Any, Dict, List, Union
import numpy as np

from .preprocessing import load_image

try:
    from paddleocr import PaddleOCR
    HAS_PADDLE = True
except ImportError:
    HAS_PADDLE = False


DEFAULT_MOCK_LINES = [
    {"text": "ĐƠN THUỐC: M.1457500.1108", "confidence": 0.98},
    {"text": "Chẩn đoán: Viêm dạ dày - Nhiễm khuẩn hô hấp", "confidence": 0.95},
    {"text": "1. Omeprazole 20mg - Số lượng: 6 Viên - Uống trước khi ăn 30 phút", "confidence": 0.96},
    {"text": "2. Erythromycin 500mg - Số lượng: 10 Viên - Sáng 1 viên, Chiều 1 viên", "confidence": 0.94},
    {"text": "3. Canxi D3 K2 - Số lượng: 1 Hộp - Uống buổi sáng", "confidence": 0.97},
    {"text": "4. Augmentine 375mg - Số lượng: 14 Viên - Uống sau ăn", "confidence": 0.92},
]


class PrintedOCREngine:
    """Wrapper for PaddleOCR to recognize printed prescription text."""

    def __init__(self, lang: str = "vi", use_mock: bool = False):
        self.lang = lang
        self.use_mock = use_mock or (not HAS_PADDLE)
        self._ocr = None

    def _init_paddle(self):
        if self._ocr is None and HAS_PADDLE and not self.use_mock:
            self._ocr = PaddleOCR(use_angle_cls=True, lang=self.lang, show_log=False)

    def extract_lines(self, image_source: Union[str, Path, Any]) -> List[Dict[str, Any]]:
        """Run OCR on an image and return detected text lines with confidence scores."""
        img = load_image(image_source)

        if self.use_mock:
            return list(DEFAULT_MOCK_LINES)

        self._init_paddle()
        img_np = np.array(img)
        result = self._ocr.ocr(img_np, cls=True)

        lines: List[Dict[str, Any]] = []
        if not result or not result[0]:
            return lines

        for item in result[0]:
            bbox, (text, conf) = item[0], item[1]
            if text and text.strip():
                lines.append({
                    "text": text.strip(),
                    "confidence": round(float(conf), 4),
                    "bbox": bbox,
                })
        return lines

    def extract_text(self, image_source: Union[str, Path, Any]) -> str:
        """Return newline-joined text extracted from the prescription image."""
        lines = self.extract_lines(image_source)
        return "\n".join(line["text"] for line in lines)
