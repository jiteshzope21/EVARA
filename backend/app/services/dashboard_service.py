"""
Dashboard service (Phase 4).

Aggregates a user's existing conversations, plans, and analyses into a
single read-only summary. Every value is computed directly from
persisted MongoDB documents at request time — nothing is cached,
estimated, or fabricated. Phase 1-3 services/files are not modified;
where a new read pattern is needed (e.g. trend aggregation over
analyses), this module queries the existing `analyses` collection
directly rather than adding new methods to the Phase 3 service layer.
"""

from collections import Counter
from typing import Any, Dict, List

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services import conversation_service, planner_service, report_service

RECENT_LIMIT = 5


async def _sentiment_and_theme_trends(db: AsyncIOMotorDatabase, user_id: str) -> tuple[Dict[str, int], List[Dict]]:
    sentiment_counts: Counter = Counter({"positive": 0, "negative": 0, "neutral": 0})
    theme_counts: Counter = Counter()

    cursor = db["analyses"].find({"user_id": user_id}, {"sentiment": 1, "themes": 1})
    async for doc in cursor:
        label = doc.get("sentiment", {}).get("label")
        if label in sentiment_counts:
            sentiment_counts[label] += 1
        for theme in doc.get("themes", []):
            theme_counts[theme["theme"]] += theme.get("match_count", 1)

    top_themes = [{"theme": theme, "count": count} for theme, count in theme_counts.most_common(5)]
    return dict(sentiment_counts), top_themes


async def build_dashboard(db: AsyncIOMotorDatabase, user_id: str) -> Dict[str, Any]:
    conversations = await conversation_service.list_conversations(db, user_id)
    completed_conversations = [c for c in conversations if c.get("status") == "completed"]

    plan_counts = await planner_service.count_plans_by_status(db, user_id)
    active_plans = await planner_service.list_plans(db, user_id, status_filter="pending")

    recent_reports = await report_service.list_recent_reports(db, user_id, limit=RECENT_LIMIT)
    sentiment_trend, top_themes = await _sentiment_and_theme_trends(db, user_id)

    return {
        "conversation_count": len(conversations),
        "completed_conversation_count": len(completed_conversations),
        "active_conversation_count": len(conversations) - len(completed_conversations),
        "recent_conversations": [
            {
                "id": str(c["_id"]),
                "title": c["title"],
                "stage": c["stage"],
                "status": c["status"],
                "updated_at": c["updated_at"],
            }
            for c in conversations[:RECENT_LIMIT]
        ],
        "pending_plan_count": plan_counts["pending"],
        "completed_plan_count": plan_counts["completed"],
        "cancelled_plan_count": plan_counts["cancelled"],
        "active_plans": [
            {
                "id": str(p["_id"]),
                "action": p["action"],
                "status": p["status"],
                "date": p.get("date"),
                "updated_at": p["updated_at"],
            }
            for p in active_plans[:RECENT_LIMIT]
        ],
        "recent_reports": [
            {
                "id": str(r["_id"]),
                "conversation_id": r["conversation_id"],
                "dominant_sentiment": r["dominant_sentiment"],
                "dominant_emotion": r["dominant_emotion"],
                "safety_level": r["safety_level"],
                "created_at": r["created_at"],
            }
            for r in recent_reports
        ],
        "sentiment_trend": sentiment_trend,
        "top_themes": top_themes,
    }
