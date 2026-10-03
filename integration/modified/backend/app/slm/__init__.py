"""
SLM package (Phase 5).

Exposes the public API for the SLM subsystem:
  - SLMConfig
  - GenerationContext / RecentMessage / NLPSignals
  - context_from_nlp_and_safety()
  - run_inference()
  - InferenceResult
  - load_model() / unload_model() / is_model_loaded()
  - detect_device()
  - validate_response() / strip_prompt_echo()
"""

from app.slm.config import SLMConfig
from app.slm.inference import InferenceResult, run_inference
from app.slm.model import detect_device, is_model_loaded, load_model, unload_model
from app.slm.prompting import (
    GenerationContext,
    NLPSignals,
    RecentMessage,
    build_prompt,
    context_from_nlp_and_safety,
)
from app.slm.validation import ValidationResult, strip_prompt_echo, validate_response

__all__ = [
    "SLMConfig",
    "GenerationContext",
    "NLPSignals",
    "RecentMessage",
    "InferenceResult",
    "ValidationResult",
    "run_inference",
    "load_model",
    "unload_model",
    "is_model_loaded",
    "detect_device",
    "build_prompt",
    "context_from_nlp_and_safety",
    "validate_response",
    "strip_prompt_echo",
]
