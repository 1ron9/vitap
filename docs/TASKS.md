# 📋 ĐẶC TẢ MA TRẬN NHIỆM VỤ DỰ ÁN VITAP (DEFINITIVE ENGINEERING TASK SPECIFICATION)

> **Dự án:** VitaP - Sổ Tay Y Tế Cá Nhân Hóa & Tra Cứu Dược Phẩm Thông Minh (FIT - HCMUS)  
> **Kiến trúc Chuẩn Hóa 3 Phân Hệ Client:**  
> - **F1: Hồ sơ & Chỉ số** (Tài khoản, Hồ sơ bệnh nền, Sổ tay nhật ký sinh hiệu & Biểu đồ xu hướng)  
> - **F2: Tra cứu Dược phẩm** (Động cơ kiểm tra tương tác thuốc DDI / Chống chỉ định DCI + Cổng nhập liệu OCR đơn thuốc)  
> - **F3: Trợ lý Hỏi đáp AI** (Chatbot RAG y tế)  
> **Nguồn chân lý dữ liệu (Single Source of Truth):**  
> - CSDL 3NF & DBML: [`0_medicare/docs/uml/database_erd.md`](uml/database_erd.md)  
> - Hợp đồng API: [`0_medicare/docs/api_contracts.md`](api_contracts.md)  
> - **Nguyên tắc phát triển:** Contract-First (Phát triển song song giữa Frontend & Backend bằng Mock Data, không ai bị nghẽn chờ đợi nhau).

---

## 👥 Ma Trận Phân Vai & Ranh Giới Chuyên Môn 4 Thành Viên

| Thành viên | Mã vai trò | Chuyên môn trọng tâm | Trọng trách chính trong 3 Phân hệ |
| :--- | :---: | :--- | :--- |
| **Trương Huệ Trí** (`24120472`) | **VT1** | **Product Owner & Data Core Lead** | Thiết kế CSDL 3NF (9 bảng), Auth JWT, Hồ sơ Bệnh nền, Seed Data Dược học (220+ biệt dược, 110+ hoạt chất), Thuật toán Fuzzy Matching so khớp tên thuốc, GitHub Actions CI Pipeline & Database Test Fixtures. |
| **Nguyễn Bảo Trọng** (`24120476`) | **VT2** | **Full Stack Core & DevOps Lead** | Hạ tầng Docker & Docker Compose, Backend API CRUD Sổ tay Chỉ số Sinh hiệu (`/api/v1/health-logs`), Frontend React Dashboard F1 (Form nhập số đo & Biểu đồ Line Chart theo dõi biến động Huyết áp, Cân nặng, Đường huyết). |
| **Dương Phan Minh Trí** (`24120470`) | **VT3** | **AI Vision & Clinical Engine Lead** | Trọng tâm Phân hệ F2: Thuật toán DDI Canonical Pair $O(N^2)$ Single-shot query, Chống chỉ định Bệnh nền DCI, Pipeline Gemini 1.5 Flash Vision OCR bóc tách đơn thuốc, Frontend F2 (Giao diện Tra cứu thẻ cảnh báo Đỏ/Vàng/Xanh & Modal đối chiếu đơn thuốc). |
| **Lê Thanh Phong** (`24120409`) | **VT4** | **ML Engineer & RAG Lead** | Trọng tâm Phân hệ F3: Biên soạn cẩm nang y tế Bộ Y tế Markdown, Vector Store (`pgvector`/ChromaDB), Prompt Guardrails an toàn y khoa, Backend Chatbot API (SSE Streaming), Frontend ChatBox UI component & Fallback Cache offline. |

---

## 🗓️ Lộ Trình Sprint & Hạn Định (Scrum Cadence)

- **Sprint 1 (Khởi tạo nền tảng & Hợp đồng dữ liệu):** 2026-11-02 $\rightarrow$ 2026-11-08 (Họp nghiệm thu Sprint Review: 20:00 Thứ Sáu, 08/11/2026)
- **Sprint 2 (Lõi Nghiệp vụ & Module độc lập):** 2026-11-09 $\rightarrow$ 2026-11-15 (Họp nghiệm thu Sprint Review: 20:00 Thứ Sáu, 15/11/2026)
- **Sprint 3 (Tích hợp AI & Trải nghiệm người dùng):** 2026-11-16 $\rightarrow$ 2026-11-22 (Họp nghiệm thu Sprint Review: 20:00 Thứ Sáu, 22/11/2026)
- **Sprint 4 (Kiểm thử tải, Đóng gói & Báo cáo đồ án):** 2026-11-23 $\rightarrow$ 2026-11-29 (Họp nghiệm thu Sprint Review: 20:00 Thứ Sáu, 29/11/2026)

---

## 📦 PHÂN HỆ F1: HỒ SƠ & SỔ TAY CHỈ SỐ SINH HIỆU

### [TASK-1.1] Thiết kế CSDL Quan hệ 3NF & Data DDL Migration
- **Phân cấp:** `Phân hệ F1 & F2` $\rightarrow$ `Core Database Engine`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-04 23:59 | **Story Points:** 5 SP
- **Phụ thuộc (Depends On):** Không có (Root Task).
- **Đang chặn (Blocks):** `TASK-1.2`, `TASK-1.4`, `TASK-1.6`, `TASK-1.8`, `TASK-2.2`, `TASK-3.2`.
- **Mục tiêu kỹ thuật:** Thiết lập lược đồ 9 bảng chuẩn 3NF trên PostgreSQL/Supabase (bao gồm bảng `health_logs` lưu trữ chỉ số đo chuỗi thời gian), đảm bảo ràng buộc khóa ngoại (FK), đánh chỉ mục duy nhất và hỗ trợ extension `pg_trgm`, `vector`.
- **File tác động:**
  - `backend/app/models/user_models.py` (bảng `users`, `patient_profiles`, `health_logs`)
  - `backend/app/models/drug_models.py` (bảng `active_ingredients`, `brand_names`, `drug_ingredients`, `conditions`, `drug_drug_interactions`, `drug_condition_interactions`)
  - `0_medicare/docs/uml/database_erd.md` (bao gồm Mermaid ERD & mã DBML)
