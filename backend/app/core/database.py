from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

def get_database_url(config=settings):
    """Compose ưu tiên thông tin riêng; URL.create xử lý ký tự đặc biệt trong mật khẩu."""
    if config.POSTGRES_HOST:
        return URL.create(
            "postgresql+psycopg2",
            username=config.POSTGRES_USER,
            password=config.POSTGRES_PASSWORD,
            host=config.POSTGRES_HOST,
            port=config.POSTGRES_PORT,
            database=config.POSTGRES_DB,
        )
    return make_url(config.DATABASE_URL)

database_url = get_database_url()
if database_url.get_backend_name() == "sqlite":
    connect_args = {"check_same_thread": False}
else:
    connect_args = {"connect_timeout": 5, "options": "-c statement_timeout=5000"}

engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency cung cấp session kết nối CSDL cho FastAPI endpoint."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
