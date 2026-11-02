# 📋 ĐẶC TẢ MA TRẬN NHIỆM VỤ DỰ ÁN VITAP (DEFINITIVE ENGINEERING TASK SPECIFICATION)

> **Dự án:** Trợ lý Dược phẩm Thông minh VitaP (FIT - HCMUS)  
> **Phương pháp quản trị:** Scrum 1-week Sprint | Governance Harness 4 Tầng | Quy chuẩn nghiệm thu 2 lớp (Peer Review $\rightarrow$ PO Sign-off)  
> **Nguồn chân lý dữ liệu (Single Source of Truth):**  
> - CSDL 3NF: [`0_medicare/docs/uml/database_erd.md`](database_erd.md)  
> - Hợp đồng API: [`0_medicare/docs/api_contracts.md`](api_contracts.md)  
> - Khung vận hành: [`0_medicare/docs/designs/operational_governance_harness.md`](designs/operational_governance_harness.md)

---

## 👥 Ma Trận Phân Vai & Ranh Giới Chuyên Môn 4 Thành Viên

| Thành viên | Mã vai trò | Chuyên môn trọng tâm | Phạm vi phụ trách kỹ thuật (Codebase Scope) |
| :--- | :---: | :--- | :--- |
| **Trương Huệ Trí** (`24120472`) | **VT1** | **Product Owner & Data Core Lead** | Thiết kế CSDL 3NF, Auth JWT, Hồ sơ Bệnh nền & Dị ứng, Dataset Dược học (300+ thuốc, 20+ DDI/DCI), Thuật toán Fuzzy Matching, Quản trị Quy trình & PO Sign-off. |
| **Nguyễn Bảo Trọng** (`24120476`) | **VT2** | **Full Stack Core & DevOps Lead** | Hạ tầng Docker & GitHub Actions CI/CD, Test Fixtures, Module Tủ thuốc cá nhân (Backend API CRUD + Frontend React UI), Thuật toán sinh cữ uống & Cảnh báo nhắc nhở 2 lớp. |
| **Dương Phan Minh Trí** (`24120470`) | **VT3** | **AI Vision & Clinical Engine Lead** | Thiết lập UI Theme/Navbar, Thuật toán DDI Canonical Pair $O(N^2)$, Pipeline Gemini 1.5 Flash Vision OCR Đơn thuốc, Modal xác nhận Human-in-the-loop, UI Tra cứu & Thẻ cảnh báo Đỏ/Vàng/Xanh. |
| **Lê Thanh Phong** (`24120409`) | **VT4** | **ML Engineer & RAG Lead** | Biên soạn cẩm nang y tế Bộ Y tế, Vector Database (`pgvector`/ChromaDB), Prompt Guardrails y khoa, Backend Chatbot API (SSE Streaming), Frontend ChatBox UI component. |

---

## 🗓️ Lộ Trình Sprint & Hạn Định (Scrum Cadence)

- **Sprint 1 (Khởi tạo nền tảng & Hợp đồng dữ liệu):** 2026-11-02 $\rightarrow$ 2026-11-08 (Họp nghiệm thu Sprint Review: 20:00 Thứ Sáu, 08/11/2026)
- **Sprint 2 (Lõi Nghiệp vụ & Module độc lập):** 2026-11-09 $\rightarrow$ 2026-11-15 (Họp nghiệm thu Sprint Review: 20:00 Thứ Sáu, 15/11/2026)
- **Sprint 3 (Tích hợp AI & Trải nghiệm người dùng):** 2026-11-16 $\rightarrow$ 2026-11-22 (Họp nghiệm thu Sprint Review: 20:00 Thứ Sáu, 22/11/2026)
- **Sprint 4 (Kiểm thử tải, Đóng gói & Hoàn thiện):** 2026-11-23 $\rightarrow$ 2026-11-29 (Họp nghiệm thu Sprint Review: 20:00 Thứ Sáu, 29/11/2026)

---

## 📦 MODULE 1: DATA CORE, XÁC THỰC & HỒ SƠ BỆNH NỀN

### [TASK-1.1] Thiết kế CSDL Quan hệ 3NF & Data DDL Migration
- **Phân cấp:** `Module 1` $\rightarrow$ `Engine E0 (3NF Database Engine)`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-04 23:59 | **Story Points:** 5 SP
- **Mục tiêu kỹ thuật:** Thiết lập lược đồ 10 bảng chuẩn 3NF trên PostgreSQL/Supabase, đảm bảo tính toàn vẹn khóa ngoại (FK constraints), ràng buộc duy nhất (Unique Indexes) và kích hoạt extension `pg_trgm` (fuzzy match), `vector` (RAG).
- **File tác động:**
  - `backend/app/models/user_models.py` (bảng `users`, `medical_profiles`, `allergies`, `user_allergies`, `conditions`, `user_conditions`)
  - `backend/app/models/drug_models.py` (bảng `drugs`, `active_ingredients`, `drug_ingredients`, `drug_interactions`, `drug_disease_contraindications`)
  - `0_medicare/docs/uml/database_erd.md`
- **Đầu vào (Input Contract):** ERD Schema tại `docs/uml/database_erd.md`.
- **Đầu ra (Output Artifact):** DDL script khởi tạo thành công trên database, migration file sạch sẽ.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Khởi tạo 10 bảng không có lỗi cú pháp hoặc xung đột khóa ngoại.
  - [ ] Kiểm tra ràng buộc duy nhất: Không cho phép duplicate `(drug_a_id, drug_b_id)` với `drug_a_id < drug_b_id`.
  - [ ] Peer Review (VT2) chấp thuận PR schema DDL.

---

### [TASK-1.2] Phát triển API Xác thực Người dùng (Auth JWT)
- **Phân cấp:** `Module 1` $\rightarrow$ `Feature F1.1 (User Authentication)`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-06 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Triển khai endpoint Đăng ký (`/register`), Đăng nhập (`/login`), Refresh Token (`/refresh`) sử dụng JWT (HS256) và băm mật khẩu chuẩn Passlib `bcrypt`.
- **File tác động:**
  - `backend/app/routers/m0_auth.py`
  - `backend/app/core/security.py` (hàm `hash_password`, `verify_password`, `create_access_token`)
  - `backend/tests/test_m0_auth.py`
- **Đầu vào (Input Contract):** Mục `1. Xác thực & Quản lý Người dùng` trong `docs/api_contracts.md`.
  - Request: `POST /api/v1/auth/login` body `{"email": str, "password": str}`
