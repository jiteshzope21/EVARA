"""
Analysis API (Phase 3).

Endpoints:
    POST /api/analysis/{conversation_id}/generate
    GET  /api/analysis/{conversation_id}

Both require authentication (HTTP Bearer JWT, same dependency as every
other Phase 1/2 route) and are strictly scoped to the authenticated
user's own conversations — ownership is enforced inside
app/services/analysis_service.py by delegating to Phase 2's
`conversation_service.get_owned_conversation`, not a second ownership
implementation.
"""

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth import get_current_user
from app.database.connection import get_database
from app.models.analysis import AnalysisOut
from app.models.user import UserInDB
from app.services import analysis_service

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _doc_to_out(doc: dict) -> AnalysisOut:
    return AnalysisOut(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        conversation_id=doc["conversation_id"],
        source_message_count=doc["source_message_count"],
        original_text=doc["original_text"],
        normalized_text=doc["normalized_text"],
        sentences=doc["sentences"],
        tokens=doc["tokens"],
        lemmas=doc["lemmas"],
        ngrams=doc["ngrams"],
        tfidf=doc["tfidf"],
        embedding=doc["embedding"],
        sentiment=doc["sentiment"],
        emotion=doc["emotion"],
        intent=doc["intent"],
        themes=doc["themes"],
        semantics=doc["semantics"],
        safety=doc["safety"],
        evidence=doc["evidence"],
        warnings=doc["warnings"],
        created_at=doc["created_at"],
    )


@router.post("/{conversation_id}/generate", response_model=AnalysisOut, status_code=status.HTTP_201_CREATED)
async def generate_analysis(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> AnalysisOut:
    doc = await analysis_service.generate_analysis(db, current_user.id, conversation_id)
    return _doc_to_out(doc)


@router.get("/{conversation_id}", response_model=AnalysisOut)
async def get_analysis(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> AnalysisOut:
    doc = await analysis_service.get_latest_analysis(db, current_user.id, conversation_id)
    return _doc_to_out(doc)
