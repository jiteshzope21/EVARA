"""
SLM Chat Service (Phase 5).

Provides a dedicated, multi-turn, free-flowing conversation engine powered by
the fine-tuned TinyLlama SLM and PEFT LoRA adapter.

Key design & isolation guarantees:
1. Strict separation: All records are stored in the `slm_conversations` collection.
   Deterministic `conversations` documents are NEVER touched or queried here.
2. Safety is non-negotiable: Every user turn runs through the deterministic NLP
   pipeline, safety rules, evidence aggregation, and urgent safety bypass before
   any token generation.
3. Model validation: Real model outputs pass through validate_response() to enforce
   non-clinical boundaries (no diagnosis, no medication advice, no therapist claims).
4. Multi-turn bounded context: Relevant recent turns (up to max_recent_messages)
   are structured into GenerationContext using ChatML tags without unbounded growth.
5. User ownership: Enforces strict user_id scoping (404 on non-owned or missing chats).
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.logging import get_logger
from app.nlp.pipeline import run_pipeline
from app.reasoning.evidence import aggregate_evidence
from app.safety.rules import analyze_safety
from app.slm.config import DEFAULT_MODEL_NAME, SLMConfig
from app.slm.inference import run_inference
from app.slm.model import load_model
from app.slm.prompting import (
    ELEVATED_CONCERN_RESPONSE,
    URGENT_SAFETY_RESPONSE,
    GenerationContext,
    NLPSignals,
    RecentMessage,
)
from app.slm.validation import validate_response

logger = get_logger(__name__)

COLLECTION = "slm_conversations"
DEFAULT_SLM_TITLE = "New Reflection Chat"
TITLE_MAX_LENGTH = 60

INITIAL_GREETING = (
    "Hello, I'm Evara. In this free-flowing dialogue mode, I'm here to listen, "
    "reflect with you, and help you think through whatever is on your mind. "
    "How are you feeling right now?"
)


def _to_object_id(conversation_id: str) -> ObjectId:
    try:
        return ObjectId(conversation_id)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid conversation ID format.",
        )


def _generate_title(content: str) -> str:
    text = content.strip()
    if not text:
        return DEFAULT_SLM_TITLE
    if len(text) > TITLE_MAX_LENGTH:
        return text[: TITLE_MAX_LENGTH - 3].rstrip() + "..."
    return text


def _build_config(settings: Any) -> SLMConfig:
    """Build an SLMConfig instance from app settings."""
    model_name = settings.slm_model.strip() if settings.slm_model else DEFAULT_MODEL_NAME
    adapter_path = (
        settings.slm_adapter_path.strip()
        if getattr(settings, "slm_adapter_path", None)
        else None
    )
    return SLMConfig(model_name=model_name, adapter_path=adapter_path)


async def create_slm_conversation(
    db: AsyncIOMotorDatabase,
    user_id: str,
    title: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new standalone SLM chat with an initial welcoming assistant turn."""
    now = datetime.now(timezone.utc)
    settings = get_settings()
    config = _build_config(settings)

    model_label = f"{config.display_name} [MOCK]" if settings.mock_slm else config.display_name

    initial_message = {
        "role": "assistant",
        "content": INITIAL_GREETING,
        "timestamp": now,
        "model": model_label,
        "validated": True,
        "safety_level": "normal",
        "duration_ms": None,
    }

    doc = {
        "user_id": user_id,
        "title": title.strip() if title and title.strip() else DEFAULT_SLM_TITLE,
        "messages": [initial_message],
        "created_at": now,
        "updated_at": now,
    }

    result = await db[COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("SLM conversation created: %s (user=%s)", doc["_id"], user_id)
    return doc


async def list_slm_conversations(
    db: AsyncIOMotorDatabase,
    user_id: str,
) -> List[Dict[str, Any]]:
    """Return all SLM conversations belonging to user, most recently updated first."""
    cursor = db[COLLECTION].find({"user_id": user_id}).sort("updated_at", -1)
    return [doc async for doc in cursor]


async def get_owned_slm_conversation(
    db: AsyncIOMotorDatabase,
    user_id: str,
    conversation_id: str,
) -> Dict[str, Any]:
    """Fetch an SLM conversation strictly scoped to user_id (returns 404 if not found)."""
    object_id = _to_object_id(conversation_id)
    doc = await db[COLLECTION].find_one({"_id": object_id, "user_id": user_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SLM conversation not found.",
        )
    return doc


async def delete_slm_conversation(
    db: AsyncIOMotorDatabase,
    user_id: str,
    conversation_id: str,
) -> None:
    """Delete an owned SLM conversation document."""
    object_id = _to_object_id(conversation_id)
    result = await db[COLLECTION].delete_one({"_id": object_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SLM conversation not found.",
        )
    logger.info("SLM conversation deleted: %s (user=%s)", conversation_id, user_id)


async def send_slm_chat_message(
    db: AsyncIOMotorDatabase,
    user_id: str,
    conversation_id: str,
    content: str,
) -> Dict[str, Any]:
    """
    Append a user message, run NLP & safety triage, generate multi-turn SLM response,
    validate output, atomically persist both turns, and return the updated conversation.
    """
    settings = get_settings()
    config = _build_config(settings)

    conversation = await get_owned_slm_conversation(db, user_id, conversation_id)
    existing_messages: List[Dict[str, Any]] = conversation.get("messages", [])

    now = datetime.now(timezone.utc)
    user_msg = {
        "role": "user",
        "content": content,
        "timestamp": now,
    }

    # Step 1: Run NLP analysis on the new user message
    pipeline_result = run_pipeline(content)

    # Step 2: Deterministic safety analysis
    safety_result = analyze_safety(
        pipeline_result.normalized_text,
        pipeline_result.sentiment,
        pipeline_result.emotion,
    )

    # Step 3: Evidence aggregation
    evidence_result = aggregate_evidence(pipeline_result, safety_result)

    # Step 4: Determine response policy
    safety_level = safety_result.get("level", "normal")
    if safety_level == "urgent":
        policy = "urgent"
    elif safety_level == "elevated_concern":
        policy = "elevated_concern"
    else:
        policy = "normal"

    # Step 5: Bounded recent history (last max_recent_messages turns)
    recent_history: List[RecentMessage] = []
    for m in existing_messages[-config.max_recent_messages:]:
        recent_history.append(RecentMessage(role=m["role"], content=m["content"]))

    nlp_signals = NLPSignals(
        sentiment_label=pipeline_result.sentiment.get("label"),
        sentiment_score=pipeline_result.sentiment.get("score"),
        dominant_emotion=pipeline_result.emotion.get("dominant_emotion"),
        intent_label=pipeline_result.intent.get("label"),
        top_themes=[t["theme"] for t in pipeline_result.themes[:3]],
    )

    gen_context = GenerationContext(
        conversation_stage="strategy_exploration",
        latest_user_message=content,
        recent_messages=recent_history,
        nlp=nlp_signals,
        safety_level=safety_level,
        safety_signals=safety_result.get("matched_signal_categories", []),
        evidence_summary=evidence_result,
        response_policy=policy,
    )

    # Step 6: Generate or policy bypass
    if policy == "urgent":
        # Mandatory safety bypass — model is NOT called
        logger.warning("Urgent safety detected in SLM chat (%s) — bypassed.", conversation_id)
        final_text = URGENT_SAFETY_RESPONSE
        validated = True
        duration_ms = 0.0
        model_name = config.display_name if not settings.mock_slm else f"{config.display_name} [MOCK]"
    elif settings.mock_slm:
        # Mock mode
        if policy == "elevated_concern":
            final_text = ELEVATED_CONCERN_RESPONSE
        else:
            final_text = (
                "Thank you for sharing that with me. I hear how that feels, "
                "and I'm right here with you. What part of that feels most important for you to focus on?"
            )
        validated = True
        duration_ms = None
        model_name = f"{config.display_name} [MOCK]"
    else:
        # Real model inference with LoRA adapter
        try:
            tokenizer, model = load_model(config)
        except RuntimeError as exc:
            logger.error("Failed to load SLM model in chat: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"SLM model is currently unavailable: {exc}",
            )

        inf_result = run_inference(gen_context, config, tokenizer, model)
        final_text = inf_result.text
        validated = inf_result.validated
        duration_ms = inf_result.duration_ms
        model_name = inf_result.model

    assistant_msg = {
        "role": "assistant",
        "content": final_text,
        "timestamp": datetime.now(timezone.utc),
        "model": model_name,
        "validated": validated,
        "safety_level": safety_level,
        "duration_ms": duration_ms,
    }

    # Step 7: Atomically persist both user message and assistant turn
    object_id = conversation["_id"]
    set_fields: Dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc),
    }

    # Auto-generate title if currently default
    if conversation.get("title") == DEFAULT_SLM_TITLE and len(existing_messages) <= 1:
        set_fields["title"] = _generate_title(content)

    await db[COLLECTION].update_one(
        {"_id": object_id, "user_id": user_id},
        {
            "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
            "$set": set_fields,
        },
    )

    updated_doc = await db[COLLECTION].find_one({"_id": object_id, "user_id": user_id})
    logger.info(
        "SLM chat turn completed: conversation=%s, safety=%s, validated=%s, duration_ms=%s",
        conversation_id, safety_level, validated, duration_ms,
    )
    return updated_doc
