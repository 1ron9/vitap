# 0001 — M1 Đợt A theo quyết định người dùng

- Trạng thái: Proposed (chờ review repo; yêu cầu đã được người dùng xác nhận trong chat ngày 17/11/2026)
- Baseline: dev `a0b6c35aeb45bf6ed79a7f4a12239236f42121ef`.
- Phạm vi: HM-01/02/03, HM-04 điều chỉnh, HM-06 chuyển vào A, PV-02 phần M1 và FD-04.
- Nguồn tham chiếu: API-01 v1.0 và DB-01 v3 qua [DRIVE_GUIDE](../DRIVE_GUIDE.md); implementation plan local chứa D01–D13 được xác nhận.

## Quyết định triển khai

1. Bám UI: BLOOD_PRESSURE, GLUCOSE, WEIGHT, HEART_RATE. Nhiệt độ/SPO2 chưa có input mới; lịch sử metric cũ vẫn đọc được. Đây là delta với HM-04/API draft 5 metric, không tuyên bố hoàn tất nguyên scope cũ.
2. Profile giữ phone. Dị ứng giữ DRUG/FOOD/OTHER, reaction/severity; ba trạng thái UNKNOWN/HAS_ALLERGIES/NO_KNOWN_ALLERGIES được lưu/tính ở server, không suy từ list rỗng.
3. Preferences AI-context và allergy-alert độc lập; context cần consent hiện hành. Không revoke consent OCR bằng toggle M1. Các policy service có thể được M3/M2 dùng khi tích hợp.
4. Entry được chỉ có nội dung/tiêu đề và nhiều readings cùng loại; chặn xóa reading cuối khi entry không còn nội dung.
5. API aggregate command chỉnh header/readings trong một transaction; có parent row lock và kiểm tra trạng thái cuối. Không xóa observations chỉ vì bị bỏ khỏi payload.
6. Glucose normalized mmol/L với hệ số 18, Decimal canonical 4 số lẻ ROUND_HALF_UP; lưu entered_value/entered_unit để hiển thị lại đúng giá trị gốc. Chặn số không hữu hạn/≤0/sai precision; không dùng ngưỡng chẩn đoán.
7. Chặn recorded_at/measured_at tương lai; giới hạn content 10.000, description/reaction 5.000, 100 readings/entry, page_size≤100, date range≤366 ngày. Hiển thị giờ Việt Nam và trả UTC.
8. Courses ACTIVE chỉ sau người dùng xác nhận. Chọn từ catalog backend hoặc item thuộc đơn CONFIRMED/MATCHED của owner; kết thúc COMPLETED/STOPPED. M2 review hiện còn PENDING_REVIEW nên nguồn catalog giúp M1 không phụ thuộc hoàn tất RX-04.
9. Giữ dữ liệu demo DB/localStorage cũ, không tự import hoặc mass-delete. Migration chỉ thêm dữ liệu/cấu trúc cần thiết. Dashboard chart real mode chuyển sang Đợt B, mock mode giữ preview.

## Ảnh hưởng

Revision `20261117_m1_phase_a` thêm type allergy, raw glucose và user_health_settings; backfill settings/profile shells không đoán demographics. Auth register tạo settings cùng user/profile/consent. OpenAPI chỉ gồm endpoints đã triển khai.

Backend routes/services/repositories kiểm tra principal và ownership. Frontend real mode chỉ dùng API, mock mode dùng adapter cùng shape và storage riêng. Session refresh dùng single-flight, identity generation và Web Locks khi có; logout không cho response cũ tái lập dữ liệu.

## Xác minh và giới hạn

Pytest API/ownership/transaction/policy; PostgreSQL integration/cascade/concurrent declaration; DOM form/session tests; TypeScript/Vite và OpenAPI check. Chưa thực hiện RAG, allergy rule engine, nhắc thuốc hoặc chart dữ liệu thật trong quyết định này. Thay đổi không sửa quyền truy cập hay nội dung Drive.
