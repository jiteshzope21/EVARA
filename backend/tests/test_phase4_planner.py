"""
Phase 4 tests — /api/planner/* endpoints. Mocked MongoDB, not real Atlas.
"""

import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

async def test_create_plan_minimal(client, user_a):
    token, _ = user_a
    resp = await client.post("/api/planner", json={"action": "Practice robotics"}, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["action"] == "Practice robotics"
    assert data["status"] == "pending"
    assert data["date"] is None
    assert data["time"] is None


async def test_create_plan_full(client, user_a):
    token, _ = user_a
    payload = {
        "action": "Study every evening",
        "date": "2026-10-01",
        "time": "19:00",
        "frequency": "daily",
    }
    resp = await client.post("/api/planner", json=payload, headers=auth_headers(token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["date"] == "2026-10-01"
    assert data["time"] == "19:00"
    assert data["frequency"] == "daily"


async def test_create_plan_empty_action_rejected(client, user_a):
    token, _ = user_a
    resp = await client.post("/api/planner", json={"action": "   "}, headers=auth_headers(token))
    assert resp.status_code == 422


async def test_create_plan_invalid_date_format_rejected(client, user_a):
    token, _ = user_a
    resp = await client.post(
        "/api/planner", json={"action": "Do something", "date": "10/01/2026"}, headers=auth_headers(token)
    )
    assert resp.status_code == 422


async def test_create_plan_invalid_time_format_rejected(client, user_a):
    token, _ = user_a
    resp = await client.post(
        "/api/planner", json={"action": "Do something", "time": "7pm"}, headers=auth_headers(token)
    )
    assert resp.status_code == 422


async def test_create_plan_requires_authentication(client):
    resp = await client.post("/api/planner", json={"action": "Do something"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

async def test_list_plans_scoped_to_user(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b
    await client.post("/api/planner", json={"action": "A's plan 1"}, headers=auth_headers(token_a))
    await client.post("/api/planner", json={"action": "A's plan 2"}, headers=auth_headers(token_a))
    await client.post("/api/planner", json={"action": "B's plan"}, headers=auth_headers(token_b))

    resp_a = await client.get("/api/planner", headers=auth_headers(token_a))
    resp_b = await client.get("/api/planner", headers=auth_headers(token_b))
    assert len(resp_a.json()) == 2
    assert len(resp_b.json()) == 1


async def test_list_plans_filter_by_status(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/planner", json={"action": "Plan 1"}, headers=auth_headers(token))
    plan_id = create_resp.json()["id"]
    await client.post("/api/planner", json={"action": "Plan 2"}, headers=auth_headers(token))
    await client.post(f"/api/planner/{plan_id}/complete", headers=auth_headers(token))

    resp = await client.get("/api/planner?status=completed", headers=auth_headers(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["status"] == "completed"

    resp2 = await client.get("/api/planner?status=pending", headers=auth_headers(token))
    assert len(resp2.json()) == 1


async def test_list_plans_invalid_status_filter(client, user_a):
    token, _ = user_a
    resp = await client.get("/api/planner?status=bogus", headers=auth_headers(token))
    assert resp.status_code == 400


async def test_list_plans_requires_authentication(client):
    resp = await client.get("/api/planner")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Retrieve
# ---------------------------------------------------------------------------

async def test_get_plan_owned(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/planner", json={"action": "Test plan"}, headers=auth_headers(token))
    plan_id = create_resp.json()["id"]

    resp = await client.get(f"/api/planner/{plan_id}", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["id"] == plan_id


async def test_get_plan_invalid_id(client, user_a):
    token, _ = user_a
    resp = await client.get("/api/planner/not-a-valid-id", headers=auth_headers(token))
    assert resp.status_code == 400


async def test_get_plan_missing(client, user_a):
    token, _ = user_a
    resp = await client.get("/api/planner/aaaaaaaaaaaaaaaaaaaaaaaa", headers=auth_headers(token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

async def test_update_plan_fields(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/planner", json={"action": "Old action"}, headers=auth_headers(token))
    plan_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/planner/{plan_id}", json={"action": "New action", "date": "2026-11-01"}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "New action"
    assert data["date"] == "2026-11-01"


async def test_update_plan_status_via_patch(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/planner", json={"action": "Plan"}, headers=auth_headers(token))
    plan_id = create_resp.json()["id"]

    resp = await client.patch(f"/api/planner/{plan_id}", json={"status": "cancelled"}, headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


async def test_update_plan_empty_body_rejected(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/planner", json={"action": "Plan"}, headers=auth_headers(token))
    plan_id = create_resp.json()["id"]

    resp = await client.patch(f"/api/planner/{plan_id}", json={}, headers=auth_headers(token))
    assert resp.status_code == 400


async def test_update_plan_not_owned_returns_404(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b
    create_resp = await client.post("/api/planner", json={"action": "A's plan"}, headers=auth_headers(token_a))
    plan_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/planner/{plan_id}", json={"action": "hijacked"}, headers=auth_headers(token_b)
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Complete
# ---------------------------------------------------------------------------

async def test_complete_plan(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/planner", json={"action": "Plan"}, headers=auth_headers(token))
    plan_id = create_resp.json()["id"]

    resp = await client.post(f"/api/planner/{plan_id}/complete", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


async def test_complete_plan_not_owned_returns_404(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b
    create_resp = await client.post("/api/planner", json={"action": "A's plan"}, headers=auth_headers(token_a))
    plan_id = create_resp.json()["id"]

    resp = await client.post(f"/api/planner/{plan_id}/complete", headers=auth_headers(token_b))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

async def test_delete_plan_owner(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/planner", json={"action": "Plan"}, headers=auth_headers(token))
    plan_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/planner/{plan_id}", headers=auth_headers(token))
    assert resp.status_code == 204

    get_resp = await client.get(f"/api/planner/{plan_id}", headers=auth_headers(token))
    assert get_resp.status_code == 404


async def test_delete_plan_not_owned_returns_404(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b
    create_resp = await client.post("/api/planner", json={"action": "A's plan"}, headers=auth_headers(token_a))
    plan_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/planner/{plan_id}", headers=auth_headers(token_b))
    assert resp.status_code == 404

    # confirm still exists for A
    get_resp = await client.get(f"/api/planner/{plan_id}", headers=auth_headers(token_a))
    assert get_resp.status_code == 200
