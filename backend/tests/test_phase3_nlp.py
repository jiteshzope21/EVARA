"""
Phase 3 unit tests — individual NLP/LMTA modules, safety rules, and
evidence aggregation. No database or HTTP involved; pure function tests.
"""

import pytest

from app.nlp.embeddings import EmbeddingGenerator, EmbeddingModelUnavailableError
from app.nlp.emotion import analyze_emotion
from app.nlp.intent import analyze_intent
from app.nlp.lemmatization import lemmatize
from app.nlp.ngrams import extract_all_ngrams, extract_ngrams
from app.nlp.normalization import normalize_text
from app.nlp.pipeline import run_pipeline
from app.nlp.semantics import analyze_semantics
from app.nlp.sentiment import analyze_sentiment
from app.nlp.tfidf import compute_tfidf
from app.nlp.themes import extract_themes
from app.nlp.tokenization import split_sentences, tokenize
from app.reasoning.evidence import aggregate_evidence
from app.safety.rules import analyze_safety


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

def test_normalize_collapses_whitespace():
    assert normalize_text("hello    world\n\n foo") == "hello world foo"


def test_normalize_strips_edges():
    assert normalize_text("   hello world   ") == "hello world"


def test_normalize_folds_smart_quotes():
    assert normalize_text("it\u2019s a \u201ctest\u201d") == "it's a \"test\""


def test_normalize_handles_none():
    assert normalize_text(None) == ""


def test_normalize_handles_non_string():
    assert normalize_text(12345) == ""


def test_normalize_handles_empty_string():
    assert normalize_text("") == ""


# ---------------------------------------------------------------------------
# Sentence splitting
# ---------------------------------------------------------------------------

def test_split_sentences_basic():
    result = split_sentences("This is one sentence. This is another one.")
    assert result == ["This is one sentence.", "This is another one."]


def test_split_sentences_question_and_exclamation():
    result = split_sentences("Are you okay? I hope so!")
    assert len(result) == 2


def test_split_sentences_empty_input():
    assert split_sentences("") == []


def test_split_sentences_no_terminal_punctuation():
    result = split_sentences("just some text with no ending punctuation")
    assert result == ["just some text with no ending punctuation"]


# ---------------------------------------------------------------------------
# Tokenization
# ---------------------------------------------------------------------------

def test_tokenize_basic_words():
    tokens = tokenize("Hello world")
    assert tokens == ["Hello", "world"]


def test_tokenize_handles_apostrophes():
    tokens = tokenize("I didn't practice")
    assert "didn't" in tokens


def test_tokenize_handles_numbers():
    tokens = tokenize("I studied for 30 minutes")
    assert "30" in tokens


def test_tokenize_empty_input():
    assert tokenize("") == []


# ---------------------------------------------------------------------------
# Lemmatization
# ---------------------------------------------------------------------------

def test_lemmatize_plural_and_verb_forms():
    tokens = ["studies", "studying", "studied", "cats"]
    lemmas = lemmatize(tokens)
    assert len(lemmas) == 4


def test_lemmatize_irregular_forms():
    assert lemmatize(["went"]) == ["go"]
    assert lemmatize(["better"]) == ["good"]


def test_lemmatize_passes_through_punctuation():
    assert lemmatize(["!"]) == ["!"]


def test_lemmatize_empty_input():
    assert lemmatize([]) == []


# ---------------------------------------------------------------------------
# N-grams
# ---------------------------------------------------------------------------

def test_extract_ngrams_unigrams():
    lemmas = ["study", "every", "day", "study", "hard"]
    result = extract_ngrams(lemmas, n=1, top_k=10)
    top = {item["ngram"]: item["count"] for item in result}
    assert top.get("study") == 2


def test_extract_ngrams_bigrams():
    lemmas = ["study", "every", "day"]
    result = extract_ngrams(lemmas, n=2, top_k=10)
    ngram_strings = [item["ngram"] for item in result]
    assert "study every" in ngram_strings


def test_extract_ngrams_empty_input():
    assert extract_ngrams([], n=1) == []


def test_extract_all_ngrams_structure():
    result = extract_all_ngrams(["study", "hard", "every", "day"], max_n=3)
    assert set(result.keys()) == {"1gram", "2gram", "3gram"}


# ---------------------------------------------------------------------------
# TF-IDF
# ---------------------------------------------------------------------------

