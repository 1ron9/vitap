# Dashboard M1

Trong real mode (`VITE_USE_MOCK=false`), `/dashboard` đọc số đo của tài khoản đang đăng nhập từ [API số đo gốc](../contracts/README.md#số-đo-gốc-cho-dashboard). Chọn huyết áp, đường huyết, cân nặng hoặc nhịp tim, rồi chọn khoảng Ngày, Tuần, Tháng hoặc nhập ngày tùy chọn. Ngày cuối được tính trọn ngày theo giờ Việt Nam. Tuần bắt đầu thứ Hai và tháng bắt đầu ngày 1.

Dashboard đọc đủ các trang kết quả trước khi vẽ. Mỗi điểm dùng thời điểm đo và giá trị đã lưu. Huyết áp có hai nhóm điểm cho tâm thu và tâm trương. Đường huyết dùng trục `mmol/L` và giữ giá trị, đơn vị nhập ở bảng cùng tooltip. Điểm trùng thời gian vẫn có từng dòng riêng trong bảng. Bấm “Mở ghi chép” để xem đúng entry trong Sổ tay, kể cả khi thời điểm đo và ngày ghi chép khác nhau.

Khi dữ liệu chưa tải đủ, Dashboard hiển thị trạng thái tải. Nếu một trang lỗi, nút “Thử lại” chạy lại cả truy vấn. Sau khi thêm, sửa hoặc xóa trong Sổ tay, lần đọc tiếp theo dùng dữ liệu backend mới. Bộ lọc chọn khoảng hiển thị và hai chế độ Số đo gốc/Thống kê dùng cùng khoảng đó. Dải tham chiếu thuộc task riêng.

Mock mode vẫn dùng màn hình mô phỏng với nhãn dữ liệu mẫu. Guest thấy lời mời đăng nhập. Dashboard thật không tải dữ liệu cá nhân trước khi xác thực.

## Thống kê ngày, tuần và tháng

Chọn **Cách xem → Thống kê** để xem số đo đã lưu được nhóm theo **Ngày**, **Tuần**
(bắt đầu thứ Hai) hoặc **Tháng**. Bộ lọc chỉ số và ngày ở phía trên vẫn áp dụng;
ngày cuối được tính trọn theo giờ Việt Nam. API dùng khoảng ngày địa phương
`[from,to)` nên giao diện chuyển ngày cuối sang ngày kế tiếp khi gửi request.
Chế độ **Số đo gốc** vẫn hiển thị từng lần đo và là lựa chọn mặc định.

Mỗi bucket trong bảng có số lần đo, trung bình, thấp nhất và cao nhất. Huyết áp
có hai bộ giá trị riêng cho tâm thu/tâm trương. Đường huyết dùng đơn vị chuẩn
`mmol/L`; biểu đồ và bảng dùng cùng giá trị sau tổng hợp. Bucket không có số đo
hiển thị `0` lần và dấu `—`, biểu đồ không nối khoảng trống. Kỳ đầu/cuối có thể
chỉ bao gồm một phần tuần/tháng theo khoảng ngày đã chọn.

Nếu số đo cũ có đơn vị hay giá trị không thể tổng hợp, giao diện hiển thị số lượng
và lý do được loại theo `excluded_count`/`excluded_reasons` của API. Thống kê là mô tả dữ liệu đã ghi, không
đưa ra dải tham chiếu hoặc diễn giải y khoa. Sửa/xóa trong Sổ tay làm mới cả
dữ liệu gốc lẫn thống kê sau khi request lưu thành công.

## Nghiệm thu Đợt B

Chạy `pnpm test:e2e` trong `frontend` với PostgreSQL thử nghiệm đã migrate và seed. Hai spec Dashboard chạy trên Chromium desktop/mobile. `dashboard.spec.ts` kiểm tra lọc ngày Việt Nam, hai lần đo huyết áp trùng giờ, đường huyết và mở đúng ghi chép. `dashboard-flow.spec.ts` tạo, sửa và xóa ghi chép từ UI, kiểm tra thời điểm đo và cách ly tài khoản khi phản hồi cũ về trễ. Suite PostgreSQL đối chiếu danh sách theo UUID qua nhiều trang với DB.

Khi nghiệm thu thủ công, tạo hai lần đo cùng chỉ số trong một ngày rồi đối chiếu số lượng, đơn vị và thời điểm giữa Sổ tay, bảng và biểu đồ. Sửa riêng thời điểm ghi chép để xác nhận các điểm đứng nguyên. Sau đó sửa thời điểm đo qua ngày khác và xóa ghi chép để xác nhận dữ liệu được đọc lại. Giữ phạm vi 4 chỉ số của A và đưa dải tham chiếu sang task riêng.
