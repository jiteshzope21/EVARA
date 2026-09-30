"""
Report models (Phase 4).

A report is a structured, non-clinical reflection/wellbeing summary
derived from an existing Phase 2 conversation and its Phase 3 analysis.
It never contains a diagnosis, a medical conclusion, or a mental-health
label — every field here is either copied directly from stored
conversation/analysis data or a thin, deterministic derivation of it
(e.g. truncating text, picking the latest closure message).
"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel


class IntentSummary(BaseModel):
    label: str
    confidence: float
    is_low_confidence: bool


class ReportOut(BaseModel):
    id: str
    user_id: str
    conversation_id: str
    analysis_id: str

    conversation_title: str
    conversation_stage: str
    conversation_status: str

    reflection_summary: str  # truncated, user's-own-words excerpt from the analysis

    themes: List[Dict]
    dominant_sentiment: str
    dominant_emotion: str
    intent: IntentSummary
    safety_level: str
    safety_note: str
    evidence_summary: Dict

    action_plan: Optional[str] = None  # present only once the conversation reached closure

    created_at: datetime


class ReportSummaryOut(BaseModel):
    """Lightweight representation for dashboard/progress consumption."""

    id: str
    conversation_id: str
    dominant_sentiment: str
    dominant_emotion: str
    safety_level: str
    created_at: datetime
