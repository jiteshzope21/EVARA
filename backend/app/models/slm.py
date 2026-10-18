"""
SLM response and chat models (Phase 5).

Defines:
- SLMGenerateResponse: response model for the reflection generation endpoint
- SLMMessage / SLMConversation models: standalone multi-turn SLM chat models
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class SLMGenerateResponse(BaseModel):
    """Structured response returned by POST /api/slm/{conversation_id}/generate."""

    text: str
    model: str
    generation_config: Dict[str, Any]
    validated: bool
    warnings: List[str]
    policy_used: str
    safety_bypass: bool
    safety_level: str
    conversation_stage: str
    mock: bool
    duration_ms: Optional[float] = None
    generation_id: Optional[str] = None


class SLMMessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class SLMMessage(BaseModel):
    """Individual message in a standalone SLM chat."""

    role: SLMMessageRole
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    model: Optional[str] = None
    validated: Optional[bool] = None
    safety_level: Optional[str] = None
    duration_ms: Optional[float] = None


class SLMConversationCreate(BaseModel):
    """Request payload to create a new standalone SLM chat."""

    title: Optional[str] = Field(default=None, max_length=150)


class SLMMessageCreate(BaseModel):
    """Request payload to post a message to an SLM chat."""

    content: str = Field(min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message content cannot be empty.")
        return stripped


class SLMConversationOut(BaseModel):
    """Full SLM chat conversation document with complete messages."""

    id: str
    user_id: str
    title: str
    messages: List[SLMMessage]
    created_at: datetime
    updated_at: datetime


class SLMConversationSummaryOut(BaseModel):
    """Summary item for listing user's SLM chats."""

    id: str
    title: str
    message_count: int
    created_at: datetime
    updated_at: datetime
