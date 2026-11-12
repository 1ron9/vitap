"""
Module M4 Sandbox Tests: Động cơ Đối soát Tương tác Thuốc (DDI) & Chống chỉ định (DCI)
Phụ trách chính (Owner): VT3 - Dương Phan Minh Trí (MSSV: 24120470)
Quy tắc: Thành viên khác KHÔNG tự ý chỉnh sửa file test này.
"""

def test_m4_check_interactions_stub(client):
    """Kiểm tra M4: Đối soát tương tác thuốc trả về mức nguy cơ."""
    response = client.get("/api/v1/ddi/check?drug_ids=1&drug_ids=2")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["RED", "YELLOW", "GREEN", "UNKNOWN_RISK"]
    assert "warnings" in data
