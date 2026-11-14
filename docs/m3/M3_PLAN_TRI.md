# Module 3 (AI Personal Health Assistant & RAG): Kế Hoạch Triển Khai & Kiểm Thử Chi Tiết — Dương Phan Minh Trí

> **Người thực hiện:** Dương Phan Minh Trí (`MTri` - M3 System Architect & Frontend Lead)  
> **Trách nhiệm chính:** Chủ trì thực hiện **Milestone 2** & **Milestone 4**; Tiếp nhận bàn giao, tích hợp API & Giao diện Chatbot React ở **Milestone 1** & **Milestone 3**; Điều phối toàn diện hệ thống.  
> **Căn cứ kỹ thuật:** `M3_AI_Personal_Health_Assistant_Technical_Design.md` (v2.0), `VitaP_API_Docs.md` §9, `database_schema_v3.md` và mã nguồn chuẩn từ `demo-hybrid-rag-vibe-code`.  
> **Nguyên tắc cốt lõi:** Mỗi milestone thực hiện đều phải đi kèm bộ test files tương ứng, chạy kiểm thử đạt 100% PASS trước khi bàn giao.

---

## TỔNG QUAN PHÂN CHIA QUY TRÌNH 4 MILESTONES

| Milestone | Tên giai đoạn | Trách nhiệm của Minh Trí | Trách nhiệm của Lê Thanh Phong |
| :--- | :--- | :--- | :--- |
| **Milestone 1** | **Baseline Vertical Slice & Safety Guardrails** | **Tiếp nhận & Ráp nối:** Kiểm tra Enums, chạy test an toàn của Phong, hòa hợp Chat Service Orchestrator và tích hợp Frontend Chatbot UI. | **Chủ trì thực hiện:** Hoàn tất Enums, Prompts, Lớp 1 Input Guardrail, Lớp 3 Output Guardrail, LCEL Generation và bộ Unit Test an toàn y tế. |
| **Milestone 2** | **Hybrid Search RRF & Context Integration** | **Chủ trì thực hiện:** Hybrid Search SQL RRF $k=60$, BGE Reranker client, PersonalContext M1, InteractionSupport M2, Explain Service, GPU tunnel Colab/Kaggle. | **Tiếp nhận & Đối soát:** Kiểm tra logic Reranking, đối soát ngưỡng benchmark `min_rerank_score`, kiểm tra context M1/M2 đưa vào prompt. |
| **Milestone 3** | **RAG Golden QA Dataset & Benchmark Đánh Giá** | **Phối hợp & Bổ trợ:** Multi-session management, Rate Limiting in-memory, Feedback API 👍/👎 và cập nhật giao diện người dùng. | **Chủ trì thực hiện:** Biên tập 50 Golden QA Pairs chuẩn y tế tiếng Việt, viết kịch bản và chạy đo lường Benchmark tự động bằng Ragas. |
| **Milestone 4** | **Chaos Testing, Latency Profiling & Bảo Vệ Đồ Án** | **Chủ trì thực hiện:** Kịch bản Chaos Testing, đo lường Latency Profiling, hoàn tất tài liệu kỹ thuật tổng kết và bộ slides bảo vệ đồ án. | **Tiếp nhận & Đồng chủ trì:** Đối soát độ trễ Lớp 1 (< 20ms), kiểm tra tính kiên cường khi đứt tunnel, đồng chủ trì thuyết trình bảo vệ đồ án. |

---

## QUY TRÌNH TRIỂN KHAI CHI TIẾT THEO TỪNG MILESTONE

---

### MILESTONE 1: BASELINE VERTICAL SLICE & SAFETY GUARDRAILS
> **Trạng thái:** Lê Thanh Phong chủ trì phần Core AI/Guardrails; Minh Trí tiếp nhận bàn giao, cập nhật Orchestrator và nối Frontend UI.  
> **Mục tiêu:** Tiếp nhận và nghiệm thu 2 tầng Guardrails an toàn y tế từ Phong, ráp nối với tầng Repositories đã có, hoàn tất API chat và giao diện React Chatbot hiển thị Citation Pills.

