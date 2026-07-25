from __future__ import annotations

from pathlib import Path

import pytest

from gemma_ir.bundle import EvidenceBundle
from gemma_ir.deterministic import (
    DeterministicAnalyzer,
    build_deterministic_report,
    timestamp_from_line,
)
from gemma_ir.models import IncidentGraph
from gemma_ir.tools import ForensicToolRegistry

FIXTURE = Path("eval/fixtures/hospital-webshell")
EXPECTED_TECHNIQUES = {
    "T1005",
    "T1048.003",
    "T1053.003",
    "T1190",
    "T1505.003",
    "T1548.003",
    "T1552.001",
}
EXPECTED_IOCS = {
    "203.0.113.77",
    "192.0.2.44:9443",
    "/var/www/pacs/uploads/.cache.php",
    "/etc/sudoers.d/pacs-maintenance",
    "/etc/cron.d/pacs-index",
    "/usr/local/bin/pacs-index-update",
    "/var/tmp/.pacs-export/pacs-study-index.tar.gz",
}


@pytest.fixture(scope="module")
def webshell_bundle() -> EvidenceBundle:
    return EvidenceBundle.load(FIXTURE)


@pytest.fixture(scope="module")
def webshell_graph(webshell_bundle: EvidenceBundle) -> IncidentGraph:
    return DeterministicAnalyzer().analyze(webshell_bundle)


def test_webshell_chain_is_reconstructed(webshell_graph: IncidentGraph) -> None:
    report = build_deterministic_report(webshell_graph)

    assert webshell_graph.integrity["status"] == "verified"
    assert {item["technique_id"] for item in report.techniques} == EXPECTED_TECHNIQUES
    assert EXPECTED_IOCS <= {item["value"] for item in report.iocs}

    event_types = [
        item["event_type"]
        for item in report.timeline
        if item["event_type"]
        not in {
            "prompt_injection",
            "service_file_collected",
            "suspicious_file_collected",
        }
    ]
    assert event_types == [
        "public_app_exploit",
        "web_shell",
        "sudo_abuse",
        "scheduled_task",
        "credential_access",
        "data_staged",
        "exfiltration_attempt",
    ]


def test_external_telemetry_confirms_exfiltration(
    webshell_graph: IncidentGraph,
    webshell_bundle: EvidenceBundle,
) -> None:
    registry = ForensicToolRegistry(webshell_graph, webshell_bundle)

    exfiltration = registry.call(
        "assess_exfiltration",
        {"destination": "192.0.2.44"},
    )
    scope = registry.call("assess_incident_scope", {})

    assert exfiltration["result"]["status"] == "confirmed"
    assert exfiltration["result"]["confidence"] == 0.95
    assert exfiltration["result"]["external_telemetry_sources"] == [
        "proxy/egress.log"
    ]
    assert exfiltration["result"]["limitations"] == []
    assert scope["result"]["scope_status"] == "multi_source"


def test_web_prompt_injection_and_remediation_policy(
    webshell_graph: IncidentGraph,
) -> None:
    report = build_deterministic_report(webshell_graph)

    assert report.policy_alerts
    assert report.policy_alerts[0]["decision"] == "blocked_as_untrusted_evidence"
    assert all(
        not action.modifies_system or action.requires_human_approval
        for action in report.remediation
    )


def test_nginx_common_log_timestamp_is_normalized() -> None:
    line = (
        '203.0.113.77 - - [25/Jul/2026:13:44:39 +0000] '
        '"POST /upload.php HTTP/1.1" 201 37'
    )

    assert timestamp_from_line(line) == "2026-07-25T13:44:39+00:00"
