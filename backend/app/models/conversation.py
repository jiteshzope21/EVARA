"""
Conversation models (Phase 2).

Separates:
- ConversationStage / ConversationStatus / MessageRole: controlled enums.
- Message: the embedded message shape stored inside a conversation document.
- ConversationCreate / MessageCreate: request payloads from the client.
- ConversationOut: full conversation representation (includes messages).
- ConversationSummaryOut: lightweight representation for list views.

The conversation document itself is stored as a plain dict in MongoDB
(see app/services/conversation_service.py) rather than round-tripped
through a strict "ConversationInDB" model, matching the lightweight
approach already used for UserInDB in Phase 1.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class ConversationStage(str, Enum):
    OPENING = "opening"
    PROBLEM_EXPLORATION = "problem_exploration"
    CAUSE_REFLECTION = "cause_reflection"
    PRIORITIZATION = "prioritization"
    STRATEGY_EXPLORATION = "strategy_exploration"
    ACTION_PLANNING = "action_planning"
    TIME_FREQUENCY = "time_frequency"
    CLOSURE = "closure"


class ConversationStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class Message(BaseModel):
    role: MessageRole
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ConversationCreate(BaseModel):
    """Optional title; the client may omit the body entirely."""

    title: Optional[str] = Field(default=None, max_length=150)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message content cannot be empty.")
        return stripped


class ConversationOut(BaseModel):
    """Full conversation representation, including all messages."""

    id: str
    user_id: str
    title: str
    stage: ConversationStage
    status: ConversationStatus
    messages: List[Message]
    created_at: datetime
    updated_at: datetime


class ConversationSummaryOut(BaseModel):
    """Lightweight representation for GET /api/conversations (list view)."""

    id: str
    title: str
    stage: ConversationStage
    status: ConversationStatus
    message_count: int
    created_at: datetime
    updated_at: datetime