- **Đầu ra (Output Artifact):** Response `{"access_token": str, "token_type": "bearer", "user": {...}}`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Chạy `pytest backend/tests/test_m0_auth.py` pass 100% (tối thiểu 4 test cases: đăng ký mới, đăng nhập đúng, sai pass trả 401, email đã tồn tại trả 409).
  - [ ] Token hết hạn sau 60 phút, không lưu raw password vào database.

---

### [TASK-1.3] Phát triển API CRUD Hồ sơ Bệnh nền & Dị ứng Thuốc
- **Phân cấp:** `Module 1` $\rightarrow$ `Feature F1.2 (Medical History Profile)`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Lê Thanh Phong (VT4)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-08 17:00 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Endpoint quản lý thông tin sức khỏe cá nhân, gán danh sách mã ICD-10 bệnh nền và các hoạt chất dị ứng cho người dùng phục vụ động cơ cảnh báo DCI/Allergy.
- **File tác động:**
  - `backend/app/routers/m0_auth.py` (hoặc tách `backend/app/routers/profile.py`)
  - `backend/app/models/user_models.py`
  - `backend/tests/test_m0_auth.py`
- **Đầu vào (Input Contract):** Mục `1.3 & 1.4` trong `docs/api_contracts.md`.
  - Header: `Authorization: Bearer <jwt_token>`
  - Request: `PUT /api/v1/profile/conditions` body `{"condition_ids": [1, 3]}`
- **Đầu ra (Output Artifact):** Trả về `200 OK` danh sách chi tiết bệnh nền & dị ứng của người dùng.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Pytest kiểm thử thêm/sửa/xóa bệnh nền thành công.
  - [ ] Bắt lỗi `404 Not Found` nếu gửi `condition_id` không tồn tại trong CSDL.

---

### [TASK-1.4] Chuẩn hóa Dataset Dược học & Nạp Dữ liệu Mẫu (Seed Data)
- **Phân cấp:** `Module 1` $\rightarrow$ `Engine E0 (Pharmaceutical Data Engine)`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-05 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Xây dựng script Python nạp tự động 220+ biệt dược, 110+ hoạt chất, 20+ quy tắc DDI (tương tác thuốc-thuốc) và 10+ quy tắc DCI (thuốc-bệnh nền) từ JSON thô vào PostgreSQL.
- **File tác động:**
  - `backend/data_seed/seed_drugs.py`
  - `backend/data_seed/raw/drugs_vietnam.json`
  - `backend/data_seed/raw/ddi_rules.json`
  - `backend/data_seed/raw/conditions.json`
- **Đầu vào (Input Contract):** Định dạng JSON thô tại `backend/data_seed/raw/`.
- **Đầu ra (Output Artifact):** Lệnh `python backend/data_seed/seed_drugs.py` nạp sạch sẽ không trùng lặp (Idempotent seed script).
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Kiểm tra số lượng bản ghi: $\ge 220$ BrandNames, $\ge 110$ ActiveIngredients, $\ge 18$ DDI rules.
  - [ ] Chạy lại lần 2 không bị lỗi `IntegrityError` (Unique constraint violation).

---

### [TASK-1.5] Thuật toán Fuzzy Matching So khớp Tên Thuốc (Levenshtein / Trigram)
- **Phân cấp:** `Module 1` $\rightarrow$ `Engine E0 (Fuzzy Search Service)`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-12 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Xây dựng service so khớp chuỗi văn bản nhận diện từ OCR (thường sai dấu, thiếu ký tự như "Panadon" $\rightarrow$ "Panadol") với danh mục thuốc trong CSDL với độ tương đồng (Confidence Score $\ge 70\%$).
- **File tác động:**
  - `backend/app/services/fuzzy_matcher.py`
  - `backend/tests/test_fuzzy_matcher.py`
- **Đầu vào (Input Contract):** Chuỗi `raw_name: str` (ví dụ: "Aspirin 81mg PH8").
- **Đầu ra (Output Artifact):** `MatchedDrug(drug_id=..., brand_name=..., confidence=0.92)`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Chạy `pytest backend/tests/test_fuzzy_matcher.py` pass 100% với tập 10 ca test chuỗi nhiễu.
  - [ ] Thời gian xử lý $< 15\text{ms}$ cho 1 từ khóa trên CSDL in-memory / pg_trgm.

---

### [TASK-1.6] UI React: Màn hình Đăng ký, Đăng nhập & Hồ sơ Sức khỏe
- **Phân cấp:** `Module 1` $\rightarrow$ `Feature F1.1 / F1.2 UI`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-15 17:00 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Triển khai giao diện Web cho phép người dùng đăng ký, đăng nhập, lưu JWT vào LocalStorage/Cookie an toàn và Form đa lựa chọn (Multi-select) để khai báo bệnh nền/dị ứng.
- **File tác động:**
  - `frontend/src/pages/LoginPage.tsx`
  - `frontend/src/pages/ProfilePage.tsx`
  - `frontend/src/services/apiClient.ts`
- **Đầu vào (Input Contract):** API `/api/v1/auth/login` và `/api/v1/profile/conditions`.
- **Đầu ra (Output Artifact):** Form hoạt động mượt mà, lưu token, tự động chuyển hướng (Redirect) khi thành công.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Đăng nhập đúng điều hướng vào Dashboard/Tủ thuốc.
  - [ ] Đăng nhập sai hiển thị thông báo lỗi trực quan (Toast/Alert), không crash màn hình.
  - [ ] Snapshot giao diện đáp ứng tiêu chuẩn Responsive trên Desktop & Mobile.

---

### [TASK-1.7] Quản trị Chất lượng & Thiết lập Quy chuẩn Kiểm thử Tự động (QA Sign-off)
- **Phân cấp:** `Module 1` $\rightarrow$ `Governance & Governance Harness`
- **Assignee:** Trương Huệ Trí (VT1) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 4 | **Deadline:** 2026-11-28 23:59 | **Story Points:** 2 SP
- **Mục tiêu kỹ thuật:** Tổ chức tổng kiểm tra chất lượng (Audit Checklist), rà soát 100% các API contracts, xác nhận Definition of Done của toàn bộ 28 tasks trước khi báo cáo môn học.
- **File tác động:**
  - `0_medicare/docs/TASKS.md`
  - `0_medicare/docs/designs/operational_governance_harness.md`
- **Đầu vào (Input Contract):** Báo cáo kết quả CI từ GitHub Actions và danh sách PRs đã merge.
- **Đầu ra (Output Artifact):** Bảng tổng hợp đánh giá % đóng góp (Academic Contribution Metric) và biên bản nghiệm thu đồ án.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] 100% các task ở trạng thái Done có đầy đủ commit evidence và approval của Peer Reviewer.

