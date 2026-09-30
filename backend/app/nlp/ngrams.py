"""
N-gram extraction (Phase 3 — NLP/LMTA pipeline, step 5).

Deterministic sliding-window n-gram extraction over lemmatized tokens.
"""

from collections import Counter
from typing import Dict, List

# Tokens that carry little topical/n-gram signal on their own. A small,
# fixed stopword list (not a downloaded resource) kept intentionally short.
_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "so", "to", "of", "in",
    "on", "at", "for", "with", "is", "be", "am", "are", "was", "were",
    "i", "you", "it", "this", "that", "my", "me", "do", "did",
}


def extract_ngrams(lemmas: List[str], n: int, top_k: int = 10) -> List[Dict]:
    """
    Extract the top_k most frequent n-grams (n contiguous lemmas) from a
    lemma sequence, filtering out n-grams composed entirely of stopwords
    and pure punctuation. Returns a list of {"ngram": str, "count": int}
    sorted by descending count (ties broken by first appearance order).
    """
    if not lemmas or n < 1 or len(lemmas) < n:
        return []

    filtered = [tok for tok in lemmas if tok.isalnum()]
    if len(filtered) < n:
        return []

    grams = [tuple(filtered[i : i + n]) for i in range(len(filtered) - n + 1)]
    meaningful = [g for g in grams if not all(tok in _STOPWORDS for tok in g)]

    counts = Counter(meaningful)
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], meaningful.index(kv[0])))

    return [{"ngram": " ".join(gram), "count": count} for gram, count in ranked[:top_k]]


def extract_all_ngrams(lemmas: List[str], max_n: int = 3, top_k: int = 10) -> Dict[str, List[Dict]]:
    """Convenience wrapper returning unigrams..max_n-grams keyed by size."""
    return {f"{n}gram": extract_ngrams(lemmas, n, top_k) for n in range(1, max_n + 1)}
