from __future__ import annotations

import copy
import json
from types import SimpleNamespace
from typing import Any

import pytest

from gemma_ir.bundle import EvidenceBundle
from gemma_ir.models import IncidentGraph
from gemma_ir.planner import InvestigationError, IRPlanner


class FailingCompletions:
    @staticmethod
    def create(**_: Any) -> None:
        raise ConnectionError("offline by design")


class FakeCompletions:
    def __init__(self, responses: list[Any]) -> None:
        self.responses = responses
        self.requests: list[dict[str, Any]] = []

    def create(self, **request: Any) -> Any:
        self.requests.append(copy.deepcopy(request))
        return self.responses.pop(0)


def tool_call(identifier: str, name: str, arguments: dict[str, Any]) -> Any:
    return SimpleNamespace(
        id=identifier,
        function=SimpleNamespace(
            name=name,
            arguments=json.dumps(arguments),
        ),
    )


def completion(*, content: str = "", tool_calls: list[Any] | None = None) -> Any:
    message = SimpleNamespace(content=content, tool_calls=tool_calls or [])
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def test_endpoint_failure_is_explicit_and_has_no_fake_fallback(
    incident_graph: IncidentGraph,
    evidence_bundle: EvidenceBundle,
) -> None:
    planner = IRPlanner(
        incident_graph,
        evidence_bundle,
        base_url="http://127.0.0.1:9/v1",
        model="missing",
        api_key="EMPTY",
    )
    planner.client = SimpleNamespace(
        chat=SimpleNamespace(completions=FailingCompletions())
    )

    with pytest.raises(InvestigationError, match="offline by design"):
        planner.analyze()


def test_model_drives_the_complete_tool_workflow(
    incident_graph: IncidentGraph,
    evidence_bundle: EvidenceBundle,
) -> None:
    planner = IRPlanner(
        incident_graph,
        evidence_bundle,
        base_url="https://example.invalid/v1",
        model="gemma",
        api_key="test",
    )
    evidence_ids = sorted(incident_graph.evidence)[:4]
    cited = " ".join(evidence_ids)
    report = {
        "executive_summary": f"Compromise confirmed from {cited}.",
        "incident_classification": "privileged Linux persistence",
        "observed_attack_path": [f"Account to exfiltration path {cited}"],
        "root_cause": f"Unauthorized SSH access {evidence_ids[0]}",
        "scope": {
            "status": "host_only",
            "evidence_ids": evidence_ids,
        },
        "exfiltration_assessment": {
            "status": "attempted_and_blocked",
            "evidence_ids": evidence_ids,
        },
        "techniques": ["T1136.001", "T1098.004", "T1543.002"],
        "findings": [f"Prompt injection in untrusted evidence {evidence_ids[1]}"],
        "hypotheses": ["SSH key origin remains unknown"],
        "unknowns": ["Other hosts were not collected"],
        "remediation_plan": [
            {
                "action": "Disable the unauthorized account after preservation",
                "modifies_system": True,
                "requires_human_approval": False,
                "evidence_ids": evidence_ids,
            }
        ],
        "validation_plan": [f"Search for recurrence of IOCs {evidence_ids[2]}"],
        "confidence": 0.9,
    }
    overview_round = completion(
        tool_calls=[
            tool_call("tc-1", "get_case_overview", {}),
        ]
    )
    raw_round = completion(
        tool_calls=[
            tool_call(
                "tc-2",
                "search_raw_evidence",
                {"terms": ["backup-admin"], "limit": 5},
            ),
        ]
    )
    attack_round = completion(
        tool_calls=[
            tool_call("tc-3", "trace_attack_path", {"max_depth": 6}),
            tool_call("tc-policy", "inspect_policy_alerts", {}),
        ]
    )
    decision_round = completion(
        tool_calls=[
            tool_call("tc-4", "assess_incident_scope", {}),
            tool_call("tc-5", "assess_exfiltration", {}),
            tool_call(
                "tc-6",
                "get_remediation_constraints",
                {"include_examples": True},
            ),
        ]
    )
    completions = FakeCompletions(
        [
            overview_round,
            raw_round,
            attack_round,
            decision_round,
            completion(content=json.dumps(report)),
        ]
    )
    planner.client = SimpleNamespace(
        chat=SimpleNamespace(completions=completions)
    )

    result = planner.analyze()

    assert "tools" in completions.requests[0]
    assert not any(
        message["role"] == "tool"
        for message in completions.requests[0]["messages"]
    )
    assert {
        schema["function"]["name"]
        for schema in completions.requests[0]["tools"]
    } == {"get_case_overview", "list_artifacts"}
    assert "search_raw_evidence" in {
        schema["function"]["name"]
        for schema in completions.requests[1]["tools"]
    }
    assert "trace_attack_path" in {
        schema["function"]["name"]
        for schema in completions.requests[2]["tools"]
    }
    assert "assess_exfiltration" in {
        schema["function"]["name"]
        for schema in completions.requests[3]["tools"]
    }
    assert "tools" not in completions.requests[4]
    assert result.mode == "llm"
    assert result.model == "gemma"
    assert len(result.tool_trace) == 7
    assert all(item["ok"] is True for item in result.tool_trace)
    assert result.llm_analysis["scope"]["status"] == "host_only"
    assert (
        result.llm_analysis["remediation_plan"][0]["requires_human_approval"]
        is True
    )
    assert result.policy_enforcements


def test_policy_postprocessor_forces_approval() -> None:
    analysis: dict[str, Any] = {
        "remediation_plan": [
            {
                "action": "disable account",
                "modifies_system": True,
                "requires_human_approval": False,
            }
        ]
    }
    enforcements = IRPlanner._enforce_policy(analysis)
    assert analysis["remediation_plan"][0]["requires_human_approval"] is True
    assert enforcements