#### 1. Ghi chú tiếp nhận từ Lê Thanh Phong:
Lê Thanh Phong thực hiện bổ sung các Enum còn thiếu, Prompts loader, chuyển giao 2 tầng Guardrails (Lớp 1 Input Guardrail ngắt 115 < 20ms, Lớp 3 Output Guardrail chặn ngộ nhận an toàn), LCEL Generation Engine và bộ 3 file Unit Test kiểm chứng an toàn y tế.

* **Các file repo Phong thay đổi/tạo mới:**
  - `backend/app/shared/enums.py` (Bổ sung `AnswerStatus`, `CitationType`)
  - `backend/app/modules/ai_assistant/prompts/__init__.py` (Hàm `load_prompt`)
  - `backend/app/modules/ai_assistant/prompts/explain_ddi_v1.md`
  - `backend/app/modules/ai_assistant/rag/guards/input_guard.py`
  - `backend/app/modules/ai_assistant/rag/guards/output_guard.py`
  - `backend/app/modules/ai_assistant/rag/guards/text_utils.py`
  - `backend/app/modules/ai_assistant/rag/guards/messages.py`
  - `backend/app/modules/ai_assistant/rag/generation/lcel_chain.py`
  - `backend/app/modules/ai_assistant/schemas/llm_output.py`
  - `backend/tests/unit/test_emergency_guard.py`
  - `backend/tests/unit/test_output_guard.py`
  - `backend/tests/unit/test_generation_engine.py`

#### 2. Checklist kiểm tra đối soát dành cho Minh Trí:
- [ ] **Kiểm tra Enums:** Chạy `python -c "from app.shared.enums import AnswerStatus, CitationType; print('OK')"` xác nhận không còn lỗi `ImportError`.
- [ ] **Chạy bộ Unit Tests an toàn của Phong:**
  ```bash
  pytest backend/tests/unit/test_emergency_guard.py backend/tests/unit/test_output_guard.py backend/tests/unit/test_generation_engine.py -v
  ```
  Xác nhận: 100% test PASS, thời gian quét cấp cứu $< 20.0\text{ms}$, loại bỏ sạch citation ma.
- [ ] **Hòa hợp `ChatService` với Interface của Phong:**
  - File thao tác: `backend/app/modules/ai_assistant/services/chat_service.py`
  - Cập nhật hàm `send_message`: Nhận `GuardDecision` từ `InputGuardrail().evaluate()`.
  - Kết nối với `OutputGuard().validate()`.
  - Thống nhất trường dữ liệu: dùng `content` và `cited_ids` từ `LLMGeneratedAnswer`.
- [ ] **Chạy kiểm thử tích hợp Chat Endpoints:**
  ```bash
  pytest backend/tests/integration/test_chat_endpoints.py -v
  ```
- [ ] **Tích hợp Giao diện React Chatbot UI:**
  - Files thao tác: `frontend/src/screens/Chat.tsx`, `frontend/src/api/client.ts`
  - Kết nối API `POST /api/v1/ai/chat/sessions/{id}/messages`.
  - Hiển thị bong bóng chat, các viên thuốc trích dẫn (Citation Pills `[1]`, `[2]`), bấm vào mở Popover xem trích dẫn gốc MedlinePlus.
  - Ghim cố định Disclaimer y tế chân trang.
  - Chạy kiểm thử Frontend:
    ```bash
    pnpm --dir frontend test --run
    pnpm --dir frontend typecheck
    ```

---

### MILESTONE 2: HYBRID SEARCH RRF & CONTEXT INTEGRATION
> **Trạng thái:** Minh Trí chủ trì thực hiện trực tiếp  
> **Mục tiêu:** Nâng cấp truy xuất tri thức từ Dense thuần túy sang Hybrid Search SQL RRF $k=60$, tích hợp BGE Reranker client, Personal Health Context M1 (loại bỏ PII), Rule Engine M2 và API giải thích đơn thuốc.

#### 1. Các nhiệm vụ Minh Trí trực tiếp thực hiện:

##### Task 2.1: Chuyển giao Hybrid Search SQL RRF & BGE Reranker Client
- **Files thao tác:**
  - Tạo mới: `backend/app/modules/ai_assistant/rag/retrieval.py`
  - Tạo mới: `backend/app/modules/ai_assistant/rag/reranking/bge_client.py`
  - Cập nhật: `backend/app/modules/ai_assistant/repositories/knowledge_repo.py`
  - Test file: `backend/tests/unit/test_hybrid_retrieval.py`
