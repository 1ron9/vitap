# VitaP - Sổ Tay Y Tế Cá Nhân Hóa & Tra Cứu Dược Phẩm Thông Minh

**Đồ án môn học:** Nhập môn Công nghệ Phần mềm (NMCNPM) - FIT, Trường ĐH Khoa học Tự nhiên, ĐHQG-HCM  
**Nhóm tác giả (4 thành viên):**
- **Trương Huệ Trí** (`24120472`) - Product Owner & Data Core Lead (VT1)
- **Nguyễn Bảo Trọng** (`24120476`) - Full Stack Developer, DevOps & QA Lead (VT2)
- **Dương Phan Minh Trí** (`24120470`) - Frontend Lead & Clinical DDI Engine Lead (VT3)
- **Lê Thanh Phong** (`24120409`) - AI Assistant & Medical RAG Lead (VT4)

---

## 🏛️ Kiến Trúc Chuẩn Hóa 3 Phân Hệ (3 Client Modules)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        TẦNG GIAO DIỆN (CLIENT)                         │
│                     React (Vite) + Tailwind CSS                        │
├───────────────────┬────────────────────────────┬───────────────────────┤
│ F1: HỒ SƠ & CHỈ SỐ│   F2: TRA CỨU DƯỢC PHẨM    │   F3: TRỢ LÝ HỎI ĐÁP  │
│(Personal Health)  │    (DDI & Safety Engine)   │    (Medical RAG AI)   │
└───────────────────┴────────────────────────────┴───────────────────────┘
```

1. **F1: Hồ sơ & Chỉ số Sinh hiệu (VT1 & VT2):**
   - Đăng ký, đăng nhập JWT, hồ sơ bệnh nền ICD-10 và dị ứng thuốc.
   - Sổ tay nhật ký đo (`health_logs`): Huyết áp (tâm thu/tâm trương), nhịp tim, cân nặng, đường huyết.
   - Biểu đồ xu hướng (Line Charts) trực quan hóa dữ liệu sức khỏe theo thời gian trên Dashboard.
2. **F2: Tra cứu Dược phẩm & DDI Engine (VT1 & VT3):**
   - CSDL Dược học 3NF (220+ biệt dược, 110+ hoạt chất).
   - Động cơ kiểm tra tương tác thuốc (DDI) Canonical Pair và chống chỉ định bệnh nền (DCI) hiển thị thẻ Đỏ/Vàng/Xanh.
   - Cổng nhập liệu thông minh (Smart Input OCR): Quét ảnh đơn thuốc $\rightarrow$ Gemini 1.5 Flash Vision $\rightarrow$ Fuzzy Matcher $\rightarrow$ Tự động đổ thuốc vào Tra cứu F2.
3. **F3: Trợ lý Hỏi đáp AI (VT4):**
   - Chatbot RAG y tế dựa trên kho cẩm nang Bộ Y Tế, phản hồi câu hỏi lối sống/dinh dưỡng qua SSE Streaming thời gian thực kèm Medical Guardrails an toàn.

---

## 📚 Tài Liệu Kỹ Thuật Trọng Tâm (Single Source of Truth)

1. [**`docs/TASKS.md`**](docs/TASKS.md) — Ma trận 24 nhiệm vụ kỹ thuật chi tiết (Assignee, Reviewer, Input, Output, DoD).
2. [**`docs/api_contracts.md`**](docs/api_contracts.md) — Hợp đồng dữ liệu & đặc tả toàn bộ API Endpoints giữa Frontend và Backend.
3. [**`docs/uml/database_erd.md`**](docs/uml/database_erd.md) — Sơ đồ CSDL 3NF (9 bảng), Từ điển dữ liệu và mã nguồn DBML cho [dbdiagram.io](https://dbdiagram.io).

---

## 🚀 Hướng Dẫn Chạy Môi Trường Phát Triển (Local Setup)

### 1. Khởi chạy Backend (FastAPI):
```bash
cd backend
python -m venv venv
source venv/bin/activate       # Trên Linux/macOS (hoặc venv\Scripts\activate trên Windows)
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
- Swagger API Docs: `http://localhost:8000/docs`
- Chạy kiểm thử tự động:
  ```bash
  pytest tests/ -v
  ```

### 2. Khởi chạy Frontend (React + Vite):
```bash
cd frontend
npm install
npm run dev
```
- Ứng dụng chạy tại: `http://localhost:5173`

---

## 📋 Quy Định Đóng Góp (Git & PR Workflow)
Vui lòng đọc kỹ file [CONTRIBUTING.md](CONTRIBUTING.md):
- **Nguyên tắc sống còn:** *"Chỉ sửa file của mình. Cần sửa file người khác thì nhắn người đó."*
- **Kiểm thử tự động:** Mọi Pull Request bắt buộc phải vượt qua GitHub Actions CI Pytest trước khi merge vào `main`.
