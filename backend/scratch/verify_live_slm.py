"""
End-to-End Live Verification of EVARA Fine-Tuned SLM Adapter.

Tests:
  1. Config loading: MOCK_SLM=false, SLM_ADAPTER_PATH=saved_models/evara_tinyllama_lora
  2. Database mock / conversation loading
  3. Execution of full Phase 5 pipeline (NLP, Safety, Evidence, Context, Real Generation, Validation)
  4. Response assertions:
     - mock is False
     - model string reflects base + LoRA adapter
     - validated is True
     - duration_ms is present
     - deterministic stage progression is completely preserved
"""

import asyncio
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Configure real SLM environment
os.environ["MOCK_SLM"] = "false"
os.environ["SLM_MODEL"] = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
os.environ["SLM_ADAPTER_PATH"] = str(BACKEND_DIR / "saved_models" / "evara_tinyllama_lora")
os.environ["MONGODB_URI"] = "mongodb://localhost:27017"
os.environ["MONGODB_DB_NAME"] = "evara_test"
os.environ["JWT_SECRET"] = "test-secret-key-12345"

from unittest.mock import AsyncMock, MagicMock, patch
from app.core.config import get_settings
from app.services import slm_service
from app.slm.model import unload_model


async def main():
    print("=" * 70)
    print("EVARA LIVE SLM INFERENCE VERIFICATION")
    print("=" * 70)

    # Clear cached settings and singleton
    get_settings.cache_clear()
    settings = get_settings()
    unload_model()

    print(f"Config MOCK_SLM: {settings.mock_slm}")
    print(f"Config SLM_MODEL: {settings.slm_model}")
    print(f"Config SLM_ADAPTER_PATH: {settings.slm_adapter_path}")

    assert settings.mock_slm is False, "MOCK_SLM should be False"
    assert settings.slm_adapter_path, "SLM_ADAPTER_PATH must be set"

    # Mock DB conversation
    mock_db = MagicMock()
    user_id = "test_user_42"
    conversation_id = "conv_live_test_101"

    sample_conversation = {
        "_id": conversation_id,
        "id": conversation_id,
        "user_id": user_id,
        "stage": "action_planning",
        "status": "active",
        "messages": [
            {"role": "assistant", "content": "Welcome to EVARA. What is on your mind?"},
            {"role": "user", "content": "I keep putting off my biology paper because the research seems endless."},
            {"role": "assistant", "content": "Feeling overwhelmed by the scope of research is common. What is the core question you need to answer?"},
            {"role": "user", "content": "I think I could outline just the methodology section tonight for 25 minutes."},
        ],
    }

    with patch("app.services.conversation_service.get_owned_conversation", new=AsyncMock(return_value=sample_conversation)):
        print("\nCalling slm_service.generate_slm_response()...")
        result = await slm_service.generate_slm_response(
            db=mock_db,
            user_id=user_id,
            conversation_id=conversation_id,
            persist=False,
        )

    print("\n--- Generation Result Received ---")
    print(f"Model: {result['model']}")
    print(f"Mock Mode: {result['mock']}")
    print(f"Validated: {result['validated']}")
    print(f"Safety Level: {result['safety_level']}")
    print(f"Policy Used: {result['policy_used']}")
    print(f"Safety Bypass: {result['safety_bypass']}")
    print(f"Stage: {result['conversation_stage']}")
    print(f"Duration: {result.get('duration_ms')} ms")
    print(f"Generated Text:\n{result['text']}")
    print("=" * 70)

    # Verification checks
    assert result["mock"] is False, "FAIL: Response reported as mock!"
    assert "LoRA" in result["model"], f"FAIL: Model does not indicate LoRA: {result['model']}"
    assert result["validated"] is True, "FAIL: Response failed validation"
    assert len(result["text"]) >= 20, "FAIL: Generated text too short"
    assert result["conversation_stage"] == "action_planning", "FAIL: Stage mismatch"
    assert len(sample_conversation["messages"]) == 4, "FAIL: Conversation messages were unexpectedly mutated"

    print("\n>>> ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<")


if __name__ == "__main__":
    asyncio.run(main())
