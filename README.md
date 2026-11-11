# VitaP — Development baseline

Nhánh tích hợp: **dev**. Main chỉ nhận phiên bản nhóm đã review/chốt.

Đọc [CODEBASE_DEV_MIGRATION.md](CODEBASE_DEV_MIGRATION.md) để xem kiến trúc,
quyết định contract, hướng dẫn setup/test, và quy trình feature → dev → main.

Backend hiện có Auth + Guest sessions, error envelope, model/migration v3.1 và worker
scaffold. Frontend có React/Vite, đăng nhập email và routing. M1/M2/M3 là phần phát triển
tiếp theo; các prototype cũ được giữ trong legacy/sandbox và không expose trong live API.

## Quick start

```powershell
Copy-Item .env.example .env
# Đặt SECRET_KEY và POSTGRES_PASSWORD
 docker compose up --build --wait
 docker compose exec backend alembic upgrade head
 docker compose exec backend python -m data_seed.seed_dev
 cd frontend
 Copy-Item .env.example .env
 npm ci
 npm run dev
```

Swagger: http://localhost:8000/docs. Frontend: http://localhost:5173.
Frontend mặc định dùng mock; đổi VITE_USE_MOCK=false để đăng nhập backend thật.
Dataset seed_dev là giả lập, không phải bằng chứng y khoa.

## Tài liệu và kiểm thử

- [Hướng dẫn đóng góp](CONTRIBUTING.md)
- [Contract đang triển khai](contracts/README.md)
- [OpenAPI](contracts/openapi.json)
- Backend: cài backend/requirements-dev.txt rồi chạy pytest trong backend.
- Frontend: npm run build và npm test trong frontend.
- Compose smoke: python scripts/smoke_compose.py (cần Docker).
- Private raw datasets và tài liệu nội bộ vẫn không được commit tự động.
