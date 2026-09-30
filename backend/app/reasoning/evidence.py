"""
Evidence aggregation (Phase 3).

Combines the NLP pipeline output and the safety analysis result into a
single structured "evidence" summary plus an observable decision trace.

Per the project spec, this trace must show OBSERVABLE PROCESSING
information (input -> preprocessing output -> extracted features ->
model output -> safety result) and must NOT claim to expose private
model reasoning or hidden chain-of-thought. Every entry here corresponds
directly to a concrete field already produced by a named module earlier
in the pipeline — nothing here is inferred or fabricated.
"""

from typing import Dict, List

from app.nlp.pipeline import NLPPipelineResult


def _top_ngram_summary(ngrams: Dict[str, List[Dict]]) -> List[str]:
    top_unigrams = ngrams.get("1gram", [])[:3]
    return [item["ngram"] for item in top_unigrams]


def aggregate_evidence(pipeline_result: NLPPipelineResult, safety_result: Dict) -> Dict:
    """
    Build:
      - "summary": the key signals a downstream response-policy step
        (Phase 4/5) would act on, at a glance.
      - "decision_trace": an ordered list of {"step", "output"} entries
        showing exactly what each stage of the pipeline observed/produced
        — this is the "Evidence-Based Decision Trace" described in the
        project spec's NLP Analysis page requirements.
    """
    summary = {
        "sentiment_label": pipeline_result.sentiment.get("label"),
        "dominant_emotion": pipeline_result.emotion.get("dominant_emotion"),
        "intent_label": pipeline_result.intent.get("label"),
        "intent_is_low_confidence": pipeline_result.intent.get("is_low_confidence"),
        "top_themes": [t["theme"] for t in pipeline_result.themes],
        "top_terms": _top_ngram_summary(pipeline_result.ngrams),
        "safety_level": safety_result.get("level"),
    }

    decision_trace: List[Dict] = [
        {
            "step": "input",
            "output": {"character_count": len(pipeline_result.original_text or "")},
        },
        {
            "step": "preprocessing",
            "output": {
                "normalized_text": pipeline_result.normalized_text,
                "sentence_count": len(pipeline_result.sentences),
                "token_count": len(pipeline_result.tokens),
                "lemma_count": len(pipeline_result.lemmas),
            },
        },
        {
            "step": "extracted_features",
            "output": {
                "top_unigrams": pipeline_result.ngrams.get("1gram", [])[:5],
                "top_tfidf_terms": pipeline_result.tfidf.get("top_terms", [])[:5],
                "embedding_method": pipeline_result.embedding.get("method"),
                "embedding_dimensions": pipeline_result.embedding.get("dimensions"),
            },
        },
        {
            "step": "model_output",
            "output": {
                "sentiment": pipeline_result.sentiment,
                "emotion": pipeline_result.emotion,
                "intent": pipeline_result.intent,
                "themes": pipeline_result.themes,
                "semantics": pipeline_result.semantics,
            },
        },
        {
            "step": "safety_result",
            "output": safety_result,
        },
    ]

    return {"summary": summary, "decision_trace": decision_trace}
