"""
Intent analysis (Phase 3 — NLP/LMTA pipeline, step 10).

Implements "Experiment A" from the project spec: TF-IDF + Logistic
Regression as a transparent, classical-ML intent classifier.

IMPORTANT — dataset honesty note:
`_BOOTSTRAP_TRAINING_EXAMPLES` below is a small (~50-example), hand-
written, clearly-labeled DEVELOPMENT dataset used only to exercise this
Phase 3 architecture end-to-end. It is explicitly NOT the 2,000-5,000
example synthetic dataset described for Phase 5, and this classifier's
predictions should not be treated as accurate or production-grade — with
this little data, it is a structural placeholder proving the pipeline
wiring (TF-IDF -> LogisticRegression -> label), not a validated model.
Phase 5 is expected to retrain/replace the underlying model without
changing the `IntentClassifier.predict()` interface.
"""

from dataclasses import dataclass
from typing import Dict, List

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# Categories loosely mirror the EVARA reflective conversation stages so
# the classifier's output is meaningful in context, without being coupled
# to (or replacing) the deterministic Phase 2 stage engine.
_BOOTSTRAP_TRAINING_EXAMPLES: List[tuple] = [
    ("hi there", "greeting"),
    ("hello", "greeting"),
    ("hey, how are you", "greeting"),
    ("good morning", "greeting"),
    ("my exam went really badly", "problem_statement"),
    ("I've been struggling to focus at work", "problem_statement"),
    ("I keep procrastinating on my assignments", "problem_statement"),
    ("things have been really hard lately", "problem_statement"),
    ("I'm having trouble sleeping at night", "problem_statement"),
    ("I didn't practice enough before the test", "cause_reflection"),
    ("I think it's because I don't have a routine", "cause_reflection"),
    ("I wasn't paying attention in class", "cause_reflection"),
    ("maybe it's because I'm overwhelmed with everything else", "cause_reflection"),
    ("I want to work on my study habits", "goal_statement"),
    ("I'd like to focus on managing my time better", "goal_statement"),
    ("what matters most to me right now is sleeping better", "goal_statement"),
    ("I want to build a consistent exercise habit", "goal_statement"),
    ("I could try setting a fixed schedule", "strategy_discussion"),
    ("maybe I should study with a friend", "strategy_discussion"),
    ("one option is to break the task into smaller steps", "strategy_discussion"),
    ("I could ask for help from my teacher", "strategy_discussion"),
    ("I'll practice every morning from 6 to 8", "planning_statement"),
    ("I will start tomorrow at 7 PM", "planning_statement"),
    ("I'm going to do this three times a week", "planning_statement"),
    ("I'll set a reminder for every evening", "planning_statement"),
    ("yes, that's right", "confirmation"),
    ("yes exactly", "confirmation"),
    ("that sounds correct", "confirmation"),
    ("sure, that works for me", "confirmation"),
    ("thank you so much", "gratitude"),
    ("thanks, this really helped", "gratitude"),
    ("I appreciate you listening", "gratitude"),
    ("thank you for the support", "gratitude"),
]


@dataclass
class IntentPrediction:
    label: str
    confidence: float
    is_low_confidence: bool


class IntentClassifier:
    """
    TF-IDF + Logistic Regression intent classifier (see module docstring
    for the dataset-size caveat). Trained once at construction time on the
    small bootstrap dataset above.
    """

    # Below this confidence, we report the prediction but flag it as
    # low-confidence rather than silently presenting it as reliable.
    LOW_CONFIDENCE_THRESHOLD = 0.35

    def __init__(self) -> None:
        texts = [ex[0] for ex in _BOOTSTRAP_TRAINING_EXAMPLES]
        labels = [ex[1] for ex in _BOOTSTRAP_TRAINING_EXAMPLES]

        self._pipeline = Pipeline(
            [
                ("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2))),
                ("clf", LogisticRegression(max_iter=1000)),
            ]
        )
        self._pipeline.fit(texts, labels)

    def predict(self, text: str) -> IntentPrediction:
        if not text or not text.strip():
            return IntentPrediction(label="unknown", confidence=0.0, is_low_confidence=True)

        probabilities = self._pipeline.predict_proba([text])[0]
        classes = self._pipeline.classes_
        best_index = probabilities.argmax()
        label = str(classes[best_index])
        confidence = round(float(probabilities[best_index]), 4)

        return IntentPrediction(
            label=label,
            confidence=confidence,
            is_low_confidence=confidence < self.LOW_CONFIDENCE_THRESHOLD,
        )


# Module-level singleton: training on ~50 examples is fast, but there is
# no reason to retrain it on every request. A later phase can move this
# to a proper model-loading/caching layer (see app/slm/model_loader.py's
# eventual counterpart for NLP models) if/when the dataset grows.
_classifier_instance: "IntentClassifier | None" = None


def get_intent_classifier() -> IntentClassifier:
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = IntentClassifier()
    return _classifier_instance


def analyze_intent(text: str) -> Dict:
    prediction = get_intent_classifier().predict(text)
    return {
        "label": prediction.label,
        "confidence": prediction.confidence,
        "is_low_confidence": prediction.is_low_confidence,
    }
