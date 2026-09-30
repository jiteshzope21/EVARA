"""
Planner service (Phase 4).

Plain CRUD over user-owned plan documents, following the same
ownership-scoped-query pattern established in
app/services/conversation_service.py (Phase 2) — every query includes
user_id directly rather than fetching first and checking after. No
recommendation logic: a plan only ever contains what the client
explicitly submitted.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.logging import get_logger
from app.models.plan import PlanStatus

logger = get_logger(__name__)

COLLECTION = "plans"


def _to_object_id(plan_id: str) -> ObjectId:
    try:
        return ObjectId(plan_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan ID format.")


async def create_plan(
    db: AsyncIOMotorDatabase,
    user_id: str,
    action: str,
    conversation_id: Optional[str] = None,
    date: Optional[str] = None,
    time: Optional[str] = None,
    frequency: Optional[str] = None,
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "action": action,
        "date": date,
        "time": time,
        "frequency": frequency,
        "status": PlanStatus.PENDING.value,
        "created_at": now,
        "updated_at": now,
    }
    result = await db[COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Plan created: %s (user=%s)", doc["_id"], user_id)
    return doc


async def list_plans(
    db: AsyncIOMotorDatabase, user_id: str, status_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {"user_id": user_id}
    if status_filter is not None:
        query["status"] = status_filter
    cursor = db[COLLECTION].find(query).sort("created_at", -1)
    return [doc async for doc in cursor]


async def get_owned_plan(db: AsyncIOMotorDatabase, user_id: str, plan_id: str) -> Dict[str, Any]:
    object_id = _to_object_id(plan_id)
    doc = await db[COLLECTION].find_one({"_id": object_id, "user_id": user_id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")
    return doc


async def update_plan(
    db: AsyncIOMotorDatabase, user_id: str, plan_id: str, updates: Dict[str, Any]
) -> Dict[str, Any]:
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="At least one field must be provided to update."
        )

    plan = await get_owned_plan(db, user_id, plan_id)
    updates = dict(updates)
    updates["updated_at"] = datetime.now(timezone.utc)

    await db[COLLECTION].update_one({"_id": plan["_id"], "user_id": user_id}, {"$set": updates})
    return await db[COLLECTION].find_one({"_id": plan["_id"], "user_id": user_id})


async def mark_completed(db: AsyncIOMotorDatabase, user_id: str, plan_id: str) -> Dict[str, Any]:
    return await update_plan(db, user_id, plan_id, {"status": PlanStatus.COMPLETED.value})


async def cancel_plan(db: AsyncIOMotorDatabase, user_id: str, plan_id: str) -> Dict[str, Any]:
    return await update_plan(db, user_id, plan_id, {"status": PlanStatus.CANCELLED.value})


async def delete_plan(db: AsyncIOMotorDatabase, user_id: str, plan_id: str) -> None:
    object_id = _to_object_id(plan_id)
    result = await db[COLLECTION].delete_one({"_id": object_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found.")
    logger.info("Plan deleted: %s (user=%s)", plan_id, user_id)


async def count_plans_by_status(db: AsyncIOMotorDatabase, user_id: str) -> Dict[str, int]:
    """Returns {"pending": n, "completed": n, "cancelled": n} for a user."""
    counts: Dict[str, int] = {}
    for plan_status in PlanStatus:
        counts[plan_status.value] = await db[COLLECTION].count_documents(
            {"user_id": user_id, "status": plan_status.value}
        )
    return counts
