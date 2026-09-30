"""
Sentiment analysis (Phase 3 — NLP/LMTA pipeline, step 8).

Deterministic, lexicon-based polarity scoring — a small, self-authored
positive/negative word list with simple negation handling ("not good"
flips "good"'s polarity). This is a transparent, explainable baseline
appropriate for a Phase 3 academic prototype; it is NOT a trained
sentiment classifier and does not claim clinical or production-grade
accuracy (see project spec: "no fake analysis results presented as real
model output").
"""

from typing import Dict, List

_NEGATORS = {"not", "no", "never", "n't", "cant", "cannot", "wont", "dont", "didnt", "isnt", "arent"}

_POSITIVE_WORDS = {
    "good", "great", "happy", "glad", "excited", "hopeful", "confident",
    "calm", "relieved", "proud", "motivated", "better", "improve",
    "improving", "progress", "grateful", "thankful", "love", "enjoy",
    "enjoyed", "success", "successful", "positive", "optimistic",
    "comfortable", "supported", "encouraged", "relaxed", "peaceful",
    "accomplished", "capable", "strong", "ready", "excellent", "wonderful",
}

_NEGATIVE_WORDS = {
    "bad", "sad", "upset", "angry", "anxious", "worried", "stressed",
    "stress", "overwhelmed", "tired", "exhausted", "frustrated", "afraid",
    "scared", "fear", "worse", "worried", "difficult", "hard", "struggle",
    "struggling", "fail", "failed", "failing", "failure", "poor", "lonely",
    "alone", "hopeless", "helpless", "hurt", "pain", "painful", "negative",
    "disappointed", "ashamed", "guilty", "nervous", "unhappy", "miserable",
    "terrible", "awful", "worthless",
}

_WORD_SCORE = 1.0


def analyze_sentiment(lemmas: List[str]) -> Dict:
    """
    Score a lemma sequence for polarity using a fixed lexicon and simple
    negation handling (a negator within 2 tokens before a polarity word
    flips its contribution).

    Returns:
        {
            "label": "positive" | "negative" | "neutral",
            "score": float in [-1.0, 1.0]  (net polarity, normalized),
            "positive_signal_count": int,
            "negative_signal_count": int,
        }
    """
    if not lemmas:
        return {"label": "neutral", "score": 0.0, "positive_signal_count": 0, "negative_signal_count": 0}

    net_score = 0.0
    positive_count = 0
    negative_count = 0

    for i, word in enumerate(lemmas):
        lower = word.lower()
        if lower not in _POSITIVE_WORDS and lower not in _NEGATIVE_WORDS:
            continue

        window = [w.lower() for w in lemmas[max(0, i - 2) : i]]
        negated = any(w in _NEGATORS for w in window)

        polarity = _WORD_SCORE if lower in _POSITIVE_WORDS else -_WORD_SCORE
        if negated:
            polarity = -polarity

        net_score += polarity
        if polarity > 0:
            positive_count += 1
        else:
            negative_count += 1

    total_signals = positive_count + negative_count
    normalized_score = round(net_score / total_signals, 4) if total_signals else 0.0

    if normalized_score > 0.15:
        label = "positive"
    elif normalized_score < -0.15:
        label = "negative"
    else:
        label = "neutral"

    return {
        "label": label,
        "score": normalized_score,
        "positive_signal_count": positive_count,
        "negative_signal_count": negative_count,
    }
