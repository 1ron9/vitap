# Phát triển và vận hành local

## Môi trường

Khởi động nhanh: [README.md](../README.md#chạy-dự-án). Docker/CI dùng Python 3.11;
frontend dùng Node >=22.12, .nvmrc và CI chọn Node 22.13.

| File | Mục đích |
|---|---|
| .env từ .env.example | Docker Compose: PostgreSQL, SECRET_KEY, cổng API, mock AI |
| backend/.env từ backend/.env.example | Backend chạy thủ công |
| frontend/.env từ frontend/.env.example | URL API và mock frontend |

Compose chạy backend trong /app; frontend chạy npm trên host. PostgreSQL không publish
cổng host. Backend chạy thủ công cần PostgreSQL truy cập được từ host, không dùng hostname
db của Compose. Cấu hình DATABASE_URL tới DB local/thử nghiệm của bạn.

VITE_USE_MOCK=true giả lập login UI; false gọi Auth API thật. Token frontend nằm trong
RAM nên reload cần đăng nhập lại; automatic refresh UI chưa có. Backend mặc định access
TTL 15 phút, refresh 7 ngày, Guest 24 giờ theo settings.

## Database và migration

```bash
docker compose exec backend alembic current
docker compose exec backend alembic upgrade head
docker compose exec backend python -m data_seed.seed_dev
```

Alembic quản lý schema; seed chỉ nạp dữ liệu. seed_dev nạp fixture tổng hợp idempotent,
không tạo evidence hay coverage DDI. Entry point seed cũ bị vô hiệu; dataset thật cần
chuyển sang UUID và review nguồn trước khi nạp.

Baseline v2 dành cho PostgreSQL mới. Revision 20261111_dev_v3_1 nâng cấp tiếp, giữ các
trường của API. DB demo integer cũ cần backup/chuyển đổi riêng. Migration dừng nếu có
observation không entry hoặc embedding cũ còn dữ liệu; cần backfill hoặc xuất/nạp lại
embedding 768 chiều trước khi chạy tiếp. Không tự xóa dữ liệu để vượt preflight.
Revision v3.1 chặn downgrade; phục hồi bằng backup đã kiểm chứng.

Thêm revision mới khi đổi schema; review SQL/autogenerate trước khi áp dụng và kiểm tra
trên PostgreSQL. Không dùng create_all() thay Alembic trong ứng dụng hoặc seed.

## Worker và dữ liệu

Bật worker tùy chọn sau migration:

```bash
docker compose --profile worker up -d worker
docker compose logs -f worker
```

Worker dùng background_jobs, SKIP LOCKED, lease/retry và at-least-once delivery;
handler cần idempotent. Hiện hỗ trợ DELETE_FILE; không enqueue kind chưa có handler.
OCR/TTL/deletion orchestration vẫn thuộc task phát triển tiếp theo.

Volume private_storage giữ file riêng tư, không phục vụ như static public. Raw/cleaned
dataset và dữ liệu sức khỏe thật không commit vào Git. Fixture nhỏ ở data/fixtures,
manifest nguồn/version/checksum/coverage ở data/manifests.

Kiểm tra JSONL từ backend:

```bash
python -m app.modules.ai_assistant.rag.ingestion.cli --input ../data/fixtures/corpus_demo.jsonl --validate-only
```

Lệnh chỉ kiểm tra corpus, không tạo embedding. Dependency tùy chọn tách trong
requirements-ai.txt, requirements-ocr.txt, requirements-data.txt; chỉ cài khi module cần
và chốt phiên bản sau kiểm thử provider. Requirements sandbox cũ chỉ để tham khảo.

## Kiểm thử

Tại gốc repo trên PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements-dev.txt
cd backend
..\.venv\Scripts\python -m pytest tests -q
cd ..
.\.venv\Scripts\python scripts/export_openapi.py --check
cd frontend
npm ci
npm run build
npm test
```

Linux/macOS dùng .venv/bin/python thay .venv/Scripts/python. Chạy backend bằng Compose
không cần Python host; kiểm thử thủ công cần Python trên host.

Integration tests chỉ chạy khi TEST_POSTGRES_URL trỏ tới PostgreSQL thử nghiệm đã migrate.
Bộ test ghi dữ liệu nên không dùng DB cần giữ. CI tự tạo DB này. SQLite không kiểm chứng
đầy đủ JSONB/vector, indexes và constraints PostgreSQL.

Compose smoke tại gốc repo với Docker đang chạy:

```bash
python scripts/smoke_compose.py
```

Script dùng project thử riêng, kiểm tra vector, persistence và phục hồi DB, rồi dọn
resource thử. CI chạy backend, frontend, PostgreSQL migration/contract/worker và Compose
smoke trên mọi push/PR tới main/dev.

## Lệnh thường dùng

```bash
docker compose ps
docker compose logs -f backend db
docker compose down
docker compose up --wait
```

down giữ volume; down --volumes xóa dữ liệu, chỉ dùng với DB thử có thể bỏ. Đổi mật khẩu
.env không tự đổi tài khoản trong volume đã khởi tạo. Nếu cổng 8000 bận, đổi BACKEND_PORT
và cập nhật VITE_API_URL tương ứng.

/health độc lập DB; /ready kiểm tra PostgreSQL/vector, trả 503 khi dependency lỗi.
Nếu readiness lỗi, xem logs/extension; Auth báo thiếu bảng thì kiểm tra alembic current
và chạy migration. Không chia sẻ logs chứa token/mật khẩu.
