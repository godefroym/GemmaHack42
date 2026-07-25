from __future__ import annotations

from gemma_ir.models import IncidentGraph
from gemma_ir.tools import ForensicToolRegistry


def test_tool_surface_is_read_only(incident_graph: IncidentGraph) -> None:
    registry = ForensicToolRegistry(incident_graph)
    assert "delete_evidence" not in registry.names
    blocked = registry.call("delete_evidence", {})
    assert blocked["blocked"] is True
    assert blocked["ok"] is False


def test_attack_path_and_evidence_are_queryable(
    incident_graph: IncidentGraph,
) -> None:
    registry = ForensicToolRegistry(incident_graph)
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


def test_policy_blocks_log_deletion(incident_graph: IncidentGraph) -> None:
    registry = ForensicToolRegistry(incident_graph)
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
