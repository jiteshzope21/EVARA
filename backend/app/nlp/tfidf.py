"""
TF-IDF feature extraction (Phase 3 — NLP/LMTA pipeline, step 6).

TF-IDF is fundamentally a corpus statistic (term frequency relative to a
document collection). For a single analyzed text, this module treats
each SENTENCE as one "document" within a small per-request corpus — this
is a deliberate, documented design choice for analyzing one message/
conversation in isolation (there is no larger conversation corpus yet in
Phase 3). It surfaces which terms are locally distinctive within the
text rather than globally distinctive across all EVARA users' data
(no cross-user corpus is used, which also avoids any privacy concern).
"""

from typing import Dict, List

from sklearn.feature_extraction.text import TfidfVectorizer


def compute_tfidf(sentences: List[str], top_k: int = 10) -> Dict:
    """
    Fit a TF-IDF vectorizer over the given sentences (treated as a small
    per-request corpus) and return the top_k highest-scoring terms overall,
    plus basic vocabulary size metadata.

    Returns an empty structure for fewer than 1 non-empty sentence.
    """
    non_empty = [s for s in sentences if s and s.strip()]
    if not non_empty:
        return {"top_terms": [], "vocabulary_size": 0, "document_count": 0}

    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        token_pattern=r"(?u)\b[a-zA-Z]{2,}\b",
    )
    try:
        matrix = vectorizer.fit_transform(non_empty)
    except ValueError:
        # e.g. every sentence is entirely stopwords/punctuation.
        return {"top_terms": [], "vocabulary_size": 0, "document_count": len(non_empty)}

    # Sum TF-IDF scores for each term across all "documents" (sentences)
    # to get a single overall ranking for this text.
    scores = matrix.sum(axis=0).A1
    terms = vectorizer.get_feature_names_out()

    ranked = sorted(zip(terms, scores), key=lambda pair: -pair[1])[:top_k]

    return {
        "top_terms": [{"term": term, "score": round(float(score), 4)} for term, score in ranked],
        "vocabulary_size": len(terms),
        "document_count": len(non_empty),
    }
