"""
Module M3 Sandbox Tests: Trợ lý Sức khỏe & Dinh dưỡng AI (RAG + Guardrails)
Phụ trách chính (Owner): VT4 - Lê Thanh Phong (MSSV: 24120409)
Quy tắc: Thành viên khác KHÔNG tự ý chỉnh sửa file test này.
"""

def test_m3_chatbot_ask_with_citation(client):
    """Kiểm tra M3: Hỏi đáp y tế trả về nguồn trích dẫn Bộ Y tế và câu khuyến cáo."""
    response = client.post("/api/v1/chatbot/ask?question=Toi%20bi%20huyet%20ap%20cao")
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "source" in data
    assert "disclaimer" in data
