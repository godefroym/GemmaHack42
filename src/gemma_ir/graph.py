from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict, deque
from pathlib import Path
from typing import Any

from gemma_ir.models import EvidenceRef, GraphEdge, GraphNode, IncidentGraph


def stable_id(prefix: str, *parts: object) -> str:
    material = "\x1f".join(str(part) for part in parts)
    digest = hashlib.sha256(material.encode()).hexdigest()[:14]
    return f"{prefix.lower()}:{digest}"


class GraphBuilder:
    def __init__(self, case_id: str) -> None:
        self.case_id = case_id
        self.nodes: dict[str, GraphNode] = {}
        self.edges: dict[str, GraphEdge] = {}
        self.evidence: dict[str, EvidenceRef] = {}

    def add_evidence(self, evidence: EvidenceRef) -> None:
        self.evidence[evidence.id] = evidence

    def add_node(
        self,
        node_type: str,
        label: str,
        *,
        properties: dict[str, Any] | None = None,
        evidence_ids: list[str] | None = None,
        node_id: str | None = None,
    ) -> GraphNode:
        resolved_id = node_id or stable_id(node_type, label.casefold())
        existing = self.nodes.get(resolved_id)
        if existing is not None:
            existing.properties.update(properties or {})
            existing.evidence_ids = sorted(set(existing.evidence_ids + (evidence_ids or [])))
            return existing
        node = GraphNode(
            id=resolved_id,
            type=node_type,
            label=label,
            properties=properties or {},
            evidence_ids=sorted(set(evidence_ids or [])),
        )
        self.nodes[node.id] = node
        return node

    def add_edge(
        self,
        source: GraphNode | str,
        target: GraphNode | str,
        edge_type: str,
        *,
        status: str = "observed",
        confidence: float = 1.0,
        evidence_ids: list[str] | None = None,
        properties: dict[str, Any] | None = None,
    ) -> GraphEdge:
        source_id = source.id if isinstance(source, GraphNode) else source
        target_id = target.id if isinstance(target, GraphNode) else target
        edge_id = stable_id(
            "edge",
            source_id,
            target_id,
            edge_type,
            ",".join(sorted(evidence_ids or [])),
        )
        existing = self.edges.get(edge_id)
        if existing is not None:
            existing.evidence_ids = sorted(set(existing.evidence_ids + (evidence_ids or [])))
            return existing
        edge = GraphEdge(
            id=edge_id,
            source=source_id,
            target=target_id,
            type=edge_type,
            status=status,
            confidence=confidence,
            evidence_ids=sorted(set(evidence_ids or [])),
            properties=properties or {},
        )
        self.edges[edge.id] = edge
        return edge

    def build(
        self,
        *,
        integrity: dict[str, Any],
        warnings: list[str] | None = None,
    ) -> IncidentGraph:
        return IncidentGraph(
            case_id=self.case_id,
            nodes=sorted(self.nodes.values(), key=lambda item: (item.type, item.id)),
            edges=sorted(self.edges.values(), key=lambda item: item.id),
            evidence=self.evidence,
            integrity=integrity,
            warnings=warnings or [],
        )


class GraphIndex:
    """In-memory read model used even when Neo4j is unavailable."""

    def __init__(self, graph: IncidentGraph) -> None:
        self.graph = graph
        self.nodes = {node.id: node for node in graph.nodes}
        self.outgoing: dict[str, list[GraphEdge]] = defaultdict(list)
        self.incoming: dict[str, list[GraphEdge]] = defaultdict(list)
        for edge in graph.edges:
            self.outgoing[edge.source].append(edge)
            self.incoming[edge.target].append(edge)

    def find_nodes(
        self,
        *,
        query: str = "",
        node_types: list[str] | None = None,
        limit: int = 50,
    ) -> list[GraphNode]:
        lowered = query.casefold().strip()
        allowed = {item.casefold() for item in node_types or []}
        found = []
        for node in self.graph.nodes:
            if allowed and node.type.casefold() not in allowed:
                continue
            searchable = json.dumps([node.label, node.properties], ensure_ascii=False).casefold()
            if lowered and lowered not in searchable:
                continue
            found.append(node)
        return found[:limit]

    def neighbors(self, node_id: str) -> list[tuple[GraphEdge, GraphNode]]:
        values = []
        for edge in self.outgoing.get(node_id, []):
            target = self.nodes.get(edge.target)
            if target is not None:
                values.append((edge, target))
        for edge in self.incoming.get(node_id, []):
            source = self.nodes.get(edge.source)
            if source is not None:
                values.append((edge, source))
        return values

    def trace_paths(
        self,
        *,
        start_id: str | None = None,
        max_depth: int = 8,
        limit: int = 8,
    ) -> list[dict[str, Any]]:
        starts = (
            [start_id]
            if start_id
            else [
                node.id
                for node in self.graph.nodes
                if node.type == "Endpoint" and node.properties.get("role") == "source"
            ]
        )
        paths: list[dict[str, Any]] = []
        for start in starts:
            if start not in self.nodes:
                continue
            queue: deque[tuple[str, list[str], list[str]]] = deque([(start, [start], [])])
            while queue and len(paths) < limit:
                current, node_path, edge_path = queue.popleft()
                if len(edge_path) >= max_depth:
                    continue
                for edge in self.outgoing.get(current, []):
                    if edge.type in {"MAPS_TO", "OBSERVED_ON", "HAS_FINDING"}:
                        continue
                    if edge.target in node_path:
                        continue
                    next_nodes = node_path + [edge.target]
                    next_edges = edge_path + [edge.id]
                    target = self.nodes[edge.target]
                    if target.type in {"File", "Endpoint", "Service"}:
                        paths.append(
                            {
                                "nodes": [
                                    {
                                        "id": self.nodes[node_id].id,
                                        "type": self.nodes[node_id].type,
                                        "label": self.nodes[node_id].label,
                                    }
                                    for node_id in next_nodes
                                ],
                                "edges": [
                                    {
                                        "type": edge_value.type,
                                        "status": edge_value.status,
                                        "evidence_ids": edge_value.evidence_ids,
                                    }
                                    for edge_id in next_edges
                                    if (
                                        edge_value := next(
                                            item for item in self.graph.edges if item.id == edge_id
                                        )
                                    )
                                ],
                            }
                        )
                    queue.append((edge.target, next_nodes, next_edges))
        return paths[:limit]


def safe_filename(value: str) -> str:
    rendered = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-")
    return rendered or "incident"


def write_graph_json(graph: IncidentGraph, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(graph.model_dump_json(indent=2) + "\n", encoding="utf-8")
