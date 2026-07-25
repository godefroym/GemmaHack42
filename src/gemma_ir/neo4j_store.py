from __future__ import annotations

import re
from typing import Any

from neo4j import GraphDatabase

from gemma_ir.models import IncidentGraph

SAFE_CYPHER_TOKEN = re.compile(r"^[A-Z][A-Z0-9_]*$")


class Neo4jGraphStore:
    def __init__(
        self,
        *,
        uri: str,
        user: str,
        password: str,
        database: str = "neo4j",
    ) -> None:
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        self.database = database

    def close(self) -> None:
        self.driver.close()

    def ping(self) -> None:
        self.driver.verify_connectivity()

    def sync(self, graph: IncidentGraph) -> dict[str, int]:
        self.ping()
        with self.driver.session(database=self.database) as session:
            session.run(
                "CREATE CONSTRAINT ir_node_id IF NOT EXISTS "
                "FOR (node:IRNode) REQUIRE node.id IS UNIQUE"
            ).consume()
            session.run(
                "MATCH (node:IRNode {case_id: $case_id}) DETACH DELETE node",
                case_id=graph.case_id,
            ).consume()
            for node in graph.nodes:
                label = node.type.upper()
                if not SAFE_CYPHER_TOKEN.fullmatch(label):
                    raise ValueError(f"Unsafe Neo4j label: {label}")
                properties: dict[str, Any] = {
                    "id": node.id,
                    "case_id": graph.case_id,
                    "node_type": node.type,
                    "label": node.label,
                    "evidence_ids": node.evidence_ids,
                    **{
                        key: value
                        for key, value in node.properties.items()
                        if isinstance(value, (str, int, float, bool, list)) or value is None
                    },
                }
                session.run(
                    f"MERGE (node:IRNode:{label} {{id: $id}}) SET node += $properties",
                    id=node.id,
                    properties=properties,
                ).consume()
            for edge in graph.edges:
                edge_type = edge.type.upper()
                if not SAFE_CYPHER_TOKEN.fullmatch(edge_type):
                    raise ValueError(f"Unsafe Neo4j relationship: {edge_type}")
                properties = {
                    "id": edge.id,
                    "case_id": graph.case_id,
                    "status": edge.status,
                    "confidence": edge.confidence,
                    "evidence_ids": edge.evidence_ids,
                    **{
                        key: value
                        for key, value in edge.properties.items()
                        if isinstance(value, (str, int, float, bool, list)) or value is None
                    },
                }
                session.run(
                    "MATCH (source:IRNode {id: $source_id}) "
                    "MATCH (target:IRNode {id: $target_id}) "
                    f"MERGE (source)-[rel:{edge_type} {{id: $edge_id}}]->(target) "
                    "SET rel += $properties",
                    source_id=edge.source,
                    target_id=edge.target,
                    edge_id=edge.id,
                    properties=properties,
                ).consume()
        return {"nodes": len(graph.nodes), "edges": len(graph.edges)}
