"""
Reports API (Phase 4).

Endpoints:
    POST /api/reports/{conversation_id}/generate
    GET  /api/reports/{conversation_id}

Both require authentication and are scoped to the authenticated user's
own conversations, via the same ownership pattern as Phase 2/3.
"""

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth import get_current_user
from app.database.connection import get_database
from app.models.report import ReportOut
from app.models.user import UserInDB
from app.services import report_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _doc_to_out(doc: dict) -> ReportOut:
    return ReportOut(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        conversation_id=doc["conversation_id"],
        analysis_id=doc["analysis_id"],
        conversation_title=doc["conversation_title"],
        conversation_stage=doc["conversation_stage"],
        conversation_status=doc["conversation_status"],
        reflection_summary=doc["reflection_summary"],
        themes=doc["themes"],
        dominant_sentiment=doc["dominant_sentiment"],
        dominant_emotion=doc["dominant_emotion"],
        intent=doc["intent"],
        safety_level=doc["safety_level"],
        safety_note=doc["safety_note"],
        evidence_summary=doc["evidence_summary"],
        action_plan=doc.get("action_plan"),
        created_at=doc["created_at"],
    )


@router.post("/{conversation_id}/generate", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def generate_report(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ReportOut:
    doc = await report_service.generate_report(db, current_user.id, conversation_id)
    return _doc_to_out(doc)


@router.get("/{conversation_id}", response_model=ReportOut)
async def get_report(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ReportOut:
    doc = await report_service.get_latest_report(db, current_user.id, conversation_id)
    return _doc_to_out(doc)
