# VitaP — Đọc trước khi bắt đầu làm việc

Tài liệu này tóm tắt phần nền đã setup và thứ tự đọc để thành viên nắm ngữ cảnh.
Trạng thái bên dưới mô tả đợt tổ chức lại codebase tháng 11/2026; khi nhận task,
đối chiếu README, code và CI tại commit đang làm.

## 1. Repo đã được setup những gì?

| Hạng mục | Nội dung |
|---|---|
| Cấu trúc backend | FastAPI theo module **Auth, M1/health, M2/medication, M3/ai_assistant**; có core, shared, integrations và workers. |
| Tài khoản | Đăng ký email, đăng nhập JWT, refresh rotation, logout, Guest session; có Principal, kiểm tra consent và lỗi API thống nhất. |
| Database | PostgreSQL 16 + pgvector, ORM dùng UUID, Alembic và migration v3.1; hỗ trợ schema M1/M2/M3, vector 768 chiều và các ràng buộc dữ liệu. |
| Frontend | React/TypeScript/Vite có entry, routing, đăng nhập email, API client và mock mode. |
| Hạ tầng | Docker Compose cho backend/database, health/readiness, private storage và worker nền với handler DELETE_FILE. |
| Kiểm thử | CI backend, frontend build/tests, PostgreSQL migration/contract/worker và Compose smoke. |
| Tài liệu | Tập trung hướng dẫn cấp dự án vào docs/; có chỉ mục Drive, hướng dẫn agent và chỗ ghi quyết định kỹ thuật. |

**Phần nền đã có không đồng nghĩa mọi tính năng đã hoàn thành.** API/UI nghiệp vụ
M1/M2/M3, OCR/RAG thật và TTL/deletion orchestration vẫn là phần phát triển tiếp theo.
Model, protocol, placeholder và fixture không phải chức năng hoàn chỉnh hay dữ liệu y tế
đã được kiểm chứng. Prototype cũ nằm trong legacy/sandbox để tham khảo.

## 2. Cả nhóm nên đọc theo thứ tự này

| Thứ tự | File | Cần nắm được |
|---|---|---|
| 1 | [README dự án](../README.md) | Sản phẩm, chức năng hiện có và cách chạy nhanh. |
| 2 | [CONTRIBUTING](../CONTRIBUTING.md) | Tạo nhánh, mở PR, review/CI và trách nhiệm cập nhật tài liệu. |
| 3 | [architecture.md](architecture.md) | Module nào phụ trách gì, ranh giới service, dữ liệu và phân quyền. |
| 4 | [development.md](development.md) | Cấu hình môi trường, migration, seed, worker và lệnh kiểm thử. |
| 5 | [DRIVE_GUIDE.md](DRIVE_GUIDE.md) | Cây Drive, link tài liệu, thứ tự đọc theo task và các điểm đang lệch giữa nguồn. |
| 6 | [contracts/README.md](../contracts/README.md) | Cách đọc/cập nhật [OpenAPI](../contracts/openapi.json); phân biệt API đã triển khai với thiết kế dự kiến. |

Tra cứu thêm khi cần: [mục lục docs](README.md), [lịch sử chuyển đổi](history/codebase-migration.md)
và [quy ước ghi quyết định](decisions/README.md). Khi dùng AI hỗ trợ, cho agent đọc
[AGENTS.md](../AGENTS.md) và chỉ mục Drive trước các task liên quan nghiệp vụ/dữ liệu.

## 3. Sau đó đọc code theo phần mình làm

| Công việc | Vị trí cần xem |
|---|---|
| Auth/backend nền | [auth/](../backend/app/modules/auth/), [core/](../backend/app/core/), [shared/](../backend/app/shared/) |
| M1 — Sức khỏe | [health/](../backend/app/modules/health/), API/Schema trên Drive qua DRIVE_GUIDE |
| M2 — Thuốc/OCR/DDI | [medication/](../backend/app/modules/medication/), [integrations/](../backend/app/integrations/), [workers/](../backend/app/workers/), tài liệu data/OCR trên Drive |
| M3 — RAG/AI | [ai_assistant/](../backend/app/modules/ai_assistant/), interface/enum trong shared, thiết kế M3 và corpus trên Drive |
| Frontend | [app/](../frontend/src/app/), [features/](../frontend/src/features/), [shared/](../frontend/src/shared/) |
| Database/data | [migrations/](../backend/migrations/), [data_seed/](../backend/data_seed/), [manifests/](../data/manifests/) |

## 4. Quy tắc cần nhớ khi nhận task

1. Cập nhật dev, tạo nhánh task → PR vào dev → CI/review → nhóm chốt PR dev lên main.
   Giữ dev làm nhánh test lâu dài; không push trực tiếp hoặc bỏ branch protection.
2. Database đi qua Alembic trước khi seed; không sửa migration đã dùng. seed_dev là
   fixture tổng hợp. Đọc lưu ý dữ liệu cũ trong development.md trước khi migrate.
3. Kiểm tra ownership/consent tại service; M3 diễn giải kết quả rule M2, không tự kết luận
   tương tác thuốc. Thiếu dữ liệu không đồng nghĩa an toàn.
4. Tài liệu upload mới hơn chưa chắc đã được duyệt. Đối soát version/contract/code;
   ghi rõ phần chỉ đọc metadata hoặc chưa truy cập được.
5. Upload hoặc sửa tài liệu Drive phải cập nhật DRIVE_GUIDE: link/ID, mô tả phần mới,
   owner/version/trạng thái, ảnh hưởng liên quan và changelog trong cùng đợt bàn giao.
6. Không commit .env, token, ảnh đơn thuốc thật hoặc dataset chưa được phép chia sẻ.

**Bắt đầu một task:** đọc nguồn liên quan → xác định đầu ra/contract → thống nhất điểm
còn mâu thuẫn → triển khai và kiểm thử → mở PR có mô tả kết quả và phần chưa hoàn thành.
