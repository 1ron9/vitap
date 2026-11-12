# Đóng góp cho VitaP

Quy trình chính thức: feature/fix → **dev** → review và kiểm thử → **main**.
Đọc [tài liệu chuyển đổi codebase và nhánh dev](CODEBASE_DEV_MIGRATION.md).

1. Fetch và cập nhật dev bằng fast-forward; tạo nhánh task từ dev.
2. Chỉ stage các file thuộc task; thay đổi module khác phải có reviewer phù hợp.
3. Chạy backend tests, frontend build/tests và OpenAPI check khi có thay đổi liên quan.
4. Mở PR với base **dev**; không push trực tiếp dev/main.
5. Sau CI và review, squash feature vào dev. Kiểm thử tích hợp tại dev.
6. Khi cả nhóm chốt, mở PR dev → main; dùng merge commit, không squash nhánh dài hạn.

Không commit .env, token, ảnh đơn thuốc thật hoặc dataset chưa có quyền chia sẻ.
Migration đã dùng không sửa lịch sử; thêm revision mới. Không sửa test chỉ để che lỗi.
CODEOWNERS chỉ định reviewer, không phải ranh giới cấm sửa code. Owner tích hợp chịu
trách nhiệm phối hợp những thay đổi contract/schema xuyên module.
