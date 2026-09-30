"""
Lemmatization (Phase 3 — NLP/LMTA pipeline, step 4).

IMPORTANT — scope and honesty note:
This is a lightweight, rule-based *approximate* lemmatizer: a small
irregular-form exception dictionary plus a handful of common English
suffix-stripping rules (plurals, -ing, -ed, comparative/superlative). It
is NOT a full morphological analyzer or a trained/dictionary-backed
lemmatizer (e.g. spaCy or NLTK's WordNetLemmatizer). Those require
downloading model/corpus data from hosts not reachable in this
environment's network configuration. This module is deliberately
structured behind a single `lemmatize()` function so it can be swapped
for a proper lemmatizer later without touching any caller.
"""

import re
from typing import List

_IRREGULAR = {
    "is": "be", "are": "be", "was": "be", "were": "be", "been": "be", "am": "be",
    "has": "have", "had": "have", "having": "have",
    "does": "do", "did": "do", "doing": "do", "done": "do",
    "went": "go", "gone": "go", "going": "go",
    "better": "good", "best": "good", "worse": "bad", "worst": "bad",
    "children": "child", "people": "person", "men": "man", "women": "woman",
    "feet": "foot", "mice": "mouse", "geese": "goose",
    "felt": "feel", "thought": "think", "said": "say", "got": "get",
    "made": "make", "took": "take", "came": "come", "knew": "know",
    "saw": "see", "gave": "give", "found": "find", "told": "tell",
}

_SUFFIX_RULES = [
    (re.compile(r"(ies)$"), "y"),
    (re.compile(r"(ing)$"), ""),
    (re.compile(r"(ed)$"), ""),
    (re.compile(r"(es)$"), ""),
    (re.compile(r"(s)$"), ""),
]


def _lemmatize_word(word: str) -> str:
    lower = word.lower()
    if lower in _IRREGULAR:
        return _IRREGULAR[lower]
    if len(lower) <= 3:
        # Too short for suffix stripping to be reliable ("as", "is", "bus").
        return lower
    for pattern, replacement in _SUFFIX_RULES:
        if pattern.search(lower):
            stripped = pattern.sub(replacement, lower)
            if len(stripped) >= 3:
                return stripped
    return lower


def lemmatize(tokens: List[str]) -> List[str]:
    """
    Lemmatize a list of tokens. Non-alphabetic tokens (numbers,
    punctuation) are passed through unchanged. Returns [] for empty input.
    """
    if not tokens:
        return []
    return [_lemmatize_word(t) if t.isalpha() else t for t in tokens]