---

## 📦 MODULE 2: TỦ THUỐC CÁ NHÂN & NHẮC CỮ UỐNG

### [TASK-2.1] Thiết lập Hạ tầng Docker & Docker Compose Dev Environment
- **Phân cấp:** `Module 2` $\rightarrow$ `DevOps & Environment`
- **Assignee:** Nguyễn Bảo Trọng (VT2) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-04 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Xây dựng `Dockerfile` đa tầng (Multi-stage build) tối ưu dung lượng cho FastAPI backend và file `docker-compose.yml` kết nối container ứng dụng với PostgreSQL cục bộ.
- **File tác động:**
  - `0_medicare/Dockerfile`
  - `0_medicare/docker-compose.yml`
  - `.env.example`
- **Đầu vào (Input Contract):** Phiên bản Python 3.11+, requirements.txt.
- **Đầu ra (Output Artifact):** Lệnh `docker-compose up --build` khởi động toàn bộ hệ thống lên cổng 8000 và 5432.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Container khởi động sạch sẽ, truy cập được Swagger UI tại `http://localhost:8000/docs`.
  - [ ] Biến môi trường tách biệt trong `.env`, không lộ bí mật mật khẩu.

---

### [TASK-2.2] Xây dựng GitHub Actions Pipeline CI & Database Test Fixtures
- **Phân cấp:** `Module 2` $\rightarrow$ `DevOps & CI/CD`
- **Assignee:** Nguyễn Bảo Trọng (VT2) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-06 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Cấu hình file workflow `.github/workflows/ci.yml` tự động kích hoạt kiểm thử Pytest trên mỗi thao tác Push hoặc Pull Request vào nhánh `main`. Tạo fixture SQLite in-memory trong `conftest.py` để chạy test độc lập cực nhanh ($< 3\text{s}$).
- **File tác động:**
  - `.github/workflows/ci.yml`
  - `backend/tests/conftest.py`
  - `backend/pytest.ini`
- **Đầu vào (Input Contract):** Test runner pytest và cấu hình database engine test.
- **Đầu ra (Output Artifact):** Pipeline GitHub Actions có trạng thái xanh (Passing) trên repo GitHub.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Push code tự động trigger CI, hoàn thành chạy test suite dưới 2 phút.
  - [ ] Test in-memory rollback dữ liệu sau mỗi test case, không làm bẩn dữ liệu thật.

---

### [TASK-2.3] Phát triển API CRUD Tủ Thuốc Cá Nhân (User Cabinet)
- **Phân cấp:** `Module 2` $\rightarrow$ `Feature F1.3 (Personal Medicine Cabinet)`
- **Assignee:** Nguyễn Bảo Trọng (VT2) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-11 23:59 | **Story Points:** 5 SP
- **Mục tiêu kỹ thuật:** Triển khai các endpoint quản lý danh mục thuốc đang lưu trữ của người dùng: Thêm thuốc mới vào tủ, xem danh sách thuốc, cập nhật số lượng tồn/hạn sử dụng, và xóa thuốc.
- **File tác động:**
  - `backend/app/routers/cabinet.py`
  - `backend/app/models/cabinet_models.py` (hoặc trong `user_models.py`)
  - `backend/tests/test_cabinet.py`
- **Đầu vào (Input Contract):** Mục `3.1 /api/v1/cabinet` trong `docs/api_contracts.md`.
  - Body mẫu: `{"drug_id": int, "custom_name": str, "dosage": str, "quantity": int, "expiry_date": str}`
- **Đầu ra (Output Artifact):** Các endpoint `GET /api/v1/cabinet`, `POST /api/v1/cabinet`, `DELETE /api/v1/cabinet/{id}`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Chạy `pytest backend/tests/test_cabinet.py` pass 100% (tối thiểu 5 ca kiểm thử: thêm, lấy danh sách, sửa, xóa, từ chối khi không có JWT token).
  - [ ] Tự động validate không cho phép thêm thuốc có hạn sử dụng quá khứ.

---

### [TASK-2.4] Phát triển API Lịch Uống & Thuật toán Sinh Cữ Thuốc Tự Động
- **Phân cấp:** `Module 2` $\rightarrow$ `Engine E2.Cabinet (Dose Schedule Generator)`
- **Assignee:** Nguyễn Bảo Trọng (VT2) | **Peer Reviewer:** Lê Thanh Phong (VT4)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-14 23:59 | **Story Points:** 5 SP
- **Mục tiêu kỹ thuật:** Viết thuật toán tự động phân bổ cữ uống (Sáng: 07:00, Trưa: 12:00, Chiều: 18:00, Tối: 21:00) dựa trên hướng dẫn liều dùng của từng loại thuốc trong tủ. Endpoint cho phép tick "Đã uống" (Mark as Taken) và ghi nhận nhật ký tuân thủ (Compliance Log).
- **File tác động:**
  - `backend/app/routers/schedule.py`
  - `backend/app/services/scheduler.py`
  - `backend/tests/test_schedule.py`
- **Đầu vào (Input Contract):** Mục `3.2 /api/v1/cabinet/schedule` trong `docs/api_contracts.md`.
  - Request: `POST /api/v1/cabinet/schedule/take` body `{"schedule_id": int, "taken_at": "ISO_DATETIME"}`
- **Đầu ra (Output Artifact):** Timeline 24h các cữ thuốc cần uống trong ngày kèm trạng thái `taken: bool`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Pytest sinh đúng các mốc thời gian không bị trùng lặp cữ uống.
  - [ ] Cập nhật trạng thái `taken` tự động trừ số lượng viên thuốc tồn trong tủ (`quantity = quantity - dose_amount`).

---

### [TASK-2.5] UI React: Màn hình Tủ Thuốc Cá Nhân (Cabinet UI)
- **Phân cấp:** `Module 2` $\rightarrow$ `Feature F1.3 UI`
- **Assignee:** Nguyễn Bảo Trọng (VT2) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-18 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Xây dựng giao diện danh sách thuốc trong tủ dạng Card/Grid, hiển thị rõ ảnh thuốc, tên biệt dược, số lượng còn lại, ngày hết hạn và nút thao tác nhanh (Chỉnh sửa / Xóa / Thêm vào cữ uống).
- **File tác động:**
  - `frontend/src/pages/CabinetPage.tsx`
  - `frontend/src/components/CabinetCard.tsx`
  - `frontend/src/services/cabinetService.ts`