- **Đầu vào (Input Contract):** ERD Schema tại `docs/uml/database_erd.md`.
- **Đầu ra (Output Artifact):** DDL script khởi tạo thành công 9 bảng, migration sạch sẽ.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Khởi tạo 9 bảng thành công, khóa ngoại cascade/restrict chính xác.
  - [ ] Ràng buộc duy nhất `ingredient_a_id < ingredient_b_id` không cho phép lưu cặp trùng.

---

### [TASK-1.2] Phát triển API Xác thực Người dùng (Auth JWT: Register / Login / Me)
- **Phân cấp:** `Phân hệ F1` $\rightarrow$ `Feature F1.1 (User Authentication)`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-06 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-1.1` (Schema bảng `users`).
- **Đang chặn (Blocks):** `TASK-1.3`, `TASK-1.8`, `TASK-1.9`.
- **Mục tiêu kỹ thuật:** Triển khai endpoint Đăng ký (`/register`), Đăng nhập (`/login`), Lấy thông tin cá nhân (`/me`) sử dụng chuẩn JWT (HS256) và băm mật khẩu chuẩn Bcrypt.
- **File tác động:**
  - `backend/app/routers/m0_auth.py`
  - `backend/app/core/security.py`
  - `backend/tests/test_m0_auth.py`
- **Đầu vào (Input Contract):** Mục `1.1, 1.2, 1.3` trong `docs/api_contracts.md`.
- **Đầu ra (Output Artifact):** Response trả về Access Token và thông tin cơ bản người dùng.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Chạy `pytest backend/tests/test_m0_auth.py` pass 100% (tối thiểu 4 test cases).
  - [ ] Mật khẩu được băm Bcrypt, token hết hạn sau 60 phút.

---

### [TASK-1.3] Phát triển API CRUD Hồ sơ Bệnh nền & Dị ứng Thuốc
- **Phân cấp:** `Phân hệ F1` $\rightarrow$ `Feature F1.1 (Medical Profile)`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-08 17:00 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-1.2` (Auth middleware).
- **Đang chặn (Blocks):** `TASK-2.3` (DCI Contraindications), `TASK-3.3` (Chatbot Guardrails).
- **Mục tiêu kỹ thuật:** Endpoint quản lý thông tin sức khỏe cá nhân, gán danh sách mã ICD-10 bệnh nền và các hoạt chất dị ứng cho người dùng phục vụ cảnh báo DCI và tiêm vào System Prompt của Chatbot.
- **File tác động:**
  - `backend/app/routers/m0_auth.py` (hoặc `backend/app/routers/profile.py`)
  - `backend/tests/test_m0_auth.py`
- **Đầu vào (Input Contract):** Mục `1.4` trong `docs/api_contracts.md`.
- **Đầu ra (Output Artifact):** `PUT /api/v1/auth/me/profile` cập nhật danh sách ICD-10 và dị ứng.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Pytest thêm/sửa/xóa bệnh nền thành công.
  - [ ] Trả về mã lỗi 404 nếu gửi mã bệnh không hợp lệ.

---

