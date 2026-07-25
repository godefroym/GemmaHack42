from __future__ import annotations

from pathlib import Path

from gemma_ir.execution import render_llm_execution_html
from gemma_ir.models import PlannerEnvelope


def test_real_ransomware_execution_trace_is_rendered_and_auditable() -> None:
    source = (
        Path(__file__).parents[1]
        / "artifacts"
        / "hf-ransomware-real"
        / "llm-investigation.json"
    )
    envelope = PlannerEnvelope.model_validate_json(source.read_text(encoding="utf-8"))

    rendered = render_llm_execution_html(envelope)

    assert "REAL ENDPOINT RUN · NO MODEL FALLBACK" in rendered
    assert "google/gemma-4-31B-it-qat-w4a16-ct" in rendered
    assert rendered.count("model-selected call") == 6
    assert "19</strong><span>model-selected tool calls" in rendered
    assert "8</strong><span>unique cited evidence IDs" in rendered
    assert "assess_exfiltration" in rendered
    assert "not_observed" in rendered
    assert "EV-CC92D10D158E" in rendered
    assert "USED BY GEMMA" not in rendered
    assert rendered.count("class='tool-card'") == 3
    assert "10 additional read-only tools" in rendered
    assert "Question answered" not in rendered
    assert "up to 8 literal terms" in rendered
    assert "No regex or semantic search." in rendered
    assert "maximum 11 lines" in rendered
    assert "external success → confirmed" in rendered
    assert "--paper: #fbfaf7" in rendered
    assert "--accent: #ff2b3a" in rendered
    assert 'href="terminal-replay.html"' in rendered
    assert rendered.count("HUMAN APPROVAL") == 6
    assert "0</strong><span>shell or write-capable calls" in rendered
