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

### Thống kê số đo theo lịch địa phương

`GET /api/v1/health/analytics` yêu cầu User đang hoạt động, `observation_type` thuộc
bốn chỉ số trên và hai **ngày địa phương** `from`, `to` (`YYYY-MM-DD`). Khoảng ngày là
`[from,to)`, dài tối đa 366 ngày. `granularity` nhận `day` (mặc định), `week` (thứ Hai)
hoặc `month` (ngày 1). `timezone` nhận tên IANA, mặc định `Asia/Ho_Chi_Minh`.
Hai mốc ngày được chuyển riêng sang UTC để ngày đổi giờ vẫn đủ số giờ thực tế.

Response lặp lại bộ lọc và `unit`, trả `buckets` liên tục với `period_start`,
`period_end` là biên lịch tự nhiên. Bucket đầu/cuối chỉ chứa lần đo nằm trong khoảng
lọc. Bucket rỗng có `count:0`; các trường `average/minimum/maximum` và
`secondary_average/secondary_minimum/secondary_maximum` đều `null`. Trung bình
làm tròn 4 chữ số thập phân bằng `ROUND_HALF_UP`; min/max giữ độ chính xác lưu trữ.
Mỗi số đo được tính một lần. Huyết áp tính hai bộ số trên cùng các lần đo đủ hai vế.
Đường huyết dùng `mmol/L` chuẩn; row legacy `mg/dL` được chia 18 trước tổng hợp.
Row có đơn vị không nhận diện, giá trị không hợp lệ hoặc huyết áp thiếu vế bị loại
và cộng vào `excluded_count`. `excluded_reasons` trả số lượng theo mã
`UNKNOWN_UNIT`, `INVALID_VALUE`, `INCOMPLETE_BLOOD_PRESSURE` hoặc
`UNEXPECTED_SECONDARY_VALUE`; tổng các mã bằng `excluded_count`. API không sửa dữ liệu cũ.

Ví dụ nhịp tim ngày 02/01/2020 giờ Việt Nam với 205 giá trị nguyên 60–264 có
`count:205`, `average:162`, `minimum:60`, `maximum:264`. Một reading tại đúng
`2020-01-02T17:00:00Z` nằm ngoài bucket của ngày 02/01/2020.

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
