from __future__ import annotations

import json
import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response

from gemma_ir.bundle import EvidenceBundle
from gemma_ir.deterministic import build_deterministic_report
from gemma_ir.models import IncidentGraph
from gemma_ir.planner import InvestigationError, IRPlanner
from gemma_ir.render import render_attack_graph_svg, render_dashboard_html
from gemma_ir.tools import ForensicToolRegistry


def create_app(graph: IncidentGraph, bundle: EvidenceBundle) -> FastAPI:
    app = FastAPI(title="Gemma IR", version="0.1.0")
    tools = ForensicToolRegistry(graph, bundle)
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
        base_url = os.getenv("MODEL_API_BASE")
        model = os.getenv("MODEL_NAME")
        if not base_url or not model:
            raise HTTPException(
                status_code=503,
                detail="MODEL_API_BASE and MODEL_NAME must configure one LLM endpoint",
            )
        api_key = os.getenv("MODEL_API_KEY", "EMPTY")
        try:
            extra_body = json.loads(os.getenv("MODEL_EXTRA_BODY", "{}"))
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"MODEL_EXTRA_BODY is invalid JSON: {exc}",
            ) from exc
        planner = IRPlanner(
            graph,
            bundle,
            base_url=base_url,
            model=model,
            api_key=api_key,
            extra_body=extra_body,
        )
        try:
            return planner.analyze().model_dump()
        except InvestigationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    return app
