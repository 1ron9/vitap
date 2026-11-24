# Phát triển và vận hành local

## Môi trường

Khởi động nhanh: [README.md](../README.md#chạy-dự-án). Docker/CI dùng Python 3.11;
frontend dùng Node >=22.12, .nvmrc và CI chọn Node 22.13.

| File | Mục đích |
|---|---|
| .env từ .env.example | Docker Compose: PostgreSQL, SECRET_KEY, cổng API và cấu hình M3 |
| backend/.env từ backend/.env.example | Backend chạy thủ công |
| frontend/.env từ frontend/.env.example | URL API và mock frontend |

Compose chạy backend trong /app; frontend chạy pnpm trên host. PostgreSQL publish
127.0.0.1:5432. Backend chạy thủ công không dùng hostname
db của Compose. Cấu hình DATABASE_URL tới DB local/thử nghiệm của bạn.

VITE_USE_MOCK=true dùng offline preview; false gọi Auth/M1/OCR API thật. Access token ở
RAM, refresh token theo chính sách hiện tại ở localStorage; startup refresh khôi phục phiên, USER request TOKEN_EXPIRED được retry tối đa một lần. Backend mặc định access
TTL 15 phút, refresh 7 ngày, Guest 24 giờ theo settings.

## Database và migration

Khi chạy Compose, service `backend-init` chờ PostgreSQL healthy, chạy
`alembic upgrade head` rồi nạp fixture M3. Backend và worker chờ `backend-init`
hoàn tất. Xem lỗi khởi tạo bằng `docker compose logs backend-init`.

```bash
docker compose exec backend alembic current
docker compose exec backend alembic upgrade head
docker compose exec backend python -m data_seed.seed_dev
```

Alembic quản lý schema; seed chỉ nạp dữ liệu. seed_dev nạp fixture tổng hợp idempotent,
không tạo evidence hay coverage DDI. Entry point seed cũ bị vô hiệu; dataset thật cần
chuyển sang UUID và review nguồn trước khi nạp.

Fixture M3 gồm một tài liệu tổng hợp và hai chunk có vector 768 chiều cố định.
Seed chạy lại theo cùng khóa nguồn và thứ tự chunk. Retrieval chỉ dùng tài liệu
`ACTIVE`, còn fixture mang trạng thái `DEV_FIXTURE` dành cho smoke test.

Baseline v2 dành cho PostgreSQL mới. Revision 20261111_dev_v3_1 nâng cấp tiếp, giữ các
trường của API. DB demo integer cũ cần backup/chuyển đổi riêng. Migration dừng nếu có
observation không entry hoặc embedding cũ còn dữ liệu; cần backfill hoặc xuất/nạp lại
embedding 768 chiều trước khi chạy tiếp. Không tự xóa dữ liệu để vượt preflight.
Revision v3.1 chặn downgrade; phục hồi bằng backup đã kiểm chứng.

Revision `20261117_m1_phase_a` nối tiếp v3.1, thêm allergy type, glucose input provenance
và user health settings. Backfill settings/profile shell không suy đoán dữ liệu sức khỏe.
Preflight dừng nếu ownership observation/entry không khớp; không tự xóa/sửa owner.
Revision này cũng chặn downgrade để tránh mất declaration và giá trị đã nhập.

Thêm revision mới khi đổi schema; review SQL/autogenerate trước khi áp dụng và kiểm tra
trên PostgreSQL. Không dùng create_all() thay Alembic trong ứng dụng hoặc seed.

## API Chat M3

Swagger liệt kê các route dưới `/api/v1/ai`. Đăng nhập bằng tài khoản đã cấp consent
để tạo phiên, gửi tin nhắn và xem lịch sử. Mặc định Compose chạy offline với
`USE_MOCK_AI=true`. Guardrail cấp cứu chạy tại backend. Khi thiếu bằng chứng, chat trả
`INSUFFICIENT_EVIDENCE` và vẫn lưu lịch sử.

Để kết nối provider thật, đặt `USE_MOCK_AI=false` và cấu hình `GEMINI_API_KEY`,
`OLLAMA_BASE_URL` và corpus đã duyệt. URL provider phải truy cập được từ container.
`RERANKER_URL` và `KAGGLE_MEDGEMMA_NGROK_URL` là cấu hình tùy chọn. Backend dùng
chung cấu hình kết nối PostgreSQL cho Auth, M1/M2 và AsyncSession M3.

## Worker và dữ liệu

Bật worker tùy chọn sau migration:

```bash
docker compose --profile worker up -d worker
docker compose logs -f worker
```

Worker dùng background_jobs, SKIP LOCKED, lease/retry và at-least-once delivery;
handler cần idempotent. Hiện hỗ trợ DELETE_FILE và PROCESS_OCR. Upload lưu ảnh riêng tư,
tạo job PENDING rồi trả về; worker cập nhật PROCESSING/COMPLETED/FAILED để API poll đọc.
Worker enqueues xóa ảnh đơn hết hạn; cần giữ worker hoạt động để xử lý cả OCR lẫn cleanup.

## OCR thật

Ảnh in được xử lý bằng PaddleOCR trên worker CPU. OCR luôn chạy inference thật trên
ảnh người dùng; cờ `USE_MOCK_AI` chỉ ảnh hưởng module khác. Frontend cần
`VITE_USE_MOCK=false` và người dùng phải đồng ý gửi ảnh lên máy chủ:

```env
USE_MOCK_AI=true
OCR_MODE=printed
OCR_PADDLE_DEVICE=cpu
```

Khởi động worker sau khi migration:

```bash
docker compose --profile worker up --build -d
docker compose logs -f worker
```

Worker image cài PaddlePaddle 3.2.0 và PaddleOCR 3.3.0; image API không mang dependency
nặng này. Lần inference đầu tải model Paddle vào cache worker. `OCR_PADDLE_DEVICE=gpu:0`
cần image Paddle GPU khớp driver; Dockerfile.worker mặc định cài CPU. Để chạy Paddle,
sau khi migration bật worker:

```bash
docker compose --profile worker up --build -d worker
```

Lỗi engine sẽ retry rồi đánh job FAILED, không trả mock thành kết quả thật. POST trả job
PENDING; GET `/api/v1/ocr-jobs/{job_id}` dùng để poll trạng thái/kết quả. Chỉ xử lý ảnh
sức khỏe khi có consent và quyền phù hợp.

Volume private_storage giữ file riêng tư, không phục vụ như static public. Raw/cleaned
dataset và dữ liệu sức khỏe thật không commit vào Git. Fixture nhỏ ở data/fixtures,
manifest nguồn/version/checksum/coverage ở data/manifests.

Kiểm tra JSONL từ backend:

```bash
python -m app.modules.ai_assistant.rag.ingestion.cli --input ../data/fixtures/corpus_demo.jsonl --validate-only
```

Lệnh chỉ kiểm tra corpus, không tạo embedding. Dependency AI và data tùy chọn được tách
trong requirements-ai.txt và requirements-data.txt. Dockerfile.worker cài
requirements-ocr.txt. Requirements sandbox cũ chỉ để tham khảo.

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
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
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
