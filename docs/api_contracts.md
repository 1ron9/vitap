# 📜 HỢP ĐỒNG GIAO TIẾP DỮ LIỆU & ĐẶC TẢ API (API & DATA CONTRACTS)

> **Dự án:** VitaP - Sổ Tay Y Tế Cá Nhân Hóa & Tra Cứu Dược Phẩm Thông Minh (FIT - HCMUS)  
> **Kiến trúc 3 Phân hệ:**  
> - **F1: Hồ sơ & Chỉ số** (Tài khoản, Hồ sơ bệnh nền, Sổ tay nhật ký sinh hiệu & Biểu đồ xu hướng)  
> - **F2: Tra cứu Dược phẩm** (Động cơ kiểm tra tương tác thuốc DDI / Chống chỉ định DCI + Cổng nhập liệu OCR đơn thuốc)  
> - **F3: Trợ lý Hỏi đáp AI** (Chatbot RAG y tế)  
> **Mục tiêu:** Bản hợp đồng kỹ thuật chuẩn hóa (Contract-First) quy định chi tiết cấu trúc Request/Response giữa **Frontend (React)** và **Backend (FastAPI)**, giúp các thành viên phát triển song song độc lập mà không bị lệch pha dữ liệu.

---

## 🌐 Quy Chuẩn Chung (Global Conventions)

* **Base URL:** `http://localhost:8000/api/v1` (hoặc domain production khi deploy).
* **Định dạng dữ liệu:** `application/json` (trừ endpoint upload ảnh OCR dùng `multipart/form-data`).
* **Cơ chế xác thực (Authentication):**
  - Sử dụng chuẩn **HTTP Bearer Token** trong Header:
    ```http
    Authorization: Bearer <access_token>
    ```
* **Cấu trúc mã lỗi chuẩn (Standard Error Envelope):**
  ```json
  {
    "detail": "Thông báo lỗi chi tiết, dễ hiểu bằng tiếng Việt"
  }
  ```

---

## 📑 MỤC LỤC CÁC API ENDPOINTS