- **Đầu vào (Input Contract):** Dữ liệu trả về từ `GET /api/v1/cabinet`.
- **Đầu ra (Output Artifact):** Trang web tương tác mượt mà, hỗ trợ lọc theo nhóm thuốc hoặc trạng thái sắp hết hạn (Expiry Warning Badge).
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Hiển thị cảnh báo màu vàng khi thuốc còn dưới 5 viên hoặc hạn dùng còn dưới 7 ngày.
  - [ ] Modal thêm thuốc mới kết nối API thực tế, tự cập nhật danh sách không cần F5 tải lại trang.

---

### [TASK-2.6] UI React: Timeline Cữ Uống Trong Ngày & Tương Tác "Đã Uống"
- **Phân cấp:** `Module 2` $\rightarrow$ `Feature F1.4 UI`
- **Assignee:** Nguyễn Bảo Trọng (VT2) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-21 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Triển khai thanh Timeline cữ uống 4 buổi (Sáng - Trưa - Chiều - Tối) trên giao diện. Cho phép người dùng bấm tick vào từng cữ thuốc để xác nhận "Đã uống", cập nhật thanh tiến độ tuân thủ điều trị trong ngày (Daily Compliance Progress Bar).
- **File tác động:**
  - `frontend/src/pages/SchedulePage.tsx` (hoặc nhúng trong `CabinetPage.tsx`)
  - `frontend/src/components/DoseTimeline.tsx`
- **Đầu vào (Input Contract):** Dữ liệu `GET /api/v1/cabinet/schedule/today`.
- **Đầu ra (Output Artifact):** Giao diện cữ uống động, nút tick có animation chuyển màu xanh khi hoàn thành.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Bấm tick gọi API thành công, giao diện lập tức chuyển trạng thái sang "Đã uống lúc HH:MM".
  - [ ] Thống kê đúng tỷ lệ % hoàn thành trong ngày (ví dụ: đã uống 3/4 cữ = 75%).

---

### [TASK-2.7] Tích hợp Cơ chế Cảnh Báo Nhắc Nhở 2 Lớp (In-App Banner + Audio)
- **Phân cấp:** `Module 2` $\rightarrow$ `Feature F1.4 / Engine E2 (Reminder Alert System)`
- **Assignee:** Nguyễn Bảo Trọng (VT2) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 4 | **Deadline:** 2026-11-25 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Xây dựng cơ chế nhắc việc uống thuốc: Lớp 1 hiển thị Banner thông báo nổi trên góc màn hình Web kèm âm thanh chuông báo (Web Audio API); Lớp 2 gửi Browser Push Notification nếu người dùng cho phép quyền thông báo.
- **File tác động:**
  - `frontend/src/components/ReminderBanner.tsx`
  - `frontend/src/services/notificationService.ts`
  - `frontend/src/assets/sounds/bell.mp3`
- **Đầu vào (Input Contract):** Giờ hệ thống client so khớp với các mốc giờ cữ uống chưa tick.
- **Đầu ra (Output Artifact):** Banner tự động bật lên khi tới giờ cữ uống kèm âm thanh chuông.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Chạy timer ngầm (Interval check mỗi 60s), khi trùng giờ cữ thuốc chưa uống thì kích hoạt thông báo.
  - [ ] Nút "Bỏ qua" hoặc "Uống ngay" đóng banner sạch sẽ.

---

## 📦 MODULE 3: TRA CỨU DƯỢC LÝ & QUÉT ĐƠN THUỐC AI

### [TASK-3.1] Triển Khai Framework Frontend React Vite, Tailwind CSS & Theme Layout
- **Phân cấp:** `Module 3` $\rightarrow$ `Frontend Foundation`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-04 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Khởi tạo cấu trúc dự án React với Vite, TypeScript, cấu hình Tailwind CSS theo bộ nhận diện y tế (màu chủ đạo Emerald/Teal/Slate), cài đặt React Router v6 với Navbar, Footer và thanh điều hướng thống nhất.
- **File tác động:**
  - `frontend/package.json`
  - `frontend/src/App.tsx`
  - `frontend/src/index.css`
  - `frontend/src/components/Navbar.tsx`
- **Đầu vào (Input Contract):** Thiết kế nhận diện thương hiệu VitaP và sitemap đề xuất.
- **Đầu ra (Output Artifact):** Trang Web chạy mượt mà tại `http://localhost:5173`, chuyển route `/cabinet`, `/interaction`, `/chatbot` không bị giật trang.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Lệnh `npm run build` không phát sinh bất kỳ lỗi TypeScript/CSS nào.
  - [ ] Header Navbar hiển thị trạng thái đăng nhập và các liên kết điều hướng chuẩn xác.

---

### [TASK-3.2] Thuật toán DDI Canonical Pair & Single-Shot Query Kiểm Tra Tương Tác
- **Phân cấp:** `Module 3` $\rightarrow$ `Engine E1 (Clinical Interaction Engine)`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-07 23:59 | **Story Points:** 5 SP
- **Mục tiêu kỹ thuật:** Viết logic kiểm tra tương tác giữa tập hợp $N$ loại thuốc ($N \le 10$). Sinh tổ hợp các cặp thuốc $\binom{N}{2}$ theo chuẩn Canonical Pair (`drug_a_id < drug_b_id`) và thực hiện 1 câu truy vấn SQL duy nhất (`IN (...)`) để lấy toàn bộ cảnh báo tương tác trong CSDL dưới 5ms.
- **File tác động:**
  - `backend/app/routers/m4_ddi.py`
  - `backend/app/services/ddi_engine.py`
  - `backend/tests/test_m4_ddi.py`
- **Đầu vào (Input Contract):** Mục `2.1 POST /api/v1/ddi/check` trong `docs/api_contracts.md`.
  - Body: `{"drug_ids": [1, 5, 12]}`
- **Đầu ra (Output Artifact):** Danh sách các cặp tương tác kèm mức độ (`severity`: RED, YELLOW, GREEN) và cơ chế ảnh hưởng dược học.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Chạy `pytest backend/tests/test_m4_ddi.py` pass 100% (tối thiểu 10 ca test: cặp cấm kỵ Paracetamol + Rượu/Thuốc quá liều gan, kháng sinh + antacid, tập thuốc không tương tác).
  - [ ] Single query thực thi $< 10\text{ms}$ không bị N+1 query loop.

---

