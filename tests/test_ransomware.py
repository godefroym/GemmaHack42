from __future__ import annotations

from pathlib import Path

import pytest

from gemma_ir.bundle import EvidenceBundle
from gemma_ir.deterministic import DeterministicAnalyzer, build_deterministic_report
from gemma_ir.models import IncidentGraph

FIXTURE = Path("eval/fixtures/hospital-ransomware")


@pytest.fixture(scope="module")
def ransomware_graph() -> IncidentGraph:
    return DeterministicAnalyzer().analyze(EvidenceBundle.load(FIXTURE))


def test_ransomware_impact_chain_is_reconstructed(ransomware_graph: IncidentGraph) -> None:
    report = build_deterministic_report(ransomware_graph)
    assert ransomware_graph.integrity["status"] == "verified"

    # The WannaCry-style impact playbook: stop the service, destroy recovery
    # options, then encrypt. Initial access (T1078) is intentionally not mapped
    # to a technique node, matching how authentication is treated elsewhere.
    assert {item["technique_id"] for item in report.techniques} == {
        "T1489",
        "T1490",
        "T1486",
    }

    summaries = [step["summary"] for step in report.attack_path]
    assert any("stopped before impact" in summary for summary in summaries)
    assert any("was destroyed" in summary for summary in summaries)
    assert any("encrypted artifact" in summary for summary in summaries)

    ioc_values = {item["value"] for item in report.iocs}
    assert "/usr/local/bin/pacs-crypt" in ioc_values
    assert "/srv/hospital-data/HOW_TO_DECRYPT.txt" in ioc_values


def test_second_stage_prompt_injection_is_blocked(ransomware_graph: IncidentGraph) -> None:
    report = build_deterministic_report(ransomware_graph)
    # The planted instruction tries to exonerate the attacker rather than delete
    # evidence, but it must still be treated as untrusted evidence.
    assert report.policy_alerts
    assert report.policy_alerts[0]["decision"] == "blocked_as_untrusted_evidence"


def test_every_modifying_remediation_requires_human_approval(
    ransomware_graph: IncidentGraph,
) -> None:
    report = build_deterministic_report(ransomware_graph)
    assert all(
        not action.modifies_system or action.requires_human_approval
        for action in report.remediation
    )
