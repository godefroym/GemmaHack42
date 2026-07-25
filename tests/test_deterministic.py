from __future__ import annotations

from gemma_ir.deterministic import build_deterministic_report
from gemma_ir.models import IncidentGraph


def test_expected_attack_is_reconstructed(incident_graph: IncidentGraph) -> None:
    report = build_deterministic_report(incident_graph)
    assert incident_graph.integrity["status"] == "verified"
    assert len(report.attack_path) == 8
    assert {item["technique_id"] for item in report.techniques} == {
        "T1136.001",
        "T1098.004",
        "T1543.002",
        "T1552.001",
        "T1005",
        "T1048.003",
    }
    assert any(item["value"] == "203.0.113.10:8443" for item in report.iocs)
    assert report.policy_alerts[0]["decision"] == "blocked_as_untrusted_evidence"
    assert all(
        not action.modifies_system or action.requires_human_approval
        for action in report.remediation
    )


def test_every_event_has_hashed_provenance(incident_graph: IncidentGraph) -> None:
    for event in incident_graph.nodes_of_type("Event"):
        assert event.evidence_ids
        for evidence_id in event.evidence_ids:
            evidence = incident_graph.evidence[evidence_id]
            assert len(evidence.sha256) == 64
            assert evidence.source_path
