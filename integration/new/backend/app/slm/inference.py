"""
SLM Inference (Phase 5).

This module contains the ACTUAL model inference path.
It does NOT produce fake/placeholder responses.

Flow:
    GenerationContext
        -> build_prompt()        (prompting.py)
        -> tokenize()
        -> model.generate()
        -> decode()
        -> strip_prompt_echo()   (validation.py)
        -> validate_response()   (validation.py)
        -> InferenceResult

Safety bypass:
    If the context.response_policy is "urgent", the SLM is NOT called.
    Instead, the deterministic URGENT_SAFETY_RESPONSE is returned
    directly from this module. The SLM NEVER overrides urgent safety.

Policy responses:
    "elevated_concern" → ELEVATED_CONCERN_RESPONSE is used if SLM
    validation fails, and is always appended as a suggestion.

If the model cannot be loaded (RuntimeError from model.py), this module
raises that error explicitly — callers must handle it.
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.slm.config import SLMConfig
from app.slm.prompting import (
    ELEVATED_CONCERN_RESPONSE,
    URGENT_SAFETY_RESPONSE,
    GenerationContext,
    build_prompt,
)
from app.slm.validation import ValidationResult, strip_prompt_echo, validate_response

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass
class InferenceResult:
    """Structured result returned from the SLM inference pipeline."""

    text: str
    model: str
    generation_config: Dict[str, Any]
    validated: bool
    warnings: List[str] = field(default_factory=list)
    policy_used: str = "normal"
    safety_bypass: bool = False
    duration_ms: Optional[float] = None


# ---------------------------------------------------------------------------
# Public inference entry point
# ---------------------------------------------------------------------------


def run_inference(
    context: GenerationContext,
    config: SLMConfig,
    tokenizer: Any,
    model: Any,
) -> InferenceResult:
    """
    Execute a single SLM inference pass.

    Parameters:
        context:   The structured GenerationContext (bounded, safe).
        config:    The SLMConfig instance controlling generation.
        tokenizer: A loaded HuggingFace tokenizer (from model.py).
        model:     A loaded HuggingFace causal LM (from model.py).

    Returns:
        InferenceResult with the generated text and metadata.

    Safety contract:
        - If context.response_policy == "urgent", returns deterministic
          safety text WITHOUT calling the model.
        - Generated text is validated before being returned.
        - If validation fails, returns the deterministic policy fallback.
    """
    # -------------------------------------------------------------------
    # 1. URGENT SAFETY BYPASS — model is NOT called
    # -------------------------------------------------------------------
    if context.response_policy == "urgent":
        logger.warning(
            "Urgent safety level detected — SLM bypassed. "
            "Returning deterministic safety response."
        )
        return InferenceResult(
            text=URGENT_SAFETY_RESPONSE,
            model=config.model_name,
            generation_config={},
            validated=True,
            warnings=["Urgent safety bypass: deterministic response used."],
            policy_used="urgent",
            safety_bypass=True,
        )

    # -------------------------------------------------------------------
    # 2. Build prompt
    # -------------------------------------------------------------------
    prompt = build_prompt(context, config)
    logger.debug("SLM prompt built (%d chars)", len(prompt))

    # -------------------------------------------------------------------
    # 3. Tokenize
    # -------------------------------------------------------------------
    try:
        import torch

        device = config.device or "cpu"
        inputs = tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=config.max_input_tokens,
        ).to(device)
        input_len = inputs["input_ids"].shape[1]
        logger.debug("Tokenized prompt: %d tokens", input_len)

    except Exception as exc:
        raise RuntimeError(f"Tokenization failed: {exc}") from exc

    # -------------------------------------------------------------------
    # 4. Generate
    # -------------------------------------------------------------------
    gen_config = config.to_generation_kwargs()
    t_start = time.perf_counter()

    try:
        with torch.no_grad():
            if config.do_sample and config.seed is not None:
                torch.manual_seed(config.seed)

            output_ids = model.generate(
                **inputs,
                pad_token_id=tokenizer.eos_token_id,
                **gen_config,
            )

    except Exception as exc:
        raise RuntimeError(f"model.generate() failed: {exc}") from exc

    duration_ms = (time.perf_counter() - t_start) * 1000
    logger.debug("Generation took %.1f ms", duration_ms)

    # -------------------------------------------------------------------
    # 5. Decode
    # -------------------------------------------------------------------
    try:
        full_output = tokenizer.decode(output_ids[0], skip_special_tokens=True)
    except Exception as exc:
        raise RuntimeError(f"Token decoding failed: {exc}") from exc

    # -------------------------------------------------------------------
    # 6. Strip prompt echo
    # -------------------------------------------------------------------
    raw_response = strip_prompt_echo(full_output, prompt)
    logger.debug("Raw response after echo-strip (%d chars): %.80s...", len(raw_response), raw_response)

    # -------------------------------------------------------------------
    # 7. Validate
    # -------------------------------------------------------------------
    validation: ValidationResult = validate_response(raw_response, config)
    warnings = list(validation.warnings)

    if validation.is_valid:
        final_text = validation.text
        validated = True
    else:
        # Validation failed — use deterministic policy fallback
        logger.warning(
            "SLM response rejected (%s). Using policy fallback for level=%s.",
            validation.rejection_reason,
            context.safety_level,
        )
        warnings.append(
            f"Generated response rejected ({validation.rejection_reason}); "
            "deterministic policy response substituted."
        )
        final_text = _policy_fallback_text(context.response_policy)
        validated = False

    # For elevated_concern, append the resource suggestion even if response is valid
    if context.response_policy == "elevated_concern" and validation.is_valid:
        final_text = final_text.rstrip() + " " + ELEVATED_CONCERN_RESPONSE

    return InferenceResult(
        text=final_text,
        model=config.model_name,
        generation_config=gen_config,
        validated=validated,
        warnings=warnings,
        policy_used=context.response_policy,
        safety_bypass=False,
        duration_ms=round(duration_ms, 1),
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _policy_fallback_text(policy: str) -> str:
    """Return the deterministic fallback text for a given response policy."""
    if policy == "urgent":
        return URGENT_SAFETY_RESPONSE
    if policy in ("elevated_concern",):
        return ELEVATED_CONCERN_RESPONSE
    # normal / low_concern — generic supportive prompt
    return (
        "I'm here to listen. Could you tell me a bit more about what's on your mind?"
    )
