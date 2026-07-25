from __future__ import annotations

import asyncio
import json
import os
import queue
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response, StreamingResponse

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
        # call_json catches argument-validation errors and returns them in the
        # standard {ok: false} shape; call() lets pydantic raise a 500 instead.
        result = tools.call_json(tool_name, json.dumps(arguments))
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result)
        return result

    def planner_settings(simulate_failure: bool = False) -> dict[str, Any]:
        base_url = os.getenv("MODEL_API_BASE", "http://127.0.0.1:11434/v1")
        if simulate_failure:
            # An endpoint that refuses instantly, so the fallback path can be
            # demonstrated in seconds instead of waiting out the 75 s deadline.
            base_url = "http://127.0.0.1:9/v1"
        return {
            "base_url": base_url,
            "model": os.getenv("MODEL_NAME", "gemma4:e4b"),
            "api_key": os.getenv("MODEL_API_KEY", "local"),
            "extra_body": (
                {"think": False, "options": {"num_ctx": 8192}} if "11434" in base_url else {}
            ),
        }

    @app.post("/api/plan")
    def create_plan() -> dict[str, Any]:
        planner = IRPlanner(graph, **planner_settings())
        return planner.analyze().model_dump()

    @app.get("/api/meta")
    def get_meta() -> dict[str, Any]:
        settings = planner_settings()
        host = settings["base_url"].split("//", 1)[-1].split(":", 1)[0]
        report = build_deterministic_report(graph)
        return {
            "case_id": graph.case_id,
            "model": settings["model"],
            "base_url": settings["base_url"],
            "backend": "ollama" if "11434" in settings["base_url"] else "openai_compatible",
            "offline": host in {"127.0.0.1", "localhost", "::1"},
            "integrity": graph.integrity,
            "warnings": graph.warnings,
            "counts": {
                "nodes": len(graph.nodes),
                "edges": len(graph.edges),
                "evidence": len(graph.evidence),
                "attack_steps": len(report.attack_path),
                "techniques": len(report.techniques),
                "iocs": len(report.iocs),
                "policy_alerts": len(report.policy_alerts),
            },
        }

    # ---- streamed planner runs -------------------------------------------------
    # A synchronous /api/plan blocks for up to 75 s on the local model before
    # falling back, which reads as a hung page. A run exposes the same work as a
    # live event stream so the interface can show progress while it happens.

    runs: dict[str, dict[str, Any]] = {}

    @app.post("/api/plan/runs", status_code=202)
    async def start_run(body: dict[str, Any] | None = None) -> dict[str, Any]:
        simulate_failure = bool((body or {}).get("simulate_failure"))
        settings = planner_settings(simulate_failure)
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        events: queue.Queue[dict[str, Any] | None] = queue.Queue()
        runs[run_id] = {"events": events, "result": None, "status": "running"}

        def execute() -> None:
            try:
                planner = IRPlanner(graph, **settings, on_event=events.put)
                envelope = planner.analyze().model_dump()
                runs[run_id]["result"] = envelope
                runs[run_id]["status"] = "done"
                events.put({"type": "done", "envelope": envelope})
            except Exception as error:  # noqa: BLE001 - surfaced to the client
                runs[run_id]["status"] = "error"
                events.put({"type": "error", "message": str(error)})
            finally:
                events.put(None)

        asyncio.get_running_loop().run_in_executor(None, execute)
        return {"run_id": run_id, "status": "running", "model": settings["model"]}

    @app.get("/api/plan/runs/{run_id}")
    def get_run(run_id: str) -> dict[str, Any]:
        run = runs.get(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail={"error": "unknown run"})
        if run["result"] is None:
            return {"status": run["status"]}
        return run["result"]

    @app.get("/api/plan/runs/{run_id}/events")
    async def stream_run(run_id: str) -> StreamingResponse:
        run = runs.get(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail={"error": "unknown run"})
        events: queue.Queue[dict[str, Any] | None] = run["events"]

        async def frames() -> AsyncIterator[str]:
            loop = asyncio.get_running_loop()
            while True:
                try:
                    event = await loop.run_in_executor(None, events.get, True, 10)
                except queue.Empty:
                    yield ": ping\n\n"  # keep EventSource alive during the model wait
                    continue
                if event is None:
                    return
                yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"

        return StreamingResponse(
            frames(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return app
