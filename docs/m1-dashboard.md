# Dashboard M1

Trong real mode (`VITE_USE_MOCK=false`), `/dashboard` đọc số đo của tài khoản đang đăng nhập từ [API số đo gốc](../contracts/README.md#số-đo-gốc-cho-dashboard). Chọn huyết áp, đường huyết, cân nặng hoặc nhịp tim, rồi chọn khoảng Ngày, Tuần, Tháng hoặc nhập ngày tùy chọn. Ngày cuối được tính trọn ngày theo giờ Việt Nam. Tuần bắt đầu thứ Hai và tháng bắt đầu ngày 1.

Dashboard đọc đủ các trang kết quả trước khi vẽ. Mỗi điểm dùng thời điểm đo và giá trị đã lưu. Huyết áp có hai nhóm điểm cho tâm thu và tâm trương. Đường huyết dùng trục `mmol/L` và giữ giá trị, đơn vị nhập ở bảng cùng tooltip. Điểm trùng thời gian vẫn có từng dòng riêng trong bảng. Bấm “Mở ghi chép” để xem đúng entry trong Sổ tay, kể cả khi thời điểm đo và ngày ghi chép khác nhau.

Khi dữ liệu chưa tải đủ, Dashboard hiển thị trạng thái tải. Nếu một trang lỗi, nút “Thử lại” chạy lại cả truy vấn. Sau khi thêm, sửa hoặc xóa trong Sổ tay, lần đọc tiếp theo dùng dữ liệu backend mới. Bộ lọc chỉ đổi khoảng hiển thị các số đo gốc. Chế độ thống kê theo bucket và dải tham chiếu thuộc các phần triển khai riêng.

Mock mode vẫn dùng màn hình mô phỏng với nhãn dữ liệu mẫu. Guest thấy lời mời đăng nhập. Dashboard thật không tải dữ liệu cá nhân trước khi xác thực.
