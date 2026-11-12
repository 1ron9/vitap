# Đóng góp cho VitaP

## Nhánh và Pull Request

```text
nhánh task → PR vào dev → CI + review + kiểm thử tích hợp
                       → PR dev vào main → nhóm chốt → merge commit
```

- **main:** phiên bản đã được nhóm chốt, làm mốc sử dụng và bàn giao.
- **dev:** nhánh tích hợp và thử nghiệm lâu dài; giữ nhánh sau mỗi lần phát hành.
- **Nhánh task:** tạo từ dev mới nhất; tên `feat/<task>-<mô-tả>`, `fix/<task>-<mô-tả>`,
  `docs/<mô-tả>` hoặc `codex/<mô-tả>`.

```bash
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c feat/<task>-<description>
# sửa, kiểm thử, stage đúng file rồi commit
git push -u origin feat/<task>-<description>
```

Mở PR với **base: dev**; ghi task, hành vi thay đổi, ảnh hưởng API/schema và kết quả test.
Chọn reviewer theo chuyên môn; thay đổi xuyên module cần người phụ trách liên quan review.
CODEOWNERS chỉ định reviewer, không cấm sửa chéo file.

Feature PR có thể squash vào dev. Khi kiểm thử tích hợp đạt và nhóm thống nhất,
mở PR **dev → main**, dùng **merge commit** để giữ lịch sử hai nhánh dài hạn.
Sự đồng ý trong nhóm cần được ghi nhận bằng Approve trên GitHub trước khi merge.

Hai nhánh yêu cầu một approval từ reviewer có quyền write, bốn CI bắt buộc xanh và
xử lý hết review conversation. Approval cũ bị hủy khi có commit mới. Quy tắc áp dụng
cả với admin; không force push hoặc xóa dev/main.

Hotfix main: tạo nhánh từ main, đi qua PR/review/CI, sau đó PR main → dev để đồng bộ.
Tài liệu hoặc thay đổi khác đi thẳng vào main cũng phải đồng bộ về dev. Nếu dev lỗi,
sửa hoặc revert qua PR; không reset lịch sử dùng chung.

## Quy ước triển khai

- Code theo domain trong `backend/app/modules/` và `frontend/src/features/`.
- Route gọi service; module giao tiếp qua service nội bộ và Principal đã xác thực.
- Dữ liệu cá nhân kiểm tra ownership/consent tại service và repository.
- Thay đổi schema bằng revision mới; không sửa migration đã được dùng.
- Thay đổi API cập nhật DTO, OpenAPI và frontend/mock liên quan trong cùng PR.
- Chỉ stage file thuộc task; không commit .env, token, ảnh đơn thuốc thật hoặc dataset
  chưa có quyền chia sẻ. Dataset lớn quản lý bằng manifest nguồn/version/checksum.
- Commit dạng `feat(auth): ...`, `fix(health): ...`, `docs: ...`; ghi task nếu có.

## Kiểm tra trước review

Lệnh đầy đủ nằm trong [DEVELOPMENT.md](DEVELOPMENT.md#kiểm-thử).

| Thay đổi | Kiểm tra |
|---|---|
| Backend | Pytest liên quan; toàn suite khi ảnh hưởng hạ tầng chung |
| API/DTO | Xuất/kiểm tra OpenAPI, kiểm tra consumer/mock |
| Schema/seed/worker | Integration tests trên PostgreSQL thử nghiệm đã migrate |
| Frontend | Build TypeScript/Vite và tests liên quan |
| Docker/Compose | Compose smoke |
| Chỉ tài liệu | Đường dẫn, câu lệnh và trạng thái chức năng mô tả |

CI bắt buộc: `Run Backend Pytest`, `Frontend build and tests`,
`PostgreSQL migrations and contracts`, `FastAPI + PostgreSQL + pgvector`.
Không sửa test để che lỗi; cập nhật test khi contract đổi và giải thích trong PR.
