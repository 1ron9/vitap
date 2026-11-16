# HƯỚNG DẪN KIỂM THỬ, VẬN HÀNH VÀ BÀN GIAO FRONTEND UI (VITAP WEB APP)

> **Vị trí file:** `docs/frontend/FRONTEND_INTEGRATION_GUIDE.md`  
> **Nhánh Git phụ trách:** `feat/fe-figma-migration`  
> **Phiên bản:** v1.0.0 (Cập nhật ngày 14/11/2026)  
> **Áp dụng cho:** Toàn bộ thành viên đội ngũ VitaP (Frontend, Backend, M3 AI/RAG, QA/Tester).

---

## 1. TỔNG QUAN & BỐI CẢNH DỰ ÁN

Tài liệu này ghi lại chi tiết toàn bộ quá trình di chuyển (migration), tái cấu trúc, làm sạch dữ liệu mock và tích hợp giao diện người dùng **VitaP Web Companion** từ bản mẫu thiết kế Figma Make sang mã nguồn chính thức của hệ thống.

### 1.1. Công nghệ sử dụng (Tech Stack)

- **Frontend Framework:** React 19, TypeScript 5.7+, Vite 8
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`), cấu hình design tokens chuẩn y tế (màu sắc, độ tương phản WCAG AA)
- **Routing:** `react-router-dom` v7 (đồng bộ URL SPA: `/`, `/dashboard`, `/journal`, `/scan`, `/chat`, `/profile`)
- **Iconography:** `lucide-react`
- **Typography & Quyền riêng tư:** Self-hosted fonts `@fontsource/be-vietnam-pro` và `@fontsource/ibm-plex-mono` (không dùng CDN Google Fonts nhằm chống rò rỉ địa chỉ IP người bệnh ra bên thứ ba)
- **Testing:** Vitest 5+, assertion qua `renderToString` (`react-dom/server`) cho kiểm thử component nhẹ và nhanh (33 tests lâm sàng và tính năng)
- **Package Manager:** `pnpm` (>= 10.33)
- **Backend đồng hành:** FastAPI (Python 3.11+), PostgreSQL 16 + pgvector, SQLAlchemy 2.0, Alembic

---

## 2. HƯỚNG DẪN THIẾT LẬP & CHẠY KIỂM THỬ (TESTING & SETUP GUIDE)

Mọi thành viên trong nhóm có thể tái lập và kiểm thử toàn bộ hệ thống bằng các bước tuần tự dưới đây.

### 2.1. Yêu cầu môi trường tiên quyết (Prerequisites)

- **Node.js:** Phiên bản 22.x trở lên.
- **pnpm:** Phiên bản 10.x trở lên (`npm install -g pnpm@10.33.0`).
- **Python:** 3.11.x trở lên cùng công cụ `venv`.
- **Docker & Docker Compose:** Đang chạy trên máy để khởi tạo cơ sở dữ liệu PostgreSQL.

---

### 2.2. Bước 1: Khởi động Cơ sở dữ liệu PostgreSQL cục bộ

Từ thư mục gốc dự án:

```bash
# Khởi động container Postgres (cổng 5432)
docker compose up -d db

# Kiểm tra container đã ở trạng thái healthy
docker compose ps
```

> _Lưu ý:_ Thông tin kết nối mặc định: `postgresql://vitap_dev:vitap_dev_pass_2026@127.0.0.1:5432/vitap_dev`.

---

### 2.3. Bước 2: Thiết lập Backend & Chạy Seed dữ liệu mẫu

Mở terminal tại thư mục backend:

```bash
cd backend

# Kích hoạt môi trường ảo Python
source .venv/bin/activate

# Cập nhật schema database mới nhất qua Alembic
alembic upgrade head

# Chạy kịch bản nạp dữ liệu kiểm thử (3 Persona bệnh nhân chuẩn + Dược thư Quốc gia)
python -m data_seed.seed_test_scenarios
```

_Kết quả mong đợi:_ Terminal hiển thị nạp thành công các hoạt chất, cặp tương tác thuốc mẫu và tạo 3 tài khoản kiểm thử (`patient.chronic@vitap.vn`, `patient.ddi@vitap.vn`, `patient.empty@vitap.vn`).

---

### 2.4. Bước 3: Cài đặt thư viện Frontend

Mở terminal tại thư mục frontend:

```bash
cd frontend

# Cài đặt toàn bộ dependencies theo lockfile
pnpm install
```

---

