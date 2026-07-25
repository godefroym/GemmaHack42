from __future__ import annotations

import json
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
from gemma_ir.execution import write_llm_execution
from gemma_ir.graph import write_graph_json
from gemma_ir.models import PlannerEnvelope
from gemma_ir.neo4j_store import Neo4jGraphStore
from gemma_ir.planner import InvestigationError, IRPlanner
from gemma_ir.render import write_visualizations
from gemma_ir.terminal_replay import write_terminal_replay
from gemma_ir.tools import ForensicToolRegistry

app = typer.Typer(no_args_is_help=True, help="Local-first Gemma incident response.")
console = Console()


def load_graph(evidence_path: Path) -> Any:
    bundle = EvidenceBundle.load(evidence_path)
    return DeterministicAnalyzer().analyze(bundle)


def load_case(evidence_path: Path) -> tuple[EvidenceBundle, Any]:
    bundle = EvidenceBundle.load(evidence_path)
    return bundle, DeterministicAnalyzer().analyze(bundle)


def parse_extra_body(value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise typer.BadParameter(f"Invalid --extra-body JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise typer.BadParameter("--extra-body must be a JSON object")
    return parsed


def run_llm_investigation(
    bundle: EvidenceBundle,
    graph: Any,
    *,
    base_url: str,
    model: str,
    api_key: str,
    extra_body: str,
    max_rounds: int,
    timeout_seconds: float,
) -> Any:
    planner = IRPlanner(
        graph,
        bundle,
        base_url=base_url,
        model=model,
        api_key=api_key,
        extra_body=parse_extra_body(extra_body),
        max_rounds=max_rounds,
        timeout_seconds=timeout_seconds,
    )
    try:
        return planner.analyze()
    except InvestigationError as exc:
        console.print(f"[red]Investigation failed:[/red] {exc}")
        raise typer.Exit(code=2) from exc


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
    bundle, graph = load_case(evidence)
    result = ForensicToolRegistry(graph, bundle).call_json(name, arguments)
    console.print_json(data=result)
    if not result.get("ok"):
        raise typer.Exit(code=2)


@app.command()
def plan(
    evidence: Annotated[Path, typer.Argument(exists=True, readable=True)],
    base_url: Annotated[str, typer.Option(envvar="MODEL_API_BASE")],
    model: Annotated[str, typer.Option(envvar="MODEL_NAME")],
    api_key: Annotated[str, typer.Option(envvar="MODEL_API_KEY", hide_input=True)] = "EMPTY",
    output: Annotated[Path, typer.Option("--output", "-o")] = Path("artifacts/demo/llm-plan.json"),
    extra_body: Annotated[str, typer.Option("--extra-body")] = "{}",
    max_rounds: Annotated[int, typer.Option(min=7, max=30)] = 16,
    timeout_seconds: Annotated[float, typer.Option(min=10, max=1800)] = 180,
) -> None:
    """Run the endpoint-backed LLM investigation workflow."""
    bundle, graph = load_case(evidence)
    result = run_llm_investigation(
        bundle,
        graph,
        base_url=base_url,
        model=model,
        api_key=api_key,
        extra_body=extra_body,
        max_rounds=max_rounds,
        timeout_seconds=timeout_seconds,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(result.model_dump_json(indent=2) + "\n", encoding="utf-8")
    execution_path = write_llm_execution(result, output.with_suffix(".html"))
    terminal_path = write_terminal_replay(
        result,
        ForensicToolRegistry(graph, bundle),
        output.with_name(f"{output.stem}-terminal.html"),
    )
    console.print(f"Investigation complete; tool calls: {len(result.tool_trace)}")
    console.print(f"Output: {output.resolve()}")
    console.print(f"Execution trace: {execution_path.resolve()}")
    console.print(f"Terminal replay: {terminal_path.resolve()}")


@app.command()
def investigate(
    evidence: Annotated[Path, typer.Argument(exists=True, readable=True)],
    base_url: Annotated[str, typer.Option(envvar="MODEL_API_BASE")],
    model: Annotated[str, typer.Option(envvar="MODEL_NAME")],
    api_key: Annotated[str, typer.Option(envvar="MODEL_API_KEY", hide_input=True)] = "EMPTY",
    output_dir: Annotated[Path, typer.Option("--output-dir", "-o")] = Path(
        "artifacts/investigation"
    ),
    extra_body: Annotated[str, typer.Option("--extra-body")] = "{}",
    max_rounds: Annotated[int, typer.Option(min=7, max=30)] = 16,
    timeout_seconds: Annotated[float, typer.Option(min=10, max=1800)] = 180,
    sync_neo4j: Annotated[bool, typer.Option("--sync-neo4j")] = False,
) -> None:
    """Run static analysis, visualization and the real LLM investigation."""
    bundle, graph = load_case(evidence)
    outputs = write_analysis(graph, output_dir)
    if sync_neo4j:
        result = sync_graph_to_neo4j(graph)
        console.print(f"Neo4j sync: {result}")
    print_summary(graph, outputs)

    investigation = run_llm_investigation(
        bundle,
        graph,
        base_url=base_url,
        model=model,
        api_key=api_key,
        extra_body=extra_body,
        max_rounds=max_rounds,
        timeout_seconds=timeout_seconds,
    )
    investigation_path = output_dir / "llm-investigation.json"
    investigation_path.write_text(
        investigation.model_dump_json(indent=2) + "\n",
        encoding="utf-8",
    )
    execution_path = write_llm_execution(
        investigation,
        output_dir / "llm-execution.html",
    )
    terminal_path = write_terminal_replay(
        investigation,
        ForensicToolRegistry(graph, bundle),
        output_dir / "terminal-replay.html",
    )
    console.print(
        f"LLM investigation complete; tool calls: {len(investigation.tool_trace)}"
    )
    console.print(f"investigation: {investigation_path.resolve()}")
    console.print(f"execution trace: {execution_path.resolve()}")
    console.print(f"terminal replay: {terminal_path.resolve()}")


@app.command("render-execution")
def render_execution(
    investigation: Annotated[Path, typer.Argument(exists=True, readable=True)],
    output: Annotated[Path, typer.Option("--output", "-o")] = Path(
        "artifacts/demo/llm-execution.html"
    ),
) -> None:
    """Render an auditable execution view from a recorded LLM investigation."""
    envelope = PlannerEnvelope.model_validate_json(
        investigation.read_text(encoding="utf-8")
    )
    write_llm_execution(envelope, output)
    console.print(f"Execution trace: {output.resolve()}")


@app.command("render-terminal-replay")
def render_terminal_replay(
    investigation: Annotated[Path, typer.Argument(exists=True, readable=True)],
    evidence: Annotated[Path, typer.Argument(exists=True, readable=True)],
    output: Annotated[Path, typer.Option("--output", "-o")] = Path(
        "artifacts/demo/terminal-replay.html"
    ),
) -> None:
    """Replay recorded LLM tool calls against the matching evidence bundle."""
    envelope = PlannerEnvelope.model_validate_json(
        investigation.read_text(encoding="utf-8")
    )
    bundle, graph = load_case(evidence)
    if graph.case_id != envelope.case_id:
        raise typer.BadParameter(
            f"Evidence case {graph.case_id!r} does not match {envelope.case_id!r}"
        )
    write_terminal_replay(
        envelope,
        ForensicToolRegistry(graph, bundle),
        output,
    )
    console.print(f"Terminal replay: {output.resolve()}")


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
    bundle, graph = load_case(evidence)
    uvicorn.run(create_app(graph, bundle), host=host, port=port)


if __name__ == "__main__":
    app()
