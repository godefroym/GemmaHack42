from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response

from gemma_ir.deterministic import build_deterministic_report
from gemma_ir.models import IncidentGraph
from gemma_ir.planner import IRPlanner
from gemma_ir.render import render_attack_graph_svg, render_dashboard_html
from gemma_ir.tools import ForensicToolRegistry


def create_app(graph: IncidentGraph) -> FastAPI:
    app = FastAPI(title="Gemma IR", version="0.1.0")
    tools = ForensicToolRegistry(graph)
    dashboard = render_dashboard_html(graph, render_attack_graph_svg(graph))

    @app.get("/", response_class=HTMLResponse)
    def index() -> str:
        return dashboard

    @app.get("/graph.svg")
    def graph_svg() -> Response:
        return Response(
            content=render_attack_graph_svg(graph),
            media_type="image/svg+xml",
        )

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "case_id": graph.case_id,
            "integrity": graph.integrity,
        }

    @app.get("/api/graph")
    def get_graph() -> dict[str, Any]:
        return graph.model_dump()

    @app.get("/api/report")
    def get_report() -> dict[str, Any]:
        return build_deterministic_report(graph).model_dump()

    @app.get("/api/tools")
    def get_tools() -> list[dict[str, Any]]:
        return tools.schemas

    @app.post("/api/tools/{tool_name}")
    def call_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        result = tools.call(tool_name, arguments)
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result)
        return result

    @app.post("/api/plan")
    def create_plan() -> dict[str, Any]:
        base_url = os.getenv("MODEL_API_BASE", "http://127.0.0.1:11434/v1")
        model = os.getenv("MODEL_NAME", "gemma4:e4b")
        api_key = os.getenv("MODEL_API_KEY", "local")
        extra_body = {"think": False, "options": {"num_ctx": 8192}} if "11434" in base_url else {}
        planner = IRPlanner(
            graph,
            base_url=base_url,
            model=model,
            api_key=api_key,
            extra_body=extra_body,
        )
        return planner.analyze().model_dump()

    return app
