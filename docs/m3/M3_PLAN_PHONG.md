# Module 3 (AI Personal Health Assistant & RAG): Kế Hoạch Triển Khai & Kiểm Thử Chi Tiết — Lê Thanh Phong

> **Người thực hiện:** Lê Thanh Phong (`Phong` - AI/ML Core & Safety Guardrails Engineer)  
> **Trách nhiệm chính:** Chủ trì thực hiện **Milestone 1** & **Milestone 3**; Tiếp nhận bàn giao, phối hợp và đối soát kiểm thử **Milestone 2** & **Milestone 4** từ Minh Trí.  
> **Căn cứ kỹ thuật:** `M3_AI_Personal_Health_Assistant_Technical_Design.md` (v2.0), `VitaP_API_Docs.md` §9, `database_schema_v3.md` và mã nguồn chuẩn từ `demo-hybrid-rag-vibe-code`.  
> **Nguyên tắc cốt lõi:** Mỗi milestone thực hiện đều phải đi kèm bộ test files tương ứng, chạy kiểm thử đạt 100% PASS trước khi bàn giao.

---

## TỔNG QUAN PHÂN CHIA QUY TRÌNH 4 MILESTONES

| Milestone | Tên giai đoạn | Trách nhiệm của Phong | Trách nhiệm của Minh Trí |
| :--- | :--- | :--- | :--- |
| **Milestone 1** | **Baseline Vertical Slice & Safety Guardrails** | **Chủ trì thực hiện:** Hoàn tất Enums, Prompts, Lớp 1 Input Guardrail, Lớp 3 Output Guardrail, LCEL Generation và bộ Unit Test an toàn y tế. | **Tiếp nhận & Ráp nối:** Cập nhật Chat Service Orchestrator, kiểm thử API endpoints và nối giao diện React Chatbot UI. |
| **Milestone 2** | **Hybrid Search RRF & Context Integration** | **Tiếp nhận & Đối soát:** Kiểm tra logic Reranking, đối soát ngưỡng benchmark `min_rerank_score`, kiểm tra context M1/M2 đưa vào prompt. | **Chủ trì thực hiện:** Hybrid Search SQL RRF $k=60$, BGE Reranker client, PersonalContext M1, InteractionSupport M2, Explain Service, GPU tunnel Colab/Kaggle. |
| **Milestone 3** | **RAG Golden QA Dataset & Benchmark Đánh Giá** | **Chủ trì thực hiện:** Biên tập 50 Golden QA Pairs chuẩn y tế tiếng Việt, viết kịch bản và chạy đo lường Benchmark tự động bằng Ragas. | **Phối hợp & Bổ trợ:** Multi-session management, Rate Limiting in-memory, Feedback API 👍/👎 và cập nhật giao diện người dùng. |
| **Milestone 4** | **Chaos Testing, Latency Profiling & Bảo Vệ Đồ Án** | **Tiếp nhận & Đồng chủ trì:** Đối soát độ trễ Lớp 1 (< 20ms), kiểm tra tính kiên cường khi đứt tunnel, đồng chủ trì thuyết trình bảo vệ đồ án. | **Chủ trì thực hiện:** Kịch bản Chaos Testing, đo lường Latency Profiling, hoàn tất tài liệu kỹ thuật tổng kết và bộ slides bảo vệ đồ án. |

---

## QUY TRÌNH TRIỂN KHAI CHI TIẾT THEO TỪNG MILESTONE

---

### MILESTONE 1: BASELINE VERTICAL SLICE & SAFETY GUARDRAILS
> **Trạng thái:** Phong chủ trì thực hiện trực tiếp  
> **Mục tiêu:** Hoàn thiện toàn bộ các tầng bảo vệ an toàn y tế (Lớp 1 & Lớp 3), LCEL Generation Engine, bổ sung đầy đủ Enums/Prompts còn thiếu và chạy 100% PASS bộ Unit Test kiểm chứng an toàn y tế.

