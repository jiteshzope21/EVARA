"""
Emotion analysis (Phase 3 — NLP/LMTA pipeline, step 9).

Deterministic, lexicon-based emotion tagging across six coarse
categories (joy, sadness, anger, fear, surprise, disgust). Self-authored
keyword lists — a transparent heuristic baseline, not a trained
classifier. Multiple emotions can be present at once; this returns
signal counts per category plus a single "dominant_emotion" for
convenience, defaulting to "neutral" when no lexicon terms are matched.
"""

from typing import Dict, List

_EMOTION_LEXICON: Dict[str, set] = {
    "joy": {
        "happy", "glad", "joy", "joyful", "excited", "delighted", "cheerful",
        "proud", "grateful", "thankful", "hopeful", "content", "pleased",
        "love", "enjoy", "enjoyed", "relieved", "motivated",
    },
    "sadness": {
        "sad", "unhappy", "down", "depressed", "lonely", "alone", "hopeless",
        "miserable", "hurt", "disappointed", "grief", "cry", "crying",
        "heartbroken", "empty", "worthless",
    },
    "anger": {
        "angry", "mad", "furious", "annoyed", "irritated", "frustrated",
        "resentful", "hate", "rage", "upset",
    },
    "fear": {
        "afraid", "scared", "fear", "anxious", "nervous", "worried",
        "panicked", "terrified", "uneasy", "overwhelmed", "stressed",
        "stress",
    },
    "surprise": {
        "surprised", "shocked", "amazed", "astonished", "unexpected",
        "startled",
    },
    "disgust": {
        "disgusted", "gross", "revolted", "repulsed", "sick",
    },
}


def analyze_emotion(lemmas: List[str]) -> Dict:
    """
    Count lexicon matches per emotion category over a lemma sequence.

    Returns:
        {
            "dominant_emotion": str,       # e.g. "sadness" or "neutral"
            "emotion_signal_counts": {category: int, ...},
        }
    """
    counts = {category: 0 for category in _EMOTION_LEXICON}

    if lemmas:
        for word in lemmas:
            lower = word.lower()
            for category, lexicon in _EMOTION_LEXICON.items():
                if lower in lexicon:
                    counts[category] += 1

    total_signals = sum(counts.values())
    if total_signals == 0:
        dominant = "neutral"
    else:
        dominant = max(counts.items(), key=lambda kv: kv[1])[0]

    return {"dominant_emotion": dominant, "emotion_signal_counts": counts}