### 2.5. Bước 4: Chạy bộ kiểm thử tự động (Automated Verification)

Đội ngũ có thể chạy nhanh các lệnh sau để đảm bảo mã nguồn đạt 100% tiêu chuẩn chất lượng và an toàn y tế:

#### A. Kiểm tra Backend Pytest

```bash
cd backend
PYTHONPATH=. .venv/bin/pytest -v
```

- **Kết quả:** `23 passed, 5 skipped` (100% tests cho Auth M0, Foundation, Seed Scenarios, API main đều xanh).

#### B. Kiểm tra Frontend TypeScript Typecheck

```bash
pnpm --dir frontend typecheck
```

- **Kết quả:** `0 errors` (TypeScript biên dịch hoàn toàn sạch).

#### C. Chạy Frontend Vitest (33 Unit & Safety Tests)

```bash
pnpm --dir frontend test --run
```

- **Kết quả:** `7 passed (7 suites), 33 passed (33 tests)`:
  - `safety.test.tsx` (15 tests): Kiểm tra 4 trạng thái tương tác thuốc chuẩn, cấm nhãn xanh "safe", kiểm tra chuyển đổi mmol/L.
  - `review_fixes.test.tsx` (5 tests): Kiểm tra ngắt phiên đăng xuất, deep link quét đơn, phân tách trạng thái rỗng.
  - `copilot_review_fixes.test.tsx` (3 tests): Kiểm tra chi tiết lỗi 422 envelope `{field, reason}`, skip link landmark chat, cô lập DataProvider.
  - `fixtures.test.ts` (4 tests): Kiểm tra đồng bộ dữ liệu hạt giống 3 persona.
  - `api.test.ts` (3 tests): Kiểm tra client API envelope và mapping lỗi HTTP 422/409.
  - `natural_screens.test.tsx` (2 tests): Kiểm tra hiển thị màn hình thực tế theo người dùng.
  - `no_demopanel.test.tsx` (1 test): Đảm bảo `DemoPanel` và mock controls nhân tạo đã bị loại bỏ hoàn toàn.

#### D. Kiểm tra Production Build

```bash
pnpm --dir frontend build
```

- **Kết quả:** `✓ built in ~800-900ms`, toàn bộ assets và fonts self-hosted được đóng gói chính xác vào thư mục `dist/`.

---

### 2.6. Bước 5: Khởi chạy Máy chủ Phát triển (Local Dev Server)

Để kiểm thử trực tiếp trên trình duyệt, mở 2 cửa sổ terminal:

**Cửa sổ 1 - Backend FastAPI:**

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

_(Backend chạy tại `http://localhost:8000`, tài liệu Swagger docs tại `http://localhost:8000/docs`)_

**Cửa sổ 2 - Frontend Vite:**

```bash
cd frontend
pnpm dev
```

_(Frontend chạy tại `http://localhost:5173`, tự động chuyển tiếp các request `/api/_`về`http://localhost:8000` qua reverse proxy)\*

---

### 2.7. Danh sách Tài khoản Kiểm thử (Test Accounts) & Mật khẩu

Toàn bộ các tài khoản seed đều dùng mật khẩu chung tuân thủ Invariant bảo mật:

> **Mật khẩu chung:** `Vitap@Dev2026`

| Tài khoản (Email)              | Vai trò / Kịch bản kiểm thử                           | Dữ liệu có sẵn                                                    | Mục đích kiểm thử chính                                                                                                     |
| :----------------------------- | :---------------------------------------------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| **`patient.chronic@vitap.vn`** | Bệnh nhân mãn tính (Tiểu đường Type 2, Tăng huyết áp) | 2 đơn thuốc, nhật ký đường huyết, huyết áp                        | Kiểm tra biểu đồ sinh hiệu Dashboard, Sổ tay ghi chép, tra cứu tương tác Metformin - Captopril                              |
| **`patient.ddi@vitap.vn`**     | Bệnh nhân tim mạch có tương tác thuốc nguy hiểm       | Đơn thuốc tim mạch `TIM-MACH-2026-001` (Clopidogrel + Omeprazole) | Kiểm tra cảnh báo đỏ **CONTRAINDICATED** (giảm hiệu lực chống đông), kiểm tra trợ lý Chatbot phản ứng với đơn thuốc nguy cơ |
| **`patient.empty@vitap.vn`**   | Bệnh nhân mới tạo tài khoản                           | Không có đơn thuốc, không có ghi chép                             | Kiểm tra **Empty State** trên tất cả các màn hình: Dashboard, Sổ tay, Quét đơn, Đảm bảo không bị dính mock data             |
| **Khách vãng lai (Guest)**     | Trải nghiệm thử không cần đăng nhập                   | Chưa lưu trữ                                                      | Thử nghiệm tính năng "Kiểm tra thuốc" công khai ngay tại Trang chủ                                                          |