### [TASK-3.3] Thuật toán Đối Kháng Thuốc - Bệnh Nền (DCI) & Dị Ứng Cá Nhân Hóa
- **Phân cấp:** `Module 3` $\rightarrow$ `Engine E1 (Disease Contraindication & Allergy Engine)`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-12 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Mở rộng động cơ kiểm tra dược lý: Nạp danh sách bệnh nền và dị ứng từ profile người dùng, so khớp với bảng `drug_disease_contraindications` và `user_allergies` để phát hiện chống chỉ định (ví dụ: Người suy gan không dùng Paracetamol liều cao, người loét dạ dày không dùng Aspirin/Ibuprofen).
- **File tác động:**
  - `backend/app/services/ddi_engine.py`
  - `backend/tests/test_m4_ddi.py`
- **Đầu vào (Input Contract):** Danh sách `drug_ids` kết hợp `user_id` hiện tại.
- **Đầu ra (Output Artifact):** Thêm trường `contraindications: [...]` và `allergy_warnings: [...]` trong response trả về.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Pytest bắt chính xác ca bệnh nhân có tiền sử Hen phế quản dùng thuốc chẹn Beta $\rightarrow$ Cảnh báo ĐỎ (Nguy kịch).
  - [ ] Bắt chính xác ca bệnh nhân dị ứng Penicillin khi kê Amoxicillin $\rightarrow$ Cảnh báo ĐỎ dị ứng.

---

### [TASK-3.4] Pipeline Nén Ảnh Client-side & OCR Đơn Thuốc Bằng Gemini 1.5 Flash
- **Phân cấp:** `Module 3` $\rightarrow$ `Engine E2.OCR (Vision Prescription Pipeline)`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Lê Thanh Phong (VT4)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-15 23:59 | **Story Points:** 5 SP
- **Mục tiêu kỹ thuật:** Triển khai pipeline trích xuất đơn thuốc từ hình ảnh: Nén ảnh phía client (giảm dung lượng xuống $< 1\text{MB}$ bằng Canvas/browser-image-compression), gửi lên Backend gọi Google Gemini 1.5 Flash Vision với Structured JSON Prompt để bóc tách: Danh sách tên thuốc, hàm lượng, số lượng, cách dùng.
- **File tác động:**
  - `backend/app/services/ocr/gemini_vision_service.py`
  - `backend/app/routers/m1_ocr.py` (hoặc trong router upload)
  - `frontend/src/services/imageCompression.ts`
- **Đầu vào (Input Contract):** File ảnh JPG/PNG đơn thuốc viết tay hoặc in ấn.
- **Đầu ra (Output Artifact):** Pydantic JSON: `[{"raw_name": "Panadol 500mg", "dosage": "1v x 2 lan", "quantity": 10}, ...]`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Bóc tách chính xác tối thiểu $80\%$ số loại thuốc trên 3 ảnh đơn thuốc mẫu thực tế.
  - [ ] Có fallback trả về Mock data hoặc báo lỗi thân thiện nếu mất mạng/hết quota Gemini API.

---

### [TASK-3.5] UI React: Modal Xem Trước & Xác Nhận Đơn Thuốc (Human-in-the-Loop)
- **Phân cấp:** `Module 3` $\rightarrow$ `Feature F2.2 UI (OCR Verification Modal)`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-19 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Thiết kế Modal hiển thị kết quả sau khi quét OCR kèm ảnh chụp gốc đối chiếu song song. Tự động gợi ý thuốc từ Fuzzy Match (Task 1.5) và cho phép người dùng click chỉnh sửa trực tiếp tên/liều lượng/số lượng trước khi nhấn "Xác nhận lưu vào Tủ thuốc".
- **File tác động:**
  - `frontend/src/components/PrescriptionReviewModal.tsx`
  - `frontend/src/pages/PrescriptionUploadPage.tsx`
- **Đầu vào (Input Contract):** JSON trích xuất từ OCR + kết quả Fuzzy Match.
- **Đầu ra (Output Artifact):** Modal thân thiện, người dùng sửa được text input, nhấn lưu gọi API `/api/v1/cabinet/batch-add`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Tuyệt đối không tự động nạp thẳng vào tủ nếu người dùng chưa bấm nút xác nhận (Tuân thủ nguyên tắc An toàn Y khoa).
  - [ ] Cho phép thêm dòng thuốc mới hoặc xóa dòng thuốc nhận diện sai.

---

### [TASK-3.6] UI React: Màn Hình Tra Cứu Tương Tác & Thẻ Cảnh Báo Đỏ/Vàng/Xanh
- **Phân cấp:** `Module 3` $\rightarrow$ `Feature F2.1 UI (Interaction Checker Page)`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-22 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Xây dựng màn hình Tra cứu tương tác: Cho phép người dùng chọn nhanh các thuốc từ Tủ thuốc cá nhân hoặc gõ ô Autocomplete tìm kiếm biệt dược trong CSDL. Hiển thị kết quả tương tác dạng Thẻ cảnh báo phân cấp màu trực quan:
  - 🔴 **Đỏ (Chống chỉ định tuyệt đối / Nghiêm trọng):** Bắt buộc dừng thuốc, nguy hiểm tính mạng.
  - 🟡 **Vàng (Thận trọng / Cần theo dõi):** Uống cách nhau 2-4 tiếng, theo dõi tác dụng phụ.
  - 🟢 **Xanh (An toàn):** Không phát hiện tương tác có hại.
- **File tác động:**
  - `frontend/src/pages/InteractionPage.tsx`
  - `frontend/src/components/InteractionCard.tsx`
  - `frontend/src/components/DrugAutocomplete.tsx`
- **Đầu vào (Input Contract):** Danh sách thuốc chọn từ UI gửi tới `/api/v1/ddi/check`.
- **Đầu ra (Output Artifact):** Giao diện hiển thị trực quan các thẻ cảnh báo và chi tiết cơ chế dược học.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Hiển thị đầy đủ cơ chế tương tác, hậu quả lâm sàng và lời khuyên xử lý.
  - [ ] Có nút chia sẻ hoặc lưu kết quả tra cứu.

---

### [TASK-3.7] Tối Ưu Hóa Trải Nghiệm Khách Hàng (UX) & Kiểm Thử E2E Luồng Tra Cứu
- **Phân cấp:** `Module 3` $\rightarrow$ `Testing & Polish`
- **Assignee:** Dương Phan Minh Trí (VT3) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 4 | **Deadline:** 2026-11-26 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Rà soát và kiểm thử toàn diện luồng: Chụp ảnh đơn thuốc $\rightarrow$ Xem trước $\rightarrow$ Nạp vào tủ $\rightarrow$ Tự động cảnh báo tương tác với các thuốc cũ đã có trong tủ. Tối ưu CSS animation và thông báo phản hồi (Feedback state/Loading spinner).
- **File tác động:**
  - `frontend/src/pages/InteractionPage.tsx`
  - `frontend/src/pages/PrescriptionUploadPage.tsx`
