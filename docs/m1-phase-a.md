# M1 Đợt A — API, UI và nghiệm thu

Đợt A triển khai hồ sơ, bệnh nền/dị ứng, Journal với 4 metric hiện có trên UI, declarations/preferences và medication courses theo [quyết định 0001](decisions/0001-m1-phase-a.md). Code ở backend/app/modules/health và frontend/src/features/health. [OpenAPI](../contracts/openapi.json) là contract endpoint thực thi.

## Chạy và migration

Sau khi cấu hình `.env` theo README:

```bash
docker compose up --build --wait
docker compose exec backend alembic upgrade head
docker compose exec backend python -m data_seed.seed_test_scenarios
```

Đọc CLI `--help` của seed nếu cần xuất fixture. Chỉ dùng seed tổng hợp trên DB phát triển. Không dùng `create_all()` thay migration. Revision M1 giữ records cũ, thêm shell profile còn thiếu và settings mặc định; không tự xác nhận “không dị ứng” hoặc nhập dữ liệu localStorage vào DB.

Frontend dùng pnpm (packageManager pin trong package.json):

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Đặt `VITE_USE_MOCK=false` để dùng backend; `/api` được Vite proxy tới localhost:8000. Dùng mock=true cho offline preview: health resources theo DTO mới, storage riêng `vitap-m1-mock-v1-<email>`. Không dùng dữ liệu mẫu làm bằng chứng y khoa. Dashboard mock vẫn là preview, real chart được hoàn thiện ở Đợt B.

## Hợp đồng chính

Base `/api/v1/health`, tất cả cần User hợp lệ. Public=401, Guest=403, tài nguyên chủ khác/nested ID sai=404; lỗi giữ envelope code/message/details/request_id. Không nhận owner/source/verified từ client. PATCH bỏ field giữ nguyên; null chỉ xóa field nullable.

| Resource | Hành vi |
|---|---|
| profile | GET/PATCH tên/ngày sinh/giới tính/phone/height; profile GET không ghi DB |
| conditions | CRUD + status filter/pagination, tự khai MANUAL/verified=false |
| allergies | CRUD loại/tên/phản ứng/severity/ingredient; ingredient sai=422 |
| allergy-declaration | GET/PUT UNKNOWN hoặc NO_KNOWN_ALLERGIES khi list rỗng; HAS_ALLERGIES là trạng thái suy từ records |
| preferences | GET/PATCH hai booleans; ai_context_available là giá trị effective chỉ đọc, gồm consent hiện hành |
| entries | CRUD + from/to/observation_type + pagination; filter trước phân trang, child query theo batch |
| entries/{id}/aggregate | PATCH một command create/update/delete readings + entry header, atomic rollback |
| entries/{id}/observations | POST reading; PATCH/DELETE theo nested observation ID |
| medication-course-options | User-only catalog options q/page; /prescription-items chỉ owned confirmed/matched sources |
| medication-courses | GET/POST; PATCH /{id} chuyển ACTIVE→COMPLETED/STOPPED, retry cùng trạng thái/ngày trả 200 |

List trả items/pagination, default page=1/page_size=20; max 100. Khoảng query `[from,to)` tối đa 366 ngày khi đủ hai mốc. Entries sort recorded_at DESC/id DESC; observations theo measured_at/id. Timestamp phải có offset/Z; API trả UTC, UI dùng Asia/Ho_Chi_Minh.

### Journal atomic

POST tạo entry+readings cùng transaction. PATCH header riêng không sửa thời gian readings. Khi chỉnh sửa toàn form, frontend gửi một PATCH aggregate:

```json
{
  "entry": {"title": "Buổi sáng"},
  "observations": {
    "create": [{"observation_type":"HEART_RATE","value":72,"unit":"bpm"}],
    "update": [],
    "delete": []
  }
}
```

Update target dùng ID sẵn có; không đổi type/parent. Records không có trong command giữ nguyên. Cùng ID vừa update vừa delete hoặc lặp target bị từ chối. Giá trị sau tất cả thao tác phải còn text hoặc ít nhất một reading, tối đa 100. Xóa toàn entry cascade observations/symptoms.

Glucose nhận mmol/L hoặc mg/dL, canonical mmol/L và entered fields lưu riêng. Ví dụ 100 mg/dL → canonical 5.5556, hiển thị lại 100 mg/dL. Đổi unit qua PATCH cần kèm value; sửa measured_at riêng không normalize lại số đo.

