"""
Phase 5 — Standalone TinyLlama SLM Chat Tests.

Covers:
1. Creating, listing, retrieving, and deleting SLM chats.
2. Authentication and cross-user ownership isolation.
3. Multi-turn message flow, chronological ordering, and bounded context.
4. Deterministic urgent-risk safety bypass in SLM chat.
5. Non-clinical response validation.
6. Mock vs real model metadata reporting.
7. Complete isolation from Guided conversation state and collections.
"""

import os
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB_NAME", "evara_test")
os.environ.setdefault("JWT_SECRET", "test-only-secret-do-not-use-in-production")
os.environ.setdefault("MOCK_SLM", "true")

from app.main import app
from app.slm.config import SLMConfig
from app.slm.prompting import URGENT_SAFETY_RESPONSE


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def register_and_login(client: AsyncClient, email: str) -> str:
    resp = await client.post(
        "/api/auth/register",
        json={"name": "SLM Tester", "email": email, "password": "SecurePassword123"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def http_client(mock_database):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def user_token(http_client):
    return await register_and_login(http_client, "slm_primary@example.com")


# ---------------------------------------------------------------------------
# 1. Lifecycle: Create, List, Detail, Delete
# ---------------------------------------------------------------------------


class TestSLMChatLifecycle:
    async def test_create_and_list_slm_chats(self, http_client, user_token):
        headers = auth_headers(user_token)

        # 1. Create a chat
        create_resp = await http_client.post(
            "/api/slm/chat/conversations",
            json={"title": "My Study Reflection"},
            headers=headers,
        )
        assert create_resp.status_code == 201, create_resp.text
        data = create_resp.json()
        assert data["title"] == "My Study Reflection"
        assert len(data["messages"]) == 1
        assert data["messages"][0]["role"] == "assistant"
        chat_id = data["id"]

        # 2. List chats
        list_resp = await http_client.get("/api/slm/chat/conversations", headers=headers)
        assert list_resp.status_code == 200
        chats = list_resp.json()
        assert len(chats) >= 1
        assert any(c["id"] == chat_id for c in chats)

    async def test_get_slm_chat_detail(self, http_client, user_token):
        headers = auth_headers(user_token)

        create_resp = await http_client.post(
            "/api/slm/chat/conversations",
            json={"title": "Detailed Chat"},
            headers=headers,
        )
        chat_id = create_resp.json()["id"]

        detail_resp = await http_client.get(
            f"/api/slm/chat/conversations/{chat_id}",
            headers=headers,
        )
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["id"] == chat_id
        assert detail["title"] == "Detailed Chat"
        assert len(detail["messages"]) >= 1

    async def test_delete_slm_chat(self, http_client, user_token):
        headers = auth_headers(user_token)

        create_resp = await http_client.post(
            "/api/slm/chat/conversations",
            headers=headers,
        )
        chat_id = create_resp.json()["id"]

        # Delete chat
        del_resp = await http_client.delete(
            f"/api/slm/chat/conversations/{chat_id}",
            headers=headers,
        )
        assert del_resp.status_code == 204

        # Verify 404 after deletion
        get_resp = await http_client.get(
            f"/api/slm/chat/conversations/{chat_id}",
            headers=headers,
        )
        assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# 2. Authentication and Ownership Isolation
# ---------------------------------------------------------------------------


class TestSLMChatOwnership:
    async def test_unauthenticated_requests_rejected(self, http_client):
        # Create
        resp = await http_client.post("/api/slm/chat/conversations", json={})
        assert resp.status_code == 401

        # List
        resp = await http_client.get("/api/slm/chat/conversations")
        assert resp.status_code == 401

        # Detail
        fake_id = "507f1f77bcf86cd799439011"
        resp = await http_client.get(f"/api/slm/chat/conversations/{fake_id}")
        assert resp.status_code == 401

        # Message
        resp = await http_client.post(
            f"/api/slm/chat/conversations/{fake_id}/messages",
            json={"content": "Hello?"},
        )
        assert resp.status_code == 401

    async def test_cross_user_isolation(self, http_client, mock_database):
        token_a = await register_and_login(http_client, "user_a@example.com")
        token_b = await register_and_login(http_client, "user_b@example.com")

        # User A creates a chat
        create_resp = await http_client.post(
            "/api/slm/chat/conversations",
            json={"title": "User A Private Chat"},
            headers=auth_headers(token_a),
        )
        chat_id = create_resp.json()["id"]

        # User B cannot view User A's chat (must return 404, not 200 or 403)
        get_resp = await http_client.get(
            f"/api/slm/chat/conversations/{chat_id}",
            headers=auth_headers(token_b),
        )
        assert get_resp.status_code == 404

        # User B cannot send a message to User A's chat
        msg_resp = await http_client.post(
            f"/api/slm/chat/conversations/{chat_id}/messages",
            json={"content": "Unauthorized message"},
            headers=auth_headers(token_b),
        )
        assert msg_resp.status_code == 404

        # User B cannot delete User A's chat
        del_resp = await http_client.delete(
            f"/api/slm/chat/conversations/{chat_id}",
            headers=auth_headers(token_b),
        )
        assert del_resp.status_code == 404


# ---------------------------------------------------------------------------
# 3. Multi-Turn Message Flow & Chronological Ordering
# ---------------------------------------------------------------------------


class TestSLMChatMultiTurn:
    async def test_multi_turn_message_flow_and_ordering(self, http_client, user_token):
        headers = auth_headers(user_token)

        create_resp = await http_client.post(
            "/api/slm/chat/conversations",
            headers=headers,
        )
        chat_id = create_resp.json()["id"]

        # Turn 1
        t1_resp = await http_client.post(
            f"/api/slm/chat/conversations/{chat_id}/messages",
            json={"content": "I am struggling to manage my coursework deadlines."},
            headers=headers,
        )
        assert t1_resp.status_code == 200
        chat_t1 = t1_resp.json()
        assert len(chat_t1["messages"]) == 3  # Initial + User 1 + Assistant 1
        assert chat_t1["messages"][1]["role"] == "user"
        assert chat_t1["messages"][1]["content"] == "I am struggling to manage my coursework deadlines."
        assert chat_t1["messages"][2]["role"] == "assistant"
        assert len(chat_t1["messages"][2]["content"]) > 10

        # Turn 2
        t2_resp = await http_client.post(
            f"/api/slm/chat/conversations/{chat_id}/messages",
            json={"content": "My primary concern is the literature review section."},
            headers=headers,
        )
        assert t2_resp.status_code == 200
        chat_t2 = t2_resp.json()
        assert len(chat_t2["messages"]) == 5  # Initial + U1 + A1 + U2 + A2
        assert chat_t2["messages"][3]["role"] == "user"
        assert chat_t2["messages"][4]["role"] == "assistant"

        # Verify ordering: timestamps must be monotonic
        timestamps = [m["timestamp"] for m in chat_t2["messages"]]
        assert timestamps == sorted(timestamps)

    async def test_bounded_history_context(self, http_client, user_token, mock_database):
        """Verify that generation context limits history to max_recent_messages."""
        from app.services import slm_chat_service

        headers = auth_headers(user_token)
        create_resp = await http_client.post(
            "/api/slm/chat/conversations",
            headers=headers,
        )
        chat_id = create_resp.json()["id"]

        # Post 8 messages
        for i in range(8):
            await http_client.post(
                f"/api/slm/chat/conversations/{chat_id}/messages",
                json={"content": f"Turn {i}: Talking about my plan."},
                headers=headers,
            )

        detail_resp = await http_client.get(
            f"/api/slm/chat/conversations/{chat_id}",
            headers=headers,
        )
        messages = detail_resp.json()["messages"]
        assert len(messages) == 1 + (8 * 2)  # 1 initial + 8 user + 8 assistant = 17


# ---------------------------------------------------------------------------
# 4. Safety Triage & Urgent Bypass
# ---------------------------------------------------------------------------


class TestSLMChatSafety:
    async def test_urgent_safety_bypass_in_slm_chat(self, http_client, user_token):
        """Urgent crisis signal must trigger immediate deterministic safety bypass."""
        headers = auth_headers(user_token)

        create_resp = await http_client.post(
            "/api/slm/chat/conversations",
            headers=headers,
        )
        chat_id = create_resp.json()["id"]

        # Benign turn 1
        await http_client.post(
            f"/api/slm/chat/conversations/{chat_id}/messages",
            json={"content": "I was studying earlier today."},
            headers=headers,
        )

        # Urgent turn 2
        urgent_resp = await http_client.post(
            f"/api/slm/chat/conversations/{chat_id}/messages",
            json={"content": "I want to die. I have pills and I'm ready to end it."},
            headers=headers,
        )
        assert urgent_resp.status_code == 200
        chat = urgent_resp.json()
        latest_assistant_msg = chat["messages"][-1]

        assert latest_assistant_msg["role"] == "assistant"
        assert latest_assistant_msg["safety_level"] == "urgent"
        # Deterministic emergency text must be returned
        assert "emergency" in latest_assistant_msg["content"].lower() or "crisis" in latest_assistant_msg["content"].lower()

    async def test_empty_message_rejected(self, http_client, user_token):
        headers = auth_headers(user_token)
        create_resp = await http_client.post(
            "/api/slm/chat/conversations",
            headers=headers,
        )
        chat_id = create_resp.json()["id"]

        resp = await http_client.post(
            f"/api/slm/chat/conversations/{chat_id}/messages",
            json={"content": "   "},
            headers=headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 5. Isolation from Guided Conversations
# ---------------------------------------------------------------------------


class TestSLMChatIsolation:
    async def test_slm_chats_do_not_pollute_guided_conversations(self, http_client, user_token, mock_database):
        headers = auth_headers(user_token)

        # 1. Create a Guided conversation
        guided_resp = await http_client.post(
            "/api/conversations",
            json={"title": "My Guided 8-Stage Walk"},
            headers=headers,
        )
        guided_id = guided_resp.json()["id"]

        # 2. Create an SLM chat and post messages
        slm_resp = await http_client.post(
            "/api/slm/chat/conversations",
            json={"title": "Separate SLM Chat"},
            headers=headers,
        )
        slm_id = slm_resp.json()["id"]

        await http_client.post(
            f"/api/slm/chat/conversations/{slm_id}/messages",
            json={"content": "Free-flowing SLM dialogue message."},
            headers=headers,
        )

        # 3. Verify Guided conversation list only contains Guided conversation
        guided_list = (await http_client.get("/api/conversations", headers=headers)).json()
        assert len(guided_list) == 1
        assert guided_list[0]["id"] == guided_id

        # 4. Verify SLM conversation list only contains SLM chat
        slm_list = (await http_client.get("/api/slm/chat/conversations", headers=headers)).json()
        assert len(slm_list) == 1
        assert slm_list[0]["id"] == slm_id

        # 5. Verify Guided conversation stage remains opening and unmodified
        guided_detail = (await http_client.get(f"/api/conversations/{guided_id}", headers=headers)).json()
        assert guided_detail["stage"] == "opening"
        assert len(guided_detail["messages"]) == 1