- **Đầu vào (Input Contract):** Luồng thao tác thực tế của người dùng.
- **Đầu ra (Output Artifact):** Trải nghiệm không giật lag, thời gian phản hồi thao tác $< 300\text{ms}$.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Trạng thái Loading Spinner hiển thị rõ ràng khi đang upload ảnh hoặc chờ Gemini OCR.
  - [ ] Thử nghiệm trên kích thước màn hình Mobile và Desktop hiển thị chuẩn xác không vỡ layout.

---

## 📦 MODULE 4: TRỢ LÝ ĐÀM THOẠI Y TẾ & LỐI SỐNG AI

### [TASK-4.1] Biên Soạn & Chuẩn Hóa Cẩm Nang Y Tế Định Dạng Markdown (MoH Guidelines)
- **Phân cấp:** `Module 4` $\rightarrow$ `Knowledge Base Engineering`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 1 | **Deadline:** 2026-11-06 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Thu thập, biên soạn và chuẩn hóa tối thiểu 10 tài liệu cẩm nang y tế chính thống (Hướng dẫn sử dụng thuốc an toàn của Bộ Y tế, dinh dưỡng cho người tiểu đường, huyết áp, phụ nữ mang thai, chế độ kiêng cữ khi uống thuốc) sang định dạng Markdown chuẩn hóa theo cấu trúc: `# Chủ đề`, `## Nguyên tắc`, `### Khuyến cáo`.
- **File tác động:**
  - `backend/app/services/rag/knowledge_base/*.md` (tối thiểu 10 files)
- **Đầu vào (Input Contract):** Tài liệu hướng dẫn điều trị của Bộ Y tế, Dược thư Quốc gia Việt Nam.
- **Đầu ra (Output Artifact):** Thư mục tài liệu Markdown sạch sẽ, không chứa thông tin rác, chia đoạn mạch lạc.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Tối thiểu 10 files Markdown với tổng dung lượng $\ge 50\text{KB}$ văn bản chuyên môn y khoa.
  - [ ] Phủ đầy đủ 4 chủ đề lớn: Sử dụng kháng sinh, Chế độ ăn cho bệnh mạn tính, Tương kỵ thực phẩm - thuốc, Dị ứng thuốc.

---

### [TASK-4.2] Xây Dựng RAG Pipeline & Vector Database Embeddings
- **Phân cấp:** `Module 4` $\rightarrow$ `Engine E3 (Medical RAG Engine)`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-13 23:59 | **Story Points:** 5 SP
- **Mục tiêu kỹ thuật:** Triển khai quy trình RAG: Cắt nhỏ tài liệu cẩm nang thành các Chunks (kích thước 300-500 tokens, overlap 50 tokens), tính toán vector embedding (sử dụng Gemini Text-Embedding-004 hoặc model mã nguồn mở Sentence-Transformers) và lưu trữ vào Vector Store (Supabase `pgvector` hoặc ChromaDB cục bộ). Viết hàm truy vấn top $K=3$ đoạn trích liên quan nhất theo độ tương đồng Cosine.
- **File tác động:**
  - `backend/app/services/rag/ingest.py`
  - `backend/app/services/rag/retriever.py`
  - `backend/tests/test_rag.py`
- **Đầu vào (Input Contract):** Tập tài liệu Markdown từ Task 4.1.
- **Đầu ra (Output Artifact):** Script nạp dữ liệu `python backend/app/services/rag/ingest.py` và hàm `retrieve_context(query: str, top_k: int = 3) -> List[str]`.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Chạy `ingest.py` vector hóa toàn bộ cẩm nang thành công không lỗi.
  - [ ] Thử nghiệm truy vấn: Câu hỏi "Bị tiểu đường có uống được nước cam không?" trả về đúng đoạn trích dẫn cẩm nang dinh dưỡng tiểu đường với Cosine Similarity $\ge 0.75$.

---

### [TASK-4.3] Thiết Lập Rào Chắn An Toàn (Medical Guardrails) & System Prompt Y Khoa
- **Phân cấp:** `Module 4` $\rightarrow$ `Engine E3 (Medical Guardrails & Personalization)`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 2 | **Deadline:** 2026-11-15 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Xây dựng System Prompt chuyên biệt cho trợ lý y tế:
  1. Tiêm động thông tin hồ sơ người dùng (Tuổi, giới tính, bệnh nền, thuốc đang uống trong tủ).
  2. Rào chắn từ chối chẩn đoán bệnh thay bác sĩ hoặc kê đơn thuốc cấm.
  3. Bắt buộc trích dẫn nguồn tài liệu cẩm nang (`[Nguồn: Cẩm nang Bộ Y Tế]`) và luôn kèm câu từ chối trách nhiệm y khoa (Medical Disclaimer).
- **File tác động:**
  - `backend/app/services/rag/prompts.py`
  - `backend/app/services/rag/guardrails.py`
  - `backend/tests/test_m3_chatbot.py`
- **Đầu vào (Input Contract):** Prompt template + Profile bệnh nhân + Context trích xuất từ RAG.
- **Đầu ra (Output Artifact):** Prompt an toàn gửi tới Gemini API.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Pytest thử nghiệm câu hỏi độc hại (ví dụ: "Cho tôi cách tự phá thai bằng thuốc", "Kê đơn thuốc ngủ liều tử vong") $\rightarrow$ Hệ thống lập tức từ chối và khuyên đến cơ sở y tế.
  - [ ] Câu trả lời luôn đính kèm câu khuyến cáo: *"Thông tin chỉ mang tính tham khảo, vui lòng hỏi ý kiến bác sĩ chuyên khoa."*

---

### [TASK-4.4] Phát Triển API Chatbot Đàm Thoại Thời Gian Thực (SSE Streaming)
- **Phân cấp:** `Module 4` $\rightarrow$ `Feature F3.1 (Conversational API)`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-19 23:59 | **Story Points:** 5 SP
- **Mục tiêu kỹ thuật:** Triển khai endpoint `/api/v1/chatbot/chat-stream` sử dụng Server-Sent Events (SSE - `text/event-stream`). Kết nối Gemini 1.5 Flash streaming để trả kết quả từng từ (token-by-token) về client, tối ưu hóa thời gian phản hồi chữ đầu tiên (TTFT $< 1.5\text{s}$). Lưu lịch sử hội thoại vào CSDL (bảng `chat_history`).
- **File tác động:**
  - `backend/app/routers/m3_chatbot.py`
  - `backend/app/services/rag/llm_client.py`
  - `backend/tests/test_m3_chatbot.py`
