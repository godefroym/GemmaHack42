from __future__ import annotations

from gemma_ir.bundle import EvidenceBundle
from gemma_ir.deterministic import build_deterministic_report
from gemma_ir.models import IncidentGraph, PlannerEnvelope
from gemma_ir.terminal_replay import (
    build_replay_steps,
    build_stage_replay,
    render_terminal_replay_html,
)
from gemma_ir.tools import ForensicToolRegistry


def test_terminal_replay_runs_recorded_tools_against_read_only_evidence(
    incident_graph: IncidentGraph,
    evidence_bundle: EvidenceBundle,
) -> None:
    envelope = PlannerEnvelope(
        case_id=incident_graph.case_id,
        mode="llm",
        model="google/gemma-test",
        deterministic_report=build_deterministic_report(incident_graph),
        llm_analysis={"confidence": 0.9},
        tool_trace=[
            {
                "round": 1,
                "name": "get_case_overview",
                "arguments": {},
                "ok": True,
                "blocked": False,
            },
            {
                "round": 3,
                "name": "search_raw_evidence",
                "arguments": {"terms": ["backup-admin"], "limit": 2},
                "ok": True,
                "blocked": False,
            },
            {
                "round": 6,
                "name": "assess_exfiltration",
                "arguments": {},
                "ok": True,
                "blocked": False,
            },
        ],
    )
    registry = ForensicToolRegistry(incident_graph, evidence_bundle)

    steps = build_replay_steps(envelope, registry)
    stages = build_stage_replay(envelope, registry)
    rendered = render_terminal_replay_html(envelope, registry)

    assert [step["stage"] for step in steps] == ["ORIENT", "SEARCH", "DECIDE"]
    assert [stage["stage"] for stage in stages] == ["ORIENT", "SEARCH", "DECIDE"]
    assert steps[0]["result"]["integrity"] == "verified"
    assert steps[1]["result"]["matches"] == 2
    assert steps[2]["result"]["status"] == "attempted_and_blocked"
    assert "Incident replay" in rendered
    assert "Victim route: NONE" in rendered
    assert "evidence mounted read-only" in rendered
    assert 'id="play"' in rendered
    assert "Start replay" in rendered
    assert "shell-equivalent views" in rendered
    assert "sha256sum -c evidence/SHA256SUMS" in rendered
    assert "rg -i -F" in rendered
    assert "setTimeout" in rendered
    assert "ssh analyst@pandar-ir" in rendered
