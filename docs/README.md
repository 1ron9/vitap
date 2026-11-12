# Tài liệu VitaP

## Bắt đầu từ đâu

| Nhu cầu | Tài liệu |
|---|---|
| Giới thiệu, trạng thái chức năng và khởi động nhanh | [README dự án](../README.md) |
| Tìm tài liệu nhóm trên Drive, đọc theo module, cập nhật khi upload | [DRIVE_GUIDE.md](DRIVE_GUIDE.md) |
| Kiến trúc và ranh giới module | [architecture.md](architecture.md) |
| Cấu hình, migration, worker và kiểm thử | [development.md](development.md) |
| Làm task và mở PR theo quy trình dev → main | [CONTRIBUTING](../CONTRIBUTING.md) |
| Hợp đồng API đã triển khai | [Hướng dẫn contract](../contracts/README.md), [OpenAPI](../contracts/openapi.json) |
| Ghi nhận quyết định kỹ thuật | [decisions/](decisions/README.md) |
| Lịch sử tổ chức lại codebase | [codebase-migration.md](history/codebase-migration.md) |

## Tài liệu repo và tài liệu Drive

[Drive chung](https://drive.google.com/drive/folders/1_ik5G4XIdZu2JeFgXxFPTC7FoMAGTaZg)
lưu tài liệu làm việc, thiết kế, báo cáo và dataset lớn. Repo lưu hướng dẫn sử dụng/phát
triển, quyết định đã review và chỉ mục nguồn có version. Đọc DRIVE_GUIDE trước khi dùng
tài liệu Drive cho một task; mỗi nguồn có vai trò, mức xác minh và giới hạn riêng.

Markdown là chỉ mục chính. Khi upload mới hoặc sửa tài liệu Drive, người upload phải
cập nhật DRIVE_GUIDE: link/ID, mô tả thay đổi, owner/version/trạng thái, nguồn thay thế
và changelog. Thay đổi đi qua PR vào dev cùng đợt bàn giao.

## Quy ước đặt tài liệu

- Đặt hướng dẫn cấp dự án trong docs/; giữ README/CONTRIBUTING ở root để dễ tìm.
- Giữ README mô tả riêng một module cạnh code; giữ OpenAPI cùng contracts/.
- Đặt quyết định mới trong decisions/, ghi rõ trạng thái và link PR review.
- Đặt tài liệu lịch sử trong history/; không dùng bản cũ làm hướng dẫn hiện hành.
- Cập nhật mục lục và relative links khi thêm hoặc di chuyển file.
- docs/private/ và docs/_exports/ bị ignore; kiểm tra dữ liệu nhạy cảm trước khi stage.

AI agent đọc [AGENTS.md](../AGENTS.md) và chọn nguồn liên quan theo DRIVE_GUIDE;
link không tự cấp quyền truy cập hoặc xác nhận nội dung đã được đọc.
