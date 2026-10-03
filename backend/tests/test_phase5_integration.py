"""
Phase 5 — Integration tests.

Tests the complete Phase 5 pipeline via the HTTP API:
  - Authentication required
  - Conversation ownership enforced
  - Full NLP → safety → policy → SLM (mock) → validation flow
  - Urgent safety bypass
  - Phase 1–4 regression (ensure nothing broken)

All tests use MOCK_SLM=true (already set in conftest.py) and the
mongomock in-memory database. No real model is downloaded.
"""

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB_NAME", "evara_test")
os.environ.setdefault("JWT_SECRET", "test-only-secret-do-not-use-in-production")
os.environ.setdefault("MOCK_SLM", "true")

from app.main import app


# ---------------------------------------------------------------------------
# Helpers reused from conftest
# ---------------------------------------------------------------------------

def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def register_and_login(client: AsyncClient, email: str) -> str:
    resp = await client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": email, "password": "SecurePass123"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


async def create_conversation(client: AsyncClient, token: str) -> str:
    resp = await client.post("/api/conversations", headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def send_message(client: AsyncClient, token: str, conv_id: str, content: str):
    resp = await client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": content},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def http_client(mock_database):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def authenticated_user(http_client):
    token = await register_and_login(http_client, "slm-user@example.com")
    return token


@pytest_asyncio.fixture
async def conversation_with_messages(http_client, authenticated_user):
    token = authenticated_user
    conv_id = await create_conversation(http_client, token)
    # Send one message to advance past the opening stage requirement
    await send_message(http_client, token, conv_id, "I've been feeling really stressed about exams.")
    return token, conv_id


# ---------------------------------------------------------------------------
# Authentication and ownership tests
# ---------------------------------------------------------------------------


class TestSLMAuth:
    async def test_unauthenticated_request_rejected(self, http_client, conversation_with_messages):
        token, conv_id = conversation_with_messages
        resp = await http_client.post(f"/api/slm/{conv_id}/generate")
        assert resp.status_code == 401

    async def test_authenticated_request_succeeds(self, http_client, conversation_with_messages):
        token, conv_id = conversation_with_messages
        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate",
            headers=auth_headers(token),
        )
        assert resp.status_code == 200, resp.text

    async def test_wrong_user_ownership_rejected(self, http_client, mock_database):
        token_a = await register_and_login(http_client, "owner@example.com")
        token_b = await register_and_login(http_client, "other@example.com")
        conv_id = await create_conversation(http_client, token_a)
        await send_message(http_client, token_a, conv_id, "Hello, I need help.")

        # User B tries to generate against User A's conversation
        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate",
            headers=auth_headers(token_b),
        )
        assert resp.status_code == 404  # 404 for both not-found and not-owner

    async def test_invalid_conversation_id(self, http_client, authenticated_user):
        token = authenticated_user
        resp = await http_client.post(
            "/api/slm/not-a-valid-object-id/generate",
            headers=auth_headers(token),
        )
        assert resp.status_code == 400

    async def test_nonexistent_conversation_id(self, http_client, authenticated_user):
        token = authenticated_user
        resp = await http_client.post(
            "/api/slm/000000000000000000000001/generate",
            headers=auth_headers(token),
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Response structure tests
# ---------------------------------------------------------------------------


class TestSLMResponseStructure:
    async def test_response_has_required_fields(self, http_client, conversation_with_messages):
        token, conv_id = conversation_with_messages
        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate",
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        required_keys = {
            "text", "model", "generation_config", "validated",
            "warnings", "policy_used", "safety_bypass",
            "safety_level", "conversation_stage", "mock",
        }
        assert required_keys.issubset(set(data.keys())), (
            f"Missing keys: {required_keys - set(data.keys())}"
        )

    async def test_mock_flag_is_true(self, http_client, conversation_with_messages):
        """In test environment MOCK_SLM=true, mock field must be True."""
        token, conv_id = conversation_with_messages
        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate",
            headers=auth_headers(token),
        )
        data = resp.json()
        assert data["mock"] is True

    async def test_text_is_non_empty(self, http_client, conversation_with_messages):
        token, conv_id = conversation_with_messages
        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate",
            headers=auth_headers(token),
        )
        data = resp.json()
        assert data["text"]
        assert len(data["text"]) > 5

    async def test_validated_is_true_for_mock(self, http_client, conversation_with_messages):
        token, conv_id = conversation_with_messages
        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate",
            headers=auth_headers(token),
        )
        data = resp.json()
        assert data["validated"] is True

    async def test_safety_level_field_valid(self, http_client, conversation_with_messages):
        token, conv_id = conversation_with_messages
        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate",
            headers=auth_headers(token),
        )
        data = resp.json()
        assert data["safety_level"] in ("normal", "low_concern", "elevated_concern", "urgent")


