"""
Phase 2 tests — conversation engine, API, and ownership isolation.

Run against a mocked MongoDB (see conftest.py), not real Atlas.
"""

import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Creation
# ---------------------------------------------------------------------------

async def test_create_conversation_with_body(client, user_a):
    token, _ = user_a
    resp = await client.post("/api/conversations", json={"title": "My Session"}, headers=auth_headers(token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Session"
    assert data["stage"] == "opening"
    assert data["status"] == "active"


async def test_create_conversation_with_no_body(client, user_a):
    """POST /api/conversations must work with a completely empty request body."""
    token, _ = user_a
    resp = await client.post("/api/conversations", headers=auth_headers(token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "New Session"


async def test_create_conversation_auto_creates_opening_message(client, user_a):
    token, _ = user_a
    resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    data = resp.json()
    assert len(data["messages"]) == 1
    assert data["messages"][0]["role"] == "assistant"
    assert len(data["messages"][0]["content"]) > 0


async def test_create_conversation_requires_authentication(client):
    resp = await client.post("/api/conversations", json={})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Listing
# ---------------------------------------------------------------------------

async def test_list_conversations_scoped_to_user(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b

    await client.post("/api/conversations", json={}, headers=auth_headers(token_a))
    await client.post("/api/conversations", json={}, headers=auth_headers(token_a))
    await client.post("/api/conversations", json={}, headers=auth_headers(token_b))

    resp_a = await client.get("/api/conversations", headers=auth_headers(token_a))
    resp_b = await client.get("/api/conversations", headers=auth_headers(token_b))

    assert resp_a.status_code == 200
    assert resp_b.status_code == 200
    assert len(resp_a.json()) == 2
    assert len(resp_b.json()) == 1


async def test_list_conversations_requires_authentication(client):
    resp = await client.get("/api/conversations")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

async def test_get_owned_conversation(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    resp = await client.get(f"/api/conversations/{conv_id}", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["id"] == conv_id


async def test_get_conversation_invalid_id_format(client, user_a):
    token, _ = user_a
    resp = await client.get("/api/conversations/not-a-valid-object-id", headers=auth_headers(token))
    assert resp.status_code == 400


async def test_get_conversation_wellformed_but_missing_id(client, user_a):
    token, _ = user_a
    resp = await client.get("/api/conversations/aaaaaaaaaaaaaaaaaaaaaaaa", headers=auth_headers(token))
    assert resp.status_code == 404


async def test_get_conversation_requires_authentication(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    resp = await client.get(f"/api/conversations/{conv_id}")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Stage progression
# ---------------------------------------------------------------------------

EXPECTED_STAGE_ORDER = [
    "opening",
    "problem_exploration",
    "cause_reflection",
    "prioritization",
    "strategy_exploration",
    "action_planning",
    "time_frequency",
    "closure",
]


async def test_full_stage_progression_requires_exactly_seven_messages(client, user_a):
    """
    8 stages total (opening -> ... -> closure). Conversation is created at
    'opening' already, so exactly 7 user messages are required to reach
    'closure' (one message per remaining stage transition).
    """
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv = create_resp.json()
    assert conv["stage"] == EXPECTED_STAGE_ORDER[0]
    conv_id = conv["id"]

    answers = [
        "My robotics exam went badly and I think my result will be poor.",
        "I didn't practice enough and wasn't paying attention in lectures.",
        "I need to practice more and pay attention in lectures.",
        "I could set a fixed study block or study with a friend.",
        "I'll practice robotics every morning.",
        "I'll study for 30 minutes every evening.",
        "I will start tomorrow at 7 PM.",
    ]

    last = None
    for i, answer in enumerate(answers):
        resp = await client.post(
            f"/api/conversations/{conv_id}/messages", json={"content": answer}, headers=auth_headers(token)
        )
        assert resp.status_code == 200, resp.text
        last = resp.json()
        assert last["stage"] == EXPECTED_STAGE_ORDER[i + 1], (
            f"After message {i + 1} ('{answer}'), expected stage "
            f"'{EXPECTED_STAGE_ORDER[i + 1]}' but got '{last['stage']}'"
        )

    assert last["stage"] == "closure"
    assert last["status"] == "completed"
    # 1 opening message + 7 * (user + assistant) = 15
    assert len(last["messages"]) == 15


async def test_title_auto_generated_from_first_message(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]
    assert create_resp.json()["title"] == "New Session"

    resp = await client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "My robotics exam went really badly and I'm worried about it."},
        headers=auth_headers(token),
    )
    assert resp.json()["title"].startswith("My robotics exam went really badly")


# ---------------------------------------------------------------------------
# Closure regression test — THE critical requested test.
#
# Uses two clearly distinct, unmistakable answers so a mix-up between the
# action-planning answer and the time/frequency answer would be obvious
# and unambiguous in the assertion.
# ---------------------------------------------------------------------------

async def test_closure_uses_distinct_action_and_time_answers_without_mixing_them_up(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    # Walk through opening -> ... -> action_planning (5 messages get us
    # from 'opening' to 'action_planning'; the 5th message's *response*
    # will be the action_planning prompt).
    filler_answers = [
        "I've been struggling to stay consistent with exercise.",
        "I think it's because I don't have a fixed routine.",
        "I want to build a consistent exercise habit.",
        "I could set a fixed schedule or find an accountability partner.",
        "I'll go with setting a fixed schedule.",
    ]
    conv = None
    for answer in filler_answers:
        resp = await client.post(
            f"/api/conversations/{conv_id}/messages", json={"content": answer}, headers=auth_headers(token)
        )
        conv = resp.json()
    assert conv["stage"] == "action_planning"

    action_planning_answer = "I will study for 30 minutes every evening."
    time_frequency_answer = "I will start tomorrow at 7 PM."

    # This message answers ACTION_PLANNING -> transitions to TIME_FREQUENCY.
    resp = await client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": action_planning_answer},
        headers=auth_headers(token),
    )
    conv = resp.json()
    assert conv["stage"] == "time_frequency"

    # This message answers TIME_FREQUENCY -> transitions to CLOSURE.
    resp = await client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": time_frequency_answer},
        headers=auth_headers(token),
    )
    conv = resp.json()
    assert conv["stage"] == "closure"
    assert conv["status"] == "completed"

    closure_message = conv["messages"][-1]["content"]
    assert conv["messages"][-1]["role"] == "assistant"

    # Both distinct answers must appear, and specifically NOT swapped:
    # the action-planning text must not be mistaken for the time answer
    # or vice versa. We assert both substrings are present verbatim.
    assert action_planning_answer in closure_message, (
        f"Closure message did not include the action-planning answer.\nGot: {closure_message}"
    )
    assert time_frequency_answer in closure_message, (
        f"Closure message did not include the time/frequency answer.\nGot: {closure_message}"
    )

    # Extra safety: the action-planning answer must appear BEFORE the
    # time/frequency answer in the closure text.
    assert closure_message.index(action_planning_answer) < closure_message.index(time_frequency_answer)

    # Regression guard for the exact live-Swagger wording bug: embedding a
    # full user sentence mid-sentence ("you're planning to I will study...")
    # produced awkward, duplicated phrasing. Assert those specific broken
    # phrasings are gone, and that each answer is presented as a clearly
    # delimited quote instead.
    assert "planning to I will" not in closure_message
    assert "aiming to start I will" not in closure_message
    assert f'"{action_planning_answer}"' in closure_message
    assert f'"{time_frequency_answer}"' in closure_message


async def test_message_after_closure_stays_closed(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    answers = [
        "Problem description.",
        "Cause description.",
        "Priority description.",
        "Strategy description.",
        "Action description.",
        "Time description.",
        "Final confirmation.",
    ]
    conv = None
    for answer in answers:
        resp = await client.post(
            f"/api/conversations/{conv_id}/messages", json={"content": answer}, headers=auth_headers(token)
        )
        conv = resp.json()
    assert conv["stage"] == "closure"
    message_count_at_closure = len(conv["messages"])

    # One more message after closure: should not crash, should not
    # re-advance the stage, should not regenerate a (possibly wrong) plan summary.
    resp = await client.post(
        f"/api/conversations/{conv_id}/messages", json={"content": "Thanks!"}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    conv_after = resp.json()
    assert conv_after["stage"] == "closure"
    assert conv_after["status"] == "completed"
    assert len(conv_after["messages"]) == message_count_at_closure + 2


# ---------------------------------------------------------------------------
# Message validation
# ---------------------------------------------------------------------------

async def test_empty_message_rejected(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/conversations/{conv_id}/messages", json={"content": ""}, headers=auth_headers(token)
    )
    assert resp.status_code == 422


async def test_whitespace_only_message_rejected(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/conversations/{conv_id}/messages", json={"content": "   "}, headers=auth_headers(token)
    )
    assert resp.status_code == 422


async def test_missing_content_field_rejected(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    resp = await client.post(f"/api/conversations/{conv_id}/messages", json={}, headers=auth_headers(token))
    assert resp.status_code == 422


async def test_send_message_requires_authentication(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    resp = await client.post(f"/api/conversations/{conv_id}/messages", json={"content": "hi"})
    assert resp.status_code == 401


async def test_send_message_to_invalid_conversation_id(client, user_a):
    token, _ = user_a
    resp = await client.post(
        "/api/conversations/not-a-valid-id/messages", json={"content": "hi"}, headers=auth_headers(token)
    )
    assert resp.status_code == 400


async def test_send_message_to_missing_conversation(client, user_a):
    token, _ = user_a
    resp = await client.post(
        "/api/conversations/aaaaaaaaaaaaaaaaaaaaaaaa/messages",
        json={"content": "hi"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Ownership isolation — the critical Phase 2 security requirement.
# ---------------------------------------------------------------------------

async def test_user_b_cannot_read_user_a_conversation(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b

    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token_a))
    conv_id = create_resp.json()["id"]

    resp = await client.get(f"/api/conversations/{conv_id}", headers=auth_headers(token_b))
    assert resp.status_code == 404  # not 403 — existence is not leaked


async def test_user_b_cannot_send_message_to_user_a_conversation(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b

    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token_a))
    conv_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/conversations/{conv_id}/messages", json={"content": "intrusion"}, headers=auth_headers(token_b)
    )
    assert resp.status_code == 404

    # Confirm A's conversation was not modified by B's attempt.
    resp_a = await client.get(f"/api/conversations/{conv_id}", headers=auth_headers(token_a))
    assert len(resp_a.json()["messages"]) == 1  # still just the opening message


async def test_user_b_cannot_delete_user_a_conversation(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b

    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token_a))
    conv_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/conversations/{conv_id}", headers=auth_headers(token_b))
    assert resp.status_code == 404

    # Confirm A's conversation still exists.
    resp_a = await client.get(f"/api/conversations/{conv_id}", headers=auth_headers(token_a))
    assert resp_a.status_code == 200


async def test_user_b_cannot_list_user_a_conversations(client, user_a, user_b):
    token_a, _ = user_a
    token_b, _ = user_b

    await client.post("/api/conversations", json={"title": "A's private session"}, headers=auth_headers(token_a))

    resp_b = await client.get("/api/conversations", headers=auth_headers(token_b))
    assert resp_b.status_code == 200
    titles = [c["title"] for c in resp_b.json()]
    assert "A's private session" not in titles


# ---------------------------------------------------------------------------
# Deletion
# ---------------------------------------------------------------------------

async def test_owner_can_delete_own_conversation(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/conversations/{conv_id}", headers=auth_headers(token))
    assert resp.status_code == 204

    resp_get = await client.get(f"/api/conversations/{conv_id}", headers=auth_headers(token))
    assert resp_get.status_code == 404


async def test_delete_already_deleted_conversation_returns_404(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    first = await client.delete(f"/api/conversations/{conv_id}", headers=auth_headers(token))
    assert first.status_code == 204

    second = await client.delete(f"/api/conversations/{conv_id}", headers=auth_headers(token))
    assert second.status_code == 404


async def test_delete_requires_authentication(client, user_a):
    token, _ = user_a
    create_resp = await client.post("/api/conversations", json={}, headers=auth_headers(token))
    conv_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/conversations/{conv_id}")
    assert resp.status_code == 401
