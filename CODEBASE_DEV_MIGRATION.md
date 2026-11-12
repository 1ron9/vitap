# VitaP — Tổ chức lại codebase và quy trình nhánh dev

Ngày: 12/11/2026. Trạng thái: tích hợp trên **dev để nhóm review**, chưa duyệt phát hành lên main.

## 1. Mục đích và phạm vi

Chuẩn hóa nền phát triển theo Auth + M1 (health) + M2 (medication) + M3 (ai_assistant).
Giữ lịch sử Git, Docker/Compose FD-01 và công việc của các thành viên. Phần Auth/Alembic
đang sửa được lưu thành commit riêng trước khi refactor. Main không nhận các thay đổi này.

Đây là bản setup nền, không phải bản hoàn thành nghiệp vụ M1/M2/M3. Không coi màn hình
placeholder, provider protocol hoặc dữ liệu mẫu là OCR/RAG/DDI đã hoạt động.

## 2. Nguồn và quyết định contract trên dev

- [Schema v3](https://drive.google.com/file/d/1MJLcimlQMTQlbnddvFt5iHC_X-zDLdGR/view)
- [API contract](https://drive.google.com/file/d/1zoiLz89zWNiQ-CMT4YwD7_KLnY12m8Ds/view)
- [M3 technical design](https://drive.google.com/file/d/1a6ME1J6_NfADYL2PnlN9bkGaP94_q9NH/view)

Các quyết định dưới đây được hiện thực trên dev và cần nhóm review trước main:

| Chủ đề | Quyết định |
|---|---|
| Auth | Giữ email, UUID, status ACTIVE/SUSPENDED/DELETED, refresh hash/rotation và consent version. |
| Hồ sơ | Giữ id, height_cm và các trường nhật ký trong API; không loại bỏ chỉ vì DBML v3 rút gọn. |
| Consent | Giữ scope/is_accepted/consented_at/version; cung cấp dependency require_ai_consent. |
| Dữ liệu tự khai | Default verified=false cho bản ghi mới; không tự đổi verification của dữ liệu cũ. |
| Nhật ký | observation phải gắn entry; xóa entry cascade observations/symptoms. |
| Prescription | UPLOADED/PENDING_REVIEW/CONFIRMED/FAILED; DELETED dành cho tombstone tương lai. Review và save là hai thao tác. |
| Nguồn item | OCR/MANUAL_EDIT/MANUAL_ENTRY; lưu source_ocr_item_id, confidence theo trường và candidates. |
| DDI | INTERACTION_FOUND/UNRESOLVED_DRUG/INSUFFICIENT_DATA/NO_KNOWN_INTERACTION_IN_DATABASE. Không có coverage thì không suy ra an toàn. |
| M3 warning | INFO/WARNING/CRITICAL theo API và thiết kế M3. |
| Embedding | vector(768), HNSW cosine và lexical trigram; model mặc định nomic-embed-text-v2-moe. |
| Corpus | source_name + external_id duy nhất; có content_hash/language để hỗ trợ ingestion sau này. |
| Citation | Bổ sung interaction_id và source_url; không dùng nguồn bịa trong stub. |
| Worker | PostgreSQL durable jobs, SKIP LOCKED, lease/retry; hiện bật DELETE_FILE, handler phải idempotent. |

## 3. Cấu trúc và tình trạng triển khai

| Thư mục | Nội dung |
|---|---|
| backend/app/modules/auth | Auth đang dùng; các import cũ được giữ bằng compatibility shim. |
| backend/app/modules/health | ORM M1 và medication courses; API nghiệp vụ chưa triển khai. |
| backend/app/modules/medication | ORM danh mục/đơn/OCR; rule engine và upload API chưa triển khai. |
| backend/app/modules/ai_assistant | ORM M3; CLI kiểm tra corpus JSONL; chưa thực hiện embedding/generation. |
| backend/app/shared | Principal/consent, error envelope, enum và giao diện service nội bộ. |
| backend/app/integrations | Private local storage, protocol OCR/embedding/generation. |
| backend/app/workers | Worker bền vững; handler DELETE_FILE. |
| backend/app/legacy | Prototype cũ, không được đăng ký trong API thật. |
| backend/migrations | Baseline v2 được bảo toàn, migration tiến lên dev v3.1. |
| frontend/src/app | React entry, routing, đăng nhập email, shell chức năng. |
| frontend/src/shared | Typed API client, token trong RAM, xử lý error envelope và tests. |
| contracts/openapi.json | Chỉ mô tả endpoint thực sự triển khai. |
| data/manifests, data/fixtures | Manifest coverage và fixture tổng hợp phục vụ dev/test. |

Frontend mock mode hiển thị rõ dữ liệu thử. Reload sẽ mất phiên frontend vì token chỉ lưu
trong RAM; automatic refresh và giao diện đăng ký là phần Auth UI tiếp theo. Backend có
register/login/refresh/logout/me/guest-sessions. Các trang M1/M2/M3 hiện là placeholder.

Các test stub M3/DDI cũ được giữ trong sandbox để tham khảo, không tính vào CI nghiệp vụ.
Tests fuzzy cũ dùng metadata riêng, không tạo schema integer lẫn với schema UUID runtime.
Seed cũ bị vô hiệu ở entry point; dùng seed_dev để nạp fixture sau migration.

## 4. Quy trình nhánh bắt buộc

```text
feature/fix branch → PR vào dev → CI + review + kiểm thử tích hợp
                              → PR dev vào main → nhóm chốt → merge main
```

- **dev** là nhánh tích hợp và thử nghiệm lâu dài; không xóa sau release.
- **main** là bản nhóm đã chốt. Không push trực tiếp, không tự merge dev vào main.
- Bắt đầu công việc từ dev mới nhất, tạo nhánh ngắn theo task.
- PR thông thường phải chọn **base: dev**. Ghi phạm vi, contract/migration bị ảnh hưởng,
  cách test, phần chưa hoàn thành. Reviewer theo chuyên môn và CODEOWNERS.
- Feature PR có thể squash vào dev. PR **dev → main dùng merge commit** để giữ quan hệ
  lịch sử giữa hai nhánh lâu dài. Sau release đồng bộ main ngược về dev qua PR nếu cần.
- Không force push dev/main. Giải quyết conflict trên nhánh task và chạy lại kiểm thử.
- Hotfix khẩn: branch từ main, PR/review vào main; sau đó back-merge vào dev qua PR.
- Nếu dev lỗi: sửa hoặc revert commit lỗi qua PR, không reset lịch sử dùng chung.

```bash
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c feat/<task>-<description>
# sửa, kiểm thử, stage đúng file
git push -u origin feat/<task>-<description>
# GitHub: mở PR base=dev
```

Commit setup đầu tiên được tích hợp vào dev theo yêu cầu của chủ repo. Thành viên review
toàn bộ diff dev/main; chỉ khi nhóm chốt mới tạo/duyệt promotion vào main.

## 5. Chạy local

Yêu cầu Python 3.11 (CI/Docker), Node >=22.12, Docker Desktop Linux containers.

```powershell
Copy-Item .env.example .env
# Thay SECRET_KEY và POSTGRES_PASSWORD phù hợp local
docker compose up --build --wait
docker compose exec backend alembic upgrade head
docker compose exec backend python -m data_seed.seed_dev
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Frontend mặc định mock; đặt VITE_USE_MOCK=false để gọi backend thật. Người dùng thật
có thể tạo bằng POST /api/v1/auth/register trong Swagger, consent health-ai-v1.

`/health` kiểm tra process; `/ready` kiểm tra PostgreSQL/pgvector. Hai endpoint này không
chứng minh schema đã migrate; phải chạy Alembic trước API nghiệp vụ.

Không chạy `docker compose down --volumes` với DB cần giữ. Baseline v2 dành cho DB mới.
Nếu DB đã có schema demo integer, xuất dữ liệu/backup và lập chuyển đổi riêng. Migration
v3.1 chủ động dừng nếu có observation không entry hoặc embedding cũ còn dữ liệu; cần
backfill hoặc xuất/nạp lại trước. Không tự xóa dữ liệu để vượt preflight. Downgrade v3.1
bị chặn để tránh mất dữ liệu; rollback bằng backup đã kiểm chứng.

Worker chạy sau migration:

```bash
docker compose --profile worker up -d worker
```

Storage private không được mount thành thư mục public. API upload phải kiểm tra owner,
MIME/magic bytes/decode/giới hạn và đăng ký handler OCR trước khi nhận job. Durable queue
không đồng nghĩa toàn bộ lifecycle OCR/deletion/TTL đã triển khai.

## 6. Kiểm thử và tiêu chí review

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements-dev.txt
cd backend
..\.venv\Scripts\python -m pytest tests -q
cd ..
.\.venv\Scripts\python scripts/export_openapi.py --check
cd frontend
npm run build
npm test
```

CI chạy push/PR tới dev và main: backend tests, Compose smoke, frontend build/tests,
PostgreSQL migration và contract. PostgreSQL job migrate hai lần (idempotent), đối chiếu
column ORM/DB, kiểm tra constraints, seed lặp và đăng nhập trên schema migrate thật.
Unit tests SQLite không thay cho integration PostgreSQL; TEST_POSTGRES_URL chỉ trỏ vào DB
thử có thể bỏ, vì integration tests tạo dữ liệu.

Điều kiện đưa dev lên main: CI xanh trên commit mới nhất, review của thành viên khác,
thống nhất các quyết định mục 2, kiểm thử luồng UI/API liên quan, và ghi rõ phần chưa xong.
File CODEOWNERS chỉ chỉ định reviewer; enforcement phụ thuộc branch protection trên GitHub.

## 7. Phần bàn giao tiếp theo

- Trọng: hoàn thiện API M1, ownership xuyên FK, chuẩn hóa DTO/OpenAPI mới theo từng PR.
- THT: dataset thật có nguồn/version/license và coverage được review; không nâng fixture thành evidence.
- Minh Trí: frontend feature, RAG ingestion/retrieval/orchestration, citation validation.
- Phong: OCR provider, input guards, reranker/MedGemma runtime và benchmark.
- M3 GENERAL phải không đọc/sử dụng hồ sơ cá nhân, kể cả history từ PERSONAL trước đó.
- Thuốc đang dùng phải từ course ACTIVE; khi chưa có thì ghi thiếu context.
- TTL cleanup, deletion orchestration và real OCR handlers cần task riêng. Không enqueue
  các kind chưa có handler. Pipeline AI thật cần pin dependency và test riêng trước bật.

## 8. Giới hạn xác minh

Xem kết quả CI trên GitHub tại commit dev hiện hành. Máy chuẩn bị thay đổi có Python 3.12
và Node 22.13; không có Docker trong PATH. PostgreSQL và Compose được xác minh bằng CI
Linux/Python 3.11 thay vì tự nhận đã chạy Docker trên máy local.