1. **[Phân hệ F1: Hồ sơ & Sổ tay Chỉ số Sinh hiệu](#1-phân-hệ-f1-hồ-sơ--sổ-tay-chỉ-số-sinh-hiệu)**
   - `POST /api/v1/auth/register` (Đăng ký tài khoản)
   - `POST /api/v1/auth/login` (Đăng nhập lấy Token)
   - `GET /api/v1/auth/me` (Lấy thông tin cá nhân & hồ sơ)
   - `PUT /api/v1/auth/me/profile` (Cập nhật bệnh nền & dị ứng)
   - `POST /api/v1/health-logs` (Ghi nhận mốc đo: Huyết áp, Cân nặng, Đường huyết)
   - `GET /api/v1/health-logs/history` (Lấy dữ liệu chuỗi thời gian để vẽ biểu đồ Line Chart)
   - `DELETE /api/v1/health-logs/{id}` (Xóa bản ghi đo)
2. **[Phân hệ F2: Tra cứu Dược phẩm & DDI Engine](#2-phân-hệ-f2-tra-cứu-dược-phẩm--ddi-engine)**
   - `GET /api/v1/drugs/search` (Tìm kiếm biệt dược gợi ý Autocomplete)
   - `POST /api/v1/drugs/check-interactions` (Kiểm tra tương tác DDI/DCI phân cấp Đỏ/Vàng/Xanh)
   - `POST /api/v1/ocr/process-prescription` (Cổng nhập liệu thông minh: OCR trích xuất đơn thuốc $\rightarrow$ đổ vào F2)
3. **[Phân hệ F3: Trợ lý Hỏi đáp AI](#3-phân-hệ-f3-trợ-lý-hỏi-đáp-ai)**
   - `POST /api/v1/chatbot/chat-stream` (Hỏi đáp y tế SSE Streaming thời gian thực)
   - `GET /api/v1/chatbot/history` (Lịch sử hội thoại)

---

## 1. Phân hệ F1: Hồ sơ & Sổ tay Chỉ số Sinh hiệu

### 1.1. Đăng ký tài khoản mới
* **Endpoint:** `POST /api/v1/auth/register`
* **Xác thực:** Không yêu cầu (Public).

#### Request Body:
```json
{
  "phone": "0912345678",
  "password": "Password123@",
  "full_name": "Nguyễn Văn An"
}
```

#### Response (`201 Created`):
```json
{
  "id": 1,
  "phone": "0912345678",
  "full_name": "Nguyễn Văn An",
  "created_at": "2026-11-03T10:00:00Z"
}
```

---

### 1.2. Đăng nhập hệ thống (Lấy JWT Access Token)
* **Endpoint:** `POST /api/v1/auth/login`
* **Xác thực:** Không yêu cầu (Public).

#### Request Body:
```json
{
  "phone": "0912345678",
  "password": "Password123@"
}
```

#### Response (`200 OK`):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "phone": "0912345678",
    "full_name": "Nguyễn Văn An"
  }
}
```

---

### 1.3. Lấy thông tin cá nhân & Hồ sơ bệnh nền
* **Endpoint:** `GET /api/v1/auth/me`
* **Xác thực:** Yêu cầu Bearer Token.

#### Response (`200 OK`):
```json
{
  "id": 1,
  "phone": "0912345678",
  "full_name": "Nguyễn Văn An",
  "profile": {
    "yob": 1968,
    "gender": "MALE",
    "medical_conditions": ["I10", "E11"],
    "drug_allergies": ["Aspirin", "Penicillin"]
  }
}
```

---

### 1.4. Cập nhật hồ sơ bệnh nền & Tiền sử dị ứng
* **Endpoint:** `PUT /api/v1/auth/me/profile`
* **Xác thực:** Yêu cầu Bearer Token.

#### Request Body:
```json
{
  "yob": 1968,
  "gender": "MALE",
  "medical_conditions": ["I10", "K25"],
  "drug_allergies": ["Aspirin"]
}
```

#### Response (`200 OK`):
```json
{
  "message": "Cập nhật hồ sơ sức khỏe thành công",
  "profile": {
    "yob": 1968,
    "gender": "MALE",
    "medical_conditions": ["I10", "K25"],
    "drug_allergies": ["Aspirin"],
    "updated_at": "2026-11-03T10:05:00Z"
  }
}
```

---

### 1.5. Ghi nhận mốc đo Chỉ số Sinh hiệu (Huyết áp, Cân nặng, Đường huyết)
* **Endpoint:** `POST /api/v1/health-logs`
* **Xác thực:** Yêu cầu Bearer Token.
* **Người phụ trách:** VT2 (Nguyễn Bảo Trọng)

#### Request Body:
```json
{
  "recorded_at": "2026-11-03T08:30:00Z",
  "systolic_bp": 125,
  "diastolic_bp": 82,
  "heart_rate": 74,
  "weight": 66.2,
  "blood_sugar": 108.5,
  "notes": "Đo buổi sáng trước khi ăn"
}
```

#### Response (`201 Created`):
```json
{
  "id": 101,
  "user_id": 1,
  "recorded_at": "2026-11-03T08:30:00Z",
  "systolic_bp": 125,
  "diastolic_bp": 82,
  "heart_rate": 74,
  "weight": 66.2,
  "blood_sugar": 108.5,
  "notes": "Đo buổi sáng trước khi ăn"
}
```

---

### 1.6. Lấy dữ liệu chuỗi thời gian để vẽ Biểu đồ Xu hướng (Line Charts)
* **Endpoint:** `GET /api/v1/health-logs/history`
* **Xác thực:** Yêu cầu Bearer Token.
* **Query Parameters:**
  - `days`: Số ngày cần lấy dữ liệu (mặc định: `7`, tùy chọn: `14`, `30`, `90`).
  - `metric`: Lọc chỉ số cần vẽ: `all` (mặc định), `blood_pressure`, `weight`, `blood_sugar`.

#### Response (`200 OK`):
```json
{
  "time_range_days": 7,
  "summary": {
    "avg_systolic": 123.5,
    "avg_diastolic": 81.0,
    "latest_weight": 66.2,
    "status": "Huyết áp trong giới hạn bình thường"
  },
  "series": [
    {
      "id": 98,
      "date": "2026-10-28",
      "recorded_at": "2026-10-28T07:15:00Z",
      "systolic_bp": 120,
      "diastolic_bp": 80,
      "heart_rate": 72,
      "weight": 66.5,
      "blood_sugar": 102.0
    },
    {
      "id": 99,
      "date": "2026-10-29",
      "recorded_at": "2026-10-29T08:00:00Z",
      "systolic_bp": 124,
      "diastolic_bp": 82,
      "heart_rate": 75,
      "weight": 66.4,
      "blood_sugar": 105.0
    },
    {
      "id": 101,
      "date": "2026-11-03",
      "recorded_at": "2026-11-03T08:30:00Z",
      "systolic_bp": 125,
      "diastolic_bp": 82,
      "heart_rate": 74,
      "weight": 66.2,
      "blood_sugar": 108.5
    }
  ]
}
```

---

### 1.7. Xóa một bản ghi đo
* **Endpoint:** `DELETE /api/v1/health-logs/{id}`
* **Xác thực:** Yêu cầu Bearer Token.

#### Response (`200 OK`):
```json
{
  "message": "Đã xóa bản ghi đo thành công",
  "deleted_id": 101
}
```

---

## 2. Phân hệ F2: Tra cứu Dược phẩm & DDI Engine

### 2.1. Tìm kiếm biệt dược gợi ý (Autocomplete Search)
* **Endpoint:** `GET /api/v1/drugs/search`
* **Xác thực:** Không yêu cầu.
* **Query Parameters:** `q=pana` (Tối thiểu 2 ký tự).

#### Response (`200 OK`):
```json
[
  {
    "id": 1,
    "brand_name": "Panadol Extra",
    "manufacturer": "GSK",
    "dosage_form": "Viên nén",
    "ingredients": [
      {
        "inn_name": "Paracetamol",
        "strength": "500mg"
      },
      {
        "inn_name": "Caffeine",
        "strength": "65mg"
      }
    ]
  }
]
```

---

### 2.2. Kiểm tra tương tác thuốc (DDI Engine) & Chống chỉ định bệnh nền (DCI)
* **Endpoint:** `POST /api/v1/drugs/check-interactions`
* **Xác thực:** Tùy chọn (Nếu có Bearer Token sẽ tự động lấy bệnh nền/dị ứng của User để kiểm tra DCI).
* **Người phụ trách:** VT3 (Dương Phan Minh Trí)

#### Request Body:
```json
{
  "drug_ids": [1, 5],
  "custom_conditions": ["I10", "K25"]
}
```

#### Response (`200 OK`):
```json
{
  "overall_risk": "RED",
  "total_interactions_found": 1,
  "total_contraindications_found": 1,
  "drug_drug_interactions": [
    {
      "ingredient_a": "Aspirin",
      "ingredient_b": "Warfarin",
      "severity": "RED",
      "mechanism": "Aspirin ức chế kết tập tiểu cầu và gây tổn thương niêm mạc dạ dày, kết hợp với Warfarin làm tăng nguy cơ xuất huyết tiêu hóa nghiêm trọng.",
      "clinical_management": "Chống chỉ định phối hợp trừ khi có chỉ định nghiêm ngặt từ bác sĩ tim mạch. Cần theo dõi chỉ số INR và phát hiện sớm dấu hiệu xuất huyết."
    }
  ],
  "disease_contraindications": [
    {
      "ingredient": "Aspirin",
      "condition_name": "Loét dạ dày tá tràng",
      "icd10_code": "K25",
      "severity": "RED",
      "contraindication_type": "ABSOLUTE",
      "clinical_advice": "Aspirin gây tổn thương trực tiếp niêm mạc dạ dày, chống chỉ định tuyệt đối cho bệnh nhân đang có ổ loét tiến triển."
    }
  ]
}
```

---

### 2.3. Cổng nhập liệu thông minh: OCR Đơn thuốc (Smart Input cho F2)
* **Endpoint:** `POST /api/v1/ocr/process-prescription`
* **Content-Type:** `multipart/form-data`
* **Người phụ trách:** VT3 (Dương Phan Minh Trí - Vision) & VT1 (Trương Huệ Trí - Fuzzy Match)

#### Request Form Data:
* `file`: File ảnh đơn thuốc (`image/jpeg`, `image/png`, dung lượng $\le 5\text{MB}$).

#### Response (`200 OK`):
```json
{
  "raw_extracted_text": "1. Panadol 500mg: 1v x 2 lan\n2. Aspirin 81mg: 1v sang",
  "extracted_drugs": [
    {
      "raw_name": "Panadol 500mg",
      "dosage": "1 viên x 2 lần/ngày",
      "matched_drug": {
        "id": 1,
        "brand_name": "Panadol Extra",
        "confidence_score": 0.95
      }
    },
    {
      "raw_name": "Aspirin 81mg",
      "dosage": "1 viên buổi sáng",
      "matched_drug": {
        "id": 5,
        "brand_name": "Aspirin 81mg PH8",
        "confidence_score": 0.92
      }
    }
  ]
}
```
*(Dữ liệu `extracted_drugs` này được Frontend tự động chuyển tiếp làm đầu vào cho màn hình F2 để kiểm tra tương tác tức thì)*

---

## 3. Phân hệ F3: Trợ lý Hỏi đáp AI (Chatbot RAG)

### 3.1. Hỏi đáp y tế thời gian thực (SSE Streaming)
* **Endpoint:** `POST /api/v1/chatbot/chat-stream`
* **Xác thực:** Yêu cầu Bearer Token (để tự động tiêm bệnh nền của User vào System Prompt).
* **Content-Type:** `text/event-stream`
* **Người phụ trách:** VT4 (Lê Thanh Phong)

#### Request Body:
```json
{
  "message": "Tôi bị cao huyết áp thì có uống được nước bưởi khi dùng thuốc Amlodipine không?",
  "session_id": "uuid-v4-session"
}
```

#### SSE Stream Events:
```http
event: token
data: {"text": "Chào"}

event: token
data: {"text": " bạn,"}

event: token
data: {"text": " khi đang uống Amlodipine điều trị tăng huyết áp, bạn KHÔNG NÊN uống nước bưởi chùm vì làm tăng nồng độ thuốc trong máu..."}

event: citation
data: {"source": "Dược thư Quốc gia Việt Nam", "section": "Tương tác thuốc - thực phẩm"}

event: done
data: {"disclaimer": "Thông tin chỉ mang tính tham khảo y khoa, vui lòng tham vấn bác sĩ điều trị trước khi thay đổi chế độ sinh hoạt."}
```