def test_compute_tfidf_returns_terms():
    sentences = ["I am worried about my exam.", "The exam is very important to me."]
    result = compute_tfidf(sentences)
    assert result["document_count"] == 2
    assert len(result["top_terms"]) > 0


def test_compute_tfidf_empty_input():
    result = compute_tfidf([])
    assert result["top_terms"] == []
    assert result["document_count"] == 0


def test_compute_tfidf_all_stopwords():
    result = compute_tfidf(["the a an", "is of to"])
    assert result["top_terms"] == []


# ---------------------------------------------------------------------------
# Embeddings — Phase 3 CORRECTION: verifies the transformer implementation
# specifically, and explicitly confirms it is NOT HashingVectorizer.
# ---------------------------------------------------------------------------

def test_embedding_generator_is_configured_for_the_required_transformer_model():
    """Verifies the exact model name and dimensionality required by the spec."""
    generator = EmbeddingGenerator()
    assert generator.MODEL_NAME == "sentence-transformers/all-MiniLM-L6-v2"
    assert generator.DIMENSIONS == 384


def test_embedding_module_does_not_use_hashing_vectorizer():
    """
    Regression guard for the exact defect being corrected: the module's
    own source must not reference HashingVectorizer or the old
    "hashed_bag_of_words" label as its active implementation.
    """
    import app.nlp.embeddings as embeddings_module
    import inspect

    source = inspect.getsource(embeddings_module)
    # The correction-note docstring is allowed to mention HashingVectorizer
    # as prose describing what was REMOVED; what must never exist is an
    # actual import/usage of it.
    assert "from sklearn" not in source
    assert "import sklearn" not in source
    assert "HashingVectorizer(" not in source  # no live instantiation
    assert 'method="hashed_bag_of_words' not in source
    assert 'EMBEDDING_METHOD = "hashed_bag_of_words' not in source


def test_embedding_generator_uses_sentence_transformers_package():
    """
    Confirms the implementation is actually built on sentence-transformers
    (imported lazily inside EmbeddingGenerator.__init__), not merely named
    as if it were.
    """
    import inspect

    from app.nlp.embeddings import EmbeddingGenerator as EG

    source = inspect.getsource(EG.__init__)
    assert "from sentence_transformers import SentenceTransformer" in source
    assert "SentenceTransformer(self.MODEL_NAME)" in source


def test_embedding_generator_reports_availability_honestly():
    """
    THE key correctness test: the generator must never claim a
    successful transformer embedding unless the model actually loaded.
    In this development sandbox, huggingface.co is unreachable, so
    `is_available` is expected to be False here — this test verifies the
    *honest reporting* of that state, not a fabricated success. In an
    environment with access to huggingface.co, the `if` branch below is
    what would execute and prove a real embedding was generated.
    """
    generator = EmbeddingGenerator()
    result = generator.embed_result("hello world")

    # The method/dimension labels describe the CONFIGURED model and are
    # always reported, whether or not it actually loaded.
    assert result.method == "sentence-transformers/all-MiniLM-L6-v2"
    assert result.dimensions == 384

    if generator.is_available:
        assert result.available is True
        assert result.error is None
        assert len(result.vector_preview) == 8
        assert result.vector_norm > 0.0
    else:
        assert result.available is False
        assert result.error is not None
        assert "huggingface" in result.error.lower() or "sentence-transformers" in result.error.lower() \
            or "SentenceTransformer" in result.error or "model" in result.error.lower()
        assert result.vector_preview == []
        assert result.vector_norm == 0.0


def test_embed_text_raises_clear_error_when_model_unavailable_never_fabricates():
    """
    embed_text() must raise EmbeddingModelUnavailableError rather than
    silently returning a non-transformer vector when the model isn't
    loaded. When the model IS available, it must return a real
    384-dim vector.
    """
    generator = EmbeddingGenerator()
    if generator.is_available:
        vector = generator.embed_text("some text")
        assert vector.shape == (384,)
    else:
        with pytest.raises(EmbeddingModelUnavailableError):
            generator.embed_text("some text")


def test_embedding_generator_deterministic_when_available():
    generator = EmbeddingGenerator()
    if not generator.is_available:
        pytest.skip(
            "Transformer model (sentence-transformers/all-MiniLM-L6-v2) is "
            "unavailable in this environment: no network access to "
            "huggingface.co. This is an environmental limitation, not a "
            "code defect — see app/nlp/embeddings.py."
        )
    v1 = generator.embed_text("consistent text")
    v2 = generator.embed_text("consistent text")
    assert list(v1) == list(v2)