- **Nội dung thực hiện:**
  - Cài đặt truy vấn `hybrid_search()` trong `knowledge_repo.py` kết hợp điểm vector cosine (pgvector HNSW) và điểm từ khóa trigram (GIN index) bằng Reciprocal Rank Fusion ($k=60$).
  - Cài đặt `BgeRerankerClient` gọi mô hình `bge-reranker-v2-m3` qua Ngrok tunnel với timeout 3.0s.
  - Thiết lập Circuit Breaker: Khi Reranker gặp sự cố hoặc timeout, tự động fallback lấy Top-K từ RRF mà không làm sập luồng chat.
- **Lệnh kiểm thử:**
  ```bash
  pytest backend/tests/unit/test_hybrid_retrieval.py -v
  ```

##### Task 2.2: Tích hợp Ngữ cảnh cá nhân M1 & Rule Engine M2
- **Files thao tác:**
  - Tạo mới: `backend/app/modules/ai_assistant/services/personal_context.py`
  - Tạo mới: `backend/app/modules/ai_assistant/services/interaction_support.py`
  - Tạo mới: `backend/app/modules/ai_assistant/services/drug_mentions.py`
  - Test file: `backend/tests/unit/test_personal_context.py`
- **Nội dung thực hiện:**
  - `personal_context.py`: Lọc bỏ PII (tên, CCCD, địa chỉ). Chỉ chọn nhóm dữ liệu cần thiết cho câu hỏi: Câu hỏi nhắc thuốc $\rightarrow$ Nạp DỊ ỨNG + THUỐC ACTIVE; Câu hỏi bệnh nền $\rightarrow$ Chỉ lấy bệnh ACTIVE/CHRONIC.
  - `interaction_support.py` & `drug_mentions.py`: Trích xuất thuốc qua entity matching, gọi Rule Engine M2, đóng gói kết quả thành `<drug_interaction_result>` với trích dẫn `INTERACTION_RULE`.
- **Lệnh kiểm thử:**
  ```bash
  pytest backend/tests/unit/test_personal_context.py -v
  ```

##### Task 2.3: Xây dựng Explain Service & Endpoint `/api/v1/ai/explain/interaction`
- **Files thao tác:**
  - Tạo mới: `backend/app/modules/ai_assistant/services/explain_service.py`
  - Cập nhật: `backend/app/modules/ai_assistant/router.py`
  - Test file: `backend/tests/integration/test_explain_endpoint.py`
- **Nội dung thực hiện:**
  - Dựng endpoint `POST /api/v1/ai/explain/interaction` nhận 2 loại thuốc, gọi Rule Engine M2 và dùng LLM diễn giải ngắn gọn 2–4 câu cho người bệnh.
  - Nếu LLM lỗi hoặc bị Guard từ chối $\rightarrow$ Fallback trả về template tất định, trả HTTP 200 mà không gây lỗi giao diện.

##### Task 2.4: Thiết lập Colab Notebook mở Ngrok Tunnel
- **Files thao tác:**
  - Tạo mới: `backend/sandbox/vt4_ai_lab/m3_gpu_server_colab.ipynb`
- **Nội dung thực hiện:**
  - Cung cấp notebook chạy GPU T4 miễn phí trên Google Colab nạp `BAAI/bge-reranker-v2-m3`, expose endpoint `/rerank` qua Ngrok.

#### 2. Thông tin bàn giao cho Lê Thanh Phong:
* Pipeline truy xuất: `KnowledgeRetriever.retrieve()` đã tích hợp RRF và Reranker.
* Ngữ cảnh prompt: Khối `<personal_health_context>` và `<drug_interaction_result>`.
* Bộ test suite MS2 hoàn chỉnh.

---

### MILESTONE 3: RAG GOLDEN QA DATASET & BENCHMARK ĐÁNH GIÁ
> **Trạng thái:** Lê Thanh Phong chủ trì phần Benchmark AI; Minh Trí hoàn thiện Session Management, Rate Limiter và Feedback UI.  
> **Mục tiêu:** Tiếp nhận tập test 50 Golden QA và kết quả Benchmark Ragas từ Phong; hoàn tất quản lý đa phiên, cơ chế chống spam Rate Limiting và tính năng đánh giá tin nhắn 👍/👎.

