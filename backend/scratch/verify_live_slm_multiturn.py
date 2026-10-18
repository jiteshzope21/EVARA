"""
Live Multi-Turn Verification with Real TinyLlama LoRA Fine-Tuned Model.

Tests 3 consecutive messages through slm_chat_service with MOCK_SLM=false:
- Turn 1: "I feel anxious about an upcoming presentation next Tuesday."
- Turn 2: "The hardest part is speaking in front of my professors."
- Turn 3: "I'd like to practice with a friend tomorrow afternoon."

Verifies:
1. Model string identifies real fine-tuned LoRA adapter.
2. Latency is measured (> 0 ms).
3. Validated is True.
4. Messages grow from 1 initial greeting -> 3 turns -> 5 turns -> 7 turns.
5. Chronological turn ordering is preserved.
6. Zero mock mode flags.
"""

import asyncio
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Real inference configuration
os.environ["MOCK_SLM"] = "false"
os.environ["SLM_MODEL"] = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
os.environ["SLM_ADAPTER_PATH"] = str(BACKEND_DIR / "saved_models" / "evara_tinyllama_lora")
os.environ["MONGODB_URI"] = "mongodb://localhost:27017"
os.environ["MONGODB_DB_NAME"] = "evara_test"
os.environ["JWT_SECRET"] = "test-secret-key-12345"

from unittest.mock import MagicMock
from mongomock_motor import AsyncMongoMockClient

from app.core.config import get_settings
from app.services import slm_chat_service
from app.slm.model import unload_model


async def main():
    print("=" * 80)
    print("EVARA MULTI-TURN REAL SLM INFERENCE VERIFICATION (3 CONSECUTIVE TURNS)")
    print("=" * 80)

    get_settings.cache_clear()
    settings = get_settings()
    unload_model()

    print(f"Setting MOCK_SLM: {settings.mock_slm}")
    print(f"Setting SLM_MODEL: {settings.slm_model}")
    print(f"Setting SLM_ADAPTER_PATH: {settings.slm_adapter_path}")

    assert settings.mock_slm is False, "MOCK_SLM must be False for real inference verification"

    # Use in-memory async mongo mock so we don't depend on external network/Atlas
    client = AsyncMongoMockClient()
    db = client["evara_test"]
    user_id = "live_verify_user_001"

    # 1. Create SLM Chat
    print("\n--- Creating SLM Chat Session ---")
    chat = await slm_chat_service.create_slm_conversation(db, user_id, "Presentation Prep")
    chat_id = str(chat["_id"])
    print(f"Created Chat ID: {chat_id}, Messages: {len(chat['messages'])}")
    print(f"Initial Greeting: {chat['messages'][0]['content']}")

    test_turns = [
        "I feel anxious about an upcoming presentation next Tuesday.",
        "The hardest part is speaking in front of my professors.",
        "I'd like to practice with a friend tomorrow afternoon.",
    ]

    for turn_idx, user_input in enumerate(test_turns, start=1):
        print(f"\n" + "-" * 70)
        print(f"Turn {turn_idx} User: {user_input}")
        print("Running real SLM inference with LoRA adapter...")

        updated_chat = await slm_chat_service.send_slm_chat_message(
            db=db,
            user_id=user_id,
            conversation_id=chat_id,
            content=user_input,
        )

        expected_msg_count = 1 + (turn_idx * 2)
        assert len(updated_chat["messages"]) == expected_msg_count, (
            f"Expected {expected_msg_count} messages, got {len(updated_chat['messages'])}"
        )

        user_turn = updated_chat["messages"][-2]
        asst_turn = updated_chat["messages"][-1]

        assert user_turn["role"] == "user"
        assert user_turn["content"] == user_input
        assert asst_turn["role"] == "assistant"
        assert asst_turn["validated"] is True
        assert "[MOCK]" not in asst_turn["model"]
        assert "LoRA" in asst_turn["model"]
        assert asst_turn["duration_ms"] is not None and asst_turn["duration_ms"] > 0

        print(f"Turn {turn_idx} Assistant Response: {asst_turn['content']}")
        print(f"Model: {asst_turn['model']}")
        print(f"Safety Level: {asst_turn['safety_level']}")
        print(f"Validated: {asst_turn['validated']}")
        print(f"Duration: {asst_turn['duration_ms']:.1f} ms")

    print("\n" + "=" * 80)
    print(">>> 3-TURN REAL MODEL VERIFICATION COMPLETE — ALL ASSERTIONS PASSED! <<<")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
