"""
Analysis service (Phase 3).

Orchestrates:
    owned conversation lookup (reusing Phase 2's ownership-checked
    conversation_service, not a second implementation)
        -> concatenate the conversation's user messages
        -> NLP/LMTA pipeline (app/nlp/pipeline.py)
        -> safety analysis (app/safety/rules.py)
        -> evidence aggregation (app/reasoning/evidence.py)
        -> persist to the `analyses` collection, scoped to user_id +
           conversation_id
        -> return the structured result

This file contains no NLP logic itself — it only wires together the
already-implemented, independently testable modules.
"""

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.logging import get_logger
from app.nlp.pipeline import run_pipeline
from app.reasoning.evidence import aggregate_evidence
from app.safety.rules import analyze_safety
from app.services import conversation_service

logger = get_logger(__name__)

COLLECTION = "analyses"


def _extract_user_text(conversation: Dict[str, Any]) -> str:
    """
    Concatenate all of the conversation's user-authored messages (in
    order) into one text for analysis. Assistant messages (the Phase 2
    engine's own deterministic prompts) are intentionally excluded —
    Phase 3 analyzes what the USER said, not EVARA's own prompts.
    """
    messages = conversation.get("messages", [])
    user_messages = [m["content"] for m in messages if m.get("role") == "user"]
    return ". ".join(m.strip().rstrip(".") for m in user_messages if m and m.strip())


async def generate_analysis(
    db: AsyncIOMotorDatabase, user_id: str, conversation_id: str
) -> Dict[str, Any]:
    """
    Run the full Phase 3 pipeline over an owned conversation's user
    messages, persist the result, and return the stored document.
    """
    conversation = await conversation_service.get_owned_conversation(db, user_id, conversation_id)

    combined_text = _extract_user_text(conversation)
    user_message_count = sum(1 for m in conversation.get("messages", []) if m.get("role") == "user")

    if not combined_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This conversation has no user messages yet to analyze.",
        )

    pipeline_result = run_pipeline(combined_text)
    safety_result = analyze_safety(
        pipeline_result.normalized_text, pipeline_result.sentiment, pipeline_result.emotion
    )
    evidence_result = aggregate_evidence(pipeline_result, safety_result)

    doc: Dict[str, Any] = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "source_message_count": user_message_count,
        "original_text": pipeline_result.original_text,
        "normalized_text": pipeline_result.normalized_text,
        "sentences": pipeline_result.sentences,
        "tokens": pipeline_result.tokens,
        "lemmas": pipeline_result.lemmas,
        "ngrams": pipeline_result.ngrams,
        "tfidf": pipeline_result.tfidf,
        "embedding": pipeline_result.embedding,
        "sentiment": pipeline_result.sentiment,
        "emotion": pipeline_result.emotion,
        "intent": pipeline_result.intent,
        "themes": pipeline_result.themes,
        "semantics": pipeline_result.semantics,
        "safety": safety_result,
        "evidence": evidence_result,
        "warnings": pipeline_result.warnings,
        "created_at": datetime.now(timezone.utc),
    }

    result = await db[COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info(
        "Analysis generated: %s (conversation=%s, user=%s, safety_level=%s)",
        doc["_id"], conversation_id, user_id, safety_result["level"],
    )
    return doc


async def get_latest_analysis(
    db: AsyncIOMotorDatabase, user_id: str, conversation_id: str
) -> Dict[str, Any]:
    """
    Fetch the most recently generated analysis for an owned conversation.
    Ownership is re-verified via get_owned_conversation so a nonexistent
    or not-owned conversation_id returns the same 404 as elsewhere,
    rather than leaking existence via a different error path.
    """
    await conversation_service.get_owned_conversation(db, user_id, conversation_id)

    doc = await db[COLLECTION].find_one(
        {"conversation_id": conversation_id, "user_id": user_id},
        sort=[("created_at", -1)],
    )
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analysis has been generated for this conversation yet.",
        )
    return doc