### Preferences và courses

Context policy ở health/policy.py nhận Principal và requested sections; GENERAL hoặc permission/consent không hợp lệ không trả dữ liệu cá nhân. Không có raw-context HTTP endpoint. M3/rule engine cần gọi policy khi tích hợp; A không cung cấp RAG hoặc engine cảnh báo y khoa mới.

Courses không tự tạo từ OCR/save. UI yêu cầu chọn thuốc và xác nhận; direct catalog source luôn dùng được. M2 review baseline chưa CONFIRMED nên item-source có thể chưa có kết quả; không hạ điều kiện để nhận pending/unresolved. Medication logs/reminder nằm ngoài A.

## Nghiệm thu

1. Đăng ký/đăng nhập, chỉnh Profile, reload và đọc lại dữ liệu.
2. CRUD bệnh nền/dị ứng, sửa reaction/type, xác nhận không dị ứng khi list rỗng; thêm allergy tự bỏ xác nhận, xóa cuối về UNKNOWN.
3. Toggle preferences và reload; tắt context không revoke OCR consent.
4. Tạo note-only entry và entry nhiều readings cùng loại. Thử sai unit/BP thiếu secondary/thời gian tương lai.
5. Sửa header + readings trong một lần Lưu; lỗi một reading phải rollback tất cả, UI giữ draft.
6. Lọc ngày VN/metric và qua hơn một page; không bỏ sót do filter sau pagination.
7. Bắt đầu course từ catalog, kết thúc/dừng, kiểm tra ACTIVE/history. Không auto-activate từ đơn.
8. Logout A/login B, Guest deep link và request/refresh về trễ: không xuất hiện dữ liệu A trong B.
9. Check mobile/desktop, labels/focus và thao tác bàn phím. Browser QA thực tế ghi riêng, DOM tests không thay thế visual QA.

Lệnh kiểm tra: Pytest backend; PostgreSQL integration trên DB disposable đã migrate; `python scripts/export_openapi.py --check`; frontend `pnpm typecheck`, `pnpm test`, `pnpm build`. CI có thêm Compose smoke. Ghi rõ tests skip nếu thiếu TEST_POSTGRES_URL, không coi SQLite là kiểm chứng PostgreSQL.

## Bằng chứng triển khai

Nhánh `codex/m1-phase-a`, [PR #15 vào dev](https://github.com/1ron9/vitap/pull/15). Base triển khai: `a0b6c35a`.
M1-01…M1-14 và M1-A17…M1-A19 đã có code, contract và kiểm thử. M1-15/16 gồm nghiệm thu
và bàn giao; việc review/merge vào dev vẫn theo CONTRIBUTING.

- [CI của commit triển khai đầu tiên](https://github.com/1ron9/vitap/actions/runs/44132045257): cả 4 job đạt, gồm PostgreSQL 16 + pgvector, Alembic upgrade chạy lặp, migration/backfill giữ legacy, transaction/row-lock/cascade/precision, OpenAPI và Compose persistence/recovery.
- Browser QA 18/11/2026: Chrome headless, viewport 1440×1000 và 390×844. Profile và Journal không tràn ngang; kiểm tra form, labels, focus và navigation. Lưu/reload Profile, confirm/add/delete allergy, toggle/reload preferences, thêm condition, Journal title-only/reload, catalog course ACTIVE→COMPLETED/reload đều đạt trong mock mode riêng. Ảnh QA ở `docs/_exports/qa-*.png` (không commit dữ liệu trình duyệt).
- DOM tests dùng real transport với HTTP được kiểm soát để kiểm chứng submit/422 giữ draft/aggregate/session races; API và PostgreSQL tests kiểm chứng persistence/ownership phía server. Browser QA mock không được coi là browser E2E với PostgreSQL.
- Máy triển khai không có Docker/PostgreSQL local. Các kiểm tra DB/Compose dùng CI; chưa áp migration lên database người dùng.

Theo phạm vi đã chốt, real Dashboard charts để Đợt B; M3/rule engine cần nối policy khi triển khai
module tương ứng. Courses không gồm medication logs/reminders. ADR vẫn Proposed cho đến khi review repo.
