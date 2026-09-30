"""
Theme/topic analysis (Phase 3 — NLP/LMTA pipeline, step 11).

Deterministic keyword-lexicon matching against a small, fixed set of
common wellbeing-adjacent themes. This is topic *tagging* via keyword
overlap, not statistical topic modeling (e.g. LDA) or a trained
classifier — an intentionally simple, explainable Phase 3 baseline.
"""

from typing import Dict, List

_THEME_LEXICON: Dict[str, set] = {
    "academic_pressure": {
        "exam", "exams", "test", "tests", "study", "studying", "grade",
        "grades", "school", "class", "classes", "lecture", "lectures",
        "homework", "assignment", "assignments", "university", "college",
    },
    "work_stress": {
        "work", "job", "boss", "deadline", "deadlines", "meeting",
        "meetings", "career", "workload", "colleague", "colleagues",
        "office", "manager", "project", "promotion",
    },
    "relationships": {
        "friend", "friends", "friendship", "partner", "relationship",
        "breakup", "boyfriend", "girlfriend", "family", "parent",
        "parents", "conflict", "argument", "lonely", "alone",
    },
    "sleep": {
        "sleep", "sleeping", "insomnia", "tired", "exhausted", "rest",
        "bed", "night", "awake",
    },
    "exercise_health": {
        "exercise", "workout", "gym", "run", "running", "health", "diet",
        "fitness", "routine", "habit",
    },
    "time_management": {
        "time", "schedule", "procrastinate", "procrastinating",
        "procrastination", "organize", "organized", "priorities",
        "priority", "focus", "distracted", "distraction",
    },
    "finance": {
        "money", "financial", "finances", "budget", "debt", "bills",
        "rent", "afford",
    },
}


def extract_themes(lemmas: List[str], top_k: int = 5) -> List[Dict]:
    """
    Return themes whose lexicon overlaps with the given lemmas, ranked by
    match count, each with the specific matched terms as observable
    evidence (not a hidden score).
    """
    if not lemmas:
        return []

    lower_lemmas = [w.lower() for w in lemmas]
    results = []

    for theme, lexicon in _THEME_LEXICON.items():
        matches = sorted({w for w in lower_lemmas if w in lexicon})
        if matches:
            results.append({"theme": theme, "match_count": len(matches), "matched_terms": matches})

    results.sort(key=lambda r: -r["match_count"])
    return results[:top_k]
