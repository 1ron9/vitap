from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import m0_auth, m3_chatbot, m4_ddi

app = FastAPI(
    title="VitaP API",
    description="Sổ Tay Y Tế Cá Nhân Hóa, Tra Cứu Tương Tác Thuốc & Trợ Lý Sức Khỏe Thông Minh",
    version="1.0.0"
)

# Cấu hình CORS để Frontend React gọi được API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gắn các Routers phân hệ VitaP
app.include_router(m0_auth.router, prefix="/api/v1/auth", tags=["F1/E0 - Tài khoản & Hồ sơ"])
app.include_router(m3_chatbot.router, prefix="/api/v1/chatbot", tags=["F3/E3 - Trợ lý Sức khỏe AI"])
app.include_router(m4_ddi.router, prefix="/api/v1/ddi", tags=["F2/E2 - Tương tác thuốc"])

@app.get("/")
def read_root():
    return {"status": "success", "message": "MediCare API is running healthy!"}
