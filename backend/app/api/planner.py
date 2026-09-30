"""
Planner API (Phase 4).

Endpoints:
    POST   /api/planner
    GET    /api/planner              (optional ?status=pending|completed|cancelled)
    GET    /api/planner/{plan_id}
    PATCH  /api/planner/{plan_id}
    POST   /api/planner/{plan_id}/complete
    DELETE /api/planner/{plan_id}

All require authentication and are strictly scoped to the authenticated
user's own plans.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth import get_current_user
from app.database.connection import get_database
from app.models.plan import PlanCreate, PlanOut, PlanStatus, PlanUpdate
from app.models.user import UserInDB
from app.services import planner_service

router = APIRouter(prefix="/api/planner", tags=["planner"])


def _doc_to_out(doc: dict) -> PlanOut:
    return PlanOut(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        conversation_id=doc.get("conversation_id"),
        action=doc["action"],
        date=doc.get("date"),
        time=doc.get("time"),
        frequency=doc.get("frequency"),
        status=doc["status"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@router.post("", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanCreate,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PlanOut:
    doc = await planner_service.create_plan(
        db,
        current_user.id,
        action=payload.action,
        conversation_id=payload.conversation_id,
        date=payload.date,
        time=payload.time,
        frequency=payload.frequency,
    )
    return _doc_to_out(doc)


@router.get("", response_model=List[PlanOut])
async def list_plans(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> List[PlanOut]:
    if status_filter is not None:
        valid_values = {s.value for s in PlanStatus}
        if status_filter not in valid_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter. Must be one of: {sorted(valid_values)}",
            )
    docs = await planner_service.list_plans(db, current_user.id, status_filter=status_filter)
    return [_doc_to_out(doc) for doc in docs]


@router.get("/{plan_id}", response_model=PlanOut)
async def get_plan(
    plan_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PlanOut:
    doc = await planner_service.get_owned_plan(db, current_user.id, plan_id)
    return _doc_to_out(doc)


@router.patch("/{plan_id}", response_model=PlanOut)
async def update_plan(
    plan_id: str,
    payload: PlanUpdate,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PlanOut:
    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] is not None:
        updates["status"] = PlanStatus(updates["status"]).value
    doc = await planner_service.update_plan(db, current_user.id, plan_id, updates)
    return _doc_to_out(doc)


@router.post("/{plan_id}/complete", response_model=PlanOut)
async def complete_plan(
    plan_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PlanOut:
    doc = await planner_service.mark_completed(db, current_user.id, plan_id)
    return _doc_to_out(doc)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> None:
    await planner_service.delete_plan(db, current_user.id, plan_id)