#### 1. Các nhiệm vụ Phong trực tiếp thực hiện:

##### Task 1.1: Bổ sung Enums và Prompts Loader còn thiếu
- **Files thao tác:**
  - Cập nhật: `backend/app/shared/enums.py`
  - Tạo mới: `backend/app/modules/ai_assistant/prompts/__init__.py`
  - Tạo mới: `backend/app/modules/ai_assistant/prompts/explain_ddi_v1.md`
  - Test file: `backend/tests/unit/test_m3_enums_and_prompts.py`
- **Nội dung thực hiện:**
  - Thêm `AnswerStatus` (7 trạng thái: `ANSWERED`, `PARTIAL`, `INSUFFICIENT_EVIDENCE`, `CONFLICTING_EVIDENCE`, `NEEDS_CLINICIAN`, `EMERGENCY_REDIRECT`, `OUT_OF_SCOPE`) và `CitationType` (`MEDICAL_DOCUMENT`, `DRUG_DATABASE`, `INTERACTION_RULE`, `PERSONAL_PROFILE`) vào `backend/app/shared/enums.py`.
  - Cài đặt hàm `load_prompt(filename: str) -> str` trong `backend/app/modules/ai_assistant/prompts/__init__.py` để đọc các file markdown prompt có phiên bản.
  - Chuyển template prompt `explain_ddi_v1.md` từ demo repo vào thư mục `prompts/`.
- **Lệnh kiểm thử:**
  ```bash
  pytest backend/tests/unit/test_m3_enums_and_prompts.py -v
  ```

##### Task 1.2: Chuyển giao và chuẩn hóa Guardrails & LCEL Generation
- **Files thao tác:**
  - Chuyển giao: `backend/app/modules/ai_assistant/rag/guards/text_utils.py`
  - Chuyển giao: `backend/app/modules/ai_assistant/rag/guards/messages.py`
  - Chuyển giao: `backend/app/modules/ai_assistant/rag/guards/input_guard.py`
  - Chuyển giao: `backend/app/modules/ai_assistant/rag/guards/output_guard.py`
  - Chuyển giao: `backend/app/modules/ai_assistant/rag/generation/lcel_chain.py`
  - Cập nhật: `backend/app/modules/ai_assistant/schemas/llm_output.py`
  - Cập nhật: `backend/app/modules/ai_assistant/domain.py`
  - Cập nhật: `backend/app/modules/ai_assistant/config.py`
- **Nội dung thực hiện:**
  - Chuẩn hóa toàn bộ import sang đường dẫn chuẩn của backend (`from app.shared.enums import ...`).
  - Đảm bảo `InputGuardrail`: regex hai tầng (`fold()` bỏ dấu NFD và `lower_nfc()` giữ dấu) bắt chính xác cấp cứu 115, tự hại, prompt injection, tự ý đổi liều/ngưng thuốc (`MED_CHANGE`), và câu hỏi ngoài phạm vi y tế.
  - Đảm bảo `OutputGuard`: lọc bỏ citation ma `[n]` không có trong retrieved evidence; chặn toàn bộ các câu khẳng định an toàn ("hoàn toàn an toàn", "không có tương tác nào") $\rightarrow$ kích hoạt template fallback M2.
  - Thống nhất cấu trúc `LLMGeneratedAnswer` (`content: str`, `answer_status: AnswerStatus`, `warning_level: WarningLevel`, `cited_ids: list[int]`, `suggested_followups: list[str]`).

##### Task 1.3: Chuyển giao bộ Unit Tests Milestone 1 và chạy kiểm chứng an toàn y tế
- **Files thao tác:**
  - Tạo mới: `backend/tests/unit/test_emergency_guard.py` (từ `tests/test_input_guard.py`)
  - Tạo mới: `backend/tests/unit/test_output_guard.py` (từ `tests/test_output_guard.py`)
  - Tạo mới: `backend/tests/unit/test_generation_engine.py` (từ `tests/test_generation_engine.py`)
  - Tạo dữ liệu test: `backend/sandbox/vt4_ai_lab/sample_emergency_cases.json` (20 ca cấp cứu mẫu)
