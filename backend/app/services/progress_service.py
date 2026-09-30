"""
Progress service (Phase 4).

Deterministic metrics derived only from persisted plan and conversation
records. If a metric can't be reliably computed from existing data, it
is left out rather than estimated.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services import conversation_service, planner_service

RECENT_COMPLETED_LIMIT = 5
ACTIVITY_WINDOW_DAYS = 7


def _completion_percentage(pending: int, completed: int) -> float:
    """
    Completion percentage over "actionable" plans (pending + completed),
    deliberately excluding cancelled plans from the denominator so a
    cancelled item doesn't count against the user's progress. Returns
    0.0 when there are no actionable plans at all.
    """
    actionable = pending + completed
    if actionable == 0:
        return 0.0
    return round((completed / actionable) * 100, 2)


async def build_progress(db: AsyncIOMotorDatabase, user_id: str) -> Dict[str, Any]:
    plan_counts = await planner_service.count_plans_by_status(db, user_id)
    pending = plan_counts["pending"]
    completed = plan_counts["completed"]
    cancelled = plan_counts["cancelled"]
    total = pending + completed + cancelled

    all_plans = await planner_service.list_plans(db, user_id)
    completed_plans = [p for p in all_plans if p["status"] == "completed"]
    completed_plans.sort(key=lambda p: p["updated_at"], reverse=True)

    cutoff = datetime.now(timezone.utc) - timedelta(days=ACTIVITY_WINDOW_DAYS)
    plans_completed_last_7_days = sum(
        1 for p in completed_plans if _as_aware(p["updated_at"]) >= cutoff
    )

    conversations = await conversation_service.list_conversations(db, user_id)
    completed_conversations = [c for c in conversations if c.get("status") == "completed"]

    return {
        "total_plans": total,
        "pending_plans": pending,
        "completed_plans": completed,
        "cancelled_plans": cancelled,
        "completion_percentage": _completion_percentage(pending, completed),
        "recent_completed_plans": [
            {
                "id": str(p["_id"]),
                "action": p["action"],
                "status": p["status"],
                "date": p.get("date"),
                "updated_at": p["updated_at"],
            }
            for p in completed_plans[:RECENT_COMPLETED_LIMIT]
        ],
        "plans_completed_last_7_days": plans_completed_last_7_days,
        "total_conversations": len(conversations),
        "completed_conversations": len(completed_conversations),
    }


def _as_aware(dt: datetime) -> datetime:
    """MongoDB may return naive UTC datetimes (see Phase 1/2 precedent); normalize for comparison."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
