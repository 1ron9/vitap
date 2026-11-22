# Hợp đồng API VitaP

openapi.json mô tả endpoint backend hiện triển khai: Auth, Guest, M1 (gồm API số đo gốc), OCR M2 và hạ tầng.
Phạm vi M1 và delta với API draft: [m1-phase-a.md](../docs/m1-phase-a.md). Xem trạng thái trong
[README](../README.md) và ranh giới module trong [ARCHITECTURE](../docs/architecture.md).

### Số đo gốc cho Dashboard

`GET /api/v1/health/observations` yêu cầu tài khoản User đang hoạt động và ba tham số
`observation_type`, `from`, `to`. Chỉ số hỗ trợ gồm `BLOOD_PRESSURE`, `GLUCOSE`,
`WEIGHT`, `HEART_RATE`. Hai mốc là timestamp có offset hoặc `Z`. API đọc theo
`measured_at` trong khoảng `[from,to)`, tối đa 366 ngày và trả timestamp UTC.

Response dùng `{items,pagination:{page,page_size,total}}`. `page` bắt đầu từ 1,
`page_size` mặc định 20 và tối đa 100. Thứ tự là `measured_at ASC, id ASC`.
Mỗi item giữ `id`, `entry_id`, các giá trị, đơn vị và cặp `entered_value`/`entered_unit`
đã lưu khi có. Hai lần đo trùng thời điểm vẫn là hai item. Client đọc đủ các trang
cần hiển thị. Các request phân trang độc lập có thể thấy dữ liệu thay đổi khi có ghi đồng thời.

### Triệu chứng trong ghi chép

`POST /api/v1/health/entries` nhận mảng `symptoms` tùy chọn. Mỗi triệu chứng cần tên,
có thể kèm mức độ tự khai (số nguyên 1–10), thời lượng theo số phút nguyên không âm
và ghi chú. Tối đa 100 triệu chứng mỗi ghi chép. Một ghi chép có thể chỉ có triệu chứng.

`PATCH /api/v1/health/entries/{id}/aggregate` nhận nhóm `symptoms` cùng kiểu thao tác
`create/update/delete` như số đo. Sửa tiêu đề, số đo và triệu chứng cùng một transaction.
Các route con `/entries/{entry_id}/symptoms` hỗ trợ POST, và `/{symptom_id}` hỗ trợ PATCH/DELETE.
Danh sách và chi tiết ghi chép trả mảng triệu chứng. Thao tác làm ghi chép rỗng trả 409.

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
