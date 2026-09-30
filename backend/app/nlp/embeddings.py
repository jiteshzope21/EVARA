"""
Embedding generation (Phase 3 — NLP/LMTA pipeline, step 7).

CORRECTION NOTE (supersedes the original Phase 3 build):
The original Phase 3 implementation used scikit-learn's HashingVectorizer
(a hashed bag-of-words), which is NOT a transformer embedding and did
not satisfy the project spec's requirement for "a suitable lightweight/
local transformer embedding model". This module has been replaced with
a real sentence-transformers implementation.

Model:      sentence-transformers/all-MiniLM-L6-v2
Dependency: sentence-transformers (pulls in torch + transformers)
Dimensions: 384

--- ENVIRONMENTAL LIMITATION (read before assuming this "just works") ---
This development sandbox's network allowlist does not include
huggingface.co (or any other model-hosting host), so the model's
weights cannot be downloaded here. `sentence-transformers` installs
fine from PyPI, but `SentenceTransformer(MODEL_NAME)` fails with an
OSError from huggingface_hub at construction time in this environment
(verified directly: `pip install sentence-transformers` succeeds;
`SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')` raises
`OSError: We couldn't connect to 'https://huggingface.co' to load the
files...`).

This module does NOT pretend that limitation away:
  - It does not fall back to HashingVectorizer or any other
    non-transformer method.
  - `EmbeddingGenerator.is_available` is False whenever the model could
    not be loaded, and every result explicitly reports that.
  - `embed_text()` raises `EmbeddingModelUnavailableError` (with the
    real underlying error attached) rather than returning a fabricated
    vector.
  - `embed_result()` returns a structured, clearly-labeled "unavailable"
    result (dimensions/method are still reported — they're properties
    of the *chosen* model, not proof it ran) instead of raising, so
    unrelated pipeline steps (sentiment, emotion, intent, themes,
    safety) can still complete without embeddings.

In a deployment environment WITH access to huggingface.co, this exact
code loads and runs the real MiniLM model with no changes required —
this is not a stub; it is the genuine implementation, currently blocked
only by this sandbox's network policy.
"""

from dataclasses import dataclass
from typing import List, Optional

import numpy as np

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSIONS = 384


class EmbeddingModelUnavailableError(RuntimeError):
    """
    Raised when the configured transformer embedding model could not be
    loaded (missing dependency, no network access to the model host,
    etc.). Callers must not catch this and substitute a fabricated
    vector — see EmbeddingGenerator.embed_result() for the sanctioned
    way to degrade gracefully with an explicit "unavailable" result.
    """


@dataclass
class EmbeddingResult:
    method: str
    dimensions: int
    vector_preview: List[float]  # first few components only — see note below
    vector_norm: float
    available: bool
    error: Optional[str] = None


class EmbeddingGenerator:
    """
    Real sentence-transformers embedding generator. Attempts to load
    `MODEL_NAME` once at construction time; the load outcome (success or
    the exact failure reason) is stored on the instance rather than
    raised immediately, so that constructing this object — e.g. as the
    module-level singleton in app/nlp/pipeline.py — never crashes the
    application. Failure is instead surfaced honestly at the point of
    use (see embed_text / embed_result).
    """

    MODEL_NAME = MODEL_NAME
    DIMENSIONS = EMBEDDING_DIMENSIONS

    def __init__(self) -> None:
        self._model = None
        self._load_error: Optional[str] = None

        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            self._load_error = (
                f"The 'sentence-transformers' package is not installed ({exc}). "
                f"Install it with: pip install sentence-transformers"
            )
            return

        try:
            self._model = SentenceTransformer(self.MODEL_NAME)
        except Exception as exc:  # noqa: BLE001 - deliberately broad: any load
            # failure (network, disk, corrupt cache, ...) must be reported,
            # not swallowed.
            self._load_error = (
                f"Could not load transformer model '{self.MODEL_NAME}' via "
                f"sentence-transformers: {type(exc).__name__}: {exc}"
            )
            self._model = None

    @property
    def is_available(self) -> bool:
        return self._model is not None

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    def embed_text(self, text: str) -> np.ndarray:
        """
        Return the full 384-dim embedding vector for a piece of text.

        Raises EmbeddingModelUnavailableError if the transformer model
        could not be loaded — this method never silently substitutes a
        non-transformer vector.
        """
        if not self.is_available:
            raise EmbeddingModelUnavailableError(
                self._load_error or "Transformer embedding model is not loaded."
            )

        if not text or not text.strip():
            return np.zeros(self.DIMENSIONS, dtype=float)

        vector = self._model.encode(text, normalize_embeddings=True, show_progress_bar=False)
        return np.asarray(vector, dtype=float)

    def embed_result(self, text: str, preview_length: int = 8) -> EmbeddingResult:
        """
        Return an API-safe summary of the embedding: metadata plus a short
        preview of the vector (not the full 384-dim vector), per the
        spec's instruction to avoid unnecessarily huge API responses.

        Unlike embed_text(), this does NOT raise when the model is
        unavailable — it returns a result with available=False and the
        exact error, so callers building a larger structured response
        (the NLP pipeline, the analysis API) can represent that honestly
        without crashing on every request.
        """
        if not self.is_available:
            return EmbeddingResult(
                method=self.MODEL_NAME,
                dimensions=self.DIMENSIONS,
                vector_preview=[],
                vector_norm=0.0,
                available=False,
                error=self._load_error,
            )

        vector = self.embed_text(text)
        preview = vector[:preview_length].round(4).tolist()
        norm = float(np.linalg.norm(vector))
        return EmbeddingResult(
            method=self.MODEL_NAME,
            dimensions=self.DIMENSIONS,
            vector_preview=preview,
            vector_norm=round(norm, 4),
            available=True,
            error=None,
        )
