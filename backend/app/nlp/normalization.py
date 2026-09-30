"""
Text normalization (Phase 3 — NLP/LMTA pipeline, step 1).

Deterministic, dependency-free cleanup applied before any other analysis.
This is intentionally simple and explainable — not a language model.
"""

import re
import unicodedata

# Collapse any run of whitespace (spaces, tabs, newlines) into a single space.
_WHITESPACE_RE = re.compile(r"\s+")

# Characters that occasionally slip in from copy/paste (smart quotes, etc.)
# and are safe to fold to their ASCII equivalents for downstream matching.
_QUOTE_MAP = str.maketrans(
    {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
    }
)


def normalize_text(raw_text: str) -> str:
    """
    Normalize raw input text:
      - Unicode NFKC normalization (canonical compatibility form).
      - Fold common "smart" punctuation to plain ASCII equivalents.
      - Collapse whitespace runs to single spaces.
      - Strip leading/trailing whitespace.

    Safe on empty/invalid input: returns "" for None or non-string input,
    never raises.
    """
    if not isinstance(raw_text, str):
        return ""

    text = unicodedata.normalize("NFKC", raw_text)
    text = text.translate(_QUOTE_MAP)
    text = _WHITESPACE_RE.sub(" ", text)
    return text.strip()
