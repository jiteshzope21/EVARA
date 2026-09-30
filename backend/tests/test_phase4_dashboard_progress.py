"""
Phase 4 tests — /api/dashboard and /api/progress. Mocked MongoDB, not real Atlas.
"""

import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

async def test_dashboard_requires_authentication(client):
    resp = await client.get("/api/dashboard")
    assert resp.status_code == 401


async def test_dashboard_empty_state(client, user_a):
    token, _ = user_a
    resp = await client.get("/api/dashboard", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["conversation_count"] == 0
    assert data["completed_conversation_count"] == 0
    assert data["active_conversation_count"] == 0
    assert data["recent_conversations"] == []
    assert data["pending_plan_count"] == 0
    assert data["completed_plan_count"] == 0
    assert data["cancelled_plan_count"] == 0
    assert data["active_plans"] == []
    assert data["recent_reports"] == []
    assert data["sentiment_trend"] == {"positive": 0, "negative": 0, "neutral": 0}
    assert data["top_themes"] == []


async def test_dashboard_aggregates_real_data(client, user_a):
    token, _ = user_a

    # One conversation, generate an analysis, generate a report.
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]
    await client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "I'm stressed about my exam."},
        headers=auth_headers(token),
    )
    await client.post(f"/api/analysis/{conv_id}/generate", headers=auth_headers(token))
    await client.post(f"/api/reports/{conv_id}/generate", headers=auth_headers(token))

    # Two plans: one pending, one completed.
    p1 = await client.post("/api/planner", json={"action": "Study"}, headers=auth_headers(token))
    await client.post("/api/planner", json={"action": "Sleep more"}, headers=auth_headers(token))
    await client.post(f"/api/planner/{p1.json()['id']}/complete", headers=auth_headers(token))

    resp = await client.get("/api/dashboard", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["conversation_count"] == 1
    assert data["active_conversation_count"] == 1  # not yet closed
    assert len(data["recent_conversations"]) == 1
    assert data["pending_plan_count"] == 1
    assert data["completed_plan_count"] == 1
    assert len(data["recent_reports"]) == 1
    assert sum(data["sentiment_trend"].values()) == 1


async def test_dashboard_ownership_isolation(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b

    await client.post("/api/conversations", json={"title": "A's session"}, headers=auth_headers(token_a))
    await client.post("/api/planner", json={"action": "A's plan"}, headers=auth_headers(token_a))

    resp_b = await client.get("/api/dashboard", headers=auth_headers(token_b))
    data_b = resp_b.json()
    assert data_b["conversation_count"] == 0
    assert data_b["pending_plan_count"] == 0


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------

async def test_progress_requires_authentication(client):
    resp = await client.get("/api/progress")
    assert resp.status_code == 401


async def test_progress_empty_state(client, user_a):
    token, _ = user_a
    resp = await client.get("/api/progress", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_plans"] == 0
    assert data["pending_plans"] == 0
    assert data["completed_plans"] == 0
    assert data["cancelled_plans"] == 0
    assert data["completion_percentage"] == 0.0
    assert data["recent_completed_plans"] == []
    assert data["plans_completed_last_7_days"] == 0
    assert data["total_conversations"] == 0
    assert data["completed_conversations"] == 0


async def test_progress_completion_percentage(client, user_a):
    token, _ = user_a
    ids = []
    for i in range(4):
        r = await client.post("/api/planner", json={"action": f"Plan {i}"}, headers=auth_headers(token))
        ids.append(r.json()["id"])
    # Complete 1 of 4; cancel 1 of 4 (cancelled excluded from denominator).
    await client.post(f"/api/planner/{ids[0]}/complete", headers=auth_headers(token))
    await client.patch(f"/api/planner/{ids[1]}", json={"status": "cancelled"}, headers=auth_headers(token))

    resp = await client.get("/api/progress", headers=auth_headers(token))
    data = resp.json()
    assert data["total_plans"] == 4
    assert data["completed_plans"] == 1
    assert data["cancelled_plans"] == 1
    assert data["pending_plans"] == 2
    # completed / (completed + pending) = 1 / 3 = 33.33%
    assert data["completion_percentage"] == pytest.approx(33.33, rel=0.01)


async def test_progress_recent_completed_plans(client, user_a):
    token, _ = user_a
    r = await client.post("/api/planner", json={"action": "Finish this"}, headers=auth_headers(token))
    plan_id = r.json()["id"]
    await client.post(f"/api/planner/{plan_id}/complete", headers=auth_headers(token))

    resp = await client.get("/api/progress", headers=auth_headers(token))
    data = resp.json()
    assert len(data["recent_completed_plans"]) == 1
    assert data["recent_completed_plans"][0]["id"] == plan_id
    assert data["plans_completed_last_7_days"] == 1


async def test_progress_ownership_isolation(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b

    r = await client.post("/api/planner", json={"action": "A's plan"}, headers=auth_headers(token_a))
    await client.post(f"/api/planner/{r.json()['id']}/complete", headers=auth_headers(token_a))

    resp_b = await client.get("/api/progress", headers=auth_headers(token_b))
    data_b = resp_b.json()
    assert data_b["total_plans"] == 0
    assert data_b["completed_plans"] == 0
