from __future__ import annotations

from fastapi.testclient import TestClient

from gemma_ir.api import create_app
from gemma_ir.models import IncidentGraph


def test_dashboard_and_read_only_api(incident_graph: IncidentGraph) -> None:
    client = TestClient(create_app(incident_graph))
    assert client.get("/health").json()["integrity"]["status"] == "verified"
    assert client.get("/").status_code == 200
    assert "Attack graph" in client.get("/").text
    assert client.get("/graph.svg").headers["content-type"].startswith("image/svg+xml")
    graph = client.get("/api/graph").json()
    assert len(graph["nodes"]) == len(incident_graph.nodes)

    blocked = client.post("/api/tools/delete_evidence", json={})
    assert blocked.status_code == 400
    assert blocked.json()["detail"]["blocked"] is True