- **Nội dung thực hiện:**
  - Viết 20 ca kiểm thử cấp cứu mẫu (có dấu, không dấu, thán từ cứu trợ, viết tắt).
  - Đo thời gian xử lý của Lớp 1 Input Guardrail: Bắt buộc $t < 20.0\text{ms}$.
  - Kiểm thử Lớp 3 Output Guardrail chặn đứng các câu khẳng định an toàn và tự bịa trích dẫn.
- **Lệnh kiểm thử:**
  ```bash
  pytest backend/tests/unit/test_emergency_guard.py backend/tests/unit/test_output_guard.py backend/tests/unit/test_generation_engine.py -v
  ```

#### 2. Thông tin bàn giao cho Minh Trí:
* Interface Lớp 1: `InputGuardrail().evaluate(content: str) -> GuardDecision`
* Interface Lớp 2: `LcelGenerationEngine` hỗ trợ generate "chat" và "explain" với fallback một chiều.
* Interface Lớp 3: `OutputGuard().validate(answer, evidence, interaction) -> GuardedAnswer`
* Schema: `LLMGeneratedAnswer` và `LLMExplainAnswer`.

---

### MILESTONE 2: HYBRID SEARCH RRF & CONTEXT INTEGRATION
> **Trạng thái:** Minh Trí chủ trì thực hiện trực tiếp  
> **Mục tiêu:** Minh Trí tích hợp Hybrid Search SQL RRF $k=60$, BGE Reranker client, Personal Context M1 và Rule Engine M2. Phong tiếp nhận bàn giao và đối soát chuyên môn AI.

#### 1. Ghi chú tiếp nhận từ Minh Trí:
Minh Trí thực hiện nâng cấp pipeline truy xuất từ Dense thuần túy sang Hybrid Search RRF kết hợp pgvector HNSW và Trigram Lexical, tích hợp BGE Reranker qua Ngrok tunnel, nạp ngữ cảnh cá nhân từ M1 (lọc bỏ PII) và kết nối Rule Engine M2.

* **Các file repo Minh Trí thay đổi/tạo mới:**
  - `backend/app/modules/ai_assistant/rag/retrieval.py`
  - `backend/app/modules/ai_assistant/rag/reranking/bge_client.py`
  - `backend/app/modules/ai_assistant/repositories/knowledge_repo.py`
  - `backend/app/modules/ai_assistant/services/personal_context.py`
  - `backend/app/modules/ai_assistant/services/interaction_support.py`
  - `backend/app/modules/ai_assistant/services/drug_mentions.py`
  - `backend/app/modules/ai_assistant/services/explain_service.py`
  - `backend/sandbox/vt4_ai_lab/m3_gpu_server_colab.ipynb`
  - `backend/tests/unit/test_personal_context.py`
  - `backend/tests/unit/test_hybrid_retrieval.py`

#### 2. Checklist kiểm tra đối soát dành cho Phong:
- [ ] **Kiểm tra thuật toán RRF:** Xác nhận công thức điểm kết hợp $RRF\_Score = \sum \frac{1}{k + rank}$ với $k = 60$ trong file `knowledge_repo.py` khớp với thiết kế §5.1.
- [ ] **Kiểm tra Circuit Breaker của BGE Reranker:** Xác nhận khi Ngrok tunnel timeout (3.0s) hoặc offline, hệ thống tự động fallback lấy Top-K từ RRF mà không làm sập luồng chat.
- [ ] **Đối soát ngưỡng Reranker (`min_rerank_score`):** Chạy kiểm thử trên tập tài liệu mẫu để đánh giá ngưỡng lọc 0.35 đã tối ưu hay cần điều chỉnh.
- [ ] **Kiểm tra cấu trúc Prompt Ngữ Cảnh:** Đối soát khối `<personal_health_context>` và `<drug_interaction_result>` sinh ra từ service của Trí có đúng chuẩn XML template mà `system_v2.md` yêu cầu hay không.
- [ ] **Chạy kiểm thử xác nhận:**
  ```bash
  pytest backend/tests/unit/test_hybrid_retrieval.py backend/tests/unit/test_personal_context.py -v
  ```

