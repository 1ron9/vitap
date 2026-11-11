from fastapi import APIRouter
router = APIRouter()

@router.post("/ask")
def ask_assistant(question: str):
    return {
        "answer": "Stub M3: Người bị huyết áp cao nên hạn chế ăn mặn.",
        "source": "Hướng dẫn Dinh dưỡng Bộ Y tế",
        "disclaimer": "Thông tin chỉ mang tính tham khảo"
    }
