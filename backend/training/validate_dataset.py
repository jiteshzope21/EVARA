"""
Dataset Validator (Phase 5).

Validates a JSONL synthetic dataset file before fine-tuning.

Checks:
  - File exists and is valid JSONL
  - Each record has a "messages" list with at least 2 turns
  - Each message has "role" and "content" fields
  - Roles are one of: system, user, assistant
  - Content is non-empty and within min/max length bounds
  - The last message is from the assistant
  - The first message (if present) with role "system" is non-empty
  - Duplicate detection (exact message-content hash)
  - Malformed records reported with line numbers

Usage:
    python training/validate_dataset.py [--input PATH] [--strict]

Exit codes:
    0 — validation passed
    1 — validation failed (at least one error found)
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Validation thresholds
MIN_ASSISTANT_CHARS = 10
MAX_ASSISTANT_CHARS = 2000
MIN_USER_CHARS = 3
MAX_USER_CHARS = 4000

VALID_ROLES = {"system", "user", "assistant"}


# ---------------------------------------------------------------------------
# Record-level validation
# ---------------------------------------------------------------------------


def _validate_record(
    record: Any,
    line_number: int,
) -> Tuple[bool, List[str]]:
    """
    Validate a single dataset record.

    Returns (is_valid, list_of_error_messages).
    """
    errors: List[str] = []

    if not isinstance(record, dict):
        return False, [f"Line {line_number}: record is not a JSON object."]

    messages = record.get("messages")
    if messages is None:
        return False, [f"Line {line_number}: missing 'messages' key."]

    if not isinstance(messages, list):
        return False, [f"Line {line_number}: 'messages' must be a list."]

    if len(messages) < 2:
        errors.append(f"Line {line_number}: 'messages' has fewer than 2 turns ({len(messages)}).")

    for i, msg in enumerate(messages):
        if not isinstance(msg, dict):
            errors.append(f"Line {line_number}, turn {i}: message is not a dict.")
            continue

        role = msg.get("role", "")
        content = msg.get("content", "")

        if role not in VALID_ROLES:
            errors.append(f"Line {line_number}, turn {i}: invalid role '{role}'. Must be one of {VALID_ROLES}.")

        if not isinstance(content, str) or not content.strip():
            errors.append(f"Line {line_number}, turn {i}: 'content' is empty or not a string.")
            continue

        if role == "user":
            if len(content) < MIN_USER_CHARS:
                errors.append(f"Line {line_number}, turn {i}: user content too short ({len(content)} < {MIN_USER_CHARS}).")
            if len(content) > MAX_USER_CHARS:
                errors.append(f"Line {line_number}, turn {i}: user content too long ({len(content)} > {MAX_USER_CHARS}).")

        if role == "assistant":
            if len(content) < MIN_ASSISTANT_CHARS:
                errors.append(f"Line {line_number}, turn {i}: assistant content too short ({len(content)} < {MIN_ASSISTANT_CHARS}).")
            if len(content) > MAX_ASSISTANT_CHARS:
                errors.append(f"Line {line_number}, turn {i}: assistant content too long ({len(content)} > {MAX_ASSISTANT_CHARS}).")

    # Last turn must be assistant
    if messages and isinstance(messages[-1], dict):
        last_role = messages[-1].get("role")
        if last_role != "assistant":
            errors.append(f"Line {line_number}: last turn must be 'assistant', got '{last_role}'.")

    return len(errors) == 0, errors


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------


def _record_fingerprint(record: Dict[str, Any]) -> str:
    """Return a stable hash for a record's message content."""
    messages = record.get("messages", [])
    key = json.dumps(
        [{"role": m.get("role"), "content": m.get("content", "").strip()} for m in messages],
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Main validation function
# ---------------------------------------------------------------------------


def validate_dataset(
    input_path: str,
    strict: bool = False,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Validate the dataset at input_path.

    Returns:
        (overall_valid, report_dict)
    """
    path = Path(input_path)
    if not path.exists():
        return False, {"error": f"File not found: {path}"}

    all_errors: List[str] = []
    warnings: List[str] = []
    valid_count = 0
    invalid_count = 0
    total = 0
    seen_fingerprints: Dict[str, int] = {}  # fingerprint -> first line number
    duplicates: List[str] = []

    with path.open("r", encoding="utf-8") as f:
        for line_number, raw_line in enumerate(f, start=1):
            raw_line = raw_line.strip()
            if not raw_line:
                continue  # skip blank lines

            total += 1

            # JSON parse
            try:
                record = json.loads(raw_line)
            except json.JSONDecodeError as exc:
                all_errors.append(f"Line {line_number}: JSON parse error — {exc}")
                invalid_count += 1
                continue

            # Record validation
            is_valid, record_errors = _validate_record(record, line_number)
            if record_errors:
                all_errors.extend(record_errors)
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1

            # Duplicate detection
            fp = _record_fingerprint(record)
            if fp in seen_fingerprints:
                dup_msg = (
                    f"Line {line_number}: duplicate of line {seen_fingerprints[fp]}."
                )
                duplicates.append(dup_msg)
                if strict:
                    all_errors.append(dup_msg)
                else:
                    warnings.append(dup_msg)
            else:
                seen_fingerprints[fp] = line_number

    overall_valid = invalid_count == 0 and (not strict or len(duplicates) == 0)

    report = {
        "input_path": str(path),
        "total_records": total,
        "valid_records": valid_count,
        "invalid_records": invalid_count,
        "duplicate_records": len(duplicates),
        "errors": all_errors,
        "warnings": warnings,
        "passed": overall_valid,
    }

    return overall_valid, report


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate EVARA synthetic SFT dataset.")
    parser.add_argument(
        "--input",
        default="data/synthetic/evara_synthetic.jsonl",
        help="Input JSONL file path (relative to backend/).",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat duplicate records as errors (not just warnings).",
    )
    args = parser.parse_args()

    passed, report = validate_dataset(args.input, strict=args.strict)

    print(f"\n=== Dataset Validation Report ===")
    print(f"Input:           {report.get('input_path', args.input)}")
    print(f"Total records:   {report.get('total_records', 0)}")
    print(f"Valid:           {report.get('valid_records', 0)}")
    print(f"Invalid:         {report.get('invalid_records', 0)}")
    print(f"Duplicates:      {report.get('duplicate_records', 0)}")

    if report.get("errors"):
        print(f"\nErrors ({len(report['errors'])}):")
        for e in report["errors"][:20]:  # cap display
            print(f"  - {e}")

    if report.get("warnings"):
        print(f"\nWarnings ({len(report['warnings'])}):")
        for w in report["warnings"][:10]:
            print(f"  - {w}")

    print(f"\nResult: {'PASSED' if passed else 'FAILED'}")

    sys.exit(0 if passed else 1)