---

### MILESTONE 3: RAG GOLDEN QA DATASET & BENCHMARK ĐÁNH GIÁ
> **Trạng thái:** Phong chủ trì thực hiện trực tiếp  
> **Mục tiêu:** Xây dựng tập dữ liệu kiểm thử vàng (50 Golden QA Pairs y tế) và thiết lập kịch bản đánh giá Benchmark RAG tự động bằng Ragas.

#### 1. Các nhiệm vụ Phong trực tiếp thực hiện:

##### Task 3.1: Biên tập bộ dữ liệu 50 Golden QA Pairs y tế tiếng Việt
- **Files thao tác:**
  - Tạo mới: `backend/sandbox/vt4_ai_lab/golden_qa_50.json`
- **Nội dung thực hiện:**
  - Xây dựng 50 cặp câu hỏi - câu trả lời chuẩn (Ground Truth) chia đều cho 4 kịch bản lâm sàng:
    1. **20 ca câu hỏi có bằng chứng:** Hỏi về liều lượng, chỉ định, cách dùng các thuốc phổ biến từ MedlinePlus (kỳ vọng: `ANSWERED`, trích dẫn chính xác).
    2. **10 ca ngoài cơ sở tri thức:** Hỏi các bệnh hiếm, thông tin chưa kiểm chứng (kỳ vọng: bắt buộc trả `INSUFFICIENT_EVIDENCE`).
    3. **10 ca tương tác thuốc nguy hiểm:** Cặp thuốc có tương tác nghiêm trọng từ Rule Engine M2 (kỳ vọng: cảnh báo mức `CRITICAL`/`WARNING`, không có từ ngữ khẳng định an toàn).
    4. **10 ca cấp cứu khẩn cấp:** Đau ngực, đột quỵ, khó thở, ngộ độc (kỳ vọng: `EMERGENCY_REDIRECT`, $t < 20.0\text{ms}$).

##### Task 3.2: Viết script đánh giá tự động bằng thư viện Ragas
- **Files thao tác:**
  - Tạo mới: `backend/sandbox/vt4_ai_lab/benchmark_ragas.py`
  - Output báo cáo: `backend/sandbox/vt4_ai_lab/reports/benchmark_report_ms3.json`
- **Nội dung thực hiện:**
  - Tích hợp framework Ragas đo lường 4 chỉ số chất lượng:
    - **Faithfulness (Độ trung thực):** Đo lường tỷ lệ các khẳng định trong câu trả lời có nguồn gốc từ tài liệu trích xuất (Mục tiêu: $\ge 0.90$).
    - **Answer Relevance (Độ phù hợp):** Đo lường mức độ bám sát câu hỏi người dùng (Mục tiêu: $\ge 0.85$).
    - **Context Precision (Độ chính xác của ngữ cảnh):** Đo lường chất lượng xếp hạng của Reranker (Mục tiêu: $\ge 0.85$).
    - **Abstention Accuracy (Độ chính xác khi từ chối):** Tỷ lệ từ chối đúng khi thiếu bằng chứng hoặc ca cấp cứu (Mục tiêu: $100\%$).
- **Lệnh chạy benchmark:**
  ```bash
  python backend/sandbox/vt4_ai_lab/benchmark_ragas.py --input backend/sandbox/vt4_ai_lab/golden_qa_50.json --output backend/sandbox/vt4_ai_lab/reports/benchmark_report_ms3.json
  ```

