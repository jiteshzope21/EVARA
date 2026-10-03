"""
SLM Structured Context and Prompt Construction (Phase 5).

Responsibilities:
  - Define the GenerationContext dataclass (bounded, structured context
    fed to the SLM — NOT raw conversation history)
  - Build the ChatML-format prompt for TinyLlama-Chat
  - Keep context bounded to MAX_RECENT_MESSAGES

The SLM receives a STRUCTURED CONTEXT, not a raw database dump.
Sensitive fields (user_id, password hashes, DB ids, etc.) are never
included in the prompt.

TinyLlama uses the ChatML format:
    <|system|>\n{system}\n</s>\n<|user|>\n{user}\n</s>\n<|assistant|>\n
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.slm.config import SLMConfig

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are Evara, a warm, non-clinical reflective-support companion. "
    "Your role is to help the user explore their thoughts and feelings, "
    "identify what matters to them, and consider practical next steps. "
    "You do NOT diagnose, prescribe medication, or provide medical advice. "
    "You do NOT claim certainty about a user's mental health. "
    "You are NOT a replacement for professional mental-health support. "
    "Keep responses concise (2–4 sentences), empathic, and open-ended. "
    "Match your tone to the conversation stage and the user's expressed emotions. "
    "Do not repeat the user's words verbatim unless it is to reflect them back gently."
)

# Stage-specific tone guidance appended to the system prompt
_STAGE_GUIDANCE: Dict[str, str] = {
    "opening": "The user is just beginning. Greet them warmly and invite them to share.",
    "problem_exploration": "Gently invite the user to elaborate on what is difficult.",
    "cause_reflection": "Help the user reflect on what might be contributing to the situation.",
    "prioritization": "Help the user identify what feels most important right now.",
    "strategy_exploration": "Invite the user to think about possible approaches or changes.",
    "action_planning": "Help the user identify a realistic, specific next step.",
    "time_frequency": "Invite the user to commit to a time and frequency for their plan.",
    "closure": (
        "Summarise the user's plan gently and supportively. "
        "Affirm their effort. Keep it brief and positive."
    ),
}

# ---------------------------------------------------------------------------
# Deterministic safety response texts (used when SLM generation is bypassed)
# ---------------------------------------------------------------------------

URGENT_SAFETY_RESPONSE = (
    "I can hear that things feel very difficult right now. "
    "Please reach out to a trusted person or a crisis support service — "
    "you don't have to face this alone. "
    "If you are in immediate danger, please contact emergency services."
)

ELEVATED_CONCERN_RESPONSE = (
    "It sounds like you're carrying a lot right now, and I want you to know that matters. "
    "It might help to talk to someone you trust, or consider reaching out to a "
    "mental health professional who can give you proper support."
)


# ---------------------------------------------------------------------------
# Structured generation context
# ---------------------------------------------------------------------------


@dataclass
class RecentMessage:
    """A single message in the bounded recent-history window."""
    role: str  # "user" or "assistant"
    content: str


@dataclass
class NLPSignals:
    """NLP pipeline outputs included in the generation context."""
    sentiment_label: Optional[str] = None
    sentiment_score: Optional[float] = None
    dominant_emotion: Optional[str] = None
    intent_label: Optional[str] = None
    top_themes: List[str] = field(default_factory=list)


@dataclass
class GenerationContext:
    """
    Structured, bounded context passed to the SLM.

    This is the ONLY data the SLM sees — not raw conversation history,
    not database document fields, not any user PII beyond message content.
    """

    # Conversation metadata (not PII, needed for stage guidance)
    conversation_stage: str
    latest_user_message: str

    # Bounded recent history (see SLMConfig.max_recent_messages)
    recent_messages: List[RecentMessage] = field(default_factory=list)

    # Optional conversation summary (populated by a future summarizer or left empty)
    conversation_summary: Optional[str] = None

    # NLP signals from the deterministic pipeline
    nlp: NLPSignals = field(default_factory=NLPSignals)

    # Safety classification (deterministic, NOT SLM-driven)
    safety_level: str = "normal"
    safety_signals: List[str] = field(default_factory=list)

    # Evidence summary from reasoning/evidence.py
    evidence_summary: Optional[Dict] = None

    # Response policy determined BEFORE SLM is called
    response_policy: str = "normal"

    # Action-plan context (e.g. a prior closure summary relevant to the stage)
    action_plan_context: Optional[str] = None


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------


def build_system_prompt(context: GenerationContext) -> str:
    """
    Build the system prompt incorporating stage-specific guidance and
    NLP/safety signals. Returns a plain string.
    """
    parts = [SYSTEM_PROMPT]

    stage_hint = _STAGE_GUIDANCE.get(context.conversation_stage, "")
    if stage_hint:
        parts.append(f"\nConversation stage: {context.conversation_stage}. {stage_hint}")

    # NLP signal hints — keep terse, just orientation for the model
    nlp = context.nlp
    signal_parts = []
    if nlp.dominant_emotion and nlp.dominant_emotion != "neutral":
        signal_parts.append(f"emotion={nlp.dominant_emotion}")
    if nlp.sentiment_label and nlp.sentiment_label != "neutral":
        signal_parts.append(f"sentiment={nlp.sentiment_label}")
    if nlp.intent_label:
        signal_parts.append(f"intent={nlp.intent_label}")
    if nlp.top_themes:
        signal_parts.append(f"themes={','.join(nlp.top_themes[:3])}")
    if signal_parts:
        parts.append(f"\n[Context signals: {'; '.join(signal_parts)}]")

    # Response policy orientation
    if context.response_policy == "elevated_concern":
        parts.append(
            "\n[Important: the user may be experiencing significant distress. "
            "Be especially warm, non-judgmental, and gently suggest they consider "
            "talking to someone they trust or a professional.]"
        )
    elif context.response_policy == "low_concern":
        parts.append(
            "\n[The user may be experiencing some difficulty. "
            "Be supportive and offer gentle, open-ended reflection.]"
        )

    # Action plan context if relevant
    if context.action_plan_context:
        parts.append(f"\n[Prior action plan: {context.action_plan_context}]")

    # Conversation summary if available
    if context.conversation_summary:
        parts.append(f"\n[Summary so far: {context.conversation_summary}]")

    return "".join(parts)


def build_prompt(context: GenerationContext, config: SLMConfig) -> str:
    """
    Build the full ChatML-formatted prompt for TinyLlama-1.1B-Chat.

    Format (TinyLlama ChatML):
        <|system|>
        {system}
        </s>
        <|user|>
        {turn_1_user}
        </s>
        <|assistant|>
        {turn_1_assistant}
        </s>
        ... (bounded to max_recent_messages)
        <|user|>
        {latest_user_message}
        </s>
        <|assistant|>

    The trailing <|assistant|> signals the model to generate a response.
    """
    system_text = build_system_prompt(context)

    lines: List[str] = []

    # System turn
    lines.append(f"<|system|>\n{system_text}\n</s>")

    # Recent history (bounded)
    recent = context.recent_messages[-config.max_recent_messages:]
    for msg in recent:
        tag = "<|user|>" if msg.role == "user" else "<|assistant|>"
        lines.append(f"{tag}\n{msg.content.strip()}\n</s>")

    # Latest user message — always included
    lines.append(f"<|user|>\n{context.latest_user_message.strip()}\n</s>")

    # Open the assistant turn for generation
    lines.append("<|assistant|>\n")

    return "\n".join(lines)


def context_from_nlp_and_safety(
    conversation_stage: str,
    latest_user_message: str,
    recent_messages: List[Dict],
    nlp_result: Optional[Dict],
    safety_result: Optional[Dict],
    evidence_summary: Optional[Dict],
    action_plan_context: Optional[str],
    config: SLMConfig,
) -> GenerationContext:
    """
    Build a GenerationContext from the raw outputs of the NLP/safety pipeline.

    This is the bridge between the conversation service and the SLM —
    it extracts only the fields needed for generation and applies the
    bounded message window.

    Parameters mirror the data available after a full NLP+safety pass.
    """
    # Determine response policy from safety level
    safety_level = "normal"
    safety_signals: List[str] = []
    if safety_result:
        safety_level = safety_result.get("level", "normal")
        safety_signals = safety_result.get("matched_signal_categories", [])

    policy = _safety_level_to_policy(safety_level)

    # Build NLP signals struct
    nlp = NLPSignals()
    if nlp_result:
        nlp.sentiment_label = nlp_result.get("sentiment", {}).get("label")
        nlp.sentiment_score = nlp_result.get("sentiment", {}).get("score")
        nlp.dominant_emotion = nlp_result.get("emotion", {}).get("dominant_emotion")
        nlp.intent_label = nlp_result.get("intent", {}).get("label")
        themes = nlp_result.get("themes", [])
        nlp.top_themes = [t.get("theme", "") for t in themes[:3] if isinstance(t, dict)]

    # Build bounded recent message list
    bounded: List[RecentMessage] = []
    for m in recent_messages[-config.max_recent_messages:]:
        role = m.get("role", "user")
        content = m.get("content", "")
        if content:
            bounded.append(RecentMessage(role=role, content=content))

    # Evidence summary (just the top-level summary dict, not full trace)
    ev_summary = None
    if evidence_summary and isinstance(evidence_summary, dict):
        ev_summary = evidence_summary.get("summary")

    return GenerationContext(
        conversation_stage=conversation_stage,
        latest_user_message=latest_user_message,
        recent_messages=bounded,
        nlp=nlp,
        safety_level=safety_level,
        safety_signals=safety_signals,
        evidence_summary=ev_summary,
        response_policy=policy,
        action_plan_context=action_plan_context,
    )


def _safety_level_to_policy(safety_level: str) -> str:
    """Map a safety level string to a response policy string."""
    mapping = {
        "normal": "normal",
        "low_concern": "low_concern",
        "elevated_concern": "elevated_concern",
        "urgent": "urgent",
    }
    return mapping.get(safety_level, "normal")