# ---------------------------------------------------------------------------
# Urgent safety bypass — policy tests
# ---------------------------------------------------------------------------


class TestUrgentSafetyBypass:
    """
    Test that when the conversation contains urgent safety language, the SLM
    mock returns the deterministic safety response, not a free-form response.

    In mock mode, the slm_service._mock_inference() function checks
    context.response_policy and returns URGENT_SAFETY_RESPONSE when urgent.
    We trigger urgent by sending a message with urgent keywords.
    """

    async def test_urgent_message_triggers_bypass(self, http_client, mock_database):
        token = await register_and_login(http_client, "urgent-user@example.com")
        conv_id = await create_conversation(http_client, token)
        # Send a message containing urgent safety language
        await send_message(http_client, token, conv_id, "I want to kill myself")

        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate",
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["safety_level"] == "urgent"
        assert data["safety_bypass"] is True
        assert data["policy_used"] == "urgent"
        # Urgent response should mention reaching out or crisis support
        text_lower = data["text"].lower()
        assert (
            "reach out" in text_lower
            or "crisis" in text_lower
            or "trusted" in text_lower
            or "emergency" in text_lower
        )


# ---------------------------------------------------------------------------
# No user message guard
# ---------------------------------------------------------------------------


class TestNoUserMessageGuard:
    async def test_no_user_message_returns_400(self, http_client, authenticated_user):
        """A brand-new conversation with no user messages returns 400."""
        token = authenticated_user
        # Create a fresh conversation (only has assistant opening message)
        resp = await http_client.post("/api/conversations", headers=auth_headers(token))
        conv_id = resp.json()["id"]

        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate",
            headers=auth_headers(token),
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Persist flag
# ---------------------------------------------------------------------------


class TestPersistFlag:
    async def test_persist_false_no_generation_id(self, http_client, conversation_with_messages):
        token, conv_id = conversation_with_messages
        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate?persist=false",
            headers=auth_headers(token),
        )
        data = resp.json()
        assert data.get("generation_id") is None or data.get("generation_id") == ""

    async def test_persist_true_returns_generation_id(self, http_client, conversation_with_messages):
        token, conv_id = conversation_with_messages
        resp = await http_client.post(
            f"/api/slm/{conv_id}/generate?persist=true",
            headers=auth_headers(token),
        )
        data = resp.json()
        assert data.get("generation_id")


# ---------------------------------------------------------------------------
# Health endpoint still reports mock_slm
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    async def test_health_endpoint_reports_mock_slm(self, http_client):
        resp = await http_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "mock_slm" in data
        assert data["mock_slm"] is True


# ---------------------------------------------------------------------------
# Phase 1–4 regression: key endpoints still work
# ---------------------------------------------------------------------------


class TestPhase1to4Regression:
    async def test_register_still_works(self, http_client):
        resp = await http_client.post(
            "/api/auth/register",
            json={"name": "Regression User", "email": "regression@example.com", "password": "Password123"},
        )
        assert resp.status_code == 201

    async def test_conversations_still_accessible(self, http_client, authenticated_user):
        token = authenticated_user
        resp = await http_client.get("/api/conversations", headers=auth_headers(token))
        assert resp.status_code == 200

    async def test_message_endpoint_still_works(self, http_client, conversation_with_messages):
        token, conv_id = conversation_with_messages
        resp = await http_client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"content": "This is a regression test message."},
            headers=auth_headers(token),
        )
        assert resp.status_code == 200

    async def test_dashboard_still_accessible(self, http_client, authenticated_user):
        token = authenticated_user
        resp = await http_client.get("/api/dashboard", headers=auth_headers(token))
        assert resp.status_code == 200

    async def test_progress_still_accessible(self, http_client, authenticated_user):
        token = authenticated_user
        resp = await http_client.get("/api/progress", headers=auth_headers(token))
        assert resp.status_code == 200

    async def test_planner_create_still_works(self, http_client, authenticated_user):
        token = authenticated_user
        resp = await http_client.post(
            "/api/planner",
            json={"action": "Review my study schedule for the week."},
            headers=auth_headers(token),
        )
        assert resp.status_code == 201

    async def test_openapi_schema_has_slm_endpoint(self, http_client):
        """OpenAPI schema includes the Phase 5 SLM endpoint."""
        resp = await http_client.get("/openapi.json")
        assert resp.status_code == 200
        schema = resp.json()
        paths = schema.get("paths", {})
        slm_path = "/api/slm/{conversation_id}/generate"
        assert slm_path in paths, f"SLM path not in OpenAPI schema. Paths: {list(paths.keys())}"

    async def test_api_version_is_phase5(self, http_client):
        """API version string reflects Phase 5."""
        resp = await http_client.get("/openapi.json")
        info = resp.json().get("info", {})
        assert "phase5" in info.get("version", "").lower() or "0.5" in info.get("version", "")
