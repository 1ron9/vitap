from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uuid import uuid4
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import engine
from app.modules.auth import router as m0_auth
from app.modules.medication.router import router as medication_router
from app.core.config import settings
from app.shared.errors import install_error_handlers

app = FastAPI(
    title="VitaP API",
    description="Sổ Tay Y Tế Cá Nhân Hóa, Tra Cứu Tương Tác Thuốc & Trợ Lý Sức Khỏe Thông Minh",
    version="1.0.0"
)

# Cấu hình CORS để Frontend React gọi được API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gắn các Routers phân hệ VitaP
app.include_router(m0_auth.router, prefix="/api/v1/auth", tags=["F1/E0 - Tài khoản & Hồ sơ"])
app.include_router(m0_auth.guest_router, prefix="/api/v1", tags=["F1/E0 - Phiên Guest"])
app.include_router(medication_router, prefix="/api/v1", tags=["F2/M2 - Số hóa Đơn thuốc & Dược phẩm"])


install_error_handlers(app)

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
