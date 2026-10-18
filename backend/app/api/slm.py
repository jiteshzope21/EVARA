"""
SLM API (Phase 5).

Endpoints:
    # Reflection assistance (Phase 5 Guided integration)
    POST   /api/slm/{conversation_id}/generate

    # Standalone TinyLlama SLM Chat (Multi-turn, persistent)
    POST   /api/slm/chat/conversations
    GET    /api/slm/chat/conversations
    GET    /api/slm/chat/conversations/{conversation_id}
    POST   /api/slm/chat/conversations/{conversation_id}/messages
    DELETE /api/slm/chat/conversations/{conversation_id}

All endpoints require JWT authentication and enforce strict user ownership.
SLM chat data is strictly isolated within the `slm_conversations` collection.
"""

from typing import List

from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth import get_current_user
from app.database.connection import get_database
from app.models.slm import (
    SLMConversationCreate,
    SLMConversationOut,
    SLMConversationSummaryOut,
    SLMGenerateResponse,
    SLMMessage,
    SLMMessageCreate,
)
from app.models.user import UserInDB
from app.services import slm_chat_service, slm_service

router = APIRouter(prefix="/api/slm", tags=["slm"])


def _doc_to_conversation_out(doc: dict) -> SLMConversationOut:
    return SLMConversationOut(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        title=doc["title"],
        messages=[
            SLMMessage(
                role=m["role"],
                content=m["content"],
                timestamp=m["timestamp"],
                model=m.get("model"),
                validated=m.get("validated"),
                safety_level=m.get("safety_level"),
                duration_ms=m.get("duration_ms"),
            )
            for m in doc.get("messages", [])
        ],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def _doc_to_summary_out(doc: dict) -> SLMConversationSummaryOut:
    return SLMConversationSummaryOut(
        id=str(doc["_id"]),
        title=doc["title"],
        message_count=len(doc.get("messages", [])),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


# ---------------------------------------------------------------------------
# Standalone Multi-turn SLM Chat Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/chat/conversations",
    response_model=SLMConversationOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_slm_chat(
    payload: SLMConversationCreate = SLMConversationCreate(),
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SLMConversationOut:
    """Create a new standalone SLM chat session."""
    doc = await slm_chat_service.create_slm_conversation(
        db=db,
        user_id=current_user.id,
        title=payload.title,
    )
    return _doc_to_conversation_out(doc)


@router.get(
    "/chat/conversations",
    response_model=List[SLMConversationSummaryOut],
)
async def list_slm_chats(
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> List[SLMConversationSummaryOut]:
    """List all standalone SLM chat sessions belonging to the current user."""
    docs = await slm_chat_service.list_slm_conversations(
        db=db,
        user_id=current_user.id,
    )
    return [_doc_to_summary_out(doc) for doc in docs]


@router.get(
    "/chat/conversations/{conversation_id}",
    response_model=SLMConversationOut,
)
async def get_slm_chat(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SLMConversationOut:
    """Retrieve an owned SLM chat session and its full message history."""
    doc = await slm_chat_service.get_owned_slm_conversation(
        db=db,
        user_id=current_user.id,
        conversation_id=conversation_id,
    )
    return _doc_to_conversation_out(doc)


@router.post(
    "/chat/conversations/{conversation_id}/messages",
    response_model=SLMConversationOut,
)
async def send_slm_chat_message(
    conversation_id: str,
    payload: SLMMessageCreate,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SLMConversationOut:
    """
    Append a user message, run NLP & safety triage, generate a bounded multi-turn
    SLM response, atomically persist both turns, and return the updated chat.
    """
    doc = await slm_chat_service.send_slm_chat_message(
        db=db,
        user_id=current_user.id,
        conversation_id=conversation_id,
        content=payload.content,
    )
    return _doc_to_conversation_out(doc)


@router.delete(
    "/chat/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_slm_chat(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> None:
    """Delete an owned SLM chat session."""
    await slm_chat_service.delete_slm_conversation(
        db=db,
        user_id=current_user.id,
        conversation_id=conversation_id,
    )


# ---------------------------------------------------------------------------
# Guided Mode SLM Reflection Assistant Endpoint (Preserved)
# ---------------------------------------------------------------------------


@router.post(
    "/{conversation_id}/generate",
    response_model=SLMGenerateResponse,
)
async def slm_generate(
    conversation_id: str,
    persist: bool = Query(default=False, description="Persist generation metadata to MongoDB"),
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SLMGenerateResponse:
    """
    Generate an SLM-assisted reflection response for the given Guided conversation.
    Preserved for backward compatibility with Guided mode's assistant panel.
    """
    result = await slm_service.generate_slm_response(
        db=db,
        user_id=current_user.id,
        conversation_id=conversation_id,
        persist=persist,
    )
    return SLMGenerateResponse(**result)
