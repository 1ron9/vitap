import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db

@pytest.fixture(scope="function")
def db_session():
    """Mỗi test dùng database riêng để endpoint được commit thật mà không rò dữ liệu."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = Session(engine)
    yield session
    session.close()
    engine.dispose()

@pytest.fixture(scope="function")
def client(db_session):
    """TestClient dùng chung, override dependency get_db để trỏ vào test database."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
