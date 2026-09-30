"""
NLP / LMTA pipeline orchestrator (Phase 3).

Wires together every deterministic analyzer module in
app/nlp/*.py into a single ordered pipeline, matching the project
spec's pipeline diagram:

    RAW TEXT -> Normalization -> Sentence Splitting -> Tokenization ->
    Lemmatization -> N-grams -> TF-IDF -> Embeddings -> Sentiment ->
    Emotion -> Intent -> Themes -> Semantic Analysis

Safety analysis and evidence aggregation are deliberately NOT called
here — they live in app/safety/rules.py and app/reasoning/evidence.py
respectively, per the architecture rule that safety must be a separate,
independently auditable component, not folded into the NLP module. The
service layer (app/services/analysis_service.py) composes this pipeline
output with safety + evidence into the final structured result.

This module contains no SLM logic, no ML-generated free text, and no
network calls — every step here is deterministic given the same input.
"""

from dataclasses import dataclass, field
from typing import Dict, List

from app.nlp.embeddings import EmbeddingGenerator
from app.nlp.emotion import analyze_emotion
from app.nlp.intent import analyze_intent
from app.nlp.lemmatization import lemmatize
from app.nlp.ngrams import extract_all_ngrams
from app.nlp.normalization import normalize_text
from app.nlp.semantics import analyze_semantics
from app.nlp.sentiment import analyze_sentiment
from app.nlp.tfidf import compute_tfidf
from app.nlp.themes import extract_themes
from app.nlp.tokenization import split_sentences, tokenize

_shared_embedder = EmbeddingGenerator()


@dataclass
class NLPPipelineResult:
    original_text: str
    normalized_text: str
    sentences: List[str]
    tokens: List[str]
    lemmas: List[str]
    ngrams: Dict[str, List[Dict]]
    tfidf: Dict
    embedding: Dict
    sentiment: Dict
    emotion: Dict
    intent: Dict
    themes: List[Dict]
    semantics: Dict
    warnings: List[str] = field(default_factory=list)


def run_pipeline(raw_text: str) -> NLPPipelineResult:
    """
    Run the complete deterministic NLP/LMTA pipeline on a single piece of
    text. Handles empty/invalid input gracefully (returns a well-formed
    result with empty fields and a warning) rather than raising.
    """
    warnings: List[str] = []

    normalized = normalize_text(raw_text)
    if not normalized:
        warnings.append("Input was empty or contained no analyzable text after normalization.")

    sentences = split_sentences(normalized)
    tokens = tokenize(normalized)
    lemmas = lemmatize(tokens)

    ngram_result = extract_all_ngrams(lemmas, max_n=3, top_k=10)
    tfidf_result = compute_tfidf(sentences, top_k=10)

    embedding_summary = _shared_embedder.embed_result(normalized)
    embedding_result = {
        "method": embedding_summary.method,
        "dimensions": embedding_summary.dimensions,
        "vector_preview": embedding_summary.vector_preview,
        "vector_norm": embedding_summary.vector_norm,
        "available": embedding_summary.available,
        "error": embedding_summary.error,
    }
    if not embedding_summary.available:
        # Honest, non-fabricated warning — see app/nlp/embeddings.py for
        # exactly what's required to make this available (model/dependency)
        # and why it currently is not in this environment.
        warnings.append(f"Embedding generation unavailable: {embedding_summary.error}")

    sentiment_result = analyze_sentiment(lemmas)
    emotion_result = analyze_emotion(lemmas)
    intent_result = analyze_intent(normalized)
    theme_result = extract_themes(lemmas, top_k=5)
    semantics_result = analyze_semantics(sentences, embedder=_shared_embedder)

    return NLPPipelineResult(
        original_text=raw_text if isinstance(raw_text, str) else "",
        normalized_text=normalized,
        sentences=sentences,
        tokens=tokens,
        lemmas=lemmas,
        ngrams=ngram_result,
        tfidf=tfidf_result,
        embedding=embedding_result,
        sentiment=sentiment_result,
        emotion=emotion_result,
        intent=intent_result,
        themes=theme_result,
        semantics=semantics_result,
        warnings=warnings,
    )
