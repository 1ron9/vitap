# VitaP M1 — bàn giao Đợt B/C

Ngày đối chiếu: 23/11/2026 (Asia/Saigon). Mốc code chức năng trên `dev` là
[`85fa399`](https://github.com/1ron9/vitap/commit/85fa399c13e8543abce0f757f44a30ea899a07f5).
Các thay đổi được mở PR riêng vào `dev`; không phát hành `main` trong đợt này.

## Phạm vi đã triển khai

| Việc | Kết quả trên `dev` | Bằng chứng |
|---|---|---|
| M1-17 | Raw observations theo `measured_at`, `[from,to)`, owner, nhiều page và ID ổn định | [PR #16](https://github.com/1ron9/vitap/pull/16), [CI](https://github.com/1ron9/vitap/actions/runs/45035608155) |
| M1-18 | Dashboard real mode: 4 chỉ số, bộ lọc ngày/tuần/tháng/tùy chọn, Recharts, bảng gốc và mở Journal đúng entry | [PR #17](https://github.com/1ron9/vitap/pull/17), [CI](https://github.com/1ron9/vitap/actions/runs/45037449697) |
| M1-19 | E2E Journal tạo/sửa/xóa, `recorded_at` khác `measured_at`, phiên A → Guest → B | [PR #18](https://github.com/1ron9/vitap/pull/18), [CI](https://github.com/1ron9/vitap/actions/runs/45039028466) |
| M1-P01 | Triệu chứng có cấu trúc trong entry, API con và aggregate atomic; Journal cho entry chỉ có triệu chứng | [PR #19](https://github.com/1ron9/vitap/pull/19), [PR #20](https://github.com/1ron9/vitap/pull/20), [CI #20](https://github.com/1ron9/vitap/actions/runs/45039707318) |
| M1-P03 | API tổng hợp ngày/tuần/tháng theo IANA timezone; Dashboard có chế độ Thống kê, bảng/biểu đồ và lý do loại dữ liệu legacy | [PR #21](https://github.com/1ron9/vitap/pull/21), [PR #22](https://github.com/1ron9/vitap/pull/22), [PR #23](https://github.com/1ron9/vitap/pull/23), [CI #23](https://github.com/1ron9/vitap/actions/runs/45156221754) |
| M1-P02 | Thuốc đang dùng được người dùng xác nhận, đã làm trong Đợt A; kiểm tra lại trên bản tích hợp | [PR #15](https://github.com/1ron9/vitap/pull/15), `test_m1_health.py`, `health.test.tsx`, `m1.spec.ts` |

Schema hiện có revision `20261122_m1_symptoms` thêm index truy vấn triệu chứng;
không tạo bảng thuốc hay bảng tổng hợp mới. OpenAPI là snapshot sinh từ app tại
[`contracts/openapi.json`](../contracts/openapi.json). API thống kê và giới hạn dữ liệu
legacy được mô tả tại [hợp đồng API](../contracts/README.md), giao diện tại
[hướng dẫn Dashboard](m1-dashboard.md).

## Quyết định phạm vi và chỗ khác tài liệu thiết kế

- BC01: Dashboard và thống kê chỉ dùng `BLOOD_PRESSURE`, `GLUCOSE`, `WEIGHT`,
  `HEART_RATE` theo Đợt A. Timeline cũ ghi thêm SpO₂/nhiệt độ; số đo legacy ấy
  vẫn đọc được ở Journal nhưng không thêm input hay biểu đồ mới.
- BC02: dải tham chiếu không áp vào số đo thật khi chưa có bối cảnh đo phù hợp.
  Mock mode giữ preview dữ liệu mẫu. Dải tham chiếu là task riêng.
- BC03: một triệu chứng có cấu trúc đủ để lưu entry. API không cho xóa nội dung
  cuối khiến entry rỗng; phải xóa cả entry.
- BC04: thống kê nhóm theo ngày, tuần bắt đầu thứ Hai và tháng. Bộ lọc thời gian
  của Dashboard vẫn chọn khoảng của các lần đo gốc; nhóm thống kê là lựa chọn riêng.

Nguồn đối chiếu đã đọc nội dung trong đợt lập kế hoạch: hai tab Timeline/Objectives
trong [Sheet Sprint](https://docs.google.com/spreadsheets/d/1rbfdxcFSRdxplcbp00wZwJlKvB_-ffM-x5I9Us22s8U/edit),
[API-01 v1.0](https://drive.google.com/file/d/1zoiLz89zWNiQ-CMT4YwD7_KLnY12m8Ds/view)
và [DB-01 v3.0](https://drive.google.com/file/d/1MJLcimlQMTQlbnddvFt5iHC_X-zDLdGR/view).
UX-01/Figma chỉ dùng kết luận audit trước, không đọc lại nội dung trong lượt B/C.
Trạng thái triển khai được đối soát với route, DTO, migration, OpenAPI và test trên
`dev`; link Drive không dùng làm bằng chứng code đã chạy.

## Nghiệm thu và giới hạn

- [CI của PR #23 trên code tích hợp](https://github.com/1ron9/vitap/actions/runs/45156221754)
  đạt frontend, backend, PostgreSQL migrations/contracts/E2E Chromium desktop/mobile
  và Compose/FastAPI/pgvector. PostgreSQL test đối chiếu 205 số đo theo ID và thống kê
  với fixture 205 số đo; E2E kiểm tra Dashboard, Journal, triệu chứng, thống kê và
  phiên A/B.
- Local trên nhánh bàn giao sau `85fa399`: `pytest backend/tests -q` đạt **136**, bỏ qua **13** integration
  cần PostgreSQL; frontend `pnpm typecheck`, `pnpm test` (**55**), `pnpm build` và
  `scripts/export_openapi.py --check` đều đạt. Không gọi 13 ca bị bỏ qua là local pass;
  CI PostgreSQL đã chạy chúng với DB thử nghiệm.
- Medication courses: API thử `ACTIVE → COMPLETED/STOPPED`, idempotency, quyền A/B,
  nguồn danh mục độc lập và khoản mục đơn chỉ khi đơn `CONFIRMED`, item `MATCHED`.
  E2E Profile thử chọn danh mục, xác nhận ACTIVE và kết thúc sang lịch sử. Việc OCR
  hoặc một bản nháp `PENDING_REVIEW` không tự xác nhận course; luồng review/save M2
  hoàn chỉnh nằm ngoài phạm vi M1 này.
- Analytics dùng các số đo đã lưu, không diễn giải y khoa. Bucket rỗng có count 0
  và các giá trị null; glucose dùng mmol/L canonical. Dữ liệu cũ có đơn vị/số đo
  không thể tổng hợp được loại khỏi trung bình và báo số lượng/lý do; không sửa dữ liệu cũ.
  Dữ liệu demo trên localStorage không được import vào backend real mode.

Backlog Sheet và tài liệu Drive không được cập nhật trong lượt code này; nguồn chính
về trạng thái triển khai là Markdown trong repo và lịch sử PR/CI. `dev → main`
tiếp tục theo review/CI và quyết định phát hành của nhóm.
