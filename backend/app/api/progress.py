"""
Progress API (Phase 4).

    GET /api/progress

Authenticated, scoped strictly to the current user's own data.
"""

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth import get_current_user
from app.database.connection import get_database
from app.models.dashboard import ProgressOut
from app.models.user import UserInDB
from app.services import progress_service

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("", response_model=ProgressOut)
async def get_progress(
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ProgressOut:
    data = await progress_service.build_progress(db, current_user.id)
    return ProgressOut(**data)
