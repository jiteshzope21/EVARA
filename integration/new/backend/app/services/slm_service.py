"""
SLM Service (Phase 5).

Orchestrates the full Phase 5 generation pipeline:
    1. Load owned conversation (Phase 2 ownership check)
    2. Run NLP/LMTA pipeline (Phase 3)
    3. Run safety analysis (Phase 3)
    4. Aggregate evidence (Phase 3)
    5. Determine response policy (Phase 5)
    6. Build structured generation context (Phase 5)
    7. Run SLM inference (Phase 5) — or use deterministic policy response
    8. Validate output (Phase 5)
    9. Optionally persist generation metadata (Phase 5)
   10. Return structured result

The SLM does NOT:
  - Replace the deterministic stage engine
  - Drive stage transitions
  - Perform safety classification
  - Own database records that belong to other services

Mock mode:
  If settings.mock_slm is True, returns a structured mock result without
  loading the model. This is the default in the test environment (see
  conftest.py: MOCK_SLM=true). The mock result is clearly labeled.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.logging import get_logger
from app.nlp.pipeline import NLPPipelineResult, run_pipeline
from app.reasoning.evidence import aggregate_evidence
from app.safety.rules import analyze_safety
from app.services import conversation_service
from app.slm.config import DEFAULT_MODEL_NAME, SLMConfig
from app.slm.inference import InferenceResult, _policy_fallback_text, run_inference
from app.slm.model import is_model_loaded, load_model
from app.slm.prompting import (
    ELEVATED_CONCERN_RESPONSE,
    URGENT_SAFETY_RESPONSE,
    context_from_nlp_and_safety,
)

logger = get_logger(__name__)

COLLECTION = "slm_generations"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def generate_slm_response(
    db: AsyncIOMotorDatabase,
    user_id: str,
    conversation_id: str,
    persist: bool = False,
) -> Dict[str, Any]:
    """
    Run the full Phase 5 pipeline for a given conversation and return
    a structured generation result.

    Parameters:
        db:               The motor database instance.
        user_id:          The authenticated user's ID.
        conversation_id:  The conversation to generate a response for.
        persist:          Whether to store the generation metadata in MongoDB.

    Returns:
        A structured dict suitable for the API response.
    """
    settings = get_settings()

    # -------------------------------------------------------------------
    # Step 1: Load owned conversation (ownership check, Phase 2)
    # -------------------------------------------------------------------
    conversation = await conversation_service.get_owned_conversation(db, user_id, conversation_id)

    messages: List[Dict] = conversation.get("messages", [])
    stage: str = conversation.get("stage", "opening")

    # Require at least one user message for SLM to respond to
    user_messages = [m for m in messages if m.get("role") == "user"]
    if not user_messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No user messages found in this conversation. Send at least one message first.",
        )

    latest_user_message: str = user_messages[-1]["content"]

    # -------------------------------------------------------------------
    # Step 2: NLP/LMTA pipeline (Phase 3, deterministic)
    # -------------------------------------------------------------------
    combined_text = _extract_user_text(conversation)
    pipeline_result: NLPPipelineResult = run_pipeline(combined_text)

    # -------------------------------------------------------------------
    # Step 3: Safety analysis (Phase 3, deterministic)
    # -------------------------------------------------------------------
    safety_result: Dict = analyze_safety(
        pipeline_result.normalized_text,
        pipeline_result.sentiment,
        pipeline_result.emotion,
    )

    # -------------------------------------------------------------------
    # Step 4: Evidence aggregation (Phase 3)
    # -------------------------------------------------------------------
    evidence_result: Dict = aggregate_evidence(pipeline_result, safety_result)

    # -------------------------------------------------------------------
    # Step 5 & 6: Response policy + generation context (Phase 5)
    # -------------------------------------------------------------------
    config = _build_config(settings)
    nlp_dict = _pipeline_to_dict(pipeline_result)

    action_plan_context: Optional[str] = _extract_action_plan_context(messages)

    gen_context = context_from_nlp_and_safety(
        conversation_stage=stage,
        latest_user_message=latest_user_message,
        recent_messages=messages,
        nlp_result=nlp_dict,
        safety_result=safety_result,
        evidence_summary=evidence_result,
        action_plan_context=action_plan_context,
        config=config,
    )

    # -------------------------------------------------------------------
    # Step 7 & 8: SLM inference (or mock) + validation (Phase 5)
    # -------------------------------------------------------------------
    if settings.mock_slm:
        inference_result = _mock_inference(gen_context, config)
        logger.info(
            "SLM mock response generated for conversation=%s, safety=%s",
            conversation_id,
            safety_result["level"],
        )
    else:
        # Real model inference
        try:
            tokenizer, model = load_model(config)
        except RuntimeError as exc:
            logger.error("SLM model load failure: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "The SLM model could not be loaded. "
                    "Check that MOCK_SLM=false is intentional and that the model is accessible. "
                    f"Error: {exc}"
                ),
            )

        inference_result = run_inference(gen_context, config, tokenizer, model)
        logger.info(
            "SLM real inference: conversation=%s, safety=%s, validated=%s, duration_ms=%s",
            conversation_id,
            safety_result["level"],
            inference_result.validated,
            inference_result.duration_ms,
        )

    # -------------------------------------------------------------------
    # Step 9: Persist generation metadata (optional)
    # -------------------------------------------------------------------
    generation_doc: Optional[Dict] = None
    if persist:
        generation_doc = await _persist_generation(
            db,
            user_id=user_id,
            conversation_id=conversation_id,
            inference_result=inference_result,
            safety_level=safety_result["level"],
            policy=gen_context.response_policy,
        )

    # -------------------------------------------------------------------
    # Step 10: Return structured result
    # -------------------------------------------------------------------
    result: Dict[str, Any] = {
        "text": inference_result.text,
        "model": inference_result.model,
        "generation_config": inference_result.generation_config,
        "validated": inference_result.validated,
        "warnings": inference_result.warnings,
        "policy_used": inference_result.policy_used,
        "safety_bypass": inference_result.safety_bypass,
        "safety_level": safety_result["level"],
        "conversation_stage": stage,
        "mock": settings.mock_slm,
    }
    if inference_result.duration_ms is not None:
        result["duration_ms"] = inference_result.duration_ms
    if generation_doc:
        result["generation_id"] = str(generation_doc.get("_id", ""))

    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_config(settings: Any) -> SLMConfig:
    """Build an SLMConfig from application settings."""
    model_name = settings.slm_model.strip() if settings.slm_model else DEFAULT_MODEL_NAME
    return SLMConfig(model_name=model_name)


def _extract_user_text(conversation: Dict[str, Any]) -> str:
    """Extract and join all user messages from a conversation document."""
    messages = conversation.get("messages", [])
    user_messages = [m["content"] for m in messages if m.get("role") == "user"]
    return ". ".join(m.strip().rstrip(".") for m in user_messages if m and m.strip())


def _extract_action_plan_context(messages: List[Dict]) -> Optional[str]:
    """
    Extract the last assistant message that looks like an action plan /
    closure summary, to provide as context to the SLM. Returns None if
    no suitable message is found.
    """
    for m in reversed(messages):
        if m.get("role") == "assistant":
            content = m.get("content", "")
            # The closure builder includes "Your plan:" as a marker
            if "your plan:" in content.lower() or "here's what i'm hearing" in content.lower():
                return content[:500]  # bounded
    return None


def _pipeline_to_dict(result: NLPPipelineResult) -> Dict:
    """Convert NLPPipelineResult to a plain dict for the context builder."""
    return {
        "sentiment": result.sentiment,
        "emotion": result.emotion,
        "intent": result.intent,
        "themes": result.themes,
        "semantics": result.semantics,
    }


def _mock_inference(context: Any, config: SLMConfig) -> InferenceResult:
    """
    Return a clearly labeled mock InferenceResult when MOCK_SLM=true.
    Does NOT call the model. Clearly identified as mock in the response.
    The mock text is policy-appropriate but deterministic.
    """
    if context.response_policy == "urgent":
        text = URGENT_SAFETY_RESPONSE
        safety_bypass = True
    elif context.response_policy == "elevated_concern":
        text = ELEVATED_CONCERN_RESPONSE
        safety_bypass = False
    else:
        # Stage-appropriate mock response
        mock_texts = {
            "opening": "Hi, I'm here to help you think things through. What's on your mind today?",
            "problem_exploration": "Thank you for sharing that. Could you tell me a bit more about what's been most challenging?",
            "cause_reflection": "That makes sense. What do you think might be contributing to this situation?",
            "prioritization": "Of everything we've talked about, what feels most important for you to focus on right now?",
            "strategy_exploration": "What are some ways you could approach this? Even small steps can matter.",
            "action_planning": "Which of those ideas feels like a realistic first step you could actually take?",
            "time_frequency": "When would you like to start, and how often do you think you could realistically do this?",
            "closure": "That sounds like a meaningful plan. You've done some real reflection today — that matters.",
        }
        text = mock_texts.get(
            context.conversation_stage,
            "I'm here to listen. Tell me more about what's going on."
        )
        safety_bypass = False

    return InferenceResult(
        text=text,
        model=f"{config.model_name} [MOCK]",
        generation_config=config.to_generation_kwargs(),
        validated=True,
        warnings=["This is a mock response (MOCK_SLM=true). No real model was called."],
        policy_used=context.response_policy,
        safety_bypass=safety_bypass,
        duration_ms=None,
    )


async def _persist_generation(
    db: AsyncIOMotorDatabase,
    user_id: str,
    conversation_id: str,
    inference_result: InferenceResult,
    safety_level: str,
    policy: str,
) -> Dict:
    """
    Persist generation metadata to MongoDB.
    Only stores metadata, not raw secrets or full model weights.
    """
    doc = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "model": inference_result.model,
        "safety_level": safety_level,
        "policy": policy,
        "validated": inference_result.validated,
        "safety_bypass": inference_result.safety_bypass,
        "warnings": inference_result.warnings,
        "generation_config": inference_result.generation_config,
        "duration_ms": inference_result.duration_ms,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db[COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.debug(
        "SLM generation persisted: %s (conversation=%s, user=%s)",
        doc["_id"], conversation_id, user_id,
    )
    return doc