---

## 3. NHỮNG GÌ ĐÃ LÀM ĐƯỢC (WHAT HAS BEEN DONE)

Trong đợt phát triển vừa qua, toàn bộ frontend đã được nâng cấp toàn diện từ một bản prototype giao diện tĩnh thành một ứng dụng web hoàn chỉnh, kết nối cơ sở dữ liệu thật và loại bỏ triệt để các thành phần giả lập.

### 3.1. Chuyển đổi Giao diện & Kiến trúc Frontend

1. **Di chuyển sạch từ Figma Make:** Đưa toàn bộ layout, components, tokens từ prototype sang dự án chính quy `vitap/frontend/`.
2. **Loại bỏ DemoPanel & Mock Variant:** Xóa bỏ hoàn toàn thanh công cụ giả lập `DemoPanel` và cơ chế đổi trạng thái nhân tạo (`variant`); toàn bộ màn hình chuyển sang phản ứng theo dữ liệu người dùng thực tế.
3. **SPA Routing chuẩn với URL:** Tích hợp `react-router-dom` với các đường dẫn `/dashboard`, `/journal`, `/scan`, `/chat`, `/profile` và `/` (Trang chủ). Hỗ trợ nút Back/Forward của trình duyệt và tự động cuộn lên đầu trang (`ScrollToTop`).
4. **Phông chữ Self-hosted chống rò rỉ dữ liệu:** Nhúng cục bộ `@fontsource/be-vietnam-pro` và `@fontsource/ibm-plex-mono`, ngắt hoàn toàn kết nối tới CDN Google Fonts để bảo vệ thông tin bệnh nhân.

### 3.2. Module Xác thực (Auth M0) & Cô lập Phiên làm việc

1. **Ràng buộc Mật khẩu an toàn y tế:** Đồng bộ validation độ dài mật khẩu tối thiểu 12 ký tự (`min_length=12`) giữa Backend và Frontend; thông báo lỗi cụ thể cho từng ô nhập liệu.
2. **Đồng thuận xử lý dữ liệu Y tế (Consent Management):** Chuẩn hóa phiên bản consent `health-ai-v1` với phạm vi `HEALTH_DATA_AND_AI_PROCESSING` khi đăng ký tài khoản.
3. **Lưu trữ & Làm mới Token:** Lưu giữ Access Token và Refresh Token trong `localStorage`; tự động gửi Bearer Token khi gọi API.
4. **Đăng xuất an toàn (Clean Logout):** Khi bấm "Đăng xuất" trên màn hình Profile, hệ thống gọi API backend hủy refresh token, xóa sạch token, email, đưa phiên về chế độ khách (`isGuest: true`) và chuyển hướng về trang Onboarding.
5. **Chặn truy cập Auth khi đã đăng nhập:** Khi người dùng đã có phiên đăng nhập, hệ thống không cho phép mở modal đăng ký/đăng nhập lại cho đến khi thực hiện đăng xuất rõ ràng.

### 3.3. Làm sạch Dữ liệu Mock trong Quét đơn & Tra cứu Tương tác

1. **Tra cứu tương tác thuốc (`Lookup.tsx`):**
   - Loại bỏ các chip "Thử nhanh" (`QUICK`) và thẻ gợi ý tương tác giả lập cố định.
   - Xây dựng tính năng **"Tương tác đã tra gần đây"**: ghi nhận lịch sử tra cứu của người dùng vào `localStorage` (`vitap-recent-lookups`), cho phép bấm vào để tra lại hoặc xóa từng mục lịch sử.
2. **Quét & Lưu đơn thuốc (`Upload.tsx`):**
   - Bỏ hoàn toàn việc tự động hiển thị 2 đơn thuốc mẫu cho mọi người dùng.
   - Danh sách "Đơn thuốc đã lưu gần đây" chỉ xuất hiện khi tài khoản thực sự có đơn thuốc được lưu (ví dụ tài khoản `patient.chronic@vitap.vn` hoặc `patient.ddi@vitap.vn`). Đối với tài khoản mới hoặc tài khoản khách, giao diện hiển thị trạng thái hướng dẫn tải đơn sạch sẽ.