#### 1. Ghi chú tiếp nhận từ Lê Thanh Phong:
Lê Thanh Phong thực hiện biên soạn 50 cặp câu hỏi - câu trả lời mẫu chuẩn y tế tiếng Việt (`golden_qa_50.json`) và chạy kịch bản đo lường Benchmark tự động bằng Ragas (đạt Faithfulness $\ge 0.90$, Abstention Accuracy = 100%).

* **Các file repo Phong thay đổi/tạo mới:**
  - `backend/sandbox/vt4_ai_lab/golden_qa_50.json`
  - `backend/sandbox/vt4_ai_lab/benchmark_ragas.py`
  - `backend/sandbox/vt4_ai_lab/reports/benchmark_report_ms3.json`

#### 2. Các nhiệm vụ Minh Trí thực hiện bổ trợ:

##### Task 3.1: Quản lý đa phiên & In-memory Rate Limiter
- **Files thao tác:**
  - Tạo mới: `backend/app/modules/ai_assistant/rate_limit.py`
  - Cập nhật: `backend/app/modules/ai_assistant/router.py`
  - Cập nhật: `backend/app/modules/ai_assistant/repositories/chat_repo.py`
  - Test file: `backend/tests/unit/test_rate_limiter.py`
- **Nội dung thực hiện:**
  - Cài đặt sliding window rate limiter: Giới hạn 15 request/phút trên mỗi user. Vượt ngưỡng trả mã `HTTP 429 TOO_MANY_REQUESTS`.
  - Hoàn thiện endpoint `DELETE /api/v1/ai/chat/sessions/{id}` hỗ trợ xóa phiên chat (Zero-trust check: phiên của người khác trả 404).

##### Task 3.2: Endpoint Đánh Giá Feedback 👍/👎 & UI
- **Files thao tác:**
  - Cập nhật: `backend/app/modules/ai_assistant/router.py` (Endpoint `POST /chat/messages/{id}/feedback`)
  - Cập nhật: `backend/app/modules/ai_assistant/repositories/chat_repo.py`
  - Cập nhật: `frontend/src/screens/Chat.tsx`
  - Test file: `backend/tests/integration/test_chat_feedback.py`
- **Nội dung thực hiện:**
  - Ghi nhận `rating` (`THUMBS_UP` / `THUMBS_DOWN`) và `comment` vào cơ sở dữ liệu.
  - Hiển thị hai nút bấm 👍/👎 tinh gọn dưới mỗi câu trả lời của trợ lý trên giao diện chat.

#### 3. Checklist kiểm tra đối soát dành cho Minh Trí:
- [ ] **Đối soát báo cáo Benchmark của Phong:** Đọc kết quả trong `backend/sandbox/vt4_ai_lab/reports/benchmark_report_ms3.json`.
- [ ] **Kiểm tra Abstention Accuracy:** Xác nhận 100% các câu hỏi thiếu bằng chứng và câu hỏi cấp cứu trong tập Golden QA đều bị từ chối hoặc chuyển hướng an toàn.
- [ ] **Chạy kiểm thử Rate Limiter & Feedback:**
  ```bash
  pytest backend/tests/unit/test_rate_limiter.py backend/tests/integration/test_chat_feedback.py -v
  ```

---

### MILESTONE 4: CHAOS TESTING, LATENCY PROFILING & BẢO VỆ ĐỒ ÁN
> **Trạng thái:** Minh Trí chủ trì thực hiện trực tiếp  
> **Mục tiêu:** Thực hiện kiểm thử hỗn loạn (Chaos Testing), lập hồ sơ độ trễ (Latency Profiling), biên soạn báo cáo kỹ thuật tổng kết và bộ slides thuyết trình bảo vệ đồ án.

#### 1. Các nhiệm vụ Minh Trí trực tiếp thực hiện:

##### Task 4.1: Xây dựng bộ kịch bản Chaos Testing
- **Files thao tác:**
  - Tạo mới: `backend/tests/integration/test_chaos_and_resilience.py`
