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

## 📚 Tài Liệu Kỹ Thuật (Lưu trữ nội bộ)
Tài liệu kiến trúc, ma trận nhiệm vụ (TASKS), hợp đồng API và sơ đồ CSDL 3NF được quản lý nội bộ bởi nhóm tác giả (được lưu tại thư mục `docs/` trên máy phát triển).

---

## 🚀 Hướng Dẫn Chạy Môi Trường Phát Triển (Local Setup)

### FD-01: Chạy backend và PostgreSQL + pgvector bằng Docker Compose

Yêu cầu: Git, Docker Engine/Docker Desktop đang chạy và Docker Compose v2 có hỗ trợ `up --wait`. Trên Windows dùng Linux containers. Chạy các lệnh dưới đây tại thư mục gốc repo.

1. Tạo cấu hình local:

   PowerShell (Windows):
   ```powershell
   Copy-Item .env.example .env
   ```
   Linux/macOS:
   ```bash
   cp .env.example .env
   ```

2. Kiểm tra `.env`: đặt `POSTGRES_PASSWORD`, `SECRET_KEY` và để `USE_MOCK_AI=true`. Giá trị mẫu chỉ dành cho máy local. Nếu mật khẩu có `$`, dùng giá trị bọc trong dấu nháy đơn theo cú pháp `.env` của Compose. Không commit `.env` hay API key.

3. Kiểm tra cấu hình và khởi chạy:
   ```bash
   docker compose config --quiet
   docker compose up --build --wait --wait-timeout 180
   docker compose ps
   ```

4. Mở các địa chỉ sau (đổi cổng nếu đã chỉnh `BACKEND_PORT`):

   | Địa chỉ | Kết quả mong đợi |
   | --- | --- |
   | http://localhost:8000/docs | Swagger UI |
   | http://localhost:8000/health | HTTP 200, `{"status":"ok"}`; không phụ thuộc database |
   | http://localhost:8000/ready | HTTP 200, `{"status":"ok","database":"ok","pgvector":"ok"}` |

`/ready` truy vấn database thật và kiểm tra extension `vector`; trả HTTP 503 nếu database lỗi hoặc thiếu extension. SQLite dùng cho unit test không được xem là PostgreSQL sẵn sàng. Healthcheck của backend dùng `/ready`.

Compose dùng Dockerfile ở gốc để build backend và image `pgvector/pgvector:0.8.1-pg16` cho database. Backend kết nối qua hostname `db`; PostgreSQL không mở cổng ra máy host. API chỉ bind vào `127.0.0.1`. Các trường `POSTGRES_*` được ghép bằng SQLAlchemy URL để hỗ trợ mật khẩu có ký tự đặc biệt. Không cần cài PostgreSQL hoặc Python trên máy để chạy Compose.

Database mới tự bật `vector` qua `docker/postgres/init/001_extensions.sql`. Script init chỉ chạy khi volume còn trống. Nếu dùng lại volume có sẵn nhưng thiếu extension, chạy:
```bash
docker compose exec db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS vector;"'
```
Lệnh trên dùng shell Linux/macOS hoặc Git Bash; trên PowerShell có thể mở `docker compose exec db sh` rồi chạy lệnh `psql` bên trong.

Task này chỉ khởi tạo extension, không tạo schema nghiệp vụ/seed dữ liệu. `/ready` xanh xác nhận hạ tầng; các API tài khoản/hồ sơ có thể còn cần schema hoặc migrations từ task tiếp theo.

Các lệnh thường dùng:
```bash
docker compose logs -f backend db
docker compose down
docker compose up --wait --wait-timeout 180
```
`down` giữ dữ liệu trong volume `postgres_data`. Chỉ dùng `docker compose down --volumes` khi muốn xóa toàn bộ database local. Đổi user/password trong `.env` không tự đổi tài khoản trong một volume đã được khởi tạo.

Kiểm thử tích hợp FD-01 (cần Python 3.11+ trên máy host):
```bash
python scripts/smoke_compose.py
```
Script dành riêng project `vitap-fd01-smoke`, dùng cổng host ngẫu nhiên và tự xóa volume thử khi kết thúc; không chạy đồng thời hai bản script. Kiểm tra API, phép toán vector thật, dữ liệu sau `down`/`up`, HTTP 503 khi dừng database và phục hồi sau khi database chạy lại. GitHub Actions chạy cùng script này, bên cạnh toàn bộ pytest.

Xử lý lỗi thường gặp:
- Không kết nối Docker daemon: mở Docker Desktop/khởi động Docker Engine.
- Cổng 8000 đã dùng: đổi `BACKEND_PORT` trong `.env` rồi chạy lại.
- Database không healthy: xem `docker compose logs db`; xác nhận cấu hình khớp với tài khoản đã lưu trong volume.
- Backend không healthy: xem `docker compose logs backend` và `/ready`; kiểm tra extension như hướng dẫn trên. Không đăng log chứa mật khẩu lên repo.

Docker chỉ cài `backend/requirements-runtime.txt` cho skeleton. Các công cụ AI/data đang có vẫn được giữ trong `backend/requirements.txt`; module nào cần chúng có thể cài file đó khi phát triển riêng. Không chuyển đổi module RAG/ChromaDB trong FD-01.

### 1. Khởi chạy Backend (FastAPI):
```bash
cd backend
python -m venv venv
source venv/bin/activate       # Trên Linux/macOS (hoặc venv\Scripts\activate trên Windows)
pip install -r requirements-runtime.txt pytest httpx
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
- Swagger API Docs: `http://localhost:8000/docs`
- Khi chạy thủ công, chỉnh `backend/.env` trỏ tới PostgreSQL/Supabase thực của nhóm; file `.env` ở gốc dành cho Compose. Nếu dùng SQLite, `/health` vẫn hoạt động còn `/ready` trả 503 do thiếu pgvector.
- Công cụ AI/data bổ sung: `pip install -r requirements.txt` khi module cần sử dụng.
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
