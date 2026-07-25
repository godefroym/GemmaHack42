from __future__ import annotations

from gemma_ir.bundle import EvidenceLine
from gemma_ir.deterministic import (
    DeterministicAnalyzer,
    EntityObservation,
    Observation,
    build_deterministic_report,
    timestamp_from_line,
)
from gemma_ir.models import EvidenceRef, IncidentGraph


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


def test_audit_and_journal_duplicates_are_consolidated() -> None:
    journal_ref = EvidenceRef(
        id="EV-111111111111",
        source_path="commands/journal.txt",
        line_number=1,
        sha256="1" * 64,
        excerpt="journal evidence",
    )
    audit_ref = EvidenceRef(
        id="EV-222222222222",
        source_path="commands/audit_search.txt",
        line_number=2,
        sha256="2" * 64,
        excerpt="audit evidence",
    )
    summary = "Outbound transfer attempt to 203.0.113.10:8443 was blocked"
    entities = [
        EntityObservation(
            "Endpoint",
            "203.0.113.10:8443",
            "target",
            {"address": "203.0.113.10"},
        )
    ]
    observations = [
        Observation(
            "exfiltration_attempt",
            "2026-07-25T07:43:54.107+02:00",
            summary,
            EvidenceLine(journal_ref, journal_ref.excerpt),
            entities,
        ),
        Observation(
            "exfiltration_attempt",
            timestamp_from_line("type=SYSCALL msg=audit(1784958234.104:42)"),
            summary,
            EvidenceLine(audit_ref, audit_ref.excerpt),
            entities,
        ),
    ]

    consolidated = DeterministicAnalyzer._consolidate_observations(observations)

    assert len(consolidated) == 1
    assert {line.ref.id for line in consolidated[0].evidence_lines} == {
        journal_ref.id,
        audit_ref.id,
    }
