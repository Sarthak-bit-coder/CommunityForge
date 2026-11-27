import json

import pytest

from accessforge_ingest import cli, http


def test_main_prints_result_json(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(cli, "run", lambda area: {"area": area})
    assert cli.main(["fremont_bart"]) == 0
    assert json.loads(capsys.readouterr().out) == {"area": "fremont_bart"}


def test_main_reports_failure_without_traceback_exit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(area: str) -> dict[str, object]:
        raise RuntimeError("network down")

    monkeypatch.setattr(cli, "run", boom)
    assert cli.main(["fremont_bart"]) == 1


def test_main_rejects_unknown_area() -> None:
    with pytest.raises(SystemExit):
        cli.main(["atlantis"])


def test_get_json_wraps_network_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(*args: object, **kwargs: object) -> None:
        raise OSError("refused")

    monkeypatch.setattr(http, "urlopen", refuse)
    with pytest.raises(RuntimeError, match="fetch failed"):
        http.get_json("https://example.invalid/x", {"a": "b"})
