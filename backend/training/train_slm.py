"""
SLM Fine-Tuning Pipeline (Phase 5).

TRAINING PIPELINE — this script must be run EXPLICITLY.
The FastAPI application NEVER imports or calls this script at startup.

Method: LoRA / PEFT (Parameter-Efficient Fine-Tuning)
  Base model: TinyLlama/TinyLlama-1.1B-Chat-v1.0
  Fine-tuning: LoRA on attention projection layers (q_proj, v_proj)
  Output: backend/saved_models/evara_tinyllama_lora/
  (LoRA adapter weights + manifest only — not full multi-gigabyte base model)

Usage:
    cd backend
    python -m training.generate_dataset
    python -m training.prepare_dataset --val-split 0.1 --test-split 0.1
    python -m training.train_slm
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

_BACKEND_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_BACKEND_ROOT))

# ---------------------------------------------------------------------------
# Default Hyperparameters
# ---------------------------------------------------------------------------

DEFAULT_MODEL_NAME   = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
DEFAULT_TRAIN_FILE   = "data/processed/train.jsonl"
DEFAULT_VAL_FILE     = "data/processed/validation.jsonl"
DEFAULT_OUTPUT_DIR   = "saved_models/evara_tinyllama_lora"
DEFAULT_EPOCHS       = 3
DEFAULT_BATCH_SIZE   = 2
DEFAULT_GRAD_ACCUM   = 4         # effective batch size = 2 * 4 = 8
DEFAULT_LR           = 3e-4
DEFAULT_MAX_SEQ_LEN  = 256
DEFAULT_SEED         = 42
DEFAULT_WARMUP_RATIO = 0.05
DEFAULT_SAVE_STEPS   = 50

# LoRA hyperparameters
LORA_R               = 8         # rank of the low-rank matrices
LORA_ALPHA           = 16        # LoRA scaling factor
LORA_DROPOUT         = 0.05
LORA_TARGET_MODULES  = ["q_proj", "v_proj"]


# ---------------------------------------------------------------------------
# PyTorch Dataset for SFT with prompt masking
# ---------------------------------------------------------------------------

def _load_jsonl_records(filepath: str) -> List[Dict[str, Any]]:
    records = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


class ConversationalSFTDataset:
    """
    PyTorch dataset for conversational SFT.
    Tokenizes ChatML messages and masks prompt tokens with -100 so loss
    is computed ONLY on the assistant's response.
    """

    def __init__(self, jsonl_file: str, tokenizer: Any, max_seq_len: int = 256):
        import torch

        self.records = _load_jsonl_records(filepath=jsonl_file)
        self.tokenizer = tokenizer
        self.max_seq_len = max_seq_len
        self.features = []

        for record in self.records:
            messages = record.get("messages", [])
            if len(messages) < 2:
                continue

            # Format full chat with assistant response
            full_text = self.tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=False,
            )

            # Format prompt-only (up to last user turn, ending with assistant prompt)
            prompt_messages = messages[:-1]
            prompt_text = self.tokenizer.apply_chat_template(
                prompt_messages,
                tokenize=False,
                add_generation_prompt=True,
            )

            full_enc = self.tokenizer(
                full_text,
                truncation=True,
                max_length=self.max_seq_len,
                return_tensors="pt",
            )
            prompt_enc = self.tokenizer(
                prompt_text,
                truncation=True,
                max_length=self.max_seq_len,
                return_tensors="pt",
            )

            input_ids = full_enc["input_ids"][0]
            attention_mask = full_enc["attention_mask"][0]
            labels = input_ids.clone()

            # Mask prompt tokens with -100
            prompt_len = min(len(prompt_enc["input_ids"][0]), len(labels))
            labels[:prompt_len] = -100

            self.features.append({
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "labels": labels,
            })

    def __len__(self) -> int:
        return len(self.features)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        return self.features[idx]


# ---------------------------------------------------------------------------
# Training function
# ---------------------------------------------------------------------------

def train(
    model_name: str = DEFAULT_MODEL_NAME,
    train_file: str = DEFAULT_TRAIN_FILE,
    val_file: str = DEFAULT_VAL_FILE,
    output_dir: str = DEFAULT_OUTPUT_DIR,
    num_epochs: int = DEFAULT_EPOCHS,
    batch_size: int = DEFAULT_BATCH_SIZE,
    grad_accum: int = DEFAULT_GRAD_ACCUM,
    learning_rate: float = DEFAULT_LR,
    max_seq_len: int = DEFAULT_MAX_SEQ_LEN,
    seed: int = DEFAULT_SEED,
    warmup_ratio: float = DEFAULT_WARMUP_RATIO,
    save_steps: int = DEFAULT_SAVE_STEPS,
    merge_and_save: bool = False,
) -> Dict[str, Any]:
    """
    Run the parameter-efficient LoRA fine-tuning pipeline.
    Returns a dict with training metrics and artifact locations.
    """
    missing = []
    try:
        import torch
    except ImportError:
        missing.append("torch")
    try:
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            DataCollatorForSeq2Seq,
            Trainer,
            TrainingArguments,
        )
    except ImportError:
        missing.append("transformers")
    try:
        from peft import LoraConfig, TaskType, get_peft_model
    except ImportError:
        missing.append("peft")

    if missing:
        print(f"ERROR: Missing training dependencies: {', '.join(missing)}")
        print("Install with: pip install transformers peft accelerate torch")
        sys.exit(1)

    import torch
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        DataCollatorForSeq2Seq,
        Trainer,
        TrainingArguments,
    )

    # Device selection
    if torch.cuda.is_available():
        device = "cuda"
        fp16 = True
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
        fp16 = False
    else:
        device = "cpu"
        fp16 = False

    print(f"\n========================================================")
    print(f"       EVARA SLM Fine-Tuning Pipeline (LoRA)            ")
    print(f"========================================================")
    print(f"Base model:       {model_name}")
    print(f"Device:           {device}")
    print(f"Train file:       {train_file}")
    print(f"Val file:         {val_file}")
    print(f"Output directory: {output_dir}")
    print(f"Epochs:           {num_epochs}")
    print(f"Batch size:       {batch_size} (effective: {batch_size * grad_accum})")
    print(f"Learning rate:    {learning_rate}")
    print(f"Max sequence len: {max_seq_len}")
    print(f"LoRA rank (r):    {LORA_R}, alpha: {LORA_ALPHA}")
    print(f"LoRA targets:     {LORA_TARGET_MODULES}")
    print(f"========================================================\n")

    # Verify input files
    train_path = Path(train_file)
    val_path = Path(val_file)
    if not train_path.exists():
        print(f"ERROR: Training file not found: {train_path}")
        sys.exit(1)
    if not val_path.exists():
        print(f"ERROR: Validation file not found: {val_path}")
        sys.exit(1)

    t_start = time.perf_counter()

    # Load tokenizer
    print("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Load base model
    print(f"Loading base model '{model_name}'...")
    base_model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        low_cpu_mem_usage=True,
    )
    base_model.config.use_cache = False

    # Apply LoRA configuration
    print("Configuring LoRA PEFT adapter...")
    lora_config = LoraConfig(
        r=LORA_R,
        lora_alpha=LORA_ALPHA,
        target_modules=LORA_TARGET_MODULES,
        lora_dropout=LORA_DROPOUT,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )
    peft_model = get_peft_model(base_model, lora_config)
    peft_model.print_trainable_parameters()

    # Build datasets
    print("Preparing tokenized conversational datasets...")
    train_dataset = ConversationalSFTDataset(str(train_path), tokenizer, max_seq_len=max_seq_len)
    val_dataset = ConversationalSFTDataset(str(val_path), tokenizer, max_seq_len=max_seq_len)
    print(f"Loaded {len(train_dataset)} training examples, {len(val_dataset)} validation examples.")

    data_collator = DataCollatorForSeq2Seq(
        tokenizer=tokenizer,
        pad_to_multiple_of=8 if device == "cuda" else None,
        return_tensors="pt",
    )

    # Configure training arguments
    out_dir = Path(output_dir)
    checkpoint_dir = out_dir / "checkpoints"
    training_args = TrainingArguments(
        output_dir=str(checkpoint_dir),
        num_train_epochs=num_epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        gradient_accumulation_steps=grad_accum,
        learning_rate=learning_rate,
        warmup_steps=5,
        lr_scheduler_type="cosine",
        fp16=fp16,
        logging_steps=5,
        save_strategy="epoch",
        eval_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="loss",
        greater_is_better=False,
        report_to="none",
        seed=seed,
        remove_unused_columns=False,
        use_cpu=(device == "cpu"),
    )

    trainer = Trainer(
        model=peft_model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=data_collator,
    )

    print("\nStarting gradient-based fine-tuning...")
    train_result = trainer.train()
    total_duration_sec = time.perf_counter() - t_start

    print(f"\nTraining completed in {total_duration_sec:.1f}s.")
    print(f"Final Train Loss: {train_result.training_loss:.4f}")

    # Evaluate on validation set
    print("Evaluating on validation set...")
    eval_metrics = trainer.evaluate()
    eval_loss = eval_metrics.get("eval_loss", 0.0)
    print(f"Validation Loss: {eval_loss:.4f}")

    # Save fine-tuned adapter weights
    out_dir.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))

    # Clean up checkpoint directory to save disk space
    import shutil
    if checkpoint_dir.exists():
        try:
            shutil.rmtree(str(checkpoint_dir))
        except Exception:
            pass

    # Save training metrics and log history
    metrics_summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "base_model": model_name,
        "adapter_type": "LoRA",
        "lora_rank": LORA_R,
        "lora_alpha": LORA_ALPHA,
        "target_modules": LORA_TARGET_MODULES,
        "epochs": num_epochs,
        "effective_batch_size": batch_size * grad_accum,
        "learning_rate": learning_rate,
        "train_loss": round(train_result.training_loss, 4),
        "eval_loss": round(eval_loss, 4),
        "train_samples": len(train_dataset),
        "val_samples": len(val_dataset),
        "duration_seconds": round(total_duration_sec, 2),
        "device": device,
        "log_history": trainer.state.log_history,
    }

    metrics_file = out_dir / "training_metrics.json"
    with open(metrics_file, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)

    # Save explicit manifest file
    manifest = {
        "format_version": "1.0",
        "artifact_type": "lora_adapter",
        "base_model_name": model_name,
        "adapter_path": str(out_dir.resolve()),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "train_loss": round(train_result.training_loss, 4),
        "eval_loss": round(eval_loss, 4),
        "device_used": device,
        "train_samples": len(train_dataset),
        "val_samples": len(val_dataset),
        "files": [f.name for f in out_dir.iterdir() if f.is_file()],
    }
    manifest_file = out_dir / "manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[Artifact Saved] LoRA adapter weights saved to: {out_dir}")
    print(f"[Manifest Saved] Manifest saved to: {manifest_file}")

    # Optionally merge adapter
    if merge_and_save:
        print("\nMerging LoRA adapter into full model...")
        merged_model = peft_model.merge_and_unload()
        merged_path = out_dir.parent / "evara_tinyllama_merged"
        merged_model.save_pretrained(str(merged_path))
        tokenizer.save_pretrained(str(merged_path))
        print(f"Merged model saved to: {merged_path}")

    return metrics_summary


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune EVARA SLM with LoRA.")
    parser.add_argument("--model",          default=DEFAULT_MODEL_NAME)
    parser.add_argument("--train-file",     default=DEFAULT_TRAIN_FILE)
    parser.add_argument("--val-file",       default=DEFAULT_VAL_FILE)
    parser.add_argument("--output-dir",     default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--epochs",         type=int,   default=DEFAULT_EPOCHS)
    parser.add_argument("--batch-size",     type=int,   default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--grad-accum",     type=int,   default=DEFAULT_GRAD_ACCUM)
    parser.add_argument("--lr",             type=float, default=DEFAULT_LR)
    parser.add_argument("--max-seq-len",    type=int,   default=DEFAULT_MAX_SEQ_LEN)
    parser.add_argument("--seed",           type=int,   default=DEFAULT_SEED)
    parser.add_argument("--warmup-ratio",   type=float, default=DEFAULT_WARMUP_RATIO)
    parser.add_argument("--save-steps",     type=int,   default=DEFAULT_SAVE_STEPS)
    parser.add_argument("--merge-and-save", action="store_true")
    args = parser.parse_args()

    os.chdir(_BACKEND_ROOT)

    train(
        model_name=args.model,
        train_file=args.train_file,
        val_file=args.val_file,
        output_dir=args.output_dir,
        num_epochs=args.epochs,
        batch_size=args.batch_size,
        grad_accum=args.grad_accum,
        learning_rate=args.lr,
        max_seq_len=args.max_seq_len,
        seed=args.seed,
        warmup_ratio=args.warmup_ratio,
        save_steps=args.save_steps,
        merge_and_save=args.merge_and_save,
    )
