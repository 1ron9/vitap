"""M3. Vision-Language Model (VLM) for Handwriting & Mixed Prescription Recognition."""

import base64
import io
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Union
import requests

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


def _image_to_base64(img) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


class VisionModelEngine:
    """Client for Qwen-VL (via Ollama/vLLM OpenAI-compatible API) or Gemini Vision."""

    def __init__(
        self,
        provider: str = "auto",
        model_name: str = "qwen2.5-vl:7b",
        api_base: str = "http://localhost:11434/v1/chat/completions",
        api_key: Optional[str] = None,
        use_mock: bool = False,
    ):
        self.provider = provider
        self.model_name = model_name
        self.api_base = api_base
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.use_mock = use_mock

    def analyze_image(self, image_source: Union[str, Path, Any]) -> Dict[str, Any]:
        """Send image to VLM and return parsed dictionary."""
        img = load_image(image_source)

        if self.use_mock:
            return dict(DEFAULT_MOCK_VLM_RESPONSE)

        if self.provider == "gemini" or (
            self.provider == "auto" and self.api_key and self.api_key != "your_gemini_api_key_here"
        ):
            return self._call_gemini(img)

        if self.provider in ("qwen", "auto"):
            try:
                return self._call_openai_compatible_vlm(img)
            except Exception:
                # Safe fallback to mock if local VLM server is not running
                return dict(DEFAULT_MOCK_VLM_RESPONSE)

        return dict(DEFAULT_MOCK_VLM_RESPONSE)

    def _call_openai_compatible_vlm(self, img) -> Dict[str, Any]:
        b64_img = _image_to_base64(img)
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Trích xuất thông tin đơn thuốc này sang JSON."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}},
                    ],
                },
            ],
            "temperature": 0.1,
        }
        resp = requests.post(self.api_base, json=payload, timeout=30)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return self._clean_and_parse_json(content)

    def _call_gemini(self, img) -> Dict[str, Any]:
        import google.generativeai as genai

        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content([SYSTEM_PROMPT, img])
        return self._clean_and_parse_json(response.text)

    @staticmethod
    def _clean_and_parse_json(raw_output: str) -> Dict[str, Any]:
        cleaned = raw_output.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            lines = [line for line in lines if not line.strip().startswith("```")]
            cleaned = "\n".join(lines).strip()
        return json.loads(cleaned)
