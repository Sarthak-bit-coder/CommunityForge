"""Verify that the experiment command preserves inputs and observed row evidence."""

import json
from pathlib import Path
import subprocess
import sys


def test_command_writes_complete_json_and_refuses_to_overwrite(tmp_path: Path) -> None:
    script = Path(__file__).resolve().parents[1] / "benchmarks" / "run.py"
    output = tmp_path / "experiment.json"
    command = [
        sys.executable,
        str(script),
        "--width",
        "2",
        "--height",
        "1",
        "--barriers",
        "1",
        "--clusterings",
        "0",
        "--seeds",
        "0",
        "1",
        "--budgets",
        "0",
        "1",
        "--methods",
        "B0",
        "exhaustive",
        "--output",
        str(output),
    ]
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    artifact = json.loads(output.read_text())
    assert json.loads(completed.stdout)["rows"] == 8
    assert artifact["synthetic"] is True
    assert artifact["protocol"]["seeds"] == [0, 1]
    assert len(artifact["rows"]) == 8
    assert all(row["status"] == "ok" for row in artifact["rows"])
    assert all(row["total_cost"] <= row["budget"] for row in artifact["rows"])
    original = output.read_bytes()
    repeated = subprocess.run(command, check=False, capture_output=True, text=True)
    assert repeated.returncode != 0
    assert "output already exists" in repeated.stderr
    assert output.read_bytes() == original
