"""
Sentence splitting and tokenization (Phase 3 — NLP/LMTA pipeline, steps 2-3).

Deterministic, rule-based, dependency-free implementations. These are
intentionally simple: a regex-based sentence boundary detector and a
regex-based word tokenizer, not a trained segmentation/tokenization
model. This is documented explicitly rather than presented as more
sophisticated than it is (see project spec: "no fake analysis results
presented as real model output").
"""

import re
from typing import List

# Split on '.', '!', '?' (optionally repeated, e.g. "?!" or "...") followed
# by whitespace and an uppercase letter or end of string. A small set of
# common abbreviations is protected from being treated as a sentence end.
_ABBREVIATIONS = {"mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "etc", "e.g", "i.e"}

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])")

_TOKEN_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:\.\d+)?|[^\sA-Za-z0-9]")


def split_sentences(normalized_text: str) -> List[str]:
    """
    Split normalized text into sentences using punctuation + capitalization
    heuristics. Falls back to treating the whole input as one sentence if
    no clear boundary is found. Returns [] for empty input.
    """
    text = normalized_text.strip()
    if not text:
        return []

    raw_candidates = _SENTENCE_SPLIT_RE.split(text)
    sentences: List[str] = []

    for candidate in raw_candidates:
        candidate = candidate.strip()
        if not candidate:
            continue
        # Guard against splitting on a protected abbreviation immediately
        # preceding the boundary (best-effort, not a full NLP model).
        last_word = re.split(r"\s+", sentences[-1])[-1].rstrip(".").lower() if sentences else ""
        if last_word in _ABBREVIATIONS and sentences:
            sentences[-1] = f"{sentences[-1]} {candidate}"
        else:
            sentences.append(candidate)

    return sentences if sentences else [text]


def tokenize(text: str) -> List[str]:
    """
    Word-level tokenizer: words (with internal apostrophes, e.g. "don't"),
    numbers, and standalone punctuation as separate tokens. Returns []
    for empty input.
    """
    if not text:
        return []
    return _TOKEN_RE.findall(text)
