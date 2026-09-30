"""
Shared pytest configuration and fixtures for the EVARA backend test suite.

Sets safe, dummy environment variables *before* any `app.*` module is
imported, because app.core.config.Settings requires MONGODB_URI and
JWT_SECRET with no defaults — importing app.main without them would
fail immediately. None of these are real credentials.

All tests run against an in-memory MongoDB mock (mongomock_motor), never
against a real MongoDB Atlas cluster. This reuses the exact same
app.database.connection module/singleton that the real app uses (no
second database connection system is introduced for testing).
"""

import os

os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB_NAME", "evara_test")
os.environ.setdefault("JWT_SECRET", "test-only-secret-do-not-use-in-production")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("MOCK_SLM", "true")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("ENVIRONMENT", "test")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

import app.database.connection as conn_module
from app.main import app as fastapi_app


@pytest_asyncio.fixture(autouse=True)
async def mock_database():
    """
    Point the app's existing database singleton (app.database.connection.database)
    at a fresh in-memory mock for every single test, so tests never share
    state and never touch a real MongoDB instance.
    """
    conn_module.database.client = AsyncMongoMockClient()
    conn_module.database.db = conn_module.database.client["evara_test"]
    await conn_module._ensure_indexes()
    yield
    conn_module.database.client = None
    conn_module.database.db = None


@pytest_asyncio.fixture
async def client(mock_database):
    """An httpx AsyncClient wired directly to the FastAPI app (in-process, no network)."""
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def user_a(client):
    """Register and return (client, token, user_json) for a first test user."""
    resp = await client.post(
        "/api/auth/register",
        json={"name": "User A", "email": "user-a@example.com", "password": "SecurePass123"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return data["access_token"], data["user"]


@pytest_asyncio.fixture
async def user_b(client):
    """Register and return (client, token, user_json) for a second, independent test user."""
    resp = await client.post(
        "/api/auth/register",
        json={"name": "User B", "email": "user-b@example.com", "password": "SecurePass123"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return data["access_token"], data["user"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