- **Đầu vào (Input Contract):** Mục `4. Trợ lý Đàm thoại Y tế` trong `docs/api_contracts.md`.
  - Request: `POST /api/v1/chatbot/chat-stream` body `{"message": str, "session_id": str}`
- **Đầu ra (Output Artifact):** Luồng stream SSE trả về từng đoạn text kèm metadata nguồn tham khảo.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Endpoint trả về `Content-Type: text/event-stream`.
  - [ ] Chạy `pytest backend/tests/test_m3_chatbot.py` pass 100% (test mock stream và test lưu lịch sử chat).

---

### [TASK-4.5] UI React: Component ChatBox Thông Minh Hỗ Trợ SSE Streaming & Markdown
- **Phân cấp:** `Module 4` $\rightarrow$ `Feature F3.1 UI (ChatBox Interface)`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Dương Phan Minh Trí (VT3)
- **Sprint:** Sprint 3 | **Deadline:** 2026-11-22 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Xây dựng giao diện khung chat hiện đại: Hỗ trợ nhận luồng dữ liệu SSE hiển thị chữ gõ theo thời gian thực (Typewriter Effect), parse định dạng Markdown (in đậm, danh sách gạch đầu dòng, bảng biểu), hiển thị trích dẫn nguồn tài liệu cẩm nang và các câu hỏi gợi ý nhanh (Prompt Suggestions).
- **File tác động:**
  - `frontend/src/components/chat/ChatBox.tsx`
  - `frontend/src/pages/ChatbotPage.tsx`
  - `frontend/src/services/chatService.ts`
- **Đầu vào (Input Contract):** Luồng sự kiện SSE từ backend.
- **Đầu ra (Output Artifact):** Giao diện khung chat phản hồi mượt mà, tự động cuộn xuống dưới (Auto-scroll), có nút dừng sinh chữ (Stop generation).
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Render chữ mượt mà không bị giật lag khung hình.
  - [ ] Hiển thị rõ ràng Disclaimer cảnh báo y tế dưới chân khung chat.

---

### [TASK-4.6] Cơ Chế Fallback Cache Cho Chatbot Khi Mất Mạng Hoặc Vượt Quota
- **Phân cấp:** `Module 4` $\rightarrow$ `Engine E3 (Chatbot Reliability & Caching)`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Nguyễn Bảo Trọng (VT2)
- **Sprint:** Sprint 4 | **Deadline:** 2026-11-25 23:59 | **Story Points:** 3 SP
- **Mục tiêu kỹ thuật:** Xây dựng cơ chế dự phòng an toàn cho Chatbot:
  1. Cache câu trả lời của 20 câu hỏi thường gặp nhất (FAQ) vào SQLite/In-memory cache.
  2. Bắt lỗi `429 Too Many Requests` (hết hạn mức Free Tier Gemini) hoặc lỗi rớt mạng để tự động trả lời bằng cẩm nang tĩnh định sẵn mà không làm sập ứng dụng khi demo.
- **File tác động:**
  - `backend/app/services/rag/fallback_cache.py`
  - `backend/tests/test_m3_chatbot.py`
- **Đầu vào (Input Contract):** Ngoại lệ `google.api_core.exceptions.ResourceExhausted` hoặc mất kết nối internet.
- **Đầu ra (Output Artifact):** Trả về nội dung trích xuất trực tiếp từ file cẩm nang Markdown cục bộ.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Giả lập ngắt kết nối Gemini API $\rightarrow$ Chatbot vẫn trả về câu trả lời hữu ích từ Cache cẩm nang và hiển thị nhãn `[Chế độ dự phòng Offline]`.

---

### [TASK-4.7] Đánh Giá Độ Chính Xác Trả Lời & Hoàn Thiện Báo Cáo Triển Khai RAG
- **Phân cấp:** `Module 4` $\rightarrow$ `Evaluation & Documentation`
- **Assignee:** Lê Thanh Phong (VT4) | **Peer Reviewer:** Trương Huệ Trí (VT1)
- **Sprint:** Sprint 4 | **Deadline:** 2026-11-28 23:59 | **Story Points:** 2 SP
- **Mục tiêu kỹ thuật:** Xây dựng bộ 20 câu hỏi kiểm thử đánh giá chất lượng câu trả lời của RAG (Grounding, Faithfulness, Answer Relevance). Viết tài liệu hướng dẫn vận hành pipeline RAG và cấu hình API key.
- **File tác động:**
  - `backend/app/services/rag/evaluation_results.md`
  - `0_medicare/docs/designs/rag_architecture.md`
- **Đầu vào (Input Contract):** 20 cặp câu hỏi - câu trả lời chuẩn (Gold Standard QA).
- **Đầu ra (Output Artifact):** Báo cáo đánh giá độ chính xác đạt $\ge 85\%$ câu trả lời bám sát cẩm nang Bộ Y Tế.
- **Tiêu chuẩn nghiệm thu (DoD):**
  - [ ] Báo cáo nghiệm thu có số liệu kiểm chứng cụ thể, được PO Trương Huệ Trí ký duyệt.

---

## 📊 BẢNG TỔNG HỢP THEO DÕI TIẾN ĐỘ & PHÂN BỔ CÔNG VIỆC

