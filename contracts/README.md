# Hợp đồng API VitaP

openapi.json mô tả endpoint backend hiện triển khai: Auth, Guest và kiểm tra hạ tầng.
Model M1/M2/M3 không đồng nghĩa API nghiệp vụ đã có; xem trạng thái trong
[README](../README.md) và ranh giới module trong [ARCHITECTURE](../docs/architecture.md).

## Cập nhật

Tại gốc repo trong môi trường đã cài dependency backend:

```bash
python scripts/export_openapi.py
python scripts/export_openapi.py --check
```

Review OpenAPI diff cùng DTO/router, cập nhật frontend/mock và tests liên quan.
CI dùng --check để phát hiện snapshot lệch với route thực thi. Endpoint dự kiến chỉ
đưa vào snapshot khi có implementation; không expose stub thành công giả.

Enum chung: backend/app/shared/enums.py. Interface: backend/app/shared/contracts.py.
Schema: lịch sử Alembic trong backend/migrations.

## Tài liệu thiết kế

- [Schema v3](https://drive.google.com/file/d/1MJLcimlQMTQlbnddvFt5iHC_X-zDLdGR/view)
- [API specification](https://drive.google.com/file/d/1zoiLz89zWNiQ-CMT4YwD7_KLnY12m8Ds/view)
- [M3 technical design](https://drive.google.com/file/d/1a6ME1J6_NfADYL2PnlN9bkGaP94_q9NH/view)

Các quyết định đối soát nằm trong [lịch sử chuyển đổi](../docs/history/codebase-migration.md).
Khi thiết kế khác implementation, ghi rõ quyết định trong PR và cập nhật nguồn liên quan;
không coi thiết kế là bằng chứng API đã hoạt động. Chốt codebase không tự sửa các file Drive.
