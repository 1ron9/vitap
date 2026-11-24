# VitaP — Sổ tay sức khỏe cá nhân

VitaP là đồ án Nhập môn Công nghệ Phần mềm tại Trường Đại học Khoa học Tự nhiên,
ĐHQG-HCM. Dự án hướng tới quản lý hồ sơ sức khỏe, số hóa đơn thuốc, tra cứu tương tác
thuốc và trợ lý thông tin y tế có dẫn nguồn.

## Chức năng và trạng thái

| Phân hệ | Hiện có | Đang phát triển |
|---|---|---|
| Tài khoản | Đăng ký/đăng nhập UI, JWT, refresh rotation, logout, Guest và khôi phục phiên | Bảo mật nâng cao ngoài MVP |
| M1 — Sức khỏe | Hồ sơ, Journal 4 chỉ số và triệu chứng có cấu trúc, preferences, medication courses, Dashboard số đo gốc và thống kê ngày/tuần/tháng | Dải tham chiếu theo ngữ cảnh thuộc task riêng |
| M2 — Thuốc | Prescription OCR queue, PaddleOCR/VLM providers, private storage | UI review/save, tra cứu và rule engine DDI; chất lượng OCR cần benchmark |
| M3 — Trợ lý | API phiên/tin nhắn, guardrails, lưu lịch sử/citations, vector 768 chiều và fixture Compose offline | Nối Chatbot UI, nạp corpus thật và tích hợp Rule Engine M2 |

Frontend dùng React/TypeScript/Vite. M1 chạy API thật hoặc mock adapter tách riêng;
đọc [hướng dẫn Đợt A](docs/m1-phase-a.md), [bàn giao Đợt B/C](docs/m1-phase-b-c.md) và [hướng dẫn Dashboard](docs/m1-dashboard.md). Fixture và prototype sandbox chỉ phục vụ thử nghiệm,
không phải bằng chứng y khoa.

## Chạy dự án

Yêu cầu Git, Docker Engine/Desktop với Linux containers và Compose v2 hỗ trợ `up --wait`.
Frontend dùng Node >=22.12 và pnpm theo package.json; CI dùng Python 3.11 và Node 22.13.

Tại gốc repo, tạo cấu hình local:

```powershell
Copy-Item .env.example .env
```

Linux/macOS dùng `cp .env.example .env`. Đặt `POSTGRES_PASSWORD` và `SECRET_KEY`
trong `.env`, rồi chạy:

```bash
docker compose up --build --wait
```

Compose chạy Alembic và tự nạp fixture pgvector M3 trước khi backend lên. Lệnh
`docker compose exec backend python -m data_seed.seed_dev` nạp thêm fixture demo tùy chọn.
Với DB có sẵn, đọc [hướng dẫn migration](docs/development.md#database-và-migration)
trước khi nâng cấp.

OCR mặc định dùng PaddleOCR cho ảnh đơn in. OCR luôn chạy trên ảnh tải lên thật,
không lấy output mẫu; xem [hướng dẫn OCR](docs/development.md#ocr-thật-local).

Mở terminal thứ hai để chạy frontend:

```powershell
cd frontend
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

Linux/macOS dùng `cp .env.example .env`. Frontend mẫu đặt `VITE_USE_MOCK=false`;
đổi true và khởi động lại Vite để dùng offline preview. Tạo tài khoản trên UI
hoặc `POST /api/v1/auth/register` trong Swagger; mẫu request có trong OpenAPI.

| Địa chỉ | Mục đích |
|---|---|
| http://localhost:5173 | Giao diện web |
| http://localhost:8000/docs | Swagger |
| http://localhost:8000/health | Kiểm tra process backend |
| http://localhost:8000/ready | Kiểm tra PostgreSQL/pgvector |

`/ready` không xác nhận schema nghiệp vụ đã migrate. PostgreSQL trong Compose publish
`127.0.0.1:5432`; backend kết nối bằng hostname `db`.

## Tài liệu

Bắt đầu từ [mục lục docs/](docs/README.md). Tài liệu cấp dự án được quản lý trong Git;
Drive lưu nguồn làm việc và dataset lớn.

- [Drive chung của nhóm](https://drive.google.com/drive/folders/1_ik5G4XIdZu2JeFgXxFPTC7FoMAGTaZg) và [hướng dẫn tìm/đọc nguồn tài liệu](docs/DRIVE_GUIDE.md).
- [Kiến trúc và ranh giới module](docs/architecture.md)
- [Phát triển, migration và kiểm thử](docs/development.md)
- [Đóng góp và quy trình nhánh](CONTRIBUTING.md)
- [Hợp đồng API](contracts/README.md), [OpenAPI hiện hành](contracts/openapi.json)
- [Lịch sử tổ chức lại codebase](docs/history/codebase-migration.md)

`main` lưu phiên bản nhóm đã chốt; `dev` là nhánh tích hợp và thử nghiệm lâu dài.
Tính năng mới đi qua PR vào dev trước khi phát hành sang main qua PR đã duyệt.
