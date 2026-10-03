"""
Dataset Preparation (Phase 5).

Prepares the validated synthetic dataset for SFT training:
  1. Load and validate the JSONL dataset
  2. Apply train/validation split (default: 80/20)
  3. Export as separate JSONL files for use with Hugging Face Datasets

Usage:
    python training/prepare_dataset.py [--input PATH] [--output-dir DIR]
                                       [--val-split 0.2] [--seed 42]

Output files:
    backend/data/processed/train.jsonl
    backend/data/processed/validation.jsonl

The "messages" key in each record is kept as-is (ChatML format),
compatible with TRL SFTTrainer's apply_chat_template workflow.
"""

import argparse
import json
import random
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

from training.validate_dataset import validate_dataset


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    records = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def write_jsonl(records: List[Dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def prepare_dataset(
    input_path: str = "data/synthetic/evara_synthetic.jsonl",
    output_dir: str = "data/processed",
    val_split: float = 0.2,
    seed: int = 42,
) -> Tuple[int, int]:
    """
    Validate, split, and export the dataset.

    Returns:
        (train_count, val_count)

    Raises:
        SystemExit if validation fails.
    """
    passed, report = validate_dataset(input_path)
    if not passed:
        print(f"Dataset validation FAILED. Cannot prepare. Errors:")
        for e in report.get("errors", []):
            print(f"  - {e}")
        sys.exit(1)

    print(
        f"Validation passed: {report['valid_records']} records "
        f"({report.get('duplicate_records', 0)} duplicates noted as warnings)."
    )

    records = load_jsonl(Path(input_path))
    rng = random.Random(seed)
    rng.shuffle(records)

    split_idx = max(1, int(len(records) * (1.0 - val_split)))
    train_records = records[:split_idx]
    val_records = records[split_idx:]

    out = Path(output_dir)
    write_jsonl(train_records, out / "train.jsonl")
    write_jsonl(val_records, out / "validation.jsonl")

    print(f"Train:      {len(train_records)} records → {out}/train.jsonl")
    print(f"Validation: {len(val_records)} records → {out}/validation.jsonl")

    return len(train_records), len(val_records)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare EVARA dataset for SFT training.")
    parser.add_argument("--input",      default="data/synthetic/evara_synthetic.jsonl")
    parser.add_argument("--output-dir", default="data/processed")
    parser.add_argument("--val-split",  type=float, default=0.2, help="Validation fraction (0–1).")
    parser.add_argument("--seed",       type=int, default=42)
    args = parser.parse_args()

    prepare_dataset(
        input_path=args.input,
        output_dir=args.output_dir,
        val_split=args.val_split,
        seed=args.seed,
    )
