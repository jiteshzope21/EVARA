"""
Safety analysis (Phase 3).

Deterministic, rule-based safety-level assignment. This is a SEPARATE,
independently auditable component from the NLP pipeline and does NOT
depend on an SLM — per the project spec's safety architecture:

    User Text -> NLP Signals + Deterministic Rules + (optional lightweight
    classifier) -> Safety Level -> Response Policy -> SLM

This module only reaches the "Safety Level" box. Response policy and SLM
integration are out of scope for Phase 3.

Levels returned are internal SYSTEM-HANDLING levels, not medical
diagnoses:
    normal | low_concern | elevated_concern | urgent

This module does not diagnose, does not recommend medication, and does
not perform autonomous crisis intervention — it only classifies a level
for a downstream (future) response-policy step to act on.

Keyword lists below are intentionally kept at the pattern level (a
modest set of common, well-known crisis-language indicators used by
standard safety/triage keyword systems) rather than an exhaustive,
method-specific list — sufficient for a transparent Phase 3 baseline
without functioning as anything beyond that.
"""

from typing import Dict, List, Optional, Protocol

# Explicit statements of intent to end one's own life or to seriously
# harm another person. Any match here is treated as "urgent".
_URGENT_PHRASES = [
    "kill myself", "end my life", "want to die", "wish i was dead",
    "wish i were dead", "better off dead", "no reason to live",
    "can't go on living", "cant go on living", "suicide", "suicidal",
    "going to hurt someone", "going to kill", "hurt someone badly",
]

# Hopelessness, isolation, or self-harm mentions without an explicit
# statement of intent — treated as "elevated_concern" (warrants attention,
# not yet the highest internal level).
_ELEVATED_CONCERN_PHRASES = [
    "hopeless", "no one cares", "nobody cares", "can't cope", "cant cope",
    "giving up", "self harm", "self-harm", "hurting myself",
    "worthless", "no point in anything", "life isn't worth",
    "life is not worth", "can't take it anymore", "cant take it anymore",
]


class SafetyClassifier(Protocol):
    """
    Extension point for an optional lightweight ML safety classifier, as
    named in the project spec ("NLP Signals + Deterministic Rules +
    Optional Lightweight Classifier"). Not implemented in Phase 3 — the
    deterministic rules below are the sole decision mechanism for now.
    A future implementation could plug in here without changing
    analyze_safety()'s signature or the rest of the pipeline.
    """

    def classify(self, normalized_text: str) -> Optional[str]:
        ...


def _find_matches(text_lower: str, phrases: List[str]) -> List[str]:
    return [p for p in phrases if p in text_lower]


def analyze_safety(
    normalized_text: str,
    sentiment: Dict,
    emotion: Dict,
    classifier: Optional[SafetyClassifier] = None,
) -> Dict:
    """
    Determine an internal safety level from deterministic keyword rules,
    supplemented by NLP signals already computed by the pipeline
    (sentiment, emotion) — not by an SLM.

    `classifier` is accepted for future extensibility (see SafetyClassifier
    above) but is not exercised by any logic in Phase 3.
    """
    text_lower = (normalized_text or "").lower()

    urgent_matches = _find_matches(text_lower, _URGENT_PHRASES)
    elevated_matches = _find_matches(text_lower, _ELEVATED_CONCERN_PHRASES)

    matched_categories: List[str] = []
    if urgent_matches:
        matched_categories.append("explicit_risk_language")
    if elevated_matches:
        matched_categories.append("hopelessness_or_isolation_language")

    if urgent_matches:
        level = "urgent"
    elif elevated_matches:
        level = "elevated_concern"
    elif (
        sentiment.get("label") == "negative"
        and sentiment.get("score", 0) <= -0.5
        and emotion.get("dominant_emotion") in {"sadness", "fear"}
    ):
        level = "low_concern"
        matched_categories.append("sustained_negative_sentiment")
    else:
        level = "normal"

    return {
        "level": level,
        "matched_signal_categories": matched_categories,
        "supporting_nlp_signals": {
            "sentiment_label": sentiment.get("label"),
            "sentiment_score": sentiment.get("score"),
            "dominant_emotion": emotion.get("dominant_emotion"),
        },
        "is_diagnosis": False,
        "note": (
            "This is an internal system-handling level used to decide how "
            "EVARA should respond, not a medical or clinical diagnosis."
        ),
    }
