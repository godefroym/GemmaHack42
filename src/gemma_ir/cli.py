from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated, Any

import typer
import uvicorn
from rich.console import Console
from rich.table import Table

from gemma_ir.api import create_app
from gemma_ir.bundle import EvidenceBundle
from gemma_ir.deterministic import DeterministicAnalyzer, build_deterministic_report
from gemma_ir.graph import write_graph_json
from gemma_ir.neo4j_store import Neo4jGraphStore
from gemma_ir.planner import IRPlanner
from gemma_ir.render import write_visualizations
from gemma_ir.tools import ForensicToolRegistry

app = typer.Typer(no_args_is_help=True, help="Local-first Gemma incident response.")
console = Console()


def load_graph(evidence_path: Path) -> Any:
    bundle = EvidenceBundle.load(evidence_path)
    return DeterministicAnalyzer().analyze(bundle)


def write_analysis(graph: Any, output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    graph_path = output_dir / "incident-graph.json"
    report_path = output_dir / "deterministic-report.json"
    write_graph_json(graph, graph_path)
    report_path.write_text(
        build_deterministic_report(graph).model_dump_json(indent=2) + "\n",
        encoding="utf-8",
    )
    rendered = write_visualizations(graph, output_dir)
    return {"graph": graph_path, "report": report_path, **rendered}


def print_summary(graph: Any, outputs: dict[str, Path]) -> None:
    report = build_deterministic_report(graph)
    table = Table(title=f"Incident {graph.case_id}")
    table.add_column("Metric")
    table.add_column("Value", justify="right")
    table.add_row("Evidence integrity", str(graph.integrity.get("status")))
    table.add_row("Graph nodes", str(len(graph.nodes)))
    table.add_row("Graph edges", str(len(graph.edges)))
    table.add_row("Attack steps", str(len(report.attack_path)))
    table.add_row("ATT&CK techniques", str(len(report.techniques)))
    table.add_row("IOCs", str(len(report.iocs)))
    table.add_row("Policy alerts", str(len(report.policy_alerts)))
    console.print(table)
    for name, path in outputs.items():
        console.print(f"{name}: {path.resolve()}")


@app.command()
def analyze(
    evidence: Annotated[Path, typer.Argument(exists=True, readable=True)],
    output_dir: Annotated[Path, typer.Option("--output-dir", "-o")] = Path("artifacts/demo"),
    sync_neo4j: Annotated[bool, typer.Option("--sync-neo4j")] = False,
) -> None:
    """Parse evidence, build the graph and emit a deterministic report."""
    graph = load_graph(evidence)
    outputs = write_analysis(graph, output_dir)
    if sync_neo4j:
        result = sync_graph_to_neo4j(graph)
        console.print(f"Neo4j sync: {result}")
    print_summary(graph, outputs)


@app.command()
def tool(
    evidence: Annotated[Path, typer.Argument(exists=True, readable=True)],
    name: Annotated[str, typer.Argument()],
    arguments: Annotated[str, typer.Option("--arguments", "-a")] = "{}",
) -> None:
    """Call one allowlisted read-only forensic tool."""
    graph = load_graph(evidence)
    result = ForensicToolRegistry(graph).call_json(name, arguments)
    console.print_json(data=result)
    if not result.get("ok"):
        raise typer.Exit(code=2)


@app.command()
def plan(
    evidence: Annotated[Path, typer.Argument(exists=True, readable=True)],
    base_url: Annotated[str, typer.Option(envvar="MODEL_API_BASE")] = "http://127.0.0.1:11434/v1",
    model: Annotated[str, typer.Option(envvar="MODEL_NAME")] = "gemma4:e4b",
    api_key: Annotated[str, typer.Option(envvar="MODEL_API_KEY", hide_input=True)] = "local",
    output: Annotated[Path, typer.Option("--output", "-o")] = Path("artifacts/demo/llm-plan.json"),
    disable_thinking: Annotated[bool, typer.Option("--disable-thinking")] = True,
) -> None:
    """Run the bounded LLM planner, with an automatic deterministic fallback."""
    graph = load_graph(evidence)
    extra_body: dict[str, Any] = {}
    if disable_thinking:
        extra_body = (
            {"think": False, "options": {"num_ctx": 8192}}
            if "11434" in base_url
            else {"chat_template_kwargs": {"enable_thinking": False}}
        )
    envelope = IRPlanner(
        graph,
        base_url=base_url,
        model=model,
        api_key=api_key,
        extra_body=extra_body,
    ).analyze()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(envelope.model_dump_json(indent=2) + "\n", encoding="utf-8")
    console.print(f"Planner mode: {envelope.mode}; tool calls: {len(envelope.tool_trace)}")
    if envelope.fallback_reason:
        console.print(f"Fallback: {envelope.fallback_reason}")
    console.print(f"Output: {output.resolve()}")


@app.command("sync-neo4j")
def sync_neo4j_command(
    evidence: Annotated[Path, typer.Argument(exists=True, readable=True)],
) -> None:
    """Mirror a deterministic graph into the isolated Neo4j instance."""
    graph = load_graph(evidence)
    console.print(sync_graph_to_neo4j(graph))


def sync_graph_to_neo4j(graph: Any) -> dict[str, int]:
    store = Neo4jGraphStore(
        uri=os.getenv("NEO4J_URI", "bolt://127.0.0.1:7688"),
        user=os.getenv("NEO4J_USER", "neo4j"),
        password=os.getenv("NEO4J_PASSWORD", "gemma-ir-demo-2026"),
        database=os.getenv("NEO4J_DATABASE", "neo4j"),
    )
    try:
        return store.sync(graph)
    finally:
        store.close()


@app.command()
def serve(
    evidence: Annotated[Path, typer.Argument(exists=True, readable=True)],
    host: Annotated[str, typer.Option()] = "127.0.0.1",
    port: Annotated[int, typer.Option()] = 8080,
) -> None:
    """Serve the local dashboard and read-only forensic API."""
    graph = load_graph(evidence)
    uvicorn.run(create_app(graph), host=host, port=port)


if __name__ == "__main__":
    app()