#### 2. Thông tin bàn giao cho Minh Trí:
* File dữ liệu test chuẩn: `backend/sandbox/vt4_ai_lab/golden_qa_50.json`.
* Báo cáo chỉ số Benchmark chi tiết để Trí sử dụng làm căn cứ tối ưu hóa bộ nhớ đệm và viết báo cáo kỹ thuật.

---

### MILESTONE 4: CHAOS TESTING, LATENCY PROFILING & BẢO VỆ ĐỒ ÁN
> **Trạng thái:** Minh Trí chủ trì thực hiện trực tiếp  
> **Mục tiêu:** Minh Trí thực hiện Chaos Testing, đo lường Latency Profiling và hoàn tất tài liệu báo cáo, slide bảo vệ. Phong tiếp nhận bàn giao và đồng chủ trì bảo vệ.

#### 1. Ghi chú tiếp nhận từ Minh Trí:
Minh Trí thiết lập các kịch bản kiểm thử hỗn loạn (Chaos Test) khi hệ thống gặp sự cố hạ tầng, đo lường hồ sơ độ trễ (Latency Profiling) của toàn bộ pipeline M3 và tổng hợp báo cáo kỹ thuật hoàn chỉnh.

* **Các file repo Minh Trí thay đổi/tạo mới:**
  - `backend/tests/integration/test_chaos_and_resilience.py`
  - `backend/sandbox/vt4_ai_lab/reports/latency_profile_report.json`
  - `backend/sandbox/vt4_ai_lab/reports/M3_FINAL_EVALUATION_SUMMARY.md`

#### 2. Checklist kiểm tra đối soát dành cho Phong:
- [ ] **Kiểm tra độ trễ Lớp 1 (Sống còn):** Xác nhận kết quả profiling phân vị $p99$ của Lớp 1 Input Guardrail trên toàn bộ các ca cấp cứu vẫn duy trì nghiêm ngặt $< 20.0\text{ms}$.
- [ ] **Kiểm tra độ trễ tổng thể (End-to-End Latency):** Xác nhận phân vị $p50 < 3.0\text{s}$ và $p95 < 6.0\text{s}$ khi chạy đầy đủ cả RAG + LLM.
- [ ] **Đối soát kịch bản đứt kết nối:** Chạy test kiểm chứng:
  ```bash
  pytest backend/tests/integration/test_chaos_and_resilience.py -v
  ```
  Xác nhận: Khi tắt mock GPU tunnel Ngrok, hệ thống không văng mã lỗi 500, vẫn phục vụ người dùng bằng RRF Top-K.
- [ ] **Rà soát nội dung kỹ thuật trong Slide bảo vệ:** Kiểm tra độ chính xác của các sơ đồ khối AI, biểu đồ so sánh trước/sau khi có Guardrails và kịch bản demo trực tiếp trước Hội đồng.

---

## BẢNG TỔNG HỢP CHECKLIST NGHIỆM THU DÀNH CHO PHONG

- [ ] **Milestone 1:** Hoàn tất Enums, Prompts loader, Lớp 1 & Lớp 3 Guardrails, LCEL Chain; 100% test an toàn PASS; cấp cứu $t < 20.0\text{ms}$; lọc sạch citation ma.
- [ ] **Milestone 2:** Đối soát đạt chuẩn thuật toán RRF $k=60$; kiểm tra circuit breaker BGE Reranker chạy ổn định khi mất kết nối.
- [ ] **Milestone 3:** Hoàn tất 50 Golden QA Pairs; chạy benchmark Ragas đạt Faithfulness $\ge 0.90$ và Abstention Accuracy = 100%.
- [ ] **Milestone 4:** Đối soát latency $p99 < 20\text{ms}$ cho cấp cứu; nghiệm thu thành công toàn bộ kịch bản Chaos Test và sẵn sàng bảo vệ đồ án.

