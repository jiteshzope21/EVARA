"""
Phase 5 — Dataset tests.

Tests the synthetic dataset generation, validation, and preparation pipeline.
No model loading required — these are pure logic tests.
"""

import json
import os
import tempfile
from pathlib import Path

import pytest

# Ensure environment vars are set before any app imports
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB_NAME", "evara_test")
os.environ.setdefault("JWT_SECRET", "test-only-secret-do-not-use-in-production")
os.environ.setdefault("MOCK_SLM", "true")

from training.generate_dataset import _EXAMPLES, _make_record, generate_dataset
from training.validate_dataset import validate_dataset

SYSTEM_PROMPT_FRAGMENT = "You are Evara"


# ---------------------------------------------------------------------------
# generate_dataset
# ---------------------------------------------------------------------------


class TestGenerateDataset:
    def test_make_record_structure(self):
        """A generated record has the correct shape."""
        ex = _EXAMPLES[0]
        record = _make_record(ex)
        assert "messages" in record
        assert "_meta" in record
        assert record["_meta"]["synthetic"] is True

    def test_make_record_message_roles(self):
        """Generated record has system, user, assistant turns."""
        record = _make_record(_EXAMPLES[0])
        roles = [m["role"] for m in record["messages"]]
        assert roles == ["system", "user", "assistant"]

    def test_make_record_system_content(self):
        """System message contains expected fragment."""
        record = _make_record(_EXAMPLES[0])
        system_msg = record["messages"][0]
        assert system_msg["role"] == "system"
        assert SYSTEM_PROMPT_FRAGMENT in system_msg["content"]

    def test_make_record_non_empty_content(self):
        """All turns have non-empty content."""
        for ex in _EXAMPLES:
            record = _make_record(ex)
            for msg in record["messages"]:
                assert msg["content"].strip(), f"Empty content in {ex['stage']}/{ex['theme']}"

    def test_all_stages_represented(self):
        """Dataset covers all 8 conversation stages."""
        expected_stages = {
            "opening", "problem_exploration", "cause_reflection",
            "prioritization", "strategy_exploration", "action_planning",
            "time_frequency", "closure",
        }
        actual_stages = {ex["stage"] for ex in _EXAMPLES}
        assert expected_stages.issubset(actual_stages), (
            f"Missing stages: {expected_stages - actual_stages}"
        )

    def test_themes_variety(self):
        """Dataset includes multiple themes."""
        themes = {ex["theme"] for ex in _EXAMPLES}
        assert len(themes) >= 5, f"Only {len(themes)} themes — need at least 5."

    def test_safety_levels_represented(self):
        """Dataset includes normal, low_concern, and elevated_concern examples."""
        levels = {ex["safety_level"] for ex in _EXAMPLES}
        assert "normal" in levels
        assert "elevated_concern" in levels

    def test_generate_dataset_writes_jsonl(self, tmp_path):
        """generate_dataset() writes a valid JSONL file."""
        out = tmp_path / "test_dataset.jsonl"
        records = generate_dataset(seed=42, output_path=str(out))
        assert out.exists()
        assert len(records) == len(_EXAMPLES)

        with out.open("r", encoding="utf-8") as f:
            lines = [l for l in f if l.strip()]
        assert len(lines) == len(_EXAMPLES)

    def test_generate_dataset_valid_json_per_line(self, tmp_path):
        """Each line in the output is valid JSON."""
        out = tmp_path / "test_dataset.jsonl"
        generate_dataset(seed=42, output_path=str(out))

        with out.open("r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                if line.strip():
                    record = json.loads(line)  # should not raise
                    assert "messages" in record, f"Line {i+1}: missing 'messages'"

    def test_generate_dataset_creates_parent_dir(self, tmp_path):
        """generate_dataset() creates parent directories if they don't exist."""
        out = tmp_path / "deep" / "nested" / "dataset.jsonl"
        generate_dataset(seed=0, output_path=str(out))
        assert out.exists()


# ---------------------------------------------------------------------------
# validate_dataset — valid records
# ---------------------------------------------------------------------------


class TestValidateDatasetValid:
    def _write_jsonl(self, path: Path, records: list):
        with path.open("w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    def _valid_record(self, user="I feel stressed.", assistant="That sounds hard. Tell me more."):
        return {
            "messages": [
                {"role": "system", "content": "You are Evara."},
                {"role": "user", "content": user},
                {"role": "assistant", "content": assistant},
            ],
            "_meta": {"stage": "opening", "theme": "general", "safety_level": "normal", "synthetic": True},
        }

    def test_valid_file_passes(self, tmp_path):
        path = tmp_path / "valid.jsonl"
        self._write_jsonl(path, [self._valid_record() for _ in range(5)])
        passed, report = validate_dataset(str(path))
        assert passed, f"Expected pass. Errors: {report['errors']}"
        assert report["valid_records"] == 5
        assert report["invalid_records"] == 0

    def test_file_not_found(self, tmp_path):
        passed, report = validate_dataset(str(tmp_path / "nonexistent.jsonl"))
        assert not passed
        assert "error" in report

    def test_empty_content_user_invalid(self, tmp_path):
        path = tmp_path / "bad.jsonl"
        rec = self._valid_record(user="   ")  # blank
        self._write_jsonl(path, [rec])
        passed, report = validate_dataset(str(path))
        assert not passed
        assert report["invalid_records"] >= 1

    def test_invalid_role_detected(self, tmp_path):
        path = tmp_path / "bad.jsonl"
        rec = {
            "messages": [
                {"role": "system", "content": "You are Evara."},
                {"role": "badactor", "content": "Hello"},
                {"role": "assistant", "content": "Hi there, tell me more."},
            ]
        }
        self._write_jsonl(path, [rec])
        passed, report = validate_dataset(str(path))
        assert not passed
        assert any("invalid role" in e for e in report["errors"])

    def test_last_turn_not_assistant_invalid(self, tmp_path):
        path = tmp_path / "bad.jsonl"
        rec = {
            "messages": [
                {"role": "system", "content": "You are Evara."},
                {"role": "assistant", "content": "Hello there."},
                {"role": "user", "content": "What do you think?"},
            ]
        }
        self._write_jsonl(path, [rec])
        passed, report = validate_dataset(str(path))
        assert not passed
        assert any("last turn" in e for e in report["errors"])

    def test_too_few_messages_invalid(self, tmp_path):
        path = tmp_path / "bad.jsonl"
        rec = {"messages": [{"role": "assistant", "content": "Hello."}]}
        self._write_jsonl(path, [rec])
        passed, report = validate_dataset(str(path))
        assert not passed

    def test_malformed_json_line_reported(self, tmp_path):
        path = tmp_path / "bad.jsonl"
        with path.open("w", encoding="utf-8") as f:
            f.write('{"messages": [{"role": "user", "content": "Hi"}')  # unclosed JSON
            f.write("\n")
        passed, report = validate_dataset(str(path))
        assert not passed
        assert any("JSON parse error" in e for e in report["errors"])

    def test_duplicate_detection(self, tmp_path):
        path = tmp_path / "dups.jsonl"
        rec = self._valid_record()
        self._write_jsonl(path, [rec, rec])  # exact duplicate
        passed, report = validate_dataset(str(path))
        # By default duplicates are warnings, not errors
        assert report["duplicate_records"] == 1
        assert any("duplicate" in w for w in report["warnings"])

    def test_duplicate_strict_mode_fails(self, tmp_path):
        path = tmp_path / "dups.jsonl"
        rec = self._valid_record()
        self._write_jsonl(path, [rec, rec])
        passed, report = validate_dataset(str(path), strict=True)
        assert not passed
        assert any("duplicate" in e for e in report["errors"])

    def test_train_validation_split(self, tmp_path):
        """prepare_dataset produces correct split sizes."""
        from training.generate_dataset import generate_dataset as gen
        from training.prepare_dataset import prepare_dataset

        src = tmp_path / "src.jsonl"
        gen(seed=42, output_path=str(src))
        train_count, val_count = prepare_dataset(
            input_path=str(src),
            output_dir=str(tmp_path / "processed"),
            val_split=0.2,
            seed=42,
        )
        total = train_count + val_count
        assert total == len(_EXAMPLES)
        assert val_count >= 1
        assert train_count >= 1
        # val should be roughly 20%
        assert abs(val_count / total - 0.2) < 0.1

    def test_generated_dataset_validates_clean(self, tmp_path):
        """The full generated dataset passes the validator with no errors."""
        from training.generate_dataset import generate_dataset as gen
        src = tmp_path / "full.jsonl"
        gen(seed=42, output_path=str(src))
        passed, report = validate_dataset(str(src))
        assert passed, f"Full dataset validation failed. Errors: {report['errors']}"
        assert report["invalid_records"] == 0
