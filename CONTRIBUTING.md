# Hướng Dẫn Đóng Góp (CONTRIBUTING) — MediCare / VitaP

Chào mừng các thành viên nhóm **MediCare / VitaP**!  
Tài liệu này quy định quy trình làm việc phân chia theo **Sandbox độc lập**, kiểm soát **Sở hữu tập tin (File Ownership)**, quy ước **Commit độc lập** và quy trình Review code học tập từ mô hình quản trị dự án AI Bloxorz nhằm đảm bảo mã nguồn ổn định, không xung đột (conflict) và tiến độ song song giữa 4 thành viên.

---

## 1. 5 Điều Tối Quan Trọng (Nguyên Tắc Sống Còn)

1. **Chỉ sửa file của mình:** Mỗi thành viên chỉ chỉnh sửa các file thuộc phân quyền phụ trách của mình. Tuyệt đối không tự ý sửa file của thành viên khác. Nếu cần sửa chéo, phải nhắn người phụ trách file đó.
2. **Không đẩy thẳng lên `main`:** Mọi task đều làm trên một nhánh riêng từ `main` rồi mở Pull Request (PR).
3. **Commit độc lập (Không `git add .` bừa bãi):** Chỉ `git add <file của mình>`. Kiểm tra bằng script `python scripts/check_commit_scope.py` trước khi commit. Commit phải ghi rõ mã module và mã task.
4. **Không sửa test của người khác chỉ để test xanh:** Nếu chạy test bị fail, phải tìm nguyên nhân từ logic triển khai của mình hoặc trao đổi trực tiếp với người viết test.
5. **Mỗi tối trước 22:00 gửi 3 dòng báo cáo:** Cập nhật ngắn gọn vào nhóm chat Zalo. Kẹt quá 1 ngày (Blocker) phải báo ngay cho Lead/PO để gỡ rối, không ôm việc một mình.

---

## 2. Bảng Phân Quyền Sở Hữu Tập Tin (File Ownership Matrix - VT1 đến VT4)

Dự án được phân chia thành 4 Sandbox kỹ thuật độc lập. Mọi thay đổi đều được giám sát tự động qua file [`.github/CODEOWNERS`](.github/CODEOWNERS):

| Mã số | Thành viên | Chuyên môn & Vai trò | Thư mục & Tập tin phụ trách chính (Sandbox) | Lệnh Test Sandbox riêng |
| :---: | :--- | :--- | :--- | :--- |
| **VT1** | **Trương Huệ Trí** (`24120472`) | **PO & Database / Data Core Lead** | • `backend/app/routers/m0_auth.py`<br>• `backend/app/models/`<br>• `backend/data_seed/`<br>• `docs/srs/` | `pytest tests/test_m0_auth.py -v` |
| **VT2** | **Nguyễn Bảo Trọng** (`24120476`) | **Backend Lead, DevOps & QA Lead** | • `backend/app/main.py`<br>• `backend/app/core/`<br>• `backend/app/routers/health_logs.py`<br>• `.github/workflows/`, Docker, `requirements.txt`<br>• `backend/tests/conftest.py` | `pytest tests/test_main.py -v` |
| **VT3** | **Dương Phan Minh Trí** (`24120470`) | **Frontend Lead & DDI Logic Lead** | • `frontend/src/` (Toàn bộ UI Web)<br>• `backend/app/routers/m4_ddi.py`<br>• `docs/designs/m4_ddi_engine.md` | `npm run dev` (Mock mode)<br>`pytest tests/test_m4_ddi.py -v` |
| **VT4** | **Lê Thanh Phong** (`24120409`) | **AI Assistant & Knowledge Base Lead** | • `backend/app/routers/m3_chatbot.py`<br>• `backend/app/services/rag/`<br>• `backend/app/services/mock_ai_service.py` | `pytest tests/test_m3_chatbot.py -v` |

---

## 3. Cơ Chế Phát Triển Song Song Bằng Sandbox (Decoupled Sandboxes)

Để các thành viên không phải chờ đợi nhau (không bị nghẽn cổ chai):

1. **Frontend Sandbox (VT3):**
   - VT3 có thể xây dựng toàn bộ giao diện Web React mà không cần Backend chạy thật bằng cách bật cờ:
     ```env
     VITE_USE_MOCK=true
     ```
   - Hệ thống tự động sử dụng `frontend/src/services/mockData.ts` để trả dữ liệu mẫu tức thì (0ms).

