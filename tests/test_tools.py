from __future__ import annotations

from gemma_ir.bundle import EvidenceBundle
from gemma_ir.models import IncidentGraph
from gemma_ir.tools import ForensicToolRegistry


def test_tool_surface_is_read_only(
    incident_graph: IncidentGraph,
    evidence_bundle: EvidenceBundle,
) -> None:
    registry = ForensicToolRegistry(incident_graph, evidence_bundle)
    assert "delete_evidence" not in registry.names
    blocked = registry.call("delete_evidence", {})
    assert blocked["blocked"] is True
    assert blocked["ok"] is False


def test_attack_path_and_evidence_are_queryable(
    incident_graph: IncidentGraph,
    evidence_bundle: EvidenceBundle,
) -> None:
    registry = ForensicToolRegistry(incident_graph, evidence_bundle)
    traced = registry.call(
        "trace_attack_path",
        {"start_entity": "203.0.113.77", "max_depth": 8},
    )
    assert traced["ok"] is True
    chain = traced["result"]["sourced_event_chain"]
    assert len(chain) == 8
    evidence_id = chain[0]["evidence_ids"][0]
    evidence = registry.call("get_evidence", {"evidence_id": evidence_id})
    assert evidence["result"]["found"] is True
    assert len(evidence["result"]["evidence"]["sha256"]) == 64


def test_policy_blocks_log_deletion(
    incident_graph: IncidentGraph,
    evidence_bundle: EvidenceBundle,
) -> None:
    registry = ForensicToolRegistry(incident_graph, evidence_bundle)
    result = registry.call(
        "check_action_policy",
        {
            "action": "delete_evidence immediately",
            "target": "all logs",
            "modifies_system": True,
        },
    )
    assert result["result"]["decision"] == "blocked"
    assert result["result"]["executed"] is False


def test_policy_alerts_are_explicitly_inspectable(
    incident_graph: IncidentGraph,
    evidence_bundle: EvidenceBundle,
) -> None:
    registry = ForensicToolRegistry(incident_graph, evidence_bundle)
    result = registry.call("inspect_policy_alerts", {})

    assert result["ok"] is True
    assert result["result"]["count"] == 1
    assert result["result"]["alerts"][0]["evidence_ids"]


def test_raw_evidence_can_be_searched_and_read_in_context(
    incident_graph: IncidentGraph,
    evidence_bundle: EvidenceBundle,
) -> None:
    registry = ForensicToolRegistry(incident_graph, evidence_bundle)
    overview = registry.call("get_case_overview", {})
    assert overview["result"]["searchable_evidence_lines"] > 0

    search = registry.call(
        "search_raw_evidence",
        {
            "terms": ["delete_evidence"],
            "source_prefix": "commands/",
            "limit": 5,
        },
    )
    assert search["ok"] is True
    assert search["result"]["count"] == 1
    evidence_id = search["result"]["matches"][0]["evidence_id"]

    context = registry.call(
        "get_evidence_context",
        {"evidence_id": evidence_id, "before": 1, "after": 1},
    )
    assert context["result"]["found"] is True
    assert len(context["result"]["context"]) == 3


def test_scope_and_exfiltration_are_bounded_by_collected_sources(
    incident_graph: IncidentGraph,
    evidence_bundle: EvidenceBundle,
) -> None:
    registry = ForensicToolRegistry(incident_graph, evidence_bundle)
    exfiltration = registry.call("assess_exfiltration", {})
    scope = registry.call("assess_incident_scope", {})

    assert exfiltration["result"]["status"] == "attempted_and_blocked"
    assert exfiltration["result"]["limitations"]
    assert scope["result"]["scope_status"] == "host_only"
    assert scope["result"]["limitations"]
