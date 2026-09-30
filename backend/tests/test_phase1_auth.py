"""
Phase 1 regression tests — authentication.

These re-verify that register/login/me still behave correctly after the
Phase 2 (conversations) and EVARA-rename changes. Run against a mocked
MongoDB (see conftest.py), not real Atlas.
"""

import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_register_success(client):
    resp = await client.post(
        "/api/auth/register",
        json={"name": "New User", "email": "new-user@example.com", "password": "SecurePass123"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "new-user@example.com"
    assert "password_hash" not in data["user"]
    assert "password" not in data["user"]


async def test_register_duplicate_email_rejected(client):
    payload = {"name": "Dup", "email": "dup@example.com", "password": "SecurePass123"}
    first = await client.post("/api/auth/register", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/auth/register", json=payload)
    assert second.status_code == 409


async def test_login_success(client):
    await client.post(
        "/api/auth/register",
        json={"name": "Login User", "email": "login-user@example.com", "password": "SecurePass123"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "login-user@example.com", "password": "SecurePass123"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_login_wrong_password_rejected(client):
    await client.post(
        "/api/auth/register",
        json={"name": "Wrong Pass", "email": "wrongpass@example.com", "password": "SecurePass123"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "wrongpass@example.com", "password": "IncorrectPassword"},
    )
    assert resp.status_code == 401


async def test_login_nonexistent_user_rejected(client):
    resp = await client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "SecurePass123"},
    )
    assert resp.status_code == 401


async def test_me_requires_authentication(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_me_with_valid_token_via_fixture(user_a):
    """Sanity check that the user_a fixture itself produces a usable token."""
    token, user = user_a
    assert token
    assert user["email"] == "user-a@example.com"


async def test_me_returns_current_user(client):
    reg = await client.post(
        "/api/auth/register",
        json={"name": "Me User", "email": "me-user@example.com", "password": "SecurePass123"},
    )
    token = reg.json()["access_token"]

    resp = await client.get("/api/auth/me", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me-user@example.com"
    assert data["name"] == "Me User"
    assert "id" in data
    assert "created_at" in data


async def test_me_with_garbage_token_rejected(client):
    resp = await client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


async def test_me_uses_http_bearer_not_oauth2_form(client):
    """
    Confirms the Swagger-auth fix: the security scheme is HTTPBearer
    (a single token field), not OAuth2PasswordBearer (username/password/
    client_id/client_secret form).
    """
    schema = client._transport.app.openapi()
    security_schemes = schema["components"]["securitySchemes"]
    assert "HTTPBearer" in security_schemes
    assert security_schemes["HTTPBearer"]["type"] == "http"
    assert security_schemes["HTTPBearer"]["scheme"] == "bearer"
    assert "OAuth2" not in str(security_schemes)
