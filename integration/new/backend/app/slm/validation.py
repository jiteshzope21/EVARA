"""
SLM Response Validation (Phase 5).

Deterministic validation of generated text BEFORE it is returned to the caller.
All checks here are rule-based — no second model call, no external API.

Rejection criteria:
  - Empty or near-empty output
  - Exceeds maximum character limit
  - Contains prompt/system injection leakage
  - Contains diagnostic claims (\"you have X disorder\", \"you are X\")
  - Contains medication recommendations
  - Contains medical treatment instructions
  - Contains crisis-inappropriate certainty
  - Contains prohibited certainty framing about mental health diagnoses

When text is rejected the caller receives a warning list and may substitute
the deterministic policy response.
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional

from app.slm.config import SLMConfig

# ---------------------------------------------------------------------------
# Prohibited pattern sets (deterministic rule lists)
# ---------------------------------------------------------------------------

# Phrases that suggest the model is revealing its system prompt or internal state
_PROMPT_LEAK_PATTERNS: List[str] = [
    "<|system|>",
    "<|user|>",
    "<|assistant|>",
    "</s>",
    "[context signals",
    "[important:",
    "[prior action plan",
    "[summary so far",
    "you are evara",
    "as a language model",
    "as an ai language model",
    "as an ai assistant",
    "i am a large language model",
    "i am an ai",
]

# Diagnostic claim patterns — model must not diagnose
_DIAGNOSTIC_PATTERNS: List[re.Pattern] = [
    re.compile(r"\byou\s+(have|are\s+suffering\s+from|are\s+diagnosed\s+with|show\s+signs\s+of)\b", re.I),
    re.compile(r"\b(diagnosis|diagnosed)\b", re.I),
    re.compile(r"\b(depression|anxiety|bipolar|schizophrenia|ptsd|ocd|adhd)\b", re.I),
    re.compile(r"\byou\s+(might|may)\s+(have|be\s+suffering\s+from)\b", re.I),
    re.compile(r"\bmental\s+illness\b", re.I),
    re.compile(r"\bclinically\b", re.I),
]

# Medication recommendation patterns
_MEDICATION_PATTERNS: List[re.Pattern] = [
    re.compile(r"\b(take|try|use|start|consider)\b.{0,40}\b(medications?|antidepressants?|ssris?|pills?|drugs?|tablets?|doses?|dosages?)\b", re.I),
    re.compile(r"\bprescri(be|bed|ption|ptions)\b", re.I),
    re.compile(r"\b(prozac|zoloft|lexapro|wellbutrin|sertraline|fluoxetine|citalopram|lithium|valium|xanax|ritalin)\b", re.I),
]

# Medical treatment instruction patterns
_MEDICAL_TREATMENT_PATTERNS: List[re.Pattern] = [
    re.compile(r"\btherapy\s+(will|should|must)\s+(cure|fix|treat)\b", re.I),
    re.compile(r"\byou\s+need\s+(to\s+)?(see|visit|consult)\s+a\s+(doctor|psychiatrist|physician)\b", re.I),
    re.compile(r"\byou\s+should\s+be\s+hospitali[sz]ed\b", re.I),
    re.compile(r"\bclinical\s+treatment\b", re.I),
]

# Unsafe crisis-response patterns (e.g. providing method info or minimizing urgency)
_UNSAFE_CRISIS_PATTERNS: List[re.Pattern] = [
    re.compile(r"\b(how\s+to|methods?\s+(of|for))\s+(suicide|self.harm|ending\s+(your\s+)?life)\b", re.I),
    re.compile(r"\bit['']s\s+(okay|fine|normal)\s+to\s+(hurt|harm)\s+yourself\b", re.I),
    re.compile(r"\bdon['']t\s+worry\s+about\s+(it|that|those\s+thoughts)\b", re.I),
]


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass
class ValidationResult:
    """Result of validating a generated response."""

    is_valid: bool
    text: str  # The (possibly cleaned) text, empty string if invalid
    warnings: List[str] = field(default_factory=list)
    rejection_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_response(raw_text: str, config: SLMConfig) -> ValidationResult:
    """
    Validate a model-generated response string.

    Returns a ValidationResult. If is_valid is False, the caller should
    substitute the deterministic policy response.
    """
    warnings: List[str] = []
    text = raw_text.strip() if raw_text else ""

    # 1. Empty / near-empty check
    if len(text) < config.min_output_chars:
        return ValidationResult(
            is_valid=False,
            text="",
            warnings=[f"Generated response is too short ({len(text)} chars < {config.min_output_chars})."],
            rejection_reason="empty_output",
        )

    # 2. Excessive length
    if len(text) > config.max_output_chars:
        warnings.append(
            f"Generated response exceeded max length ({len(text)} > {config.max_output_chars}); truncated."
        )
        text = text[: config.max_output_chars].rsplit(".", 1)[0] + "."

    # 3. Prompt leakage / system prompt disclosure
    text_lower = text.lower()
    for marker in _PROMPT_LEAK_PATTERNS:
        if marker in text_lower:
            return ValidationResult(
                is_valid=False,
                text="",
                warnings=[f"Response contains prompt leakage marker: '{marker}'."],
                rejection_reason="prompt_disclosure",
            )

    # 4. Diagnostic claims
    for pattern in _DIAGNOSTIC_PATTERNS:
        if pattern.search(text):
            return ValidationResult(
                is_valid=False,
                text="",
                warnings=[f"Response contains a prohibited diagnostic claim (pattern: {pattern.pattern})."],
                rejection_reason="diagnostic_claim",
            )

    # 5. Medication recommendations
    for pattern in _MEDICATION_PATTERNS:
        if pattern.search(text):
            return ValidationResult(
                is_valid=False,
                text="",
                warnings=[f"Response contains a prohibited medication recommendation."],
                rejection_reason="medication_recommendation",
            )

    # 6. Medical treatment instructions
    for pattern in _MEDICAL_TREATMENT_PATTERNS:
        if pattern.search(text):
            return ValidationResult(
                is_valid=False,
                text="",
                warnings=[f"Response contains a prohibited medical treatment instruction."],
                rejection_reason="medical_treatment",
            )

    # 7. Unsafe crisis content
    for pattern in _UNSAFE_CRISIS_PATTERNS:
        if pattern.search(text):
            return ValidationResult(
                is_valid=False,
                text="",
                warnings=[f"Response contains unsafe crisis content."],
                rejection_reason="unsafe_crisis_content",
            )

    return ValidationResult(is_valid=True, text=text, warnings=warnings)


def strip_prompt_echo(raw_output: str, prompt: str) -> str:
    """
    Remove the prompt prefix from the model's raw output.

    Some models echo back the prompt before their actual response.
    We strip that prefix if present.
    """
    if raw_output.startswith(prompt):
        return raw_output[len(prompt):].strip()

    # Also try stripping the last assistant marker
    assistant_marker = "<|assistant|>"
    if assistant_marker in raw_output:
        idx = raw_output.rfind(assistant_marker)
        return raw_output[idx + len(assistant_marker):].strip()

    return raw_output.strip()
