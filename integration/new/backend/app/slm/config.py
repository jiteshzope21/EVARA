"""
SLM Configuration (Phase 5).

Centralizes all configuration for the Small Language Model component.
Model selection: TinyLlama/TinyLlama-1.1B-Chat-v1.0

Rationale for model choice:
  - 1.1B parameters — small enough for CPU inference on developer hardware
  - Uses ChatML / Llama chat format (system/user/assistant turns)
  - Publicly available on Hugging Face without gating
  - Instruction-tuned: responds to system prompts appropriately
  - Acceptable inference speed on CPU for academic demonstration

Device selection is deterministic:
  - CUDA if torch.cuda.is_available()
  - MPS (Apple Silicon) if torch.backends.mps.is_available()
  - CPU otherwise

Training is a SEPARATE, explicitly launched step (see backend/training/).
The FastAPI application NEVER trains a model on startup.
"""

from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Model identity
# ---------------------------------------------------------------------------

DEFAULT_MODEL_NAME: str = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
"""
Hugging Face model ID for the base causal LM.
Can be overridden at runtime via the SLM_MODEL environment variable
(already wired in app/core/config.py: settings.slm_model).
"""

# ---------------------------------------------------------------------------
# Tokenizer / generation constraints
# ---------------------------------------------------------------------------

MAX_INPUT_TOKENS: int = 768
"""
Maximum number of tokens allowed in the full prompt fed to the model.
Longer prompts are truncated from the LEFT (oldest content) to preserve
the most recent user message and instruction.
"""

MAX_NEW_TOKENS: int = 256
"""
Maximum number of NEW tokens the model may generate per response.
Keeps responses bounded and prevents runaway generation.
"""

MIN_NEW_TOKENS: int = 20
"""
Minimum new tokens — responses shorter than this after validation are
flagged as potentially empty/truncated.
"""

MAX_RECENT_MESSAGES: int = 6
"""
Maximum number of recent conversation messages included in the
generation context (user + assistant, interleaved). Older messages are
dropped. This bounds memory usage and context length.
"""

# ---------------------------------------------------------------------------
# Generation hyperparameters
# ---------------------------------------------------------------------------

TEMPERATURE: float = 0.7
"""
Sampling temperature. Lower = more deterministic; higher = more varied.
0.7 is a reasonable default for a conversational support agent.
"""

TOP_P: float = 0.92
"""Nucleus sampling probability mass cutoff."""

TOP_K: int = 50
"""Top-K token filtering (applied before nucleus sampling)."""

REPETITION_PENALTY: float = 1.15
"""Penalise repetition of recent tokens to reduce looping responses."""

DO_SAMPLE: bool = True
"""
Use sampling-based generation (vs greedy). Set False for fully
deterministic output (useful in tests with a fixed seed).
"""

GENERATION_SEED: int = 42
"""
Reproducibility seed used when DO_SAMPLE is True and a deterministic
run is required (e.g. smoke tests).
"""

# ---------------------------------------------------------------------------
# Validation thresholds
# ---------------------------------------------------------------------------

MAX_OUTPUT_CHARS: int = 1200
"""
Hard character limit on validated response text.
Responses exceeding this are rejected (or truncated with a warning).
"""

MIN_OUTPUT_CHARS: int = 10
"""
Responses shorter than this are considered empty and rejected.
"""

# ---------------------------------------------------------------------------
# Dataclass wrapping the runtime configuration
# ---------------------------------------------------------------------------


@dataclass
class SLMConfig:
    """
    Runtime SLM configuration.

    Instantiated once and passed through the inference stack.
    All fields have safe defaults; override as needed for tests.
    """

    model_name: str = DEFAULT_MODEL_NAME
    max_input_tokens: int = MAX_INPUT_TOKENS
    max_new_tokens: int = MAX_NEW_TOKENS
    min_new_tokens: int = MIN_NEW_TOKENS
    max_recent_messages: int = MAX_RECENT_MESSAGES
    temperature: float = TEMPERATURE
    top_p: float = TOP_P
    top_k: int = TOP_K
    repetition_penalty: float = REPETITION_PENALTY
    do_sample: bool = DO_SAMPLE
    seed: int = GENERATION_SEED
    max_output_chars: int = MAX_OUTPUT_CHARS
    min_output_chars: int = MIN_OUTPUT_CHARS

    # Set at runtime by model.py after device detection — NOT a user-supplied
    # config field; kept here for observability/logging.
    device: Optional[str] = None

    def to_generation_kwargs(self) -> dict:
        """
        Return a dict of kwargs suitable for model.generate().
        device is excluded — it is set on the model/input tensors directly.
        """
        return {
            "max_new_tokens": self.max_new_tokens,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "top_k": self.top_k,
            "repetition_penalty": self.repetition_penalty,
            "do_sample": self.do_sample,
        }
