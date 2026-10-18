"""
SLM Model loading and lifecycle (Phase 5).

Handles:
  - Deterministic device detection (CUDA → MPS → CPU)
  - Tokenizer and model loading from Hugging Face Hub
  - A lazy singleton so the model is loaded once per process
  - Clean failure when the model cannot be loaded (no silent fallback
    to fake/mock generation)

IMPORTANT:
  - This module is NEVER called during FastAPI startup unless MOCK_SLM=false.
  - Training is a SEPARATE, explicit step (see backend/training/).
  - If mock_slm is True, callers MUST NOT call load_model() — they use the
    mock inference path instead.
"""

import logging
import threading
from typing import Optional, Tuple

from app.slm.config import SLMConfig

logger = logging.getLogger(__name__)

# Thread-safe singleton lock
_model_lock = threading.Lock()
_tokenizer = None
_model = None
_loaded_model_name: Optional[str] = None
_loaded_adapter_path: Optional[str] = None


def detect_device() -> str:
    """
    Detect the best available compute device.

    Order: CUDA > MPS > CPU
    The result is logged exactly once so the device choice is observable.
    Returns a torch device string: "cuda", "mps", or "cpu".
    """
    try:
        import torch
    except ImportError as exc:
        raise RuntimeError(
            "torch is not installed. Install it with: pip install torch"
        ) from exc

    if torch.cuda.is_available():
        device = "cuda"
        device_info = torch.cuda.get_device_name(0)
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
        device_info = "Apple MPS"
    else:
        device = "cpu"
        device_info = "CPU (no GPU detected)"

    logger.info("SLM device selected: %s (%s)", device, device_info)
    return device


def load_model(config: SLMConfig) -> Tuple[object, object]:
    """
    Load the tokenizer and model onto the detected device.
    Supports base causal LM or base causal LM + fine-tuned PEFT LoRA adapter.

    This is a lazy singleton: the first call downloads/loads the model;
    subsequent calls return the already-loaded objects.

    Raises RuntimeError explicitly if loading fails — callers must handle
    this and MUST NOT silently fall back to fake responses.

    Returns:
        (tokenizer, model)
    """
    global _tokenizer, _model, _loaded_model_name, _loaded_adapter_path

    with _model_lock:
        if (
            _model is not None
            and _loaded_model_name == config.model_name
            and _loaded_adapter_path == config.adapter_path
        ):
            logger.debug(
                "SLM already loaded: %s (adapter: %s)",
                config.model_name,
                config.adapter_path,
            )
            return _tokenizer, _model

        logger.info("Loading SLM tokenizer and model: %s", config.model_name)
        logger.info(
            "NOTE: First load may download model weights from Hugging Face Hub. "
            "This requires internet access. Subsequent runs use the local cache."
        )

        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:
            raise RuntimeError(
                "transformers is not installed. "
                "Install Phase 5 dependencies: pip install transformers torch"
            ) from exc

        device = detect_device()
        config.device = device  # record for observability

        try:
            tokenizer = AutoTokenizer.from_pretrained(
                config.model_name,
                use_fast=True,
            )
            # TinyLlama's pad token needs to be set explicitly for batch
            # inference; it does not define one by default.
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token
                logger.debug("Set pad_token = eos_token (%s)", tokenizer.eos_token)

        except Exception as exc:
            raise RuntimeError(
                f"Failed to load tokenizer for model '{config.model_name}'. "
                f"Verify the model name and that Hugging Face Hub is reachable. "
                f"Original error: {exc}"
            ) from exc

        try:
            import torch

            model = AutoModelForCausalLM.from_pretrained(
                config.model_name,
                torch_dtype=torch.float16 if device in ("cuda", "mps") else torch.float32,
                low_cpu_mem_usage=True,
            )
            model = model.to(device)

        except Exception as exc:
            raise RuntimeError(
                f"Failed to load base model '{config.model_name}'. "
                f"Verify the model name, local disk space, and available RAM. "
                f"Original error: {exc}"
            ) from exc

        # If adapter_path is provided, load the PEFT adapter
        if config.adapter_path:
            import os

            adapter_path = config.adapter_path
            if not os.path.isabs(adapter_path):
                # Search relative to cwd and relative to project backend root
                candidates = [
                    os.path.abspath(adapter_path),
                    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", adapter_path)),
                ]
                for cand in candidates:
                    if os.path.exists(cand):
                        adapter_path = cand
                        break

            if not os.path.exists(adapter_path):
                raise RuntimeError(
                    f"Configured SLM adapter path does not exist: {config.adapter_path} (resolved to {adapter_path})"
                )

            try:
                from peft import PeftModel

                logger.info("Loading fine-tuned LoRA adapter from: %s", adapter_path)
                model = PeftModel.from_pretrained(model, adapter_path)
                logger.info("LoRA adapter loaded successfully onto %s", config.model_name)
            except Exception as exc:
                raise RuntimeError(
                    f"Failed to load LoRA adapter from '{adapter_path}'. "
                    f"Original error: {exc}"
                ) from exc

        model.eval()  # inference mode only

        _tokenizer = tokenizer
        _model = model
        _loaded_model_name = config.model_name
        _loaded_adapter_path = config.adapter_path

        param_count = sum(p.numel() for p in model.parameters()) / 1_000_000
        logger.info(
            "SLM ready: %s (%.0fM parameters) on %s",
            config.display_name,
            param_count,
            device,
        )
        return _tokenizer, _model


def unload_model() -> None:
    """
    Release the loaded model and tokenizer from memory.
    Intended for tests and resource-constrained environments.
    """
    global _tokenizer, _model, _loaded_model_name, _loaded_adapter_path
    with _model_lock:
        _tokenizer = None
        _model = None
        _loaded_model_name = None
        _loaded_adapter_path = None
    logger.info("SLM unloaded from memory.")


def is_model_loaded() -> bool:
    """Return True if the model singleton is currently loaded."""
    return _model is not None
