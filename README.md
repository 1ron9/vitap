# VitaP — Sổ tay sức khỏe cá nhân

VitaP là đồ án Nhập môn Công nghệ Phần mềm tại Trường Đại học Khoa học Tự nhiên,
ĐHQG-HCM. Dự án hướng tới quản lý hồ sơ sức khỏe, số hóa đơn thuốc, tra cứu tương tác
thuốc và trợ lý thông tin y tế có dẫn nguồn.

## Chức năng và trạng thái

| Phân hệ | Hiện có | Đang phát triển |
|---|---|---|
| Tài khoản | Đăng ký email, JWT, refresh rotation, logout, danh tính và Guest session | Giao diện đăng ký và tự refresh phiên frontend |
| M1 — Sức khỏe | Model/migration hồ sơ, bệnh nền, dị ứng, nhật ký, chỉ số, đợt dùng thuốc | API và giao diện nghiệp vụ |
| M2 — Thuốc | Model/migration danh mục, prescription/OCR, private storage và worker xóa file | Upload/review/save, OCR thật, tra cứu và rule engine DDI |
| M3 — Trợ lý | Model/migration hội thoại, vector 768 chiều, CLI kiểm tra JSONL | Ingestion, retrieval, guardrails và generation thật |

Frontend dùng React/TypeScript/Vite, có đăng nhập email và routing. Các trang M1/M2/M3
hiện thông báo đang phát triển. Fixture và prototype sandbox chỉ phục vụ thử nghiệm,
không phải bằng chứng y khoa.

## Chạy dự án

Yêu cầu Git, Docker Engine/Desktop với Linux containers và Compose v2 hỗ trợ `up --wait`.
Frontend dùng Node >=22.12 và npm; CI dùng Python 3.11 và Node 22.13.

Tại gốc repo, tạo cấu hình local:

```powershell
Copy-Item .env.example .env
```

Linux/macOS dùng `cp .env.example .env`. Đặt `POSTGRES_PASSWORD` và `SECRET_KEY`
trong `.env`, rồi chạy:

```bash
docker compose up --build --wait
docker compose exec backend alembic upgrade head
docker compose exec backend python -m data_seed.seed_dev
```

Seed là bước tùy chọn, nạp fixture tổng hợp và có thể chạy lặp. Với DB có sẵn,
đọc [hướng dẫn migration](DEVELOPMENT.md#database-và-migration) trước khi nâng cấp.

Mở terminal thứ hai để chạy frontend:

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Linux/macOS dùng `cp .env.example .env`. Frontend mặc định dùng mock; đặt
`VITE_USE_MOCK=false` rồi khởi động lại Vite để đăng nhập backend thật. Tạo tài khoản
qua `POST /api/v1/auth/register` trong Swagger; mẫu request có trong OpenAPI.

| Địa chỉ | Mục đích |
|---|---|
| http://localhost:5173 | Giao diện web |
| http://localhost:8000/docs | Swagger |
| http://localhost:8000/health | Kiểm tra process backend |
| http://localhost:8000/ready | Kiểm tra PostgreSQL/pgvector |

`/ready` không xác nhận schema nghiệp vụ đã migrate. PostgreSQL trong Compose không
publish cổng host; backend kết nối bằng hostname `db`.

## Tài liệu

- [Kiến trúc và ranh giới module](ARCHITECTURE.md)
- [Phát triển, migration và kiểm thử](DEVELOPMENT.md)
- [Đóng góp và quy trình nhánh](CONTRIBUTING.md)
- [Hợp đồng API](contracts/README.md), [OpenAPI hiện hành](contracts/openapi.json)
- [Lịch sử tổ chức lại codebase](CODEBASE_DEV_MIGRATION.md)

`main` lưu phiên bản nhóm đã chốt; `dev` là nhánh tích hợp và thử nghiệm lâu dài.
Tính năng mới đi qua PR vào dev trước khi phát hành sang main qua PR đã duyệt.
