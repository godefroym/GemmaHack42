from __future__ import annotations

from typing import Any

from gemma_ir.models import IncidentGraph
from gemma_ir.planner import IRPlanner


class FailingModels:
    @staticmethod
    def list() -> None:
        raise ConnectionError("offline by design")


class FailingCompletions:
    @staticmethod
    def create(**_kwargs: Any) -> None:
        raise ConnectionError("offline by design")


class FailingChat:
    completions = FailingCompletions()


class FailingClient:
    # models.list() is a non-fatal probe; the inference call is what must fail.
    models = FailingModels()
    chat = FailingChat()


def test_endpoint_failure_uses_deterministic_fallback(
    incident_graph: IncidentGraph,
) -> None:
    planner = IRPlanner(
        incident_graph,
        base_url="http://127.0.0.1:9/v1",
        model="missing",
        api_key="local",
    )
    planner.client = FailingClient()  # type: ignore[assignment]
    result = planner.analyze()
    assert result.mode == "deterministic_fallback"
    assert result.llm_analysis is None
    assert len(result.deterministic_report.attack_path) == 8
    assert len(result.tool_trace) == 5
    assert "offline by design" in str(result.fallback_reason)


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