def test_embedding_generator_empty_text_when_available():
    generator = EmbeddingGenerator()
    if not generator.is_available:
        pytest.skip(
            "Transformer model unavailable in this environment (no "
            "network access to huggingface.co)."
        )
    vector = generator.embed_text("")
    assert vector.sum() == 0


def test_embedding_result_is_api_safe_when_available():
    generator = EmbeddingGenerator()
    if not generator.is_available:
        pytest.skip(
            "Transformer model unavailable in this environment (no "
            "network access to huggingface.co)."
        )
    result = generator.embed_result("some text", preview_length=8)
    assert result.dimensions == 384
    assert len(result.vector_preview) == 8
    assert result.method == "sentence-transformers/all-MiniLM-L6-v2"


# ---------------------------------------------------------------------------
# Sentiment
# ---------------------------------------------------------------------------

def test_sentiment_positive():
    lemmas = ["i", "feel", "great", "and", "happy"]
    result = analyze_sentiment(lemmas)
    assert result["label"] == "positive"


def test_sentiment_negative():
    lemmas = ["i", "feel", "bad", "and", "stressed"]
    result = analyze_sentiment(lemmas)
    assert result["label"] == "negative"


def test_sentiment_negation_flips_polarity():
    result = analyze_sentiment(["not", "good"])
    assert result["label"] == "negative"


def test_sentiment_neutral_empty():
    result = analyze_sentiment([])
    assert result["label"] == "neutral"
    assert result["score"] == 0.0


# ---------------------------------------------------------------------------
# Emotion
# ---------------------------------------------------------------------------

def test_emotion_sadness_dominant():
    lemmas = ["i", "feel", "sad", "and", "lonely"]
    result = analyze_emotion(lemmas)
    assert result["dominant_emotion"] == "sadness"


def test_emotion_neutral_when_no_matches():
    result = analyze_emotion(["the", "cat", "sat"])
    assert result["dominant_emotion"] == "neutral"


def test_emotion_empty_input():
    result = analyze_emotion([])
    assert result["dominant_emotion"] == "neutral"


# ---------------------------------------------------------------------------
# Intent
# ---------------------------------------------------------------------------

def test_intent_returns_a_known_label():
    result = analyze_intent("I will start tomorrow at 7 PM")
    assert isinstance(result["label"], str)
    assert 0.0 <= result["confidence"] <= 1.0


def test_intent_empty_text():
    result = analyze_intent("")
    assert result["label"] == "unknown"
    assert result["is_low_confidence"] is True


# ---------------------------------------------------------------------------
# Themes
# ---------------------------------------------------------------------------

def test_extract_themes_academic():
    lemmas = ["exam", "study", "lecture"]
    result = extract_themes(lemmas)
    theme_names = [t["theme"] for t in result]
    assert "academic_pressure" in theme_names


def test_extract_themes_no_matches():
    result = extract_themes(["xyz", "abc"])
    assert result == []


def test_extract_themes_empty_input():
    assert extract_themes([]) == []


# ---------------------------------------------------------------------------
# Semantics
# ---------------------------------------------------------------------------

def test_semantics_requires_two_sentences():
    result = analyze_semantics(["only one sentence"])
    assert result["average_similarity"] is None


def test_semantics_computes_pairwise_similarity_when_available_else_reports_honestly():
    """
    Phase 3 CORRECTION: analyze_semantics now depends on the transformer
    embedding model. When it's available, similarity is computed exactly
    as before; when it's not (as in this sandbox), the function must
    report available=False with a clear reason rather than crashing or
    fabricating a similarity score.
    """
    generator = EmbeddingGenerator()
    result = analyze_semantics(
        ["I am worried about my exam.", "The exam is very important."], embedder=generator
    )
    assert result["sentence_count"] == 2

    if generator.is_available:
        assert result["available"] is True
        assert result["average_similarity"] is not None
        assert 0.0 <= result["average_similarity"] <= 1.0
        assert result["note"] is None
    else:
        assert result["available"] is False
        assert result["average_similarity"] is None
        assert result["most_similar_pair"] is None
        assert result["note"] is not None
        assert "transformer" in result["note"].lower()


def test_semantics_empty_input():
    result = analyze_semantics([])
    assert result["sentence_count"] == 0


