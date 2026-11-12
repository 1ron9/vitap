# Kiến trúc VitaP

## Tổng quan

Modular monolith: React gọi FastAPI qua `/api/v1`; backend và worker dùng PostgreSQL 16
với pgvector. Các module gọi service Python nội bộ.

| Vị trí | Trách nhiệm |
|---|---|
| backend/app/core | Settings, database và model registry |
| backend/app/modules/auth | Tài khoản, JWT/refresh, Guest và consent |
| backend/app/modules/health | M1: hồ sơ, nhật ký, observations, medication courses |
| backend/app/modules/medication | M2: danh mục, prescription, OCR và tương tác thuốc |
| backend/app/modules/ai_assistant | M3: hội thoại, citations, kho tri thức, RAG |
| backend/app/shared | Principal/consent, lỗi, enum và interface service |
| backend/app/integrations | Private storage và provider OCR/embedding/generation |
| backend/app/workers | Durable jobs với lease/retry trên PostgreSQL |
| backend/migrations | Lịch sử Alembic, nguồn tạo/nâng cấp schema |
| frontend/src/app | Entry, routing, cấu hình ứng dụng |
| frontend/src/features | Components/hooks theo chức năng |
| frontend/src/shared | Typed API client và code dùng chung |
| contracts | OpenAPI của endpoint đã triển khai |
| data/fixtures, data/manifests | Fixture nhỏ và metadata nguồn/coverage |

Bổ sung router, schemas, services và repositories trong từng module theo nhu cầu.
Model M1/M2/M3 đã có nhưng API nghiệp vụ vẫn đang phát triển. Prototype trong legacy
và sandbox không được đăng ký làm API thật; compatibility imports ở đường dẫn cũ
phục vụ code chưa chuyển sang module.

## Dữ liệu và ranh giới module

- Auth dùng email/UUID, access JWT và refresh token được hash/rotate. Guest là phiên
  độc lập có TTL và không truy cập M1/M3.
- Principal xác định owner; không nhận owner tùy ý từ client/LLM. Dependency
  `require_ai_consent` kiểm tra consent cho lời gọi AI.
- Hồ sơ giữ height_cm; observations phải thuộc entry. Bệnh nền/dị ứng tự khai mới
  mặc định verified=false. Prescription tách OCR output khỏi dữ liệu review bằng
  provenance; lưu đơn không tự tạo medication course ACTIVE.
- Storage dùng khóa opaque, service kiểm tra owner trước truy cập. Worker hiện hỗ trợ
  DELETE_FILE; các handler OCR/TTL/deletion orchestration đang phát triển.

Các interface ở `backend/app/shared/contracts.py`: HealthContextProvider, DrugResolver,
InteractionChecker. M3 dùng context từ M1 và rule result M2; LLM không quyết định
status/severity tương tác thuốc.

DDI dùng INTERACTION_FOUND, UNRESOLVED_DRUG, INSUFFICIENT_DATA và
NO_KNOWN_INTERACTION_IN_DATABASE. Query không có rule chưa chứng minh đã rà soát;
phải có coverage được review mới kết luận âm tính trong phạm vi dataset.

M3 dùng INFO/WARNING/CRITICAL, vector(768), HNSW cosine và lexical trigram. Schema có
source/external ID, content hash, citations và feedback. CLI JSONL hiện chỉ kiểm tra
định dạng; ingestion/RAG thật chưa triển khai. GENERAL không được dùng context cá nhân,
kể cả history từ PERSONAL trước đó.

## Contract

[OpenAPI](contracts/openapi.json) phản ánh route thực sự đăng ký; xem
[hướng dẫn contract](contracts/README.md) để cập nhật. Lịch sử quyết định schema nằm
trong [CODEBASE_DEV_MIGRATION.md](CODEBASE_DEV_MIGRATION.md).
