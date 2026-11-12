# Quyết định kỹ thuật

Ghi quyết định có ảnh hưởng scope, kiến trúc, API/schema, dữ liệu hoặc quy trình tại đây.
Lịch sử quyết định của lần setup nằm trong [codebase-migration.md](../history/codebase-migration.md).

## Cách ghi nhận

1. Tạo file `NNNN-ten-quyet-dinh.md`, chọn số chưa dùng trong PR hiện hành.
2. Ghi bối cảnh, phương án, lựa chọn, ảnh hưởng và nguồn đối chiếu.
3. Đặt trạng thái Proposed khi đang thảo luận. Chỉ chuyển Accepted khi có quyết định
   được nhóm/reviewer xác nhận và dẫn link PR hoặc biên bản.
4. Quyết định thay thế phải dẫn hai chiều tới bản cũ; giữ lịch sử.
5. Nếu thay đổi nguồn Drive, cập nhật [DRIVE_GUIDE](../DRIVE_GUIDE.md) cùng đợt.

## Mẫu

```markdown
# NNNN — Tên quyết định

- Trạng thái: Proposed | Accepted | Superseded
- Ngày:
- Owner:
- Reviewer / bằng chứng chốt:
- Module / task:
- Nguồn liên quan (Drive ID/link, version; repo commit):

## Bối cảnh và vấn đề

## Các phương án

## Quyết định và lý do

## Ảnh hưởng code / API / schema / dữ liệu

## Cách kiểm chứng và chuyển đổi

## Quyết định thay thế / bị thay thế
```
