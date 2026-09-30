"""
Conversation API (Phase 2).

Endpoints:
    POST   /api/conversations
    GET    /api/conversations
    GET    /api/conversations/{conversation_id}
    POST   /api/conversations/{conversation_id}/messages
    DELETE /api/conversations/{conversation_id}

All endpoints require authentication (HTTP Bearer JWT, reusing the
`get_current_user` dependency from Phase 1's auth module) and are
strictly scoped to the authenticated user's own conversations. Business
logic lives in app/services/conversation_service.py — this file only
handles request/response wiring.
"""

from typing import List

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth import get_current_user
from app.database.connection import get_database
from app.models.conversation import (
    ConversationCreate,
    ConversationOut,
    ConversationSummaryOut,
    MessageCreate,
)
from app.models.user import UserInDB
from app.services import conversation_service

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _doc_to_out(doc: dict) -> ConversationOut:
    return ConversationOut(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        title=doc["title"],
        stage=doc["stage"],
        status=doc["status"],
        messages=doc.get("messages", []),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def _doc_to_summary(doc: dict) -> ConversationSummaryOut:
    return ConversationSummaryOut(
        id=str(doc["_id"]),
        title=doc["title"],
        stage=doc["stage"],
        status=doc["status"],
        message_count=len(doc.get("messages", [])),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate = ConversationCreate(),
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ConversationOut:
    doc = await conversation_service.create_conversation(db, current_user.id, payload.title)
    return _doc_to_out(doc)


@router.get("", response_model=List[ConversationSummaryOut])
async def list_conversations(
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> List[ConversationSummaryOut]:
    docs = await conversation_service.list_conversations(db, current_user.id)
    return [_doc_to_summary(doc) for doc in docs]


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ConversationOut:
    doc = await conversation_service.get_owned_conversation(db, current_user.id, conversation_id)
    return _doc_to_out(doc)


@router.post("/{conversation_id}/messages", response_model=ConversationOut)
async def send_message(
    conversation_id: str,
    payload: MessageCreate,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ConversationOut:
    doc = await conversation_service.add_user_message(
        db, current_user.id, conversation_id, payload.content
    )
    return _doc_to_out(doc)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> None:
    await conversation_service.delete_conversation(db, current_user.id, conversation_id)
