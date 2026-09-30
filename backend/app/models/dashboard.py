"""
Dashboard and progress models (Phase 4).

Every field is a deterministic count or excerpt computed directly from
persisted MongoDB documents (conversations, plans, analyses, reports) —
nothing here is estimated, predicted, or fabricated. If a metric cannot
be computed from existing stored data, it is omitted rather than guessed.
"""

from datetime import datetime
from typing import Dict, List

from pydantic import BaseModel


class ConversationSummaryItem(BaseModel):
    id: str
    title: str
    stage: str
    status: str
    updated_at: datetime


class PlanSummaryItem(BaseModel):
    id: str
    action: str
    status: str
    date: str | None = None
    updated_at: datetime


class ReportSummaryItem(BaseModel):
    id: str
    conversation_id: str
    dominant_sentiment: str
    dominant_emotion: str
    safety_level: str
    created_at: datetime


class ThemeCount(BaseModel):
    theme: str
    count: int


class DashboardOut(BaseModel):
    conversation_count: int
    completed_conversation_count: int
    active_conversation_count: int
    recent_conversations: List[ConversationSummaryItem]

    pending_plan_count: int
    completed_plan_count: int
    cancelled_plan_count: int
    active_plans: List[PlanSummaryItem]

    recent_reports: List[ReportSummaryItem]

    sentiment_trend: Dict[str, int]
    top_themes: List[ThemeCount]


class ProgressOut(BaseModel):
    total_plans: int
    pending_plans: int
    completed_plans: int
    cancelled_plans: int
    completion_percentage: float

    recent_completed_plans: List[PlanSummaryItem]
    plans_completed_last_7_days: int

    total_conversations: int
    completed_conversations: int
