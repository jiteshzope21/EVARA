"""
Dashboard API (Phase 4).

    GET /api/dashboard

Authenticated, scoped strictly to the current user's own data.
"""

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth import get_current_user
from app.database.connection import get_database
from app.models.dashboard import DashboardOut
from app.models.user import UserInDB
from app.services import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
async def get_dashboard(
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> DashboardOut:
    data = await dashboard_service.build_dashboard(db, current_user.id)
    return DashboardOut(**data)
