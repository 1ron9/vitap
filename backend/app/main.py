from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uuid import uuid4
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import engine
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
app.include_router(m0_auth.guest_router, prefix="/api/v1", tags=["F1/E0 - Phiên Guest"])
app.include_router(m3_chatbot.router, prefix="/api/v1/chatbot", tags=["F3/E3 - Trợ lý Sức khỏe AI"])
app.include_router(m4_ddi.router, prefix="/api/v1/ddi", tags=["F2/E2 - Tương tác thuốc"])


@app.exception_handler(m0_auth.AuthError)
def auth_error_handler(request, exc: m0_auth.AuthError):
    return JSONResponse(status_code=exc.status_code, content={"error": {
        "code": exc.code, "message": exc.message, "details": [], "request_id": str(uuid4())
    }})

@app.get("/")
def read_root():
    return {"status": "success", "message": "MediCare API is running healthy!"}


@app.get("/health", tags=["Infrastructure"])
def health():
    """Liveness độc lập với database."""
    return {"status": "ok"}


@app.get("/ready", tags=["Infrastructure"], responses={503: {"description": "Database hoặc pgvector chưa sẵn sàng"}})
def readiness():
    """Kiểm tra PostgreSQL thật và extension; không trả chi tiết lỗi kết nối."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            vector_available = (
                connection.dialect.name == "postgresql"
                and connection.execute(
                    text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')")
                ).scalar_one()
            )
            if not vector_available:
                return JSONResponse(status_code=503, content={
                    "status": "not_ready", "database": "ok", "pgvector": "unavailable"
                })
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={
            "status": "not_ready", "database": "unavailable", "pgvector": "unknown"
        })
    return {"status": "ok", "database": "ok", "pgvector": "ok"}
