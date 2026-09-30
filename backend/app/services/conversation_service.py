"""
Conversation engine / service layer (Phase 2).

This implements a deterministic, rule-based walk through the 8-stage
reflective workflow described in the project specification. It is
intentionally NOT an NLP or SLM system:

    - No sentiment/emotion/intent analysis.
    - No embeddings or semantic similarity.
    - No language model generation.

Stage transitions are driven purely by "one user message advances the
conversation by one stage", and assistant responses are fixed,
non-clinical, open-ended prompts (or, at closure, a plain template that
reflects the user's own prior words back to them — not an analysis of
them).

Phase 3+ will replace/augment this logic with real NLP/LMTA signals and
an SLM generator behind the same function signatures, so API routes and
the frontend contract do not need to change.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.logging import get_logger
from app.models.conversation import ConversationStage, ConversationStatus, MessageRole

logger = get_logger(__name__)

COLLECTION = "conversations"

STAGE_ORDER: List[ConversationStage] = [
    ConversationStage.OPENING,
    ConversationStage.PROBLEM_EXPLORATION,
    ConversationStage.CAUSE_REFLECTION,
    ConversationStage.PRIORITIZATION,
    ConversationStage.STRATEGY_EXPLORATION,
    ConversationStage.ACTION_PLANNING,
    ConversationStage.TIME_FREQUENCY,
    ConversationStage.CLOSURE,
]

# Deterministic, non-clinical placeholder prompts for each stage (except
# CLOSURE, whose message is built dynamically — see _build_closure_message).
STAGE_PROMPTS: Dict[ConversationStage, str] = {
    ConversationStage.OPENING: (
        "Hi, I'm Evara. I'm here to help you think through whatever's on "
        "your mind. What would you like to talk about today?"
    ),
    ConversationStage.PROBLEM_EXPLORATION: (
        "Thank you for sharing that. Could you tell me a bit more about "
        "what's been difficult about this?"
    ),
    ConversationStage.CAUSE_REFLECTION: (
        "What do you think might be contributing to this?"
    ),
    ConversationStage.PRIORITIZATION: (
        "Of everything we've touched on, what feels most important for you "
        "to work on right now?"
    ),
    ConversationStage.STRATEGY_EXPLORATION: (
        "What are some ways you could approach this?"
    ),
    ConversationStage.ACTION_PLANNING: (
        "Which of these feels like a realistic next step you could take?"
    ),
    ConversationStage.TIME_FREQUENCY: (
        "When would you like to start, and how often do you think you "
        "could realistically do this?"
    ),
}

CLOSURE_ALREADY_COMPLETED_TEXT = (
    "This reflection session has already been completed. Feel free to "
    "start a new session whenever you'd like to think through something else."
)

DEFAULT_TITLE = "New Session"
TITLE_MAX_LENGTH = 60


def _next_stage(current: ConversationStage) -> ConversationStage:
    """One user message advances the conversation by exactly one stage."""
    index = STAGE_ORDER.index(current)
    if index >= len(STAGE_ORDER) - 1:
        return ConversationStage.CLOSURE
    return STAGE_ORDER[index + 1]


def _generate_title(content: str) -> str:
    text = content.strip()
    if not text:
        return DEFAULT_TITLE
    if len(text) > TITLE_MAX_LENGTH:
        return text[: TITLE_MAX_LENGTH - 3].rstrip() + "..."
    return text


def _build_closure_message(previous_user_messages: List[Dict[str, Any]], time_frequency_answer: str) -> str:
    """
    Reflects the user's own action-planning and time/frequency answers
    back to them as a plain-text template. This is deterministic string
    substitution, not NLP analysis or generation.

    The user's answers are presented as labeled quotes rather than woven
    into a single sentence (e.g. "you're planning to {action_answer}"),
    because the user's own words are typically already a full sentence
    (e.g. "I will study for 30 minutes every evening."). Embedding a full
    sentence mid-sentence like that produces duplicated, ungrammatical
    phrasing ("...you're planning to I will study..."). Quoting each
    answer under its own label reads naturally regardless of how the
    user phrased their answer.
    """
    action_answer = (
        previous_user_messages[-1]["content"].strip() if previous_user_messages else "the step we discussed"
    )
    time_answer = time_frequency_answer.strip()
    return (
        f'Here\'s what I\'m hearing. Your plan: "{action_answer}" '
        f'Your timing: "{time_answer}" '
        f"Does that capture what you'd like to commit to? This plan is "
        f"yours, and it's here whenever you want to revisit it."
    )


def _make_message(role: MessageRole, content: str) -> Dict[str, Any]:
    return {
        "role": role.value,
        "content": content,
        "timestamp": datetime.now(timezone.utc),
    }


def _to_object_id(conversation_id: str) -> ObjectId:
    try:
        return ObjectId(conversation_id)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid conversation ID format.",
        )


async def create_conversation(
    db: AsyncIOMotorDatabase,
    user_id: str,
    title: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Start a new conversation for the given user. Automatically stores the
    stage-1 (opening) assistant prompt so the client has something to
    render immediately after creation.
    """
    now = datetime.now(timezone.utc)
    opening_message = _make_message(MessageRole.ASSISTANT, STAGE_PROMPTS[ConversationStage.OPENING])

    doc = {
        "user_id": user_id,
        "title": title.strip() if title and title.strip() else DEFAULT_TITLE,
        "stage": ConversationStage.OPENING.value,
        "status": ConversationStatus.ACTIVE.value,
        "messages": [opening_message],
        "created_at": now,
        "updated_at": now,
    }

    result = await db[COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Conversation created: %s (user=%s)", doc["_id"], user_id)
    return doc


async def list_conversations(db: AsyncIOMotorDatabase, user_id: str) -> List[Dict[str, Any]]:
    """Return this user's conversations, most recently updated first."""
    cursor = db[COLLECTION].find({"user_id": user_id}).sort("updated_at", -1)
    return [doc async for doc in cursor]


async def get_owned_conversation(
    db: AsyncIOMotorDatabase, user_id: str, conversation_id: str
) -> Dict[str, Any]:
    """
    Fetch a conversation, strictly scoped to its owner.

    Returns 404 (never 403) for both "conversation does not exist" and
    "conversation belongs to another user", so a response code can never
    be used to confirm whether a given conversation_id exists at all.
    """
    object_id = _to_object_id(conversation_id)
    doc = await db[COLLECTION].find_one({"_id": object_id, "user_id": user_id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return doc


async def delete_conversation(db: AsyncIOMotorDatabase, user_id: str, conversation_id: str) -> None:
    object_id = _to_object_id(conversation_id)
    result = await db[COLLECTION].delete_one({"_id": object_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    logger.info("Conversation deleted: %s (user=%s)", conversation_id, user_id)


async def add_user_message(
    db: AsyncIOMotorDatabase,
    user_id: str,
    conversation_id: str,
    content: str,
) -> Dict[str, Any]:
    """
    Core Phase 2 engine entry point:
      1. Load the conversation (ownership-checked).
      2. Determine the next stage deterministically.
      3. Generate the corresponding placeholder assistant response.
      4. Persist both the user message and the assistant response.
      5. Update stage/status/updated_at.
      6. Return the updated conversation document.
    """
    conversation = await get_owned_conversation(db, user_id, conversation_id)

    current_stage = ConversationStage(conversation["stage"])
    existing_messages: List[Dict[str, Any]] = conversation.get("messages", [])
    previous_user_messages = [m for m in existing_messages if m["role"] == MessageRole.USER.value]

    user_message = _make_message(MessageRole.USER, content)
    messages_to_append = [user_message]

    if current_stage == ConversationStage.CLOSURE:
        # Session already completed — acknowledge without re-advancing or
        # regenerating the plan summary.
        new_stage = ConversationStage.CLOSURE
        assistant_text = CLOSURE_ALREADY_COMPLETED_TEXT
    else:
        new_stage = _next_stage(current_stage)
        if new_stage == ConversationStage.CLOSURE:
            assistant_text = _build_closure_message(previous_user_messages, content)
        else:
            assistant_text = STAGE_PROMPTS[new_stage]

    messages_to_append.append(_make_message(MessageRole.ASSISTANT, assistant_text))

    new_status = (
        ConversationStatus.COMPLETED if new_stage == ConversationStage.CLOSURE else ConversationStatus.ACTIVE
    )

    set_fields: Dict[str, Any] = {
        "stage": new_stage.value,
        "status": new_status.value,
        "updated_at": datetime.now(timezone.utc),
    }

    # Auto-generate a display title from the user's very first message, if
    # the conversation still has the default placeholder title.
    if conversation.get("title") == DEFAULT_TITLE and current_stage == ConversationStage.OPENING:
        set_fields["title"] = _generate_title(content)

    object_id = conversation["_id"]
    await db[COLLECTION].update_one(
        {"_id": object_id, "user_id": user_id},
        {
            "$push": {"messages": {"$each": messages_to_append}},
            "$set": set_fields,
        },
    )

    updated = await db[COLLECTION].find_one({"_id": object_id, "user_id": user_id})
    return updated