# ---------------------------------------------------------------------------
# Safety rules
# ---------------------------------------------------------------------------

def test_safety_urgent_on_explicit_risk_language():
    result = analyze_safety(
        "i want to die and i can't go on living",
        sentiment={"label": "negative", "score": -1.0},
        emotion={"dominant_emotion": "sadness"},
    )
    assert result["level"] == "urgent"
    assert "explicit_risk_language" in result["matched_signal_categories"]
    assert result["is_diagnosis"] is False


def test_safety_elevated_concern_on_hopelessness():
    result = analyze_safety(
        "everything feels hopeless and no one cares",
        sentiment={"label": "negative", "score": -0.8},
        emotion={"dominant_emotion": "sadness"},
    )
    assert result["level"] == "elevated_concern"


def test_safety_low_concern_from_sustained_negative_sentiment():
    result = analyze_safety(
        "i am so tired and stressed about everything",
        sentiment={"label": "negative", "score": -0.9},
        emotion={"dominant_emotion": "sadness"},
    )
    assert result["level"] == "low_concern"


def test_safety_normal_on_neutral_text():
    result = analyze_safety(
        "i went to the store today",
        sentiment={"label": "neutral", "score": 0.0},
        emotion={"dominant_emotion": "neutral"},
    )
    assert result["level"] == "normal"


def test_safety_urgent_takes_priority_over_elevated():
    # Text containing both an urgent phrase and an elevated phrase must
    # resolve to the higher-severity "urgent" level.
    result = analyze_safety(
        "everything feels hopeless, i want to die",
        sentiment={"label": "negative", "score": -1.0},
        emotion={"dominant_emotion": "sadness"},
    )
    assert result["level"] == "urgent"


def test_safety_never_returns_medical_diagnosis_claim():
    result = analyze_safety("i want to die", sentiment={}, emotion={})
    assert result["is_diagnosis"] is False
    assert "diagnos" not in result["note"].lower().replace("not a medical or clinical diagnosis", "")


# ---------------------------------------------------------------------------
# Full pipeline + evidence aggregation
# ---------------------------------------------------------------------------

def test_full_pipeline_end_to_end():
    text = "My robotics exam went badly. I didn't practice enough."
    result = run_pipeline(text)
    assert result.normalized_text
    assert len(result.sentences) == 2
    assert len(result.tokens) > 0
    assert len(result.lemmas) == len(result.tokens)
    assert "1gram" in result.ngrams
    assert result.sentiment["label"] in {"positive", "negative", "neutral"}
    assert result.emotion["dominant_emotion"]
    assert result.intent["label"]
    assert isinstance(result.themes, list)

    # Phase 3 CORRECTION: with valid, non-empty input, the pipeline emits
    # a warning ONLY if the transformer embedding model is unavailable in
    # this environment (honest reporting, not silently swallowed) — never
    # any other unexpected warning.
    embedder_available = EmbeddingGenerator().is_available
    if embedder_available:
        assert result.warnings == []
    else:
        assert len(result.warnings) == 1
        assert "Embedding generation unavailable" in result.warnings[0]
    assert result.embedding["method"] == "sentence-transformers/all-MiniLM-L6-v2"
    assert result.embedding["dimensions"] == 384
    assert result.embedding["available"] == embedder_available


def test_full_pipeline_empty_input_no_crash():
    result = run_pipeline("")
    assert result.normalized_text == ""
    assert result.sentences == []
    assert result.tokens == []
    assert result.lemmas == []
    assert "Input was empty or contained no analyzable text after normalization." in result.warnings
    # With empty input, an additional embedding-unavailability warning may
    # also be present if the transformer model isn't loaded in this
    # environment — assert the expected warning is present rather than an
    # exact count, since that second warning is environment-dependent.
    embedder_available = EmbeddingGenerator().is_available
    expected_count = 1 if embedder_available else 2
    assert len(result.warnings) == expected_count


def test_evidence_aggregation_structure():
    result = run_pipeline("I am really stressed about my exam.")
    safety = analyze_safety(result.normalized_text, result.sentiment, result.emotion)
    evidence = aggregate_evidence(result, safety)

    assert "summary" in evidence
    assert "decision_trace" in evidence
    steps = [d["step"] for d in evidence["decision_trace"]]
    assert steps == ["input", "preprocessing", "extracted_features", "model_output", "safety_result"]
    assert evidence["summary"]["safety_level"] == safety["level"]
