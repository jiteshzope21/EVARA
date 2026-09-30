"""
Planner models (Phase 4).

A plan is a user-owned action item, either explicitly submitted by the
user or derived from their own words at conversation closure (Phase 2).
No autonomous recommendation logic is involved — a plan only ever
contains what the user (or their own prior conversation text) stated.
"""

import re
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class PlanStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


def _validate_date(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if not _DATE_RE.match(value):
        raise ValueError("date must be in YYYY-MM-DD format")
    return value


def _validate_time(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if not _TIME_RE.match(value):
        raise ValueError("time must be in 24-hour HH:MM format")
    return value


class PlanCreate(BaseModel):
    action: str = Field(min_length=1, max_length=500)
    conversation_id: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    frequency: Optional[str] = Field(default=None, max_length=100)

    @field_validator("action")
    @classmethod
    def action_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("action cannot be empty")
        return stripped

    @field_validator("date")
    @classmethod
    def validate_date_format(cls, value: Optional[str]) -> Optional[str]:
        return _validate_date(value)

    @field_validator("time")
    @classmethod
    def validate_time_format(cls, value: Optional[str]) -> Optional[str]:
        return _validate_time(value)


class PlanUpdate(BaseModel):
    """All fields optional — PATCH semantics. At least one must be set."""

    action: Optional[str] = Field(default=None, min_length=1, max_length=500)
    date: Optional[str] = None
    time: Optional[str] = None
    frequency: Optional[str] = Field(default=None, max_length=100)
    status: Optional[PlanStatus] = None

    @field_validator("action")
    @classmethod
    def action_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("action cannot be empty")
        return stripped

    @field_validator("date")
    @classmethod
    def validate_date_format(cls, value: Optional[str]) -> Optional[str]:
        return _validate_date(value)

    @field_validator("time")
    @classmethod
    def validate_time_format(cls, value: Optional[str]) -> Optional[str]:
        return _validate_time(value)


class PlanOut(BaseModel):
    id: str
    user_id: str
    conversation_id: Optional[str] = None
    action: str
    date: Optional[str] = None
    time: Optional[str] = None
    frequency: Optional[str] = None
    status: PlanStatus
    created_at: datetime
    updated_at: datetime
