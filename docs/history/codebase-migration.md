# Lịch sử tổ chức lại codebase VitaP

Ngày: 12/11/2026. Nhóm đã chốt codebase để đưa từ dev lên main.

Đây là tài liệu lịch sử. Hướng dẫn hiện hành: [README](../../README.md),
[ARCHITECTURE](../architecture.md), [DEVELOPMENT](../development.md), [CONTRIBUTING](../../CONTRIBUTING.md).

## 1. Mục đích và phạm vi

Chuẩn hóa nền phát triển theo Auth + M1 (health) + M2 (medication) + M3 (ai_assistant).
Giữ lịch sử Git, Docker/Compose FD-01 và công việc của các thành viên. Phần Auth/Alembic
đang sửa được lưu thành commit riêng trước khi refactor. Thay đổi được tích hợp qua dev trước khi đưa lên main.

Đây là bản setup nền, không phải bản hoàn thành nghiệp vụ M1/M2/M3. Không coi màn hình
placeholder, provider protocol hoặc dữ liệu mẫu là OCR/RAG/DDI đã hoạt động.

## 2. Nguồn và quyết định contract trên dev

- [Schema v3](https://drive.google.com/file/d/1MJLcimlQMTQlbnddvFt5iHC_X-zDLdGR/view)
- [API contract](https://drive.google.com/file/d/1zoiLz89zWNiQ-CMT4YwD7_KLnY12m8Ds/view)
- [M3 technical design](https://drive.google.com/file/d/1a6ME1J6_NfADYL2PnlN9bkGaP94_q9NH/view)

Các quyết định dưới đây được hiện thực trong lần setup đã được nhóm chốt:

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

## 3. Kết quả chuyển đổi

Auth được đưa vào module, giữ compatibility imports ở đường dẫn cũ. ORM dùng UUID,
metadata prototype cũ được tách riêng. API/UI stub và tests tương ứng nằm trong legacy
và sandbox, không expose trong ứng dụng chính. Seed cũ bị vô hiệu tại entry point;
seed_dev nạp fixture tổng hợp sau Alembic. Baseline v2 được giữ, revision v3.1 nâng cấp
tiếp với preflight và chặn downgrade mất dữ liệu.

React/Vite có entry, routing, login email, API client và mock mode. Private storage,
provider protocols, worker DELETE_FILE và JSONL validator tạo nền cho các task tiếp theo.
M1/M2/M3 business endpoints, OCR/RAG thật và TTL/deletion orchestration chưa hoàn thành
trong lần setup này; việc nhóm chốt codebase không thay đổi trạng thái triển khai đó.

## 4. Xác minh lúc bàn giao

CI đạt backend tests, frontend build/tests, PostgreSQL migration/contract/worker và
Compose smoke. Local đạt 21 backend tests, 3 frontend tests, OpenAPI check, JSONL
validation và npm audit không báo lỗ hổng tại thời điểm kiểm tra. Máy chuẩn bị thay đổi
không có Docker trong PATH; PostgreSQL/Compose được kiểm chứng trên CI Linux/Python 3.11.

Các số liệu này ghi nhận lần bàn giao, không thay thế CI của commit hiện hành.
Hướng dẫn phát triển và quy trình nhánh được duy trì trong [development.md](../development.md) và [CONTRIBUTING.md](../../CONTRIBUTING.md).