- **Nội dung thực hiện:**
  - **Kịch bản 1 (Đứt Ngrok Tunnel):** Ngắt giả lập server Reranker $\rightarrow$ Kiểm chứng hệ thống tự động chuyển sang Top-K RRF trong $< 50\text{ms}$ mà không gián đoạn người dùng.
  - **Kịch bản 2 (Gemini Timeout):** Giả lập Gemini API phản hồi chậm $> 8.0\text{s}$ $\rightarrow$ Kiểm chứng hệ thống kích hoạt fallback sang MedGemma hoặc thông báo "Hệ thống bận" lịch sự.
  - **Kịch bản 3 (PostgreSQL Quá Tải):** Giả lập DB tạm thời nghẽn $\rightarrow$ Kiểm chứng Lớp 1 Input Guardrail vẫn ngắt được cấp cứu 115 độc lập mà không cần chạm DB.
- **Lệnh kiểm thử:**
  ```bash
  pytest backend/tests/integration/test_chaos_and_resilience.py -v
  ```

##### Task 4.2: Lập hồ sơ độ trễ toàn diện (Latency Profiling)
- **Files thao tác:**
  - Tạo mới: `backend/sandbox/vt4_ai_lab/latency_profiler.py`
  - Output báo cáo: `backend/sandbox/vt4_ai_lab/reports/latency_profile_report.json`
- **Nội dung thực hiện:**
  - Đo lường thời gian xử lý thực tế qua 100 lượt truy vấn:
    - Lớp 1 Cấp cứu 115: $p50 < 10\text{ms}, p99 < 20\text{ms}$.
    - Truy vấn Hybrid Search pgvector: $p50 < 80\text{ms}, p95 < 150\text{ms}$.
    - Luồng RAG đầy đủ: $p50 < 3.0\text{s}, p95 < 6.0\text{s}$.

##### Task 4.3: Biên soạn Báo cáo Kỹ thuật Tổng kết & Slides Bảo Vệ
- **Files thao tác:**
  - Tạo mới: `backend/sandbox/vt4_ai_lab/reports/M3_FINAL_EVALUATION_SUMMARY.md`
  - Tạo mới: `backend/sandbox/vt4_ai_lab/reports/M3_DEFENSE_PRESENTATION.md`
- **Nội dung thực hiện:**
  - Tổng hợp số liệu: 139 tests PASS, độ trung thực Faithfulness $\ge 0.90$, Zero-Hallucination, tỷ lệ bảo vệ cấp cứu $100\%$.
  - Xây dựng 4 kịch bản demo trực tiếp trước Hội đồng:
    1. Tra cứu thông tin thuốc có trích dẫn MedlinePlus gốc.
    2. Cảnh báo an toàn dựa trên tiền sử dị ứng người dùng (M1).
    3. Cảnh báo tương tác thuốc nghiêm trọng từ Rule Engine (M2).
    4. Thử gõ câu cấp cứu $\rightarrow$ Kích hoạt ngay lập tức banner 115 trong $< 20\text{ms}$.

#### 2. Thông tin bàn giao cho Lê Thanh Phong:
* Bộ báo cáo Chaos Test và Latency Profiling để Phong đối soát.
* Bộ tài liệu thuyết trình và kịch bản demo để hai bạn cùng chủ trì bảo vệ đồ án.

---

## BẢNG TỔNG HỢP CHECKLIST NGHIỆM THU DÀNH CHO MINH TRÍ

- [ ] **Milestone 1:** Tiếp nhận thành công Enums & Guardrails; test suite an toàn PASS 100%; hoàn tất kết nối `chat_service.py` và React Chatbot UI hiển thị Citation Pills.
- [ ] **Milestone 2:** Hoàn tất Hybrid Search SQL RRF $k=60$ và BGE Reranker; nạp an toàn context M1/M2; endpoint `/explain/interaction` hoạt động ổn định.
- [ ] **Milestone 3:** Rate Limiter chặn đúng 15 req/phút; tính năng Feedback 👍/👎 ghi nhận DB; đối soát 50 câu Golden QA đạt chuẩn.
- [ ] **Milestone 4:** Vượt qua 3 kịch bản Chaos Test; lập hồ sơ latency đạt chuẩn cam kết; sẵn sàng toàn bộ báo cáo và slide bảo vệ đồ án.

