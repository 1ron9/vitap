# 📜 HỢP ĐỒNG GIAO TIẾP DỮ LIỆU & ĐẶC TẢ API (API & DATA CONTRACTS)

> **Dự án:** VitaP - Hệ thống Quản lý Dược phẩm & Trợ lý Y tế Thông minh  
> **Tác giả:** Trương Huệ Trí (`24120472`) - VT1 (PO & Data Core Lead)  
> **Mục tiêu:** Bản hợp đồng kỹ thuật chuẩn hóa (Contract-First) quy định chi tiết cấu trúc Request/Response giữa **Frontend (React)** và **Backend (FastAPI)**, giúp các thành viên phát triển song song độc lập mà không bị lệch pha dữ liệu.

---

## 🌐 Quy Chuẩn Chung (Global Conventions)

* **Base URL:** `http://localhost:8000/api/v1` (hoặc URL domain production khi deploy).
* **Định dạng dữ liệu:** `application/json` (trừ endpoint upload ảnh dùng `multipart/form-data`).
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

1. [Phân hệ Xác thực & Tài khoản (`/auth`)](#1-phân-hệ-xác-thực--tài-khoản-m0_auth)
   - `POST /api/v1/auth/register` (Đăng ký tài khoản)
   - `POST /api/v1/auth/login` (Đăng nhập lấy Token)
   - `GET /api/v1/auth/me` (Lấy thông tin cá nhân & hồ sơ)
   - `PUT /api/v1/auth/me/profile` (Cập nhật bệnh nền & dị ứng)
2. [Phân hệ Dược thư & Tra cứu Tương tác (`/drugs`)](#2-phân-hệ-dược-thư--tra-cứu-tương-tác-m4_ddi)
   - `GET /api/v1/drugs/search` (Tìm kiếm biệt dược gợi ý)
   - `POST /api/v1/drugs/check-interactions` (Kiểm tra tương tác DDI/DCI)
3. [Phân hệ Quét Đơn thuốc AI Vision (`/ocr`)](#3-phân-hệ-quét-đơn-thuốc-ai-vision-m1_ocr)
   - `POST /api/v1/ocr/process-prescription` (Trích xuất đơn thuốc & so khớp CSDL)
4. [Phân hệ Tủ thuốc Cá nhân (`/cabinets`)](#4-phân-hệ-tủ-thuốc-cá-nhân-m2_cabinet)
   - `GET /api/v1/cabinets` (Lấy danh sách thuốc trong tủ)
   - `POST /api/v1/cabinets` (Thêm thuốc mới & thiết lập cữ uống)

---

## 1. Phân hệ Xác thực & Tài khoản (`m0_auth`)

### 1.1. Đăng ký tài khoản mới
* **Endpoint:** `POST /api/v1/auth/register`
* **Xác thực:** Không yêu cầu (Public).
* **Mục đích:** Tạo tài khoản bằng số điện thoại, tự động khởi tạo hồ sơ bệnh nhân rỗng.

#### Request Body:
```json
{
  "phone": "0912345678",
  "password": "Password123@",
  "full_name": "Nguyễn Văn An"
}
```

#### Response Thành công (HTTP 201 Created):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "phone": "0912345678",
    "full_name": "Nguyễn Văn An",
    "created_at": "2026-11-02T10:00:00Z"
  }
}
```

#### Lỗi Thường Gặp:
* **HTTP 400 Bad Request:** Số điện thoại đã được đăng ký trước đó.
  ```json
  { "detail": "Số điện thoại này đã được đăng ký tài khoản." }
  ```
* **HTTP 422 Unprocessable Entity:** Thiếu trường bắt buộc hoặc password quá ngắn (< 6 ký tự).

---

### 1.2. Đăng nhập hệ thống
* **Endpoint:** `POST /api/v1/auth/login`
* **Xác thực:** Không yêu cầu (Public).
* **Mục đích:** Xác thực số điện thoại & mật khẩu, trả về Access Token có hiệu lực 24 giờ.

#### Request Body:
```json
{
  "phone": "0912345678",
  "password": "Password123@"
}
```

#### Response Thành công (HTTP 200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "phone": "0912345678",
    "full_name": "Nguyễn Văn An",
    "created_at": "2026-11-02T10:00:00Z"
  }
}
```

#### Lỗi Thường Gặp:
* **HTTP 401 Unauthorized:** Sai số điện thoại hoặc mật khẩu.
  ```json
  { "detail": "Số điện thoại hoặc mật khẩu không chính xác." }
  ```

---

### 1.3. Lấy thông tin cá nhân & Hồ sơ sức khỏe hiện tại
* **Endpoint:** `GET /api/v1/auth/me`
* **Xác thực:** Bắt buộc Bearer Token (`Header: Authorization: Bearer <token>`).
* **Mục đích:** Đồng bộ dữ liệu người dùng khi mở App hoặc F5 trang web.

#### Request Headers:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response Thành công (HTTP 200 OK):
```json
{
  "id": 1,
  "phone": "0912345678",
  "full_name": "Nguyễn Văn An",
  "profile": {
    "yob": 1985,
    "gender": "MALE",
    "medical_conditions": [
      { "code": "I10", "name": "Tăng huyết áp vô căn (nguyên phát)" },
      { "code": "K25", "name": "Loét dạ dày tá tràng / Tiền sử xuất huyết tiêu hóa" }
    ],
    "drug_allergies": ["Aspirin", "Penicillin"]
  }
}
```

---

### 1.4. Cập nhật Hồ sơ Bệnh nền & Tiền sử Dị ứng
* **Endpoint:** `PUT /api/v1/auth/me/profile`
* **Xác thực:** Bắt buộc Bearer Token.
* **Mục đích:** Người dùng cập nhật bệnh nền (chọn theo mã ICD-10) và nhập tên thuốc dị ứng.

#### Request Body:
```json
{
  "yob": 1985,
  "gender": "MALE",
  "medical_conditions": ["I10", "K25"],
  "drug_allergies": ["Aspirin", "Penicillin"]
}
```

#### Response Thành công (HTTP 200 OK):
```json
{
  "message": "Cập nhật hồ sơ bệnh nhân thành công.",
  "profile": {
    "yob": 1985,
    "gender": "MALE",
    "medical_conditions": ["I10", "K25"],
    "drug_allergies": ["Aspirin", "Penicillin"]
  }
}
```

---

## 2. Phân hệ Dược thư & Tra cứu Tương tác (`m4_ddi`)

### 2.1. Tìm kiếm biệt dược gợi ý (Autocomplete / Search)
* **Endpoint:** `GET /api/v1/drugs/search?q={query}`
* **Xác thực:** Không yêu cầu.
* **Mục đích:** Tìm kiếm tức thời khi người dùng gõ vào ô tìm kiếm (kết hợp so khớp chính xác và Fuzzy Match).

#### Request Params:
* `q` (string, required): Từ khóa tìm kiếm (ví dụ: `pana`, `hapa`, `amlo`).
* `limit` (int, optional, default=10): Số lượng gợi ý tối đa.

#### Response Thành công (HTTP 200 OK):
```json
[
  {
    "id": 1,
    "brand_name": "Panadol Extra",
    "manufacturer": "GSK",
    "dosage_form": "Viên nén",
    "ingredients": [
      { "inn_name": "Paracetamol", "strength": "500mg" },
      { "inn_name": "Caffeine", "strength": "65mg" }
    ]
  },
  {
    "id": 2,
    "brand_name": "Panadol Giảm Đau Hạ Sốt",
    "manufacturer": "GSK",
    "dosage_form": "Viên nén",
    "ingredients": [
      { "inn_name": "Paracetamol", "strength": "500mg" }
    ]
  }
]
```

---

### 2.2. Kiểm tra Tương tác Thuốc (DDI & DCI Engine)
* **Endpoint:** `POST /api/v1/drugs/check-interactions`
* **Xác thực:** Tùy chọn (Nếu gửi kèm Token sẽ tự động kiểm tra thêm chống chỉ định Bệnh nền DCI).
* **Mục đích:** Trả về các cảnh báo phân cấp màu Đỏ / Vàng / Xanh cho danh sách thuốc người dùng chọn.

#### Request Body:
```json
{
  "brand_ids": [12, 45]
}
```

#### Response Thành công (HTTP 200 OK):
```json
{
  "overall_severity": "RED",
  "total_alerts": 2,
  "ddi_alerts": [
    {
      "severity": "RED",
      "pair": ["Aspirin", "Warfarin"],
      "mechanism": "Hiệp đồng chống đông và ức chế kết tập tiểu cầu kết hợp tổn thương niêm mạc dạ dày gây xuất huyết nặng.",
      "clinical_management": "CHỐNG CHỈ ĐỊNH dùng đồng thời trừ phác đồ chuyên khoa tim mạch được theo dõi INR liên tục."
    }
  ],
  "dci_alerts": [
    {
      "severity": "RED",
      "ingredient": "Aspirin",
      "condition_code": "K25",
      "condition_name": "Loét dạ dày tá tràng",
      "contraindication_type": "ABSOLUTE",
      "clinical_advice": "Tuyệt đối chống chỉ định trên người có tiền sử loét hoặc đang xuất huyết dạ dày."
    }
  ],
  "duplicate_therapy_alerts": []
}
```

---

## 3. Phân hệ Quét Đơn thuốc AI Vision (`m1_ocr`)

### 3.1. Trích xuất đơn thuốc từ ảnh & So khớp CSDL
* **Endpoint:** `POST /api/v1/ocr/process-prescription`
* **Content-Type:** `multipart/form-data`
* **Xác thực:** Bắt buộc Bearer Token.
* **Mục đích:** Gửi ảnh đơn thuốc chụp từ điện thoại, AI nhận diện và tự động so khớp mờ vào CSDL để trả về Modal xem trước cho người dùng xác nhận (Human-in-the-loop).

#### Request Form Data:
* `file`: File ảnh đơn thuốc (`image/jpeg` hoặc `image/png`, kích thước < 5MB).

#### Response Thành công (HTTP 200 OK):
```json
{
  "prescription_id": "temp_ocr_98231",
  "recognized_drugs": [
    {
      "raw_ocr_name": "Panadol Extra 500",
      "matched_brand": {
        "id": 1,
        "brand_name": "Panadol Extra",
        "dosage_form": "Viên nén",
        "confidence_score": 0.96
      },
      "dosage": "1 viên",
      "frequency": "Uống 2 lần/ngày sau ăn (Sáng, Tối)",
      "quantity": 20
    },
    {
      "raw_ocr_name": "Thuoc la hoac k ro ten",
      "matched_brand": null,
      "confidence_score": 0.35,
      "dosage": "1 viên",
      "frequency": "Uống sáng",
      "quantity": 10
    }
  ]
}
```
* **Lưu ý Frontend:** Nếu `matched_brand == null` hoặc `confidence_score < 0.65`, Frontend hiển thị ô input cho người dùng tự gõ tìm kiếm thuốc thủ công trước khi lưu.

---

## 4. Phân hệ Tủ thuốc Cá nhân (`m2_cabinet`)

### 4.1. Lấy danh sách thuốc trong tủ
* **Endpoint:** `GET /api/v1/cabinets`
* **Xác thực:** Bắt buộc Bearer Token.

#### Response Thành công (HTTP 200 OK):
```json
[
  {
    "id": 101,
    "brand_name": "Panadol Extra",
    "dosage_form": "Viên nén",
    "remaining_quantity": 18,
    "total_quantity": 20,
    "schedules": [
      { "id": 1, "session": "MORNING", "time": "08:00", "dosage": 1.0, "is_active": true },
      { "id": 2, "session": "EVENING", "time": "20:00", "dosage": 1.0, "is_active": true }
    ]
  }
]
```

---

### 4.2. Thêm thuốc vào tủ & Cài đặt cữ uống
* **Endpoint:** `POST /api/v1/cabinets`
* **Xác thực:** Bắt buộc Bearer Token.

#### Request Body:
```json
{
  "brand_id": 1,
  "custom_drug_name": null,
  "total_quantity": 20,
  "schedules": [
    { "session": "MORNING", "time": "08:00", "dosage": 1.0 },
    { "session": "EVENING", "time": "20:00", "dosage": 1.0 }
  ]
}
```

#### Response Thành công (HTTP 201 Created):
```json
{
  "message": "Đã thêm thuốc vào tủ thành công.",
  "cabinet_id": 101
}
```
