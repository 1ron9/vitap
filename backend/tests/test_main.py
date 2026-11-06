def test_root_endpoint(client):
    """Kiểm tra healthcheck endpoint gốc."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "MediCare API" in data["message"]


def test_health_does_not_require_database(client, monkeypatch):
    from app import main

    def fail_if_connected():
        raise AssertionError("Liveness must not connect to the database")

    monkeypatch.setattr(main.engine, "connect", fail_if_connected)
    assert client.get("/health").json() == {"status": "ok"}


def test_readiness_database_unavailable(client, monkeypatch):
    from sqlalchemy.exc import OperationalError
    from app import main

    def unavailable():
        raise OperationalError("private database connection", {}, Exception("secret password"))

    monkeypatch.setattr(main.engine, "connect", unavailable)
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready", "database": "unavailable", "pgvector": "unknown"
    }
    assert "secret" not in response.text


def test_readiness_requires_vector_extension(client, monkeypatch):
    from unittest.mock import MagicMock
    from app import main

    engine = MagicMock()
    connection = engine.connect.return_value.__enter__.return_value
    connection.dialect.name = "postgresql"
    connection.execute.return_value.scalar_one.return_value = False
    monkeypatch.setattr(main, "engine", engine)
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["pgvector"] == "unavailable"


def test_readiness_postgres_and_vector_available(client, monkeypatch):
    from unittest.mock import MagicMock
    from app import main

    engine = MagicMock()
    connection = engine.connect.return_value.__enter__.return_value
    connection.dialect.name = "postgresql"
    connection.execute.return_value.scalar_one.return_value = True
    monkeypatch.setattr(main, "engine", engine)
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "pgvector": "ok"}


def test_readiness_does_not_treat_sqlite_as_postgres(client, monkeypatch):
    from sqlalchemy import create_engine
    from app import main

    sqlite_engine = create_engine("sqlite://")
    monkeypatch.setattr(main, "engine", sqlite_engine)
    try:
        response = client.get("/ready")
        assert response.status_code == 503
        assert response.json() == {
            "status": "not_ready", "database": "ok", "pgvector": "unavailable"
        }
    finally:
        sqlite_engine.dispose()


def test_compose_database_password_preserves_special_characters():
    from app.core.config import Settings
    from app.core.database import get_database_url

    config = Settings(_env_file=None, POSTGRES_HOST="db", POSTGRES_PASSWORD="p@ss:/?#% word")
    url = get_database_url(config)
    assert url.host == "db"
    assert url.password == "p@ss:/?#% word"
    assert url.get_backend_name() == "postgresql"


def test_database_url_remains_supported_without_compose():
    from app.core.config import Settings
    from app.core.database import get_database_url

    config = Settings(_env_file=None, POSTGRES_HOST=None, DATABASE_URL="sqlite:///:memory:")
    assert str(get_database_url(config)) == "sqlite:///:memory:"