### 3.4. Nâng cấp Trợ lý AI (Chatbot Real Medical Reasoning)

1. **Xóa bỏ các phiên chat giả lập:** Loại bỏ 6 phiên chat cứng (`CHAT_SESSIONS`) trong mã nguồn Figma cũ.
2. **Bộ máy suy luận Y khoa cục bộ (Medical Reasoning Engine):**
   - Phân tích câu hỏi của người dùng và đối chiếu trực tiếp với **danh sách đơn thuốc hiện tại của chính bệnh nhân** trong cơ sở dữ liệu.
   - Sử dụng Rule Engine lâm sàng để phát hiện tương tác giữa các hoạt chất trong đơn (ví dụ Clopidogrel và Omeprazole).
3. **Thực thi nghiêm ngặt các Invariant An toàn Y tế:**
   - **Invariant #6 (Emergency Cutoff):** Khi người bệnh đề cập đến các dấu hiệu cấp cứu nguy kịch (khó thở, tức ngực dữ dội, sưng phù môi/lưỡi, ngất xỉu, sốt cao co giật), hệ thống **ngắt luồng ngay lập tức**, đưa ra cảnh báo khẩn cấp và nút gọi 115 / cơ sở y tế gần nhất, tuyệt đối không chần chừ hay đưa ra lời khuyên chung chung.
   - **Invariant #1 (Từ chối chẩn đoán & kê đơn):** Khi người dùng yêu cầu chẩn đoán bệnh ("Tôi bị bệnh gì?"), kê đơn ("Kê cho tôi thuốc X"), thay đổi liều lượng hoặc dừng thuốc, Chatbot từ chối dứt khoát và hướng dẫn tham khảo ý kiến bác sĩ điều trị.
4. **Dẫn chứng Nguồn y văn chuẩn mực:**
   - Mọi giải thích về tương tác thuốc đều trích dẫn rõ nguồn từ **Dược thư Quốc gia Việt Nam 2022** và **Stockley's Drug Interactions**.
5. **Lưu trữ phiên chat theo tài khoản:**
   - Lịch sử chat được lưu trữ tách biệt theo email người dùng trong `localStorage` (`vitap-chat-sessions-<email>`), đảm bảo chuyển đổi tài khoản không bị lộ nội dung chat của nhau.

### 3.5. Sửa lỗi Database & Backend Seeder

1. **Lỗi `ForeignKeyViolation` trên bảng `drug_ingredients`:** Tách biệt bước flush bảng `Drugs` trước khi chèn vào `DrugIngredients` trong file `seed_test_scenarios.py`.
2. **Lỗi `CheckViolation` trên constraint `chk_prescription_status`:** Thay thế giá trị trạng thái không hợp lệ `"ACTIVE"` bằng giá trị chuẩn `"CONFIRMED"`.

---

## 4. NHỮNG GÌ CHƯA LÀM & KẾ HOẠCH BÀN GIAO TIẾP THEO (WHAT HAS NOT BEEN DONE / NEXT SPRINTS)

Dưới đây là danh mục các hạng mục còn chờ kết nối hoặc cần phát triển tiếp ở các sprint sau để toàn đội ngũ nắm rõ:

### 4.1. Phân hệ Backend M1 — Hồ sơ Sức khỏe Cá nhân (`User Profile API`)

- **Hiện trạng:** Bảng cơ sở dữ liệu `user_profiles` đã tồn tại trong PostgreSQL, nhưng router FastAPI cho `GET /api/v1/health/profile` và `PATCH /api/v1/health/profile` (theo đặc tả `VitaP_API_Docs.md#L203-L224`) **chưa được cài đặt và chưa được mount vào `main.py`**.
- **Kế hoạch tiếp theo:**
  - Backend team cần tạo router `vitap/backend/app/routers/profile.py` và kết nối service cập nhật hồ sơ (họ tên, ngày sinh, giới tính, số điện thoại, danh sách tiền sử bệnh nền, danh sách dị ứng).
  - Frontend: Sau khi API M1 sẵn sàng, bổ sung nút **"Chỉnh sửa thông tin cá nhân"** trên màn hình `Profile.tsx` và màn hình hoàn tất hồ sơ sau khi đăng ký mới.

### 4.2. Phân hệ Backend M2 — Xử lý OCR Đơn thuốc Tự động