### [TASK-1.4] Chuẩn hóa Dataset Dược học & Nạp Dữ liệu Mẫu (Seed Data 220+ Thuốc)
- **Phân cấp:** `Phân hệ F2` $\rightarrow$ `Core Pharmaceutical Data`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-05 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-1.1` (Schema DDL).
- **Đang chặn (Blocks):** `TASK-1.5` (Fuzzy Matcher), `TASK-2.2` (DDI Query).
- **Mục tiêu kỹ thuật:** Xây dựng script Python nạp tự động 220+ biệt dược, 110+ hoạt chất, 260+ liên kết, 18 quy tắc DDI và 7 quy tắc DCI từ JSON thô vào PostgreSQL/SQLite.
- **File tác động:**
  - `backend/data_seed/seed_drugs.py`
  - `backend/data_seed/raw/*.json`
- **Đầu vào (Input Contract):** Các file JSON trong `backend/data_seed/raw/`.
- **Đầu ra (Output Artifact):** Lệnh `python backend/data_seed/seed_drugs.py` nạp dữ liệu sạch sẽ, không trùng lặp (Idempotent).
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Số lượng bản ghi kiểm chứng: $\ge 220$ BrandNames, $\ge 110$ ActiveIngredients, $\ge 18$ DDI.
  - [ ] Chạy lại lần 2 không văng lỗi `IntegrityError`.

---

### [TASK-1.5] Thuật toán Fuzzy Matching So khớp Tên Thuốc (Levenshtein / Trigram)
- **Phân cấp:** `Phân hệ F2` $\rightarrow$ `Fuzzy Search Service (Smart Input)`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-12 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-1.4` (Seed data thuốc).
- **Đang chặn (Blocks):** `TASK-2.5` (Modal xem trước đơn thuốc OCR).
- **Mục tiêu kỹ thuật:** Xây dựng module so khớp chuỗi văn bản trích xuất từ OCR (thường sai dấu/thiếu chữ như "Panadon" $\rightarrow$ "Panadol") với CSDL biệt dược chuẩn (Confidence $\ge 70\%$).
- **File tác động:**
  - `backend/app/services/fuzzy_matcher.py`
  - `backend/tests/test_fuzzy_matcher.py`
- **Đầu vào (Input Contract):** Chuỗi ký tự thô `raw_name: str`.
- **Đầu ra (Output Artifact):** `MatchedDrug(drug_id=..., brand_name=..., confidence=...)`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] `pytest backend/tests/test_fuzzy_matcher.py` pass 100% với tập 10 chuỗi nhiễu.
  - [ ] Độ trễ so khớp $< 15\text{ms}$ cho mỗi từ khóa.

---

### [TASK-1.6] Xây dựng GitHub Actions Pipeline CI & Database Test Fixtures
- **Phân cấp:** `Hạ tầng Chung` $\rightarrow$ `DevOps & CI Engine`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-06 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-1.1`, `TASK-1.7` (Docker dev env).
- **Đang chặn (Blocks):** Quy trình kiểm thử tự động của toàn bộ PRs Backend.
- **Mục tiêu kỹ thuật:** Cấu hình file workflow `.github/workflows/ci.yml` tự động chạy Pytest khi push/PR vào `main`. Dựng fixture SQLite in-memory trong `conftest.py` chạy test độc lập siêu nhanh ($< 3\text{s}$).
- **File tác động:**
  - `.github/workflows/ci.yml`
  - `backend/tests/conftest.py`
  - `backend/pytest.ini`
- **Đầu vào (Input Contract):** Test runner pytest.
- **Đầu ra (Output Artifact):** Trạng thái CI xanh (Passing) trên GitHub.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Tự động chạy test khi mở PR, thời gian chạy dưới 2 phút.

---

### [TASK-1.7] Thiết lập Hạ tầng Docker & Docker Compose Dev Environment
- **Phân cấp:** `Hạ tầng Chung` $\rightarrow$ `DevOps & Containerization`
- **Assignee:** Nguyễn Bảo Trọng (VT2) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-04 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** Khởi tạo repository.
- **Đang chặn (Blocks):** `TASK-1.6` (CI Pipeline), `TASK-1.8` (Health Logs Backend).
- **Mục tiêu kỹ thuật:** Xây dựng `Dockerfile` tối ưu cho FastAPI và `docker-compose.yml` kết nối container ứng dụng với PostgreSQL.
- **File tác động:**
  - `0_medicare/Dockerfile`
  - `0_medicare/docker-compose.yml`
  - `.env.example`
- **Đầu vào (Input Contract):** Python 3.11+, requirements.txt.
- **Đầu ra (Output Artifact):** Lệnh `docker-compose up --build` khởi động toàn bộ hệ thống lên cổng 8000 và 5432.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Container chạy sạch sẽ, truy cập được Swagger UI tại `http://localhost:8000/docs`.

---

### [TASK-1.8] Phát triển API CRUD Sổ Tay Chỉ Số Sinh Hiệu (`/api/v1/health-logs`) & Chuỗi Thời Gian
- **Phân cấp:** `Phân hệ F1` $\rightarrow$ `Feature F1.2 Backend (Vital Signs Engine)`
- **Assignee:** Nguyễn Bảo Trọng (VT2) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-12 23:59 | **Story Points:** 5 SP
- **Phụ thuộc (Depends On):** `TASK-1.1` (Bảng `health_logs`), `TASK-1.2` (Auth JWT).
- **Đang chặn (Blocks):** `TASK-1.10` (UI Dashboard Biểu đồ Sinh hiệu).
- **Mục tiêu kỹ thuật:** Xây dựng các endpoint cho Sổ tay sức khỏe: Ghi nhận mốc đo mới (huyết áp tâm thu/tâm trương, nhịp tim, cân nặng, đường huyết), xóa mốc đo, và endpoint lấy lịch sử chuỗi thời gian (`/history?days=7|30`) trả về danh sách điểm đo có định dạng sẵn để Frontend vẽ đồ thị.
- **File tác động:**
  - `backend/app/routers/health_logs.py`
  - `backend/app/models/user_models.py` (model `HealthLog`)
  - `backend/tests/test_health_logs.py`
- **Đầu vào (Input Contract):** Mục `1.5, 1.6, 1.7` trong `docs/api_contracts.md`.
- **Đầu ra (Output Artifact):** Các endpoint `POST /api/v1/health-logs`, `GET /api/v1/health-logs/history`, `DELETE /api/v1/health-logs/{id}`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] `pytest backend/tests/test_health_logs.py` pass 100% (tối thiểu 5 test cases).
  - [ ] Endpoint `/history` tính đúng giá trị trung bình (`avg_systolic`, `avg_diastolic`) và sắp xếp theo thứ tự ngày tăng dần.

---

### [TASK-1.9] UI React: Màn hình Đăng ký, Đăng nhập & Form Hồ sơ Bệnh nền
- **Phân cấp:** `Phân hệ F1` $\rightarrow$ `Feature F1.1 UI`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-15 17:00 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-1.2` (API Auth), `TASK-2.1` (Shared Layout).
- **Đang chặn (Blocks):** Hoàn thiện phân hệ F1.
- **Mục tiêu kỹ thuật:** Triển khai giao diện Web cho phép người dùng đăng ký, đăng nhập, lưu JWT vào LocalStorage và Form chọn bệnh nền/dị ứng thuốc.
- **File tác động:**
  - `frontend/src/pages/LoginPage.tsx`
  - `frontend/src/pages/ProfilePage.tsx`
  - `frontend/src/services/apiClient.ts`
- **Đầu vào (Input Contract):** API `/api/v1/auth/login` và `/api/v1/auth/me/profile`.
- **Đầu ra (Output Artifact):** Màn hình đăng nhập mượt mà, điều hướng tự động vào Dashboard F1 khi thành công.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Đăng nhập thành công lưu token và điều hướng đúng.
  - [ ] Báo lỗi Toast trực quan khi sai mật khẩu.

---

### [TASK-1.10] UI React: Dashboard Sổ Tay Sinh Hiệu (Form Nhập Chỉ Số & Biểu Đồ Line Chart)
- **Phân cấp:** `Phân hệ F1` $\rightarrow$ `Feature F1.2 UI (Vital Signs Dashboard & Charts)`
- **Assignee:** Nguyễn Bảo Trọng (VT2) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-20 23:59 | **Story Points:** 5 SP
- **Phụ thuộc (Depends On):** `TASK-1.8` (API Health Logs), `TASK-2.1` (Shared Layout).
- **Đang chặn (Blocks):** Hoàn thiện phân hệ F1.
- **Mục tiêu kỹ thuật:** Xây dựng màn hình Dashboard Sổ tay sức khỏe:
  1. Form nhập nhanh số đo trong ngày (Huyết áp, Nhịp tim, Cân nặng, Đường huyết).
  2. Bảng hiển thị tóm tắt tình trạng (Huyết áp bình thường / Cảnh báo huyết áp cao).
  3. **Vẽ biểu đồ đường trực quan (Line Charts)** sử dụng Recharts hoặc Chart.js: Hiển thị trục X là ngày đo, trục Y là chỉ số; hỗ trợ nút gạt xem theo 7 ngày / 30 ngày.
- **File tác động:**
  - `frontend/src/pages/HealthLogDashboard.tsx`
  - `frontend/src/components/VitalSignsChart.tsx`
  - `frontend/src/components/AddLogModal.tsx`
  - `frontend/src/services/healthLogService.ts`
- **Đầu vào (Input Contract):** Dữ liệu trả về từ `GET /api/v1/health-logs/history`.
- **Đầu ra (Output Artifact):** Dashboard hiển thị biểu đồ đẹp mắt, mượt mà, tương tác hover xem chi tiết điểm đo.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Nhập số đo mới lập tức cập nhật điểm mới lên biểu đồ không cần F5.
  - [ ] Biểu đồ render chuẩn xác đường tâm thu (đỏ/cam) và tâm trương (xanh), hỗ trợ Responsive trên điện thoại.

---

## 📦 PHÂN HỆ F2: TRA CỨU DƯỢC PHẨM & DDI ENGINE (KÈM OCR ĐƠN THUỐC)

### [TASK-2.1] Khởi Tạo Frontend React Vite, Tailwind CSS, Navbar & Layout Chung
- **Phân cấp:** `Hạ tầng Frontend` $\rightarrow$ `Frontend Foundation`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-04 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** Khởi tạo repo.
- **Đang chặn (Blocks):** `TASK-1.9`, `TASK-1.10`, `TASK-2.5`, `TASK-2.6`, `TASK-3.5`.
- **Mục tiêu kỹ thuật:** Khởi tạo dự án React Vite TypeScript, cấu hình Tailwind CSS theo bộ nhận diện y tế (Emerald/Teal/Slate), cài đặt React Router v6 với Navbar 3 mục chính: **`Hồ sơ & Chỉ số (F1)`**, **`Tra cứu Dược phẩm (F2)`**, **`Trợ lý AI (F3)`**.
- **File tác động:**
  - `frontend/package.json`
  - `frontend/src/App.tsx`
  - `frontend/src/components/Navbar.tsx`
- **Đầu vào (Input Contract):** Sitemap 3 phân hệ.
- **Đầu ra (Output Artifact):** Web chạy mượt mà tại `http://localhost:5173`, chuyển tab không giật trang.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Lệnh `npm run build` không lỗi TypeScript/CSS.
  - [ ] Navbar thể hiện rõ 3 phân hệ F1, F2, F3.

---

### [TASK-2.2] Thuật toán DDI Canonical Pair & Single-Shot Query Kiểm Tra Tương Tác Thuốc
- **Phân cấp:** `Phân hệ F2` $\rightarrow$ `Engine E1 (Clinical Interaction Engine)`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-07 23:59 | **Story Points:** 5 SP
- **Phụ thuộc (Depends On):** `TASK-1.1` (Schema DDL), `TASK-1.4` (Seed data 18+ DDI rules).
- **Đang chặn (Blocks):** `TASK-2.3` (DCI), `TASK-2.6` (UI Tra cứu F2).
- **Mục tiêu kỹ thuật:** Xây dựng logic kiểm tra tương tác giữa tập hợp $N$ loại thuốc ($N \le 10$). Sinh tổ hợp các cặp $\binom{N}{2}$ theo chuẩn Canonical Pair (`drug_a_id < drug_b_id`) và thực hiện 1 câu truy vấn SQL duy nhất (`IN (...)`) để lấy toàn bộ cảnh báo tương tác trong CSDL dưới 5ms.
- **File tác động:**
  - `backend/app/routers/m4_ddi.py`
  - `backend/app/services/ddi_engine.py`
  - `backend/tests/test_m4_ddi.py`
- **Đầu vào (Input Contract):** Mục `2.2` trong `docs/api_contracts.md`.
- **Đầu ra (Output Artifact):** Endpoint `POST /api/v1/drugs/check-interactions` trả về danh sách tương tác kèm mức độ Đỏ/Vàng/Xanh.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] `pytest backend/tests/test_m4_ddi.py` pass 100% (tối thiểu 10 ca test lâm sàng).
  - [ ] Single query thực thi $< 10\text{ms}$ không bị vòng lặp N+1 query.

---

### [TASK-2.3] Thuật toán Đối Kháng Thuốc - Bệnh Nền (DCI) & Dị Ứng Cá Nhân Hóa
- **Phân cấp:** `Phân hệ F2` $\rightarrow$ `Engine E1 (Contraindication Engine)`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-12 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-2.2` (DDI Engine), `TASK-1.3` (Hồ sơ Bệnh nền/Dị ứng).
- **Đang chặn (Blocks):** `TASK-2.6` (UI Thẻ cảnh báo tổng hợp).
- **Mục tiêu kỹ thuật:** Mở rộng động cơ kiểm tra dược lý: Nạp danh sách bệnh nền và dị ứng từ profile người dùng, đối chiếu với bảng `drug_condition_interactions` để phát hiện chống chỉ định (ví dụ: Hen phế quản không dùng Beta-blockers, Loét dạ dày không dùng Aspirin).
- **File tác động:**
  - `backend/app/services/ddi_engine.py`
  - `backend/tests/test_m4_ddi.py`
- **Đầu vào (Input Contract):** Danh sách `drug_ids` kết hợp `user_id`.
- **Đầu ra (Output Artifact):** Bổ sung mảng `disease_contraindications: [...]` trong response trả về.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Bắt chính xác ca bệnh nhân có tiền sử Loét dạ dày dùng Aspirin $\rightarrow$ Cảnh báo ĐỎ (Nguy hiểm).

---

### [TASK-2.4] Pipeline Nén Ảnh Client & Gemini 1.5 Flash Vision OCR Bóc Tách Đơn Thuốc
- **Phân cấp:** `Phân hệ F2` $\rightarrow$ `Smart Input Engine (Vision OCR)`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Lê Thanh Phong (VT4)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-15 23:59 | **Story Points:** 5 SP
- **Phụ thuộc (Depends On):** `TASK-1.7` (Docker dev env).
- **Đang chặn (Blocks):** `TASK-2.5` (Modal xem trước đơn thuốc).
- **Mục tiêu kỹ thuật:** Triển khai pipeline bóc tách đơn thuốc từ ảnh chụp: Nén ảnh phía client ($< 1\text{MB}$), gửi lên Backend gọi Gemini 1.5 Flash Vision với Structured JSON Prompt để bóc tách: Danh sách tên thuốc, hàm lượng, cách dùng.
- **File tác động:**
  - `backend/app/services/ocr/gemini_vision_service.py`
  - `backend/app/routers/m1_ocr.py`
  - `frontend/src/services/imageCompression.ts`
- **Đầu vào (Input Contract):** File ảnh JPG/PNG đơn thuốc.
- **Đầu ra (Output Artifact):** Pydantic JSON: `[{"raw_name": "Panadol 500mg", "dosage": "..."}, ...]`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Bóc tách đúng tối thiểu 80% tên thuốc trên 3 ảnh đơn thuốc mẫu.
  - [ ] Có cơ chế Mock fallback nếu rớt mạng hoặc hết quota Gemini.

---

### [TASK-2.5] UI React: Modal Đối Chiếu Đơn Thuốc (Human-in-the-Loop) & Đổ Data Vào F2
- **Phân cấp:** `Phân hệ F2` $\rightarrow$ `Feature F2 UI (Smart Input OCR Modal)`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-19 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-2.4` (OCR Engine), `TASK-1.5` (Fuzzy Matcher).
- **Đang chặn (Blocks):** Luồng quét đơn thuốc hoàn chỉnh.
- **Mục tiêu kỹ thuật:** Thiết kế Modal hiển thị kết quả sau khi quét OCR kèm ảnh chụp gốc đối chiếu song song. Hiển thị gợi ý thuốc từ Fuzzy Match (Task 1.5) và cho phép người dùng click chỉnh sửa trước khi nhấn nút: **"Chuyển vào Tra cứu Tương tác"**.
- **File tác động:**
  - `frontend/src/components/PrescriptionReviewModal.tsx`
  - `frontend/src/pages/InteractionPage.tsx`
- **Đầu vào (Input Contract):** JSON OCR + kết quả Fuzzy Match.
- **Đầu ra (Output Artifact):** Bấm xác nhận tự động điền danh sách thuốc vào màn hình Tra cứu F2 và kích hoạt kiểm tra DDI ngay lập tức.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Cho phép người dùng sửa tên thuốc, xóa dòng nhận diện sai, hoặc thêm dòng mới.

---

### [TASK-2.6] UI React: Màn Hình Tra Cứu Dược Phẩm F2 & Thẻ Cảnh Báo Đỏ/Vàng/Xanh
- **Phân cấp:** `Phân hệ F2` $\rightarrow$ `Feature F2 UI (Drug Safety Checker)`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-22 23:59 | **Story Points:** 4 SP
- **Phụ thuộc (Depends On):** `TASK-2.2` (DDI Engine), `TASK-2.3` (DCI Engine), `TASK-2.1` (Shared Layout).
- **Đang chặn (Blocks):** Hoàn thiện phân hệ F2.
- **Mục tiêu kỹ thuật:** Xây dựng màn hình Tra cứu Dược phẩm F2: Cho phép người dùng gõ tìm thuốc (Autocomplete) hoặc nhận thuốc từ ảnh OCR. Hiển thị kết quả tương tác dạng Thẻ phân cấp màu sắc:
  - 🔴 **Đỏ:** Nguy hiểm / Chống chỉ định tuyệt đối.
  - 🟡 **Vàng:** Thận trọng / Cần theo dõi.
  - 🟢 **Xanh:** An toàn / Không phát hiện tương tác đối kháng.
- **File tác động:**
  - `frontend/src/pages/InteractionPage.tsx`
  - `frontend/src/components/InteractionCard.tsx`
  - `frontend/src/components/DrugAutocomplete.tsx`
- **Đầu vào (Input Contract):** Danh sách thuốc chọn trên UI gửi tới `/api/v1/drugs/check-interactions`.
- **Đầu ra (Output Artifact):** Giao diện thẻ tương tác hiển thị rõ ràng cơ chế dược học và lời khuyên xử trí y khoa.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Hiển thị đầy đủ cơ chế tương tác, hậu quả lâm sàng và khuyến cáo xử trí.
  - [ ] Autocomplete tìm kiếm thuốc phản hồi $< 50\text{ms}$.

---

### [TASK-2.7] Benchmark Thuật Toán DDI & Tối Ưu Hóa Latency Truy Vấn
- **Phân cấp:** `Phân hệ F2` $\rightarrow$ `Optimization & Benchmark`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 4 | **Deadline:** 2026-11-26 23:59 | **Story Points:** 2 SP
- **Phụ thuộc (Depends On):** `TASK-2.2`, `TASK-2.4`.
- **Đang chặn (Blocks):** Báo cáo hiệu năng đồ án.
- **Mục tiêu kỹ thuật:** Đo đạc thời gian thực thi thuật toán DDI Canonical Pair với tải $N=10$ thuốc và tối ưu payload ảnh nén gửi lên Gemini Flash để giảm thiểu chi phí token và độ trễ mạng.
- **File tác động:**
  - `backend/tests/benchmark_ddi.py`
  - `0_medicare/docs/designs/ddi_performance_report.md`
- **Đầu ra (Output Artifact):** Báo cáo benchmark chứng minh tốc độ xử lý DDI $< 5\text{ms}$.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] 100% các truy vấn thử nghiệm phản hồi dưới $10\text{ms}$ trên CSDL.

---

## 📦 PHÂN HỆ F3: TRỢ LÝ HỎI ĐÁP Y TẾ & LỐI SỐNG AI

### [TASK-3.1] Biên Soạn & Chuẩn Hóa Cẩm Nang Y Tế Định Dạng Markdown (MoH Guidelines)
- **Phân cấp:** `Phân hệ F3` $\rightarrow$ `Knowledge Base Engineering`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-06 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** Khởi tạo repo.
- **Đang chặn (Blocks):** `TASK-3.2` (RAG Vector Ingest).
- **Mục tiêu kỹ thuật:** Biên soạn tối thiểu 10 tài liệu cẩm nang y tế chính thống (hướng dẫn sử dụng thuốc an toàn của Bộ Y tế, dinh dưỡng cho người cao huyết áp, tiểu đường, phụ nữ mang thai, tương kỵ thực phẩm - thuốc) sang định dạng Markdown chuẩn.
- **File tác động:**
  - `backend/app/services/rag/knowledge_base/*.md`
- **Đầu vào (Input Contract):** Dược thư Quốc gia Việt Nam, Hướng dẫn điều trị Bộ Y tế.
- **Đầu ra (Output Artifact):** Thư mục Markdown sạch sẽ, không chứa thông tin rác.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Tối thiểu 10 files Markdown chuyên môn y khoa với tổng dung lượng $\ge 50\text{KB}$.

---

### [TASK-3.2] Xây Dựng RAG Pipeline & Vector Database Embeddings
- **Phân cấp:** `Phân hệ F3` $\rightarrow$ `Engine E3 (Medical RAG Engine)`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-13 23:59 | **Story Points:** 5 SP
- **Phụ thuộc (Depends On):** `TASK-3.1` (Tập cẩm nang Markdown), `TASK-1.1`.
- **Đang chặn (Blocks):** `TASK-3.3` (Prompt Guardrails), `TASK-3.4` (Chatbot API).
- **Mục tiêu kỹ thuật:** Chặt nhỏ tài liệu thành các Chunks (300-500 tokens, overlap 50 tokens), tính toán vector embedding (Gemini Text-Embedding-004 hoặc Sentence-Transformers) và lưu trữ vào Vector Store (`pgvector` / ChromaDB). Viết hàm truy vấn top $K=3$ đoạn trích liên quan nhất.
- **File tác động:**
  - `backend/app/services/rag/ingest.py`
  - `backend/app/services/rag/retriever.py`
  - `backend/tests/test_rag.py`
- **Đầu vào (Input Contract):** Tập Markdown từ Task 3.1.
- **Đầu ra (Output Artifact):** Script nạp vector `ingest.py` và hàm `retrieve_context(query)`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Truy vấn câu hỏi dinh dưỡng tiểu đường trả về đúng đoạn trích với Cosine Similarity $\ge 0.75$.

---

### [TASK-3.3] Thiết Lập Rào Chắn An Toàn (Medical Guardrails) & System Prompt Y Khoa
- **Phân cấp:** `Phân hệ F3` $\rightarrow$ `Engine E3 (Safety Guardrails & Personalization)`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-15 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-3.2` (Retriever RAG), `TASK-1.3` (Hồ sơ Bệnh nền).
- **Đang chặn (Blocks):** `TASK-3.4` (Chatbot API).
- **Mục tiêu kỹ thuật:** Xây dựng System Prompt an toàn: Tiêm động thông tin bệnh nền người dùng; Từ chối chẩn đoán thay bác sĩ hoặc kê đơn thuốc cấm; Bắt buộc trích dẫn nguồn tài liệu cẩm nang và đính kèm câu từ chối trách nhiệm y khoa (Medical Disclaimer).
- **File tác động:**
  - `backend/app/services/rag/prompts.py`
  - `backend/app/services/rag/guardrails.py`
  - `backend/tests/test_m3_chatbot.py`
- **Đầu vào (Input Contract):** Prompt template + Profile người dùng + Context RAG.
- **Đầu ra (Output Artifact):** Prompt an toàn gửi tới Gemini API.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Pytest thử câu hỏi độc hại/kê đơn thuốc cấm $\rightarrow$ Hệ thống lập tức từ chối an toàn.

---

### [TASK-3.4] Phát Triển API Chatbot Đàm Thoại Thời Gian Thực (SSE Streaming)
- **Phân cấp:** `Phân hệ F3` $\rightarrow$ `Feature F3.1 (Conversational API)`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-19 23:59 | **Story Points:** 5 SP
- **Phụ thuộc (Depends On):** `TASK-3.2` (Retriever), `TASK-3.3` (Guardrails).
- **Đang chặn (Blocks):** `TASK-3.5` (UI ChatBox).
- **Mục tiêu kỹ thuật:** Triển khai endpoint `/api/v1/chatbot/chat-stream` sử dụng Server-Sent Events (SSE - `text/event-stream`). Kết nối Gemini 1.5 Flash streaming để trả kết quả từng từ (token-by-token) về client, tối ưu hóa thời gian phản hồi chữ đầu tiên (TTFT $< 1.5\text{s}$).
- **File tác động:**
  - `backend/app/routers/m3_chatbot.py`
  - `backend/app/services/rag/llm_client.py`
  - `backend/tests/test_m3_chatbot.py`
- **Đầu vào (Input Contract):** Mục `3.1` trong `docs/api_contracts.md`.
- **Đầu ra (Output Artifact):** Luồng stream SSE trả về từng đoạn text kèm metadata trích dẫn nguồn.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Endpoint trả về `Content-Type: text/event-stream`.
  - [ ] Pytest test mock stream pass 100%.

---

### [TASK-3.5] UI React: Component ChatBox Thông Minh (SSE Typewriter & Markdown Rendering)
- **Phân cấp:** `Phân hệ F3` $\rightarrow` `Feature F3.1 UI (ChatBox Interface)`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-22 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-3.4` (API SSE Stream), `TASK-2.1` (Shared Layout).
- **Đang chặn (Blocks):** Hoàn thiện phân hệ F3.
- **Mục tiêu kỹ thuật:** Xây dựng giao diện khung chat hiện đại: Nhận luồng dữ liệu SSE hiển thị chữ gõ theo thời gian thực (Typewriter Effect), parse định dạng Markdown (in đậm, danh sách), hiển thị nguồn trích dẫn và các câu hỏi gợi ý nhanh.
- **File tác động:**
  - `frontend/src/components/chat/ChatBox.tsx`
  - `frontend/src/pages/ChatbotPage.tsx`
  - `frontend/src/services/chatService.ts`
- **Đầu ra (Output Artifact):** Khung chat phản hồi mượt mà, tự động cuộn xuống dưới, có nút dừng sinh chữ.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Render chữ mượt mà không giật lag.
  - [ ] Hiển thị rõ Disclaimer y tế dưới chân khung chat.

---

### [TASK-3.6] Cơ Chế Dự Phòng Fallback Cache Cho Chatbot Khi Offline / Hết Quota
- **Phân cấp:** `Phân hệ F3` $\rightarrow$ `Engine E3 (Chatbot Reliability & Caching)`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 4 | **Deadline:** 2026-11-25 23:59 | **Story Points:** 3 SP
- **Phụ thuộc (Depends On):** `TASK-3.4` (API Chatbot).
- **Đang chặn (Blocks):** Báo cáo độ tin cậy hệ thống.
- **Mục tiêu kỹ thuật:** Xây dựng cơ chế dự phòng an toàn: Cache câu trả lời của 20 câu hỏi thường gặp (FAQ) vào SQLite/In-memory cache; Bắt lỗi `429 Too Many Requests` hoặc rớt mạng để tự động trả lời bằng cẩm nang tĩnh định sẵn mà không làm sập ứng dụng khi demo.
- **File tác động:**
  - `backend/app/services/rag/fallback_cache.py`
  - `backend/tests/test_m3_chatbot.py`
- **Đầu ra (Output Artifact):** Trả về nội dung trích xuất trực tiếp từ file cẩm nang Markdown cục bộ khi API lỗi.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Giả lập ngắt kết nối Gemini API $\rightarrow$ Chatbot vẫn trả về câu trả lời hữu ích kèm nhãn `[Chế độ dự phòng Offline]`.

---

### [TASK-3.7] Đánh Giá Độ Chính Xác RAG & Báo Cáo Triển Khai
- **Phân cấp:** `Phân hệ F3` $\rightarrow$ `Evaluation & Documentation`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 4 | **Deadline:** 2026-11-28 23:59 | **Story Points:** 2 SP
- **Phụ thuộc (Depends On):** `TASK-3.2`, `TASK-3.3`, `TASK-3.4`.
- **Đang chặn (Blocks):** Báo cáo nghiệm thu cuối kỳ.
- **Mục tiêu kỹ thuật:** Xây dựng bộ 20 câu hỏi kiểm thử đánh giá chất lượng câu trả lời của RAG (Faithfulness, Answer Relevance). Viết tài liệu hướng dẫn vận hành pipeline RAG.
- **File tác động:**
  - `backend/app/services/rag/evaluation_results.md`
- **Đầu ra (Output Artifact):** Báo cáo đánh giá độ chính xác đạt $\ge 85\%$ câu trả lời bám sát cẩm nang Bộ Y Tế.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Báo cáo nghiệm thu có số liệu kiểm chứng cụ thể, được PO Trương Huệ Trí ký duyệt.

---

## 🎯 TỔNG DUYỆT ĐỒ ÁN & NGHIỆM THU

### [TASK-0.1] Tổng Kiểm Tra Chất Lượng (QA Audit Checklist) & Đóng Gói Báo Cáo
- **Phân cấp:** `Toàn Nhóm` $\rightarrow$ `Project Quality Assurance`
- **Assignee:** Trương Huệ Trí (VT1) & Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 4 | **Deadline:** 2026-11-29 23:59 | **Story Points:** 2 SP
- **Phụ thuộc (Depends On):** Hoàn thành toàn bộ các tasks Sprint 1, 2, 3 của 3 Phân hệ.
- **Mục tiêu kỹ thuật:** Kiểm tra toàn bộ 3 phân hệ chạy thực tế (Working Software):
  1. `F1: Hồ sơ & Chỉ số`: Đăng nhập $\rightarrow$ Khai báo bệnh nền $\rightarrow$ Nhập chỉ số $\rightarrow$ Hiển thị biểu đồ Line Chart huyết áp/cân nặng.
  2. `F2: Tra cứu Dược phẩm`: Quét ảnh đơn thuốc $\rightarrow$ Modal xem trước $\rightarrow$ Kiểm tra DDI/DCI hiển thị thẻ Đỏ/Vàng/Xanh.
  3. `F3: Trợ lý AI`: Chatbot SSE streaming phản hồi câu hỏi lối sống, trích dẫn nguồn cẩm nang Bộ Y tế.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] 100% các luồng demo chạy mượt mà trên môi trường Local và Cloud.
  - [ ] Biên bản nghiệm thu và slide thuyết trình hoàn tất cho buổi bảo vệ đồ án.

---

## 📊 BẢNG TỔNG HỢP THEO DÕI TIẾN ĐỘ & PHÂN BỔ CÔNG VIỆC

| Mã Task | Tên Nhiệm Vụ | Phân hệ | Assignee | Reviewer | Phụ thuộc | Đang chặn | SP | Sprint | Trạng thái |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1.1** | CSDL Quan hệ 3NF & Data DDL Migration | F1/F2 | Trương Huệ Trí | Nguyễn Bảo Trọng | - | 1.2, 1.4, 1.6, 1.8, 2.2, 3.2 | 5 | S1 | 🟢 Đã xong |
| **1.2** | API Xác thực Người dùng (Auth JWT) | F1 | Trương Huệ Trí | Nguyễn Bảo Trọng | 1.1 | 1.3, 1.8, 1.9 | 3 | S1 | 🟢 Đã xong |
| **1.3** | API CRUD Hồ sơ Bệnh nền & Dị ứng Thuốc | F1 | Trương Huệ Trí | Dương Phan Minh Trí | 1.2 | 2.3, 3.3 | 3 | S1 | 🟢 Đã xong |
| **1.4** | Chuẩn hóa Dataset Dược học & Seed Data | F2 | Trương Huệ Trí | Dương Phan Minh Trí | 1.1 | 1.5, 2.2 | 3 | S1 | 🟢 Đã xong |
| **1.5** | Thuật toán Fuzzy Matching So khớp Tên Thuốc | F2 | Trương Huệ Trí | Dương Phan Minh Trí | 1.4 | 2.5 | 3 | S2 | 🟡 Đang làm |
| **1.6** | GitHub Actions Pipeline CI & DB Test Fixtures | Chung | Trương Huệ Trí | Nguyễn Bảo Trọng | 1.1, 1.7 | Toàn bộ PRs BE | 3 | S1 | 🟢 Đã xong |
| **1.7** | Thiết lập Hạ tầng Docker & Docker Compose | Chung | Nguyễn Bảo Trọng | Trương Huệ Trí | - | 1.6, 1.8 | 3 | S1 | 🟢 Đã xong |
| **1.8** | API CRUD Sổ tay Sinh hiệu & Chuỗi thời gian | F1 | Nguyễn Bảo Trọng | Trương Huệ Trí | 1.1, 1.2 | 1.10 | 5 | S2 | ⚪ Sẵn sàng |
| **1.9** | UI React: Đăng nhập & Form Hồ sơ Bệnh nền | F1 | Trương Huệ Trí | Dương Phan Minh Trí | 1.2, 2.1 | - | 3 | S2 | ⚪ Chờ làm |
| **1.10**| UI React: Dashboard Sổ tay & Biểu đồ Line Chart | F1 | Nguyễn Bảo Trọng | Dương Phan Minh Trí | 1.8, 2.1 | - | 5 | S3 | ⚪ Sẵn sàng |
| **2.1** | Khởi tạo Frontend React Vite, Tailwind & Layout | Chung | Dương Phan Minh Trí | Trương Huệ Trí | - | 1.9, 1.10, 2.5, 2.6, 3.5 | 3 | S1 | 🟢 Đã xong |
| **2.2** | Thuật toán DDI Canonical Pair Single-Shot Query | F2 | Dương Phan Minh Trí | Trương Huệ Trí | 1.1, 1.4 | 2.3, 2.6, 2.7 | 5 | S1 | ⚪ Sẵn sàng |
| **2.3** | Thuật toán Đối kháng Thuốc - Bệnh nền DCI | F2 | Dương Phan Minh Trí | Trương Huệ Trí | 2.2, 1.3 | 2.6 | 3 | S2 | ⚪ Chờ làm |
| **2.4** | Pipeline Nén ảnh & OCR Đơn thuốc Gemini Flash | F2 | Dương Phan Minh Trí | Lê Thanh Phong | 1.7 | 2.5, 2.7 | 5 | S2 | ⚪ Sẵn sàng |
| **2.5** | UI React: Modal Đối chiếu Đơn thuốc OCR | F2 | Dương Phan Minh Trí | Trương Huệ Trí | 2.4, 1.5 | - | 3 | S3 | ⚪ Chờ làm |
| **2.6** | UI React: Màn hình Tra cứu F2 & Thẻ Cảnh báo | F2 | Dương Phan Minh Trí | Trương Huệ Trí | 2.2, 2.3, 2.1 | - | 4 | S3 | ⚪ Chờ làm |
| **2.7** | Benchmark Thuật toán DDI & Tối ưu hóa Latency | F2 | Dương Phan Minh Trí | Nguyễn Bảo Trọng | 2.2, 2.4 | - | 2 | S4 | ⚪ Chờ làm |
| **3.1** | Biên soạn Cẩm nang Y tế MoH Markdown | F3 | Lê Thanh Phong | Trương Huệ Trí | - | 3.2 | 3 | S1 | 🟢 Đã xong |
| **3.2** | Xây dựng RAG Pipeline & Vector DB Embeddings | F3 | Lê Thanh Phong | Trương Huệ Trí | 3.1, 1.1 | 3.3, 3.4 | 5 | S2 | ⚪ Sẵn sàng |
| **3.3** | Thiết lập Medical Guardrails & System Prompt | F3 | Lê Thanh Phong | Trương Huệ Trí | 3.2, 1.3 | 3.4 | 3 | S2 | ⚪ Sẵn sàng |
| **3.4** | Phát triển API Chatbot Streaming (SSE) | F3 | Lê Thanh Phong | Nguyễn Bảo Trọng | 3.2, 3.3 | 3.5, 3.6 | 5 | S3 | ⚪ Chờ làm |
| **3.5** | UI React: ChatBox Thông minh (SSE & Markdown) | F3 | Lê Thanh Phong | Dương Phan Minh Trí | 3.4, 2.1 | - | 3 | S3 | ⚪ Chờ làm |
| **3.6** | Cơ chế Dự phòng Fallback Cache Cho Chatbot | F3 | Lê Thanh Phong | Nguyễn Bảo Trọng | 3.4 | - | 3 | S4 | ⚪ Chờ làm |
| **3.7** | Đánh giá Độ chính xác RAG & Báo cáo Triển khai | F3 | Lê Thanh Phong | Trương Huệ Trí | 3.2, 3.3, 3.4 | 0.1 | 2 | S4 | ⚪ Chờ làm |
| **0.1** | Tổng Kiểm Tra Chất Lượng (QA) & Nghiệm Thu | Toàn bộ| Trương Huệ Trí & Bảo Trọng | Cả nhóm | Toàn bộ S1-S3 | Báo cáo | 2 | S4 | ⚪ Chờ làm |

---

## ⚖️ CÂN BẰNG TẢI KHỐI LƯỢNG CÔNG VIỆC 4 THÀNH VIÊN

| Thành viên | Số Task | Tổng Story Points (SP) | Tỷ trọng | Trọng tâm phụ trách |
| :--- | :---: | :---: | :---: | :--- |
| **Trương Huệ Trí (VT1)** | 7 tasks | **21 SP** | **25.6%** | CSDL 3NF, Auth JWT, Seed Data Dược, Fuzzy Matcher, CI/CD Pipeline. |
| **Nguyễn Bảo Trọng (VT2)** | 4 tasks | **18 SP** | **22.0%** | Docker/CI, Backend API Sổ tay sinh hiệu, Frontend Dashboard Biểu đồ Line Chart Huyết áp/Cân nặng. |
| **Dương Phan Minh Trí (VT3)**| 7 tasks | **25 SP** | **30.5%** | Lõi F2: DDI Canonical Pair, Chống chỉ định DCI, Gemini Vision OCR Đơn thuốc, UI Tra cứu Thẻ cảnh báo. |
| **Lê Thanh Phong (VT4)** | 7 tasks | **24 SP** | **29.3%** | Lõi F3: Cẩm nang Markdown, RAG Vector Store, Guardrails, Chatbot SSE Streaming, UI ChatBox. |
| **Chung toàn nhóm (0.1)** | 1 task | **2 SP** | **–** | Tổng duyệt và nghiệm thu đồ án cuối kỳ. |