| Mã Task | Tên Nhiệm Vụ | Module | Assignee | Reviewer | Sprint | Hạn chót | SP | Trạng thái |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1.1** | Thiết kế CSDL Quan hệ 3NF & Data DDL Migration | M1 | Trương Huệ Trí | Nguyễn Bảo Trọng | S1 | 04/11 | 5 | 🟢 Đã xong |
| **1.2** | Phát triển API Xác thực Người dùng (Auth JWT) | M1 | Trương Huệ Trí | Nguyễn Bảo Trọng | S1 | 06/11 | 3 | 🟢 Đã xong |
| **1.3** | Phát triển API CRUD Hồ sơ Bệnh nền & Dị ứng Thuốc | M1 | Trương Huệ Trí | Lê Thanh Phong | S1 | 08/11 | 3 | 🟢 Đã xong |
| **1.4** | Chuẩn hóa Dataset Dược học & Nạp Seed Data | M1 | Trương Huệ Trí | Dương Phan Minh Trí | S1 | 05/11 | 3 | 🟢 Đã xong |
| **1.5** | Thuật toán Fuzzy Matching So khớp Tên Thuốc | M1 | Trương Huệ Trí | Dương Phan Minh Trí | S2 | 12/11 | 3 | 🟡 Đang làm |
| **1.6** | UI React: Đăng ký, Đăng nhập & Hồ sơ Sức khỏe | M1 | Trương Huệ Trí | Dương Phan Minh Trí | S2 | 15/11 | 3 | ⚪ Chờ làm |
| **1.7** | Quản trị Chất lượng & Tổng duyệt QA Sign-off | M1 | Trương Huệ Trí | Nguyễn Bảo Trọng | S4 | 28/11 | 2 | ⚪ Chờ làm |
| **2.1** | Thiết lập Hạ tầng Docker & Docker Compose | M2 | Nguyễn Bảo Trọng | Trương Huệ Trí | S1 | 04/11 | 3 | 🟢 Đã xong |
| **2.2** | GitHub Actions Pipeline CI & DB Test Fixtures | M2 | Nguyễn Bảo Trọng | Trương Huệ Trí | S1 | 06/11 | 3 | 🟢 Đã xong |
| **2.3** | Phát triển API CRUD Tủ Thuốc Cá Nhân | M2 | Nguyễn Bảo Trọng | Trương Huệ Trí | S2 | 11/11 | 5 | ⚪ Sẵn sàng |
| **2.4** | API Lịch Uống & Thuật toán Sinh Cữ Thuốc | M2 | Nguyễn Bảo Trọng | Lê Thanh Phong | S2 | 14/11 | 5 | ⚪ Sẵn sàng |
| **2.5** | UI React: Màn hình Tủ Thuốc Cá Nhân | M2 | Nguyễn Bảo Trọng | Dương Phan Minh Trí | S3 | 18/11 | 3 | ⚪ Chờ làm |
| **2.6** | UI React: Timeline Cữ Uống & Tick "Đã Uống" | M2 | Nguyễn Bảo Trọng | Dương Phan Minh Trí | S3 | 21/11 | 3 | ⚪ Chờ làm |
| **2.7** | Cảnh Báo Nhắc Nhở 2 Lớp (Banner + Audio) | M2 | Nguyễn Bảo Trọng | Trương Huệ Trí | S4 | 25/11 | 3 | ⚪ Chờ làm |
| **3.1** | Khởi tạo Frontend React Vite, Tailwind & Layout | M3 | Dương Phan Minh Trí | Trương Huệ Trí | S1 | 04/11 | 3 | 🟢 Đã xong |
| **3.2** | Thuật toán DDI Canonical Pair Single-Shot Query | M3 | Dương Phan Minh Trí | Trương Huệ Trí | S1 | 07/11 | 5 | ⚪ Sẵn sàng |
| **3.3** | Thuật toán Đối Kháng Thuốc - Bệnh Nền (DCI) & Dị Ứng | M3 | Dương Phan Minh Trí | Trương Huệ Trí | S2 | 12/11 | 3 | ⚪ Chờ làm |
| **3.4** | Pipeline Nén Ảnh Client & OCR Gemini 1.5 Flash | M3 | Dương Phan Minh Trí | Lê Thanh Phong | S2 | 15/11 | 5 | ⚪ Sẵn sàng |
| **3.5** | UI React: Modal Xác Nhận Đơn Thuốc (Human-in-Loop) | M3 | Dương Phan Minh Trí | Trương Huệ Trí | S3 | 19/11 | 3 | ⚪ Chờ làm |
| **3.6** | UI React: Màn Hình Tra Cứu & Thẻ Cảnh Báo Đỏ/Vàng/Xanh | M3 | Dương Phan Minh Trí | Trương Huệ Trí | S3 | 22/11 | 3 | ⚪ Chờ làm |
| **3.7** | Tối Ưu Hóa UX & Kiểm Thử E2E Luồng Tra Cứu | M3 | Dương Phan Minh Trí | Nguyễn Bảo Trọng | S4 | 26/11 | 3 | ⚪ Chờ làm |
| **4.1** | Biên Soạn Cẩm Nang Y Tế Định Dạng Markdown | M4 | Lê Thanh Phong | Trương Huệ Trí | S1 | 06/11 | 3 | 🟢 Đã xong |
| **4.2** | Xây Dựng RAG Pipeline & Vector DB Embeddings | M4 | Lê Thanh Phong | Trương Huệ Trí | S2 | 13/11 | 5 | ⚪ Sẵn sàng |
| **4.3** | Thiết Lập Medical Guardrails & System Prompt | M4 | Lê Thanh Phong | Trương Huệ Trí | S2 | 15/11 | 3 | ⚪ Sẵn sàng |
| **4.4** | Phát Triển API Chatbot Streaming (SSE) | M4 | Lê Thanh Phong | Nguyễn Bảo Trọng | S3 | 19/11 | 5 | ⚪ Chờ làm |
| **4.5** | UI React: ChatBox Thông Minh (SSE & Markdown) | M4 | Lê Thanh Phong | Dương Phan Minh Trí | S3 | 22/11 | 3 | ⚪ Chờ làm |
| **4.6** | Cơ Chế Dự Phòng Fallback Cache Cho Chatbot | M4 | Lê Thanh Phong | Nguyễn Bảo Trọng | S4 | 25/11 | 3 | ⚪ Chờ làm |
| **4.7** | Đánh Giá Độ Chính Xác RAG & Tài Liệu Vận Hành | M4 | Lê Thanh Phong | Trương Huệ Trí | S4 | 28/11 | 2 | ⚪ Chờ làm |

---

## 🎯 CÔNG THỨC TÍNH ĐIỂM CỐNG HIẾN CÁ NHÂN (ACADEMIC EVALUATION)

Tỷ lệ điểm đóng góp cá nhân ($C_i$) của thành viên $i$ được tính toán minh bạch dựa trên 3 trụ cột khoa học:

$$C_i = 0.45 \times \frac{SP_i}{\sum SP} + 0.25 \times \frac{Git_i}{\sum Git} + 0.30 \times Peer_i$$

Trong đó:
1. **$SP_i$ (45% Trọng số khối lượng):** Tổng số Story Points của các task đạt Definition of Done (DoD) được PO nghiệm thu.
2. **$Git_i$ (25% Trọng số kỹ thuật):** Tỷ lệ đóng góp commit/PR sạch sẽ, vượt qua kiểm thử tự động của GitHub Actions CI.
3. **$Peer_i$ (30% Trọng số đánh giá chéo 360°):** Điểm đánh giá mức độ hợp tác, hỗ trợ đồng đội và tuân thủ thời hạn từ 3 thành viên còn lại (thang điểm 1.0 chuẩn hóa).
