from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

NodeType = Literal[
    "Host",
    "Event",
    "Account",
    "Group",
    "Process",
    "Service",
    "File",
    "Endpoint",
    "Technique",
    "Finding",
]


class EvidenceRef(BaseModel):
    id: str
    source_path: str
    line_number: int
    sha256: str
    excerpt: str


class GraphNode(BaseModel):
    id: str
    type: NodeType
    label: str
    properties: dict[str, Any] = Field(default_factory=dict)
    evidence_ids: list[str] = Field(default_factory=list)


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    status: Literal["observed", "derived", "hypothesis"] = "observed"
    confidence: float = Field(ge=0, le=1)
    evidence_ids: list[str] = Field(default_factory=list)
    properties: dict[str, Any] = Field(default_factory=dict)


class IncidentGraph(BaseModel):
    schema_version: int = 1
    case_id: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    evidence: dict[str, EvidenceRef]
    integrity: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)

    def node(self, node_id: str) -> GraphNode | None:
        return next((node for node in self.nodes if node.id == node_id), None)

    def nodes_of_type(self, node_type: str) -> list[GraphNode]:
        return [node for node in self.nodes if node.type == node_type]


class RemediationAction(BaseModel):
    phase: Literal[
        "containment",
        "evidence_preservation",
        "eradication",
        "recovery",
        "validation",
    ]
    action: str
    rationale: str
    modifies_system: bool
    requires_human_approval: bool
    evidence_ids: list[str] = Field(default_factory=list)


class DeterministicReport(BaseModel):
    schema_version: int = 1
    case_id: str
    confidence: float
    timeline: list[dict[str, Any]]
    attack_path: list[dict[str, Any]]
    techniques: list[dict[str, Any]]
    iocs: list[dict[str, Any]]
    policy_alerts: list[dict[str, Any]]
    unknowns: list[str]
    remediation: list[RemediationAction]
    warnings: list[str] = Field(default_factory=list)


class PlannerEnvelope(BaseModel):
    schema_version: int = 1
    case_id: str
    mode: Literal["llm"]
    model: str | None = None
    deterministic_report: DeterministicReport
    llm_analysis: dict[str, Any]
    tool_trace: list[dict[str, Any]] = Field(default_factory=list)
    policy_enforcements: list[str] = Field(default_factory=list)
