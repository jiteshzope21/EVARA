"""
SLM API (Phase 5).

Endpoint:
    POST /api/slm/{conversation_id}/generate

Requires:
  - Authentication (HTTP Bearer JWT, same dependency as all other routes)
  - Conversation ownership (enforced via slm_service -> conversation_service)

The endpoint does NOT duplicate ownership logic — it delegates to
app/services/slm_service.py which in turn delegates to the Phase 2
conversation_service.get_owned_conversation().

Query parameters:
  - persist (bool, default False): whether to store generation metadata
    in the slm_generations collection.

Response schema:
  - text:              the generated (or policy-determined) response text
  - model:             the model name used
  - generation_config: the generation hyperparameters
  - validated:         whether the response passed validation
  - warnings:          list of validation/generation warnings
  - policy_used:       the response policy that was applied
  - safety_bypass:     True if the urgent safety response was used
  - safety_level:      the deterministic safety classification
  - conversation_stage: the current conversation stage
  - mock:              True if MOCK_SLM=true was in effect
  - duration_ms:       inference duration in milliseconds (real model only)
"""

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth import get_current_user
from app.database.connection import get_database
from app.models.slm import SLMGenerateResponse
from app.models.user import UserInDB
from app.services import slm_service

router = APIRouter(prefix="/api/slm", tags=["slm"])


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
    Generate an SLM-assisted response for the given conversation.

    Runs the full Phase 5 pipeline:
      NLP analysis → safety classification → response policy → SLM generation
      → response validation → structured result.

    Requires authentication. The conversation must belong to the current user.
    """
    result = await slm_service.generate_slm_response(
        db=db,
        user_id=current_user.id,
        conversation_id=conversation_id,
        persist=persist,
    )
    return SLMGenerateResponse(**result)
