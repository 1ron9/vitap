"""PostgreSQL connection pool and per-request sessions for M3."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_database_url

from .errors import dependency_unavailable


def build_async_database_url(database_url: str | None = None) -> URL:
    url = make_url(database_url) if database_url else get_database_url()
    return url.set(drivername="postgresql+asyncpg") if url.get_backend_name() == "postgresql" else url


@asynccontextmanager
async def ai_database_lifespan(app: FastAPI):
    url = build_async_database_url()
    app.state.ai_sessions = None
    if url.get_backend_name() != "postgresql":
        yield
        return

    engine = create_async_engine(
        url,
        pool_pre_ping=True,
        hide_parameters=True,
        connect_args={"timeout": 5, "server_settings": {"statement_timeout": "5000"}},
    )
    app.state.ai_sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        yield
    finally:
        app.state.ai_sessions = None
        await engine.dispose()


async def get_async_session(request: Request):
    factory: async_sessionmaker[AsyncSession] | None = request.app.state.ai_sessions
    if factory is None:
        raise dependency_unavailable("Trợ lý AI cần cơ sở dữ liệu PostgreSQL")
    async with factory() as session:
        yield session
