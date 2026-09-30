"""
Analysis models (Phase 3).

Defines the structured, machine-readable shape of a completed NLP/LMTA
analysis, suitable for later phases (NLP Analysis page, Wellbeing
Report, etc.) to consume without re-running any analysis.
"""

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel


class NgramItem(BaseModel):
    ngram: str
    count: int


class TfidfTerm(BaseModel):
    term: str
    score: float


class TfidfResult(BaseModel):
    top_terms: List[TfidfTerm]
    vocabulary_size: int
    document_count: int


class EmbeddingMeta(BaseModel):
    method: str
    dimensions: int
    vector_preview: List[float]
    vector_norm: float
    available: bool
    error: Optional[str] = None


class SentimentResult(BaseModel):
    label: Literal["positive", "negative", "neutral"]
    score: float
    positive_signal_count: int
    negative_signal_count: int


class EmotionResult(BaseModel):
    dominant_emotion: str
    emotion_signal_counts: Dict[str, int]


class IntentResult(BaseModel):
    label: str
    confidence: float
    is_low_confidence: bool


class ThemeResult(BaseModel):
    theme: str
    match_count: int
    matched_terms: List[str]


class SemanticPair(BaseModel):
    a: int
    b: int
    similarity: float


class SemanticResult(BaseModel):
    sentence_count: int
    average_similarity: Optional[float] = None
    most_similar_pair: Optional[SemanticPair] = None
    least_similar_pair: Optional[SemanticPair] = None
    available: bool = True
    note: Optional[str] = None


class SafetyResult(BaseModel):
    level: Literal["normal", "low_concern", "elevated_concern", "urgent"]
    matched_signal_categories: List[str]
    supporting_nlp_signals: Dict
    is_diagnosis: bool
    note: str


class EvidenceResult(BaseModel):
    summary: Dict
    decision_trace: List[Dict]


class AnalysisOut(BaseModel):
    """Full structured analysis result, as stored/returned by Phase 3."""

    id: str
    user_id: str
    conversation_id: str
    source_message_count: int
    original_text: str
    normalized_text: str
    sentences: List[str]
    tokens: List[str]
    lemmas: List[str]
    ngrams: Dict[str, List[NgramItem]]
    tfidf: TfidfResult
    embedding: EmbeddingMeta
    sentiment: SentimentResult
    emotion: EmotionResult
    intent: IntentResult
    themes: List[ThemeResult]
    semantics: SemanticResult
    safety: SafetyResult
    evidence: EvidenceResult
    warnings: List[str]
    created_at: datetime