2. **AI & Testing Sandbox (VT4 & Cả nhóm):**
   - Khi chạy test tự động hoặc khi chưa có Gemini API Key, bật cờ:
     ```env
     USE_MOCK_AI=True
     ```
   - Backend tự động chuyển sang sử dụng `backend/app/services/mock_ai_service.py`, bảo đảm không tốn tiền quota và toàn bộ test suite chạy xong trong dưới 2 giây.

3. **Database Sandbox (VT1 & Cả nhóm):**
   - Môi trường Dev chạy trên Supabase Cloud.
   - Khi mất mạng hoặc báo cáo demo tại trường, trỏ `DATABASE_URL` về `localhost:5432` hoặc nạp `backend/data_seed/medicare_dump.sql` để chạy offline 100%.

---

## 4. Quy Trình Làm Việc Với Git & Commit Độc Lập

### 4.1. Các bước thực hiện một Task:
```bash
# 1. Đồng bộ mã nguồn mới nhất từ main
git switch main && git pull origin main

# 2. Tạo nhánh mới theo mã task
git switch -c feat/<mã_module>-<mã_task>-<mô_tả_ngắn>
# Ví dụ: git switch -c feat/m4-task-2.3-ddi-rules

# 3. Lập trình và chạy test trong Sandbox riêng của mình
pytest tests/test_m4_ddi.py -v

# 4. Kiểm tra tính độc lập của commit (BẮT BUỘC)
# Đảm bảo không vô tình sửa lan sang file của người khác
git add <các_file_thuộc_quyền_của_mình>
python scripts/check_commit_scope.py --staged --module m4

# 5. Commit độc lập kèm mã task
git commit -m "feat(m4): implement rule-first drug interaction (Task 2.3)"

# 6. Kéo main mới nhất về merge trước khi đẩy lên remote
git fetch origin && git merge origin/main && pytest -q

# 7. Đẩy lên GitHub và mở Pull Request
git push -u origin feat/<mã_module>-<mã_task>-<mô_tả_ngắn>
```

### 4.2. Quy ước Commit (Conventional Commits + Mã Task):
- Cú pháp: `<loại>(<module>): <mô tả ngắn> (Task <mã_task>)`
- Ví dụ chuẩn:
  - `feat(m0): implement jwt authentication router (Task 1.1)`
  - `feat(m4): add symmetric combination check for active ingredients (Task 2.3)`
  - `fix(m2): resolve checklist validation edge case (Task 2.1)`
  - `chore(devops): configure github actions ci for pytest (Task 1.2)`
  - `docs(m4): finalize technical sdd specification (Task 3.1)`

---

## 5. Bảng Phân Công Review Code Chéo

| Người viết code (Author) | Reviewer chính | Reviewer dự phòng | Tiêu chí trọng tâm cần kiểm tra |
| :---: | :---: | :---: | :--- |
| **VT1** *(Trương Huệ Trí)* | **VT2** *(Nguyễn Bảo Trọng)* | VT3 *(Dương Phan Minh Trí)* | Schema CSDL 3NF, bảo mật Auth JWT, tính độc lập của bảng dữ liệu. |
| **VT2** *(Nguyễn Bảo Trọng)* | **VT1** *(Trương Huệ Trí)* | VT4 *(Lê Thanh Phong)* | Cấu hình Docker, CI/CD, chuẩn RESTful Gateway, Exception Handler. |
| **VT3** *(Dương Phan Minh Trí)* | **VT2** *(Nguyễn Bảo Trọng)* | VT1 *(Trương Huệ Trí)* | Chuẩn giao diện React Tailwind, xử lý bất đồng bộ, kết nối Mock/Real API. |
| **VT4** *(Lê Thanh Phong)* | **VT3** *(Dương Phan Minh Trí)* | VT2 *(Nguyễn Bảo Trọng)* | Trích dẫn nguồn y tế, độ trễ RAG, Prompt Guardrails, bảo mật PHI. |

### Checklist cho Reviewer:
- [ ] PR chỉ sửa các file thuộc phạm vi Sandbox của tác giả (kiểm tra qua `.github/CODEOWNERS`).
- [ ] Chạy `pytest tests/test_<module>.py -v` thấy toàn bộ test xanh.
- [ ] Không có file `.env` hoặc API Key nào lọt vào commit.
- [ ] Không làm gãy API Contract của các module khác.
- [ ] Chỉ bấm **"Squash and merge"** khi đã được duyệt và CI GitHub Actions xanh.
