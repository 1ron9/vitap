# 0002 — M1 Đợt B/C: số đo gốc, triệu chứng và thống kê

- Trạng thái: Proposed cho review repo; BC01–BC04 đã được người dùng xác nhận trong chat.
- Ngày: 23/11/2026 (Asia/Saigon).
- Module: M1 Dashboard, Journal, analytics.
- Nguồn: [bàn giao B/C và các PR](../m1-phase-b-c.md), API-01 v1.0 và DB-01 v3.0 theo [DRIVE_GUIDE](../DRIVE_GUIDE.md).

## Bối cảnh

Đợt A đã chốt bốn chỉ số và lưu Journal qua backend. Timeline mới vẫn ghi năm
chỉ số và dải tham chiếu; entry chưa lưu đủ bối cảnh đo để gán dải có ý nghĩa.
`health_observations.measured_at` có thể khác `health_entries.recorded_at`.

## Quyết định

1. Dashboard real mode đọc từng số đo theo `measured_at` và chủ tài khoản;
   bốn chỉ số là huyết áp, đường huyết, cân nặng và nhịp tim. Mock mode giữ preview.
2. Dải tham chiếu của số đo thật tách sang task riêng. Không dùng giá trị demo
   làm dải cá nhân hoặc ngưỡng lâm sàng.
3. Triệu chứng có cấu trúc được lưu cùng entry; entry chỉ có triệu chứng hợp lệ.
   Chỉnh sửa header, số đo và triệu chứng qua một transaction.
4. Analytics nhóm ngày/tuần/tháng theo lịch địa phương IANA, tính trên các số đo
   đã lưu; dải ngày `[from,to)`, bucket rỗng rõ ràng. Dữ liệu legacy không thể
   tổng hợp được kiểm đếm theo lý do và không bị sửa.
5. Medication courses của Đợt A tiếp tục do người dùng xác nhận; dữ liệu OCR hay
   đơn chưa `CONFIRMED` không tự tạo course.

## Ảnh hưởng và xác minh

Schema thêm index cho triệu chứng, không thêm bảng aggregate. Hợp đồng mới nằm
trong [OpenAPI](../../contracts/openapi.json). [Bàn giao B/C](../m1-phase-b-c.md)
ghi commit/CI, khác biệt với Timeline và giới hạn chưa làm. Trạng thái ADR vẫn
`Proposed` cho tới khi quy trình review của nhóm chấp nhận; việc merge task vào
`dev` không tự thay đổi trạng thái ADR.
