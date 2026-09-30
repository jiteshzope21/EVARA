"""
Report service (Phase 4).

Generates a structured, non-clinical reflection report from a
conversation's already-stored Phase 3 analysis (never re-running NLP
here — see app/services/analysis_service.py, which owns that). Ownership
is enforced by delegating to the existing Phase 2/3 services rather than
a third ownership implementation.
"""

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.logging import get_logger
from app.services import analysis_service, conversation_service

logger = get_logger(__name__)

COLLECTION = "reports"

REFLECTION_SUMMARY_MAX_LENGTH = 400


def _build_reflection_summary(normalized_text: str) -> str:
    text = (normalized_text or "").strip()
    if len(text) <= REFLECTION_SUMMARY_MAX_LENGTH:
        return text
    return text[: REFLECTION_SUMMARY_MAX_LENGTH - 3].rstrip() + "..."


def _extract_action_plan(conversation: Dict[str, Any]) -> str | None:
    """
    If the conversation reached closure, return EVARA's own stored closure
    message (already generated deterministically by the Phase 2 engine —
    see conversation_service._build_closure_message) rather than
    recomputing or reinterpreting anything.
    """
    if conversation.get("status") != "completed":
        return None
    messages = conversation.get("messages", [])
    assistant_messages = [m for m in messages if m.get("role") == "assistant"]
    return assistant_messages[-1]["content"] if assistant_messages else None


async def generate_report(db: AsyncIOMotorDatabase, user_id: str, conversation_id: str) -> Dict[str, Any]:
    """
    Build and persist a report for an owned conversation, using its most
    recently generated Phase 3 analysis. Raises 404 (via
    analysis_service.get_latest_analysis) if no analysis exists yet —
    reports are never fabricated from absent data.
    """
    conversation = await conversation_service.get_owned_conversation(db, user_id, conversation_id)
    analysis = await analysis_service.get_latest_analysis(db, user_id, conversation_id)

    doc: Dict[str, Any] = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "analysis_id": str(analysis["_id"]),
        "conversation_title": conversation["title"],
        "conversation_stage": conversation["stage"],
        "conversation_status": conversation["status"],
        "reflection_summary": _build_reflection_summary(analysis["normalized_text"]),
        "themes": analysis["themes"],
        "dominant_sentiment": analysis["sentiment"]["label"],
        "dominant_emotion": analysis["emotion"]["dominant_emotion"],
        "intent": {
            "label": analysis["intent"]["label"],
            "confidence": analysis["intent"]["confidence"],
            "is_low_confidence": analysis["intent"]["is_low_confidence"],
        },
        "safety_level": analysis["safety"]["level"],
        "safety_note": analysis["safety"]["note"],
        "evidence_summary": analysis["evidence"]["summary"],
        "action_plan": _extract_action_plan(conversation),
        "created_at": datetime.now(timezone.utc),
    }

    result = await db[COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Report generated: %s (conversation=%s, user=%s)", doc["_id"], conversation_id, user_id)
    return doc


async def get_latest_report(db: AsyncIOMotorDatabase, user_id: str, conversation_id: str) -> Dict[str, Any]:
    await conversation_service.get_owned_conversation(db, user_id, conversation_id)

    doc = await db[COLLECTION].find_one(
        {"conversation_id": conversation_id, "user_id": user_id},
        sort=[("created_at", -1)],
    )
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No report has been generated for this conversation yet.",
        )
    return doc


async def list_recent_reports(db: AsyncIOMotorDatabase, user_id: str, limit: int = 5) -> list:
    """Most recent reports across all of a user's conversations (for the dashboard)."""
    cursor = db[COLLECTION].find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    return [doc async for doc in cursor]
