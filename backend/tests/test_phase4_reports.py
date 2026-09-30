"""
Phase 4 tests — /api/reports/* endpoints. Mocked MongoDB, not real Atlas.
"""

import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _conversation_with_analysis(client, token, messages):
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]
    for content in messages:
        await client.post(
            f"/api/conversations/{conv_id}/messages", json={"content": content}, headers=auth_headers(token)
        )
    await client.post(f"/api/analysis/{conv_id}/generate", headers=auth_headers(token))
    return conv_id


async def _full_closure_conversation(client, token):
    """Walk a conversation all the way to closure (7 messages) and analyze it."""
    conv_id = await _conversation_with_analysis(
        client, token,
        [
            "My exam went badly.",
            "I didn't study enough.",
            "I want to study more.",
            "I could set a fixed schedule.",
            "I'll study every evening.",
            "I will study for 30 minutes every evening.",
            "I will start tomorrow at 7 PM.",
        ],
    )
    return conv_id


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

async def test_generate_report_success(client, user_a):
    token, _ = user_a
    conv_id = await _conversation_with_analysis(client, token, ["My exam went badly and I am worried."])

    resp = await client.post(f"/api/reports/{conv_id}/generate", headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["conversation_id"] == conv_id
    assert data["reflection_summary"]
    assert data["dominant_sentiment"] in {"positive", "negative", "neutral"}
    assert data["dominant_emotion"]
    assert data["safety_level"] in {"normal", "low_concern", "elevated_concern", "urgent"}
    assert isinstance(data["themes"], list)
    assert "summary" in data["evidence_summary"] or isinstance(data["evidence_summary"], dict)
    assert data["action_plan"] is None  # conversation hasn't reached closure


async def test_generate_report_includes_action_plan_at_closure(client, user_a):
    token, _ = user_a
    conv_id = await _full_closure_conversation(client, token)

    resp = await client.post(f"/api/reports/{conv_id}/generate", headers=auth_headers(token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["conversation_status"] == "completed"
    assert data["action_plan"] is not None
    assert "7 PM" in data["action_plan"]


async def test_generate_report_without_analysis_returns_404(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]
    await client.post(
        f"/api/conversations/{conv_id}/messages", json={"content": "Something happened."}, headers=auth_headers(token)
    )
    # No analysis generated yet.
    resp = await client.post(f"/api/reports/{conv_id}/generate", headers=auth_headers(token))
    assert resp.status_code == 404


async def test_generate_report_requires_authentication(client, user_a):
    token, _ = user_a
    conv_id = await _conversation_with_analysis(client, token, ["Something."])
    resp = await client.post(f"/api/reports/{conv_id}/generate")
    assert resp.status_code == 401


async def test_generate_report_invalid_conversation_id(client, user_a):
    token, _ = user_a
    resp = await client.post("/api/reports/not-a-valid-id/generate", headers=auth_headers(token))
    assert resp.status_code == 400


async def test_generate_report_missing_conversation(client, user_a):
    token, _ = user_a
    resp = await client.post(
        "/api/reports/aaaaaaaaaaaaaaaaaaaaaaaa/generate", headers=auth_headers(token)
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

async def test_get_report_returns_latest(client, user_a):
    token, _ = user_a
    conv_id = await _conversation_with_analysis(client, token, ["First problem."])
    first_resp = await client.post(f"/api/reports/{conv_id}/generate", headers=auth_headers(token))
    first_id = first_resp.json()["id"]

    await client.post(
        f"/api/conversations/{conv_id}/messages", json={"content": "More detail."}, headers=auth_headers(token)
    )
    await client.post(f"/api/analysis/{conv_id}/generate", headers=auth_headers(token))
    second_resp = await client.post(f"/api/reports/{conv_id}/generate", headers=auth_headers(token))
    second_id = second_resp.json()["id"]
    assert second_id != first_id

    get_resp = await client.get(f"/api/reports/{conv_id}", headers=auth_headers(token))
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == second_id


async def test_get_report_before_any_generated(client, user_a):
    token, _ = user_a
    conv_id = await _conversation_with_analysis(client, token, ["Something."])
    # analysis exists but no report generated yet
    resp = await client.get(f"/api/reports/{conv_id}", headers=auth_headers(token))
    assert resp.status_code == 404


async def test_get_report_requires_authentication(client, user_a):
    token, _ = user_a
    conv_id = await _conversation_with_analysis(client, token, ["Something."])
    await client.post(f"/api/reports/{conv_id}/generate", headers=auth_headers(token))
    resp = await client.get(f"/api/reports/{conv_id}")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Ownership isolation
# ---------------------------------------------------------------------------

async def test_user_b_cannot_generate_report_for_user_a_conversation(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b
    conv_id = await _conversation_with_analysis(client, token_a, ["A's private problem."])

    resp = await client.post(f"/api/reports/{conv_id}/generate", headers=auth_headers(token_b))
    assert resp.status_code == 404


async def test_user_b_cannot_read_user_a_report(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b
    conv_id = await _conversation_with_analysis(client, token_a, ["A's private problem."])
    await client.post(f"/api/reports/{conv_id}/generate", headers=auth_headers(token_a))

    resp = await client.get(f"/api/reports/{conv_id}", headers=auth_headers(token_b))
    assert resp.status_code == 404


async def test_report_persisted_with_correct_owner(client, user_a):
    token, user = user_a
    conv_id = await _conversation_with_analysis(client, token, ["Something to report on."])
    resp = await client.post(f"/api/reports/{conv_id}/generate", headers=auth_headers(token))
    data = resp.json()
    assert data["user_id"] == user["id"]
    assert data["conversation_id"] == conv_id
