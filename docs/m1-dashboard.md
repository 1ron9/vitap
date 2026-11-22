# Dashboard M1

Trong real mode (`VITE_USE_MOCK=false`), `/dashboard` đọc số đo của tài khoản đang đăng nhập từ [API số đo gốc](../contracts/README.md#số-đo-gốc-cho-dashboard). Chọn huyết áp, đường huyết, cân nặng hoặc nhịp tim, rồi chọn khoảng Ngày, Tuần, Tháng hoặc nhập ngày tùy chọn. Ngày cuối được tính trọn ngày theo giờ Việt Nam. Tuần bắt đầu thứ Hai và tháng bắt đầu ngày 1.

Dashboard đọc đủ các trang kết quả trước khi vẽ. Mỗi điểm dùng thời điểm đo và giá trị đã lưu. Huyết áp có hai nhóm điểm cho tâm thu và tâm trương. Đường huyết dùng trục `mmol/L` và giữ giá trị, đơn vị nhập ở bảng cùng tooltip. Điểm trùng thời gian vẫn có từng dòng riêng trong bảng. Bấm “Mở ghi chép” để xem đúng entry trong Sổ tay, kể cả khi thời điểm đo và ngày ghi chép khác nhau.

Khi dữ liệu chưa tải đủ, Dashboard hiển thị trạng thái tải. Nếu một trang lỗi, nút “Thử lại” chạy lại cả truy vấn. Sau khi thêm, sửa hoặc xóa trong Sổ tay, lần đọc tiếp theo dùng dữ liệu backend mới. Bộ lọc chỉ đổi khoảng hiển thị các số đo gốc. Chế độ thống kê theo bucket và dải tham chiếu thuộc các phần triển khai riêng.

Mock mode vẫn dùng màn hình mô phỏng với nhãn dữ liệu mẫu. Guest thấy lời mời đăng nhập. Dashboard thật không tải dữ liệu cá nhân trước khi xác thực.

## Nghiệm thu Đợt B

Chạy `pnpm test:e2e` trong `frontend` với PostgreSQL thử nghiệm đã migrate và seed. Hai spec Dashboard chạy trên Chromium desktop/mobile. `dashboard.spec.ts` kiểm tra lọc ngày Việt Nam, hai lần đo huyết áp trùng giờ, đường huyết và mở đúng ghi chép. `dashboard-flow.spec.ts` tạo, sửa và xóa ghi chép từ UI, kiểm tra thời điểm đo và cách ly tài khoản khi phản hồi cũ về trễ. Suite PostgreSQL đối chiếu danh sách theo UUID qua nhiều trang với DB.

Khi nghiệm thu thủ công, tạo hai lần đo cùng chỉ số trong một ngày rồi đối chiếu số lượng, đơn vị và thời điểm giữa Sổ tay, bảng và biểu đồ. Sửa riêng thời điểm ghi chép để xác nhận các điểm đứng nguyên. Sau đó sửa thời điểm đo qua ngày khác và xóa ghi chép để xác nhận dữ liệu được đọc lại. Giữ phạm vi 4 chỉ số của A và đưa dải tham chiếu sang task riêng.
