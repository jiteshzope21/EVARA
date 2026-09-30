"""
Semantic analysis (Phase 3 — NLP/LMTA pipeline, step 12).

Uses the local transformer embedding module (app/nlp/embeddings.py) to
compute cosine similarity between sentences in the text, surfacing an
overall "semantic coherence" signal (how topically related the
sentences are to each other) and the most/least similar sentence pair.

CORRECTION NOTE: this module is unchanged in its own logic from the
original Phase 3 build; what changed is that app/nlp/embeddings.py now
uses a real transformer model instead of a hashed bag-of-words, and
that model may be unavailable in a given environment (see
embeddings.py's module docstring). This function is updated only to
handle that honestly: if the embedder cannot produce vectors, this
returns `available: False` with the concrete reason rather than
crashing the whole analysis or silently computing similarity from a
non-transformer vector.
"""

from typing import Dict, List, Optional

import numpy as np

from app.nlp.embeddings import EmbeddingGenerator, EmbeddingModelUnavailableError


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def analyze_semantics(sentences: List[str], embedder: Optional[EmbeddingGenerator] = None) -> Dict:
    """
    Compute pairwise cosine similarity across sentences using the
    transformer embedding model.

    Returns:
        {
            "sentence_count": int,
            "average_similarity": float | None,   # None if < 2 sentences OR embeddings unavailable
            "most_similar_pair": {"a": int, "b": int, "similarity": float} | None,
            "least_similar_pair": {"a": int, "b": int, "similarity": float} | None,
            "available": bool,   # False only when the transformer model could not be loaded
            "note": str | None,  # explains why, when available is False
        }
    (Indices "a"/"b" refer to positions in the given `sentences` list.)
    """
    non_empty = [s for s in sentences if s and s.strip()]

    if len(non_empty) < 2:
        return {
            "sentence_count": len(non_empty),
            "average_similarity": None,
            "most_similar_pair": None,
            "least_similar_pair": None,
            "available": True,
            "note": None,
        }

    embedder = embedder or EmbeddingGenerator()

    try:
        vectors = [embedder.embed_text(s) for s in non_empty]
    except EmbeddingModelUnavailableError as exc:
        return {
            "sentence_count": len(non_empty),
            "average_similarity": None,
            "most_similar_pair": None,
            "least_similar_pair": None,
            "available": False,
            "note": (
                "Semantic similarity requires the transformer embedding "
                f"model, which is unavailable in this environment: {exc}"
            ),
        }

    pair_scores = []
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            similarity = round(_cosine_similarity(vectors[i], vectors[j]), 4)
            pair_scores.append((i, j, similarity))

    average_similarity = round(sum(p[2] for p in pair_scores) / len(pair_scores), 4)
    most_similar = max(pair_scores, key=lambda p: p[2])
    least_similar = min(pair_scores, key=lambda p: p[2])

    return {
        "sentence_count": len(non_empty),
        "average_similarity": average_similarity,
        "most_similar_pair": {"a": most_similar[0], "b": most_similar[1], "similarity": most_similar[2]},
        "least_similar_pair": {"a": least_similar[0], "b": least_similar[1], "similarity": least_similar[2]},
        "available": True,
        "note": None,
    }