- **Hiện trạng:** Luồng Quét đơn thuốc trên Frontend hiện hỗ trợ tải ảnh và đang mô phỏng bước trích xuất OCR để chuyển sang bước kiểm tra thuốc thủ công (Manual Entry / Review Step).
- **Kế hoạch tiếp theo:**
  - Kết nối pipeline OCR thực tế (Queue, Worker, Tesseract/Vision AI model) để tự động nhận dạng tên thuốc, hàm lượng, cách dùng từ hình ảnh đơn thuốc do người dùng chụp.

### 4.3. Phân hệ Backend M3 — Tích hợp Trợ lý RAG AI nâng cao

- **Hiện trạng:** Nhánh `feat/m3-ms1` đang xây dựng hạ tầng RAG (Milvus Vector DB, mô hình embedding tiếng Việt, corpus Dược thư Quốc gia và Stockley). Frontend hiện đang chạy bộ máy suy luận cục bộ kết hợp Rule Engine an toàn để đảm bảo trải nghiệm người dùng không bị gián đoạn.
- **Kế hoạch tiếp theo:**
  - Khi nhánh `feat/m3-ms1` hoàn thành và merge vào `dev`, backend sẽ cung cấp endpoint chính thức `POST /api/v1/ai/chat`.
  - Frontend chỉ cần bật cờ gọi API trực tiếp trong `src/api/client.ts` (`chatApi.sendMessage`) để nhận câu trả lời stream từ RAG pipeline.

### 4.4. Đồng bộ hóa Sổ tay (Journal) & Đơn thuốc (Prescriptions) qua REST API

- **Hiện trạng:** Dữ liệu Sổ tay sức khỏe (nhật ký đo huyết áp, đường huyết) và Đơn thuốc đã lưu hiện đang được tải qua `seed_fixtures.json` kết hợp `localStorage`.
- **Kế hoạch tiếp theo:**
  - Xây dựng các endpoint CRUD đầy đủ trên Backend: `GET/POST /api/v1/prescriptions`, `GET/POST /api/v1/health/metrics`.
  - Thay thế cơ chế lưu cục bộ bằng các lời gọi API bất đồng bộ có phân trang và caching.

### 4.5. Đăng nhập Google OAuth Thật

- **Hiện trạng:** Nút "Tiếp tục với Google" trên form đăng nhập/đăng ký hiện đang chạy mô phỏng có kiểm tra consent.
- **Kế hoạch tiếp theo:**
  - Đăng ký Google Cloud Client ID và cấu hình Google Sign-In SDK hoặc Auth0/Firebase Authentication thật.

---

## 5. BẢNG MA TRẬN QUY TẮC AN TOÀN Y TẾ BẤT DI BẤT DỊCH (SAFETY INVARIANTS)

Để đảm bảo mọi thành viên tham gia phát triển đều không vi phạm quy chuẩn an toàn y tế, xin lưu ý 5 nguyên tắc bắt buộc:

| Quy tắc          | Nội dung quy định                       | Cách triển khai trong mã nguồn                                                                                                                                                  |
| :--------------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Invariant #1** | **Không chẩn đoán, không kê đơn**       | Chatbot từ chối mọi yêu cầu chẩn đoán bệnh, kê đơn thuốc hoặc thay đổi liều dùng; luôn kèm khuyến cáo gặp bác sĩ.                                                               |
| **Invariant #2** | **Rule Engine quyết định tương tác**    | Tương tác thuốc được tra cứu bằng bảng dữ liệu dược lý có cấu trúc, không để mô hình ngôn ngữ tự bịa đặt.                                                                       |
| **Invariant #3** | **Chỉ trả đúng 4 trạng thái tương tác** | Chỉ hiển thị: `CONTRAINDICATED`, `MAJOR`, `MODERATE`, `MINOR`. **Tuyệt đối không dùng nhãn "SAFE" hoặc biểu tượng màu xanh lá cây** (đã được kiểm chứng qua `safety.test.tsx`). |
| **Invariant #6** | **Ngắt luồng cấp cứu 115 lập tức**      | Kích hoạt ngay khi có triệu chứng đau ngực, khó thở, sốc phản vệ; ngắt trước khi chuyển câu hỏi sang xử lý sâu.                                                                 |
| **Invariant #8** | **Zero-Trust Token Principal**          | Toàn bộ quyền truy cập dữ liệu dựa trên JWT token; tuyệt đối không tin cậy `user_id` từ client truyền lên; trả mã 404 thay vì 403 để chống rò rỉ ID.                            |
