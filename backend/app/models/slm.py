"""
SLM response models (Phase 5).

Defines the Pydantic response model for the SLM generation endpoint.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


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
