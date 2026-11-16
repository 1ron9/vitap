"""M3. Vision-Language Model (VLM) for Handwriting & Mixed Prescription Recognition."""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Union

from .preprocessing import load_image

SYSTEM_PROMPT = """Bạn là hệ thống AI chuyên nhận dạng đơn thuốc y tế Việt Nam (chữ in và chữ viết tay bác sĩ).
Hãy đọc ảnh đơn thuốc và trích xuất chính xác sang định dạng JSON theo cấu trúc sau:
{
  "prescription_code": "Mã đơn thuốc nếu có hoặc null",
  "facility_name": "Tên bệnh viện/phòng khám hoặc null",
  "diagnosis": "Chẩn đoán bệnh hoặc null",
  "raw_text": "Toàn bộ văn bản đọc được trên đơn",
  "medications": [
    {
      "drug_name": "Tên thuốc (không kèm hàm lượng)",
      "strength": "Hàm lượng (VD: 20mg, 500mg, 375mg) hoặc null",
      "quantity": 6,
      "unit": "Đơn vị (VD: Viên, Hộp, Gói, Ống)",
      "instructions": "Hướng dẫn uống (VD: uống trước khi ăn 30 phút, Sáng 1 viên chiều 1 viên)",
      "confidence": 0.95
    }
  ]
}
Quy tắc bắt buộc:
- Giải nghĩa chữ viết tắt y khoa phổ biến: 'v' -> 'Viên', 'ng' -> 'ngày', 'u' -> 'uống', 'S-T-C' -> 'Sáng - Trưa - Chiều'.
- Không tự suy diễn thêm thuốc không có trên đơn. Nếu chữ viết tay mờ không rõ, giảm điểm confidence (< 0.7).
- Chỉ trả về chuỗi JSON hợp lệ, không kèm markdown giải thích."""


DEFAULT_MOCK_VLM_RESPONSE: Dict[str, Any] = {
    "prescription_code": "M.1457500.1108",
    "facility_name": "Phòng khám Đa khoa",
    "diagnosis": "Viêm dạ dày - Nhiễm khuẩn hô hấp",
    "raw_text": (
        "Đơn thuốc M.1457500.1108\n"
        "1. Omeprazole 20mg (uống trước khi ăn 30 phút) - SL: 6 Viên\n"
        "2. Erythromycin 500mg - SL: 1 Viên\n"
        "3. Canxi D3 K2 - SL: 1 Hộp\n"
        "4. Augmentine 375mg - SL: 1 Viên"
    ),
    "medications": [
        {
            "drug_name": "Omeprazole",
            "strength": "20mg",
            "quantity": 6,
            "unit": "Viên",
            "instructions": "uống trước khi ăn 30 phút",
            "confidence": 0.96,
        },
        {
            "drug_name": "Erythromycin",
            "strength": "500mg",
            "quantity": 1,
            "unit": "Viên",
            "instructions": None,
            "confidence": 0.94,
        },
        {
            "drug_name": "Canxi D3 K2",
            "strength": None,
            "quantity": 1,
            "unit": "Hộp",
            "instructions": None,
            "confidence": 0.95,
        },
        {
            "drug_name": "Augmentine",
            "strength": "375mg",
            "quantity": 1,
            "unit": "Viên",
            "instructions": None,
            "confidence": 0.91,
        },
    ],
}


def _resolve_gemini_api_key() -> str:
    env_key = os.environ.get("GEMINI_API_KEY", "")
    if env_key:
        return env_key
    try:
        from app.core.config import settings
        return settings.GEMINI_API_KEY
    except Exception:
        return ""


class VisionModelEngine:
    """Gemini Vision client for handwritten and mixed prescription images."""

    def __init__(
        self,
        provider: str = "gemini",
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        use_mock: bool = False,
    ):
        from app.core.config import settings

        self.provider = provider.lower()
        self.model_name = model_name or settings.GEMINI_VISION_MODEL
        self.api_key = api_key or _resolve_gemini_api_key()
        self.use_mock = use_mock
        self.timeout_seconds = settings.OCR_TIMEOUT_SECONDS

    def analyze_image(self, image_source: Union[str, Path, Any]) -> Dict[str, Any]:
        """Send image to VLM and return parsed dictionary."""
        img = load_image(image_source)

        if self.use_mock:
            return dict(DEFAULT_MOCK_VLM_RESPONSE)

        provider = self.provider
        if provider != "gemini":
            raise ValueError(f"Unsupported OCR provider: {self.provider!r}. Only 'gemini' is supported.")
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            raise RuntimeError("GEMINI_API_KEY is required for handwritten and mixed OCR")
        return self._call_gemini(img)

    def _call_gemini(self, img) -> Dict[str, Any]:
        import google.generativeai as genai

        genai.configure(api_key=self.api_key)
        candidates = []
        for name in (
            self.model_name,
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-flash-lite-latest",
        ):
            if name and name not in candidates:
                candidates.append(name)

        last_exc: Optional[Exception] = None
        for candidate in candidates:
            try:
                model = genai.GenerativeModel(candidate)
                response = model.generate_content(
                    [SYSTEM_PROMPT, img],
                    request_options={"timeout": self.timeout_seconds, "retry": None},
                )
                return self._clean_and_parse_json(response.text)
            except Exception as exc:
                last_exc = exc
                msg = str(exc).lower()
                if any(code in msg for code in ("429", "quota", "resourceexhausted", "404", "not found")):
                    continue
                raise
        if last_exc is not None:
            raise last_exc
        raise RuntimeError("Gemini Vision call failed")

    @staticmethod
    def _clean_and_parse_json(raw_output: str) -> Dict[str, Any]:
        cleaned = raw_output.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            lines = [line for line in lines if not line.strip().startswith("```")]
            cleaned = "\n".join(lines).strip()
        return json.loads(cleaned)
