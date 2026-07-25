#!/usr/bin/env python3
"""PANDAR — live terminal walkthrough of a full incident-response run.

Everything printed here is produced by the real pipeline. Nothing is scripted:
the hashes are recomputed, the tool calls are the planner's actual calls
streamed through its on_event hook, and the findings come out of the graph.
"""

from __future__ import annotations

import argparse
import inspect
import time
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from gemma_ir.bundle import EvidenceBundle
from gemma_ir.deterministic import DeterministicAnalyzer, build_deterministic_report
from gemma_ir.planner import IRPlanner

BANNER = r"""
 ██████╗  █████╗ ███╗   ██╗██████╗  █████╗ ██████╗
 ██╔══██╗██╔══██╗████╗  ██║██╔══██╗██╔══██╗██╔══██╗
 ██████╔╝███████║██╔██╗ ██║██║  ██║███████║██████╔╝
 ██╔═══╝ ██╔══██║██║╚██╗██║██║  ██║██╔══██║██╔══██╗
 ██║     ██║  ██║██║ ╚████║██████╔╝██║  ██║██║  ██║
 ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
"""

console = Console()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PANDAR incident-response demo.")
    parser.add_argument("bundle", type=Path, nargs="?", default=Path("eval/fixtures/hospital-demo"))
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/v1")
    parser.add_argument("--model", default="gemma4:31b")
    parser.add_argument("--api-key", default="local")
    parser.add_argument("--timeout", type=float, default=300.0)
    parser.add_argument("--pace", type=float, default=0.28, help="Pause between lines, for readability.")
    parser.add_argument("--skip-llm", action="store_true", help="Deterministic layers only.")
    return parser.parse_args()


def beat(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


def main() -> None:
    args = parse_args()
    console.print(f"[bold cyan]{BANNER}[/bold cyan]")
    console.print("  [dim]local-first forensic incident response · powered by Gemma 4[/dim]")
    console.print(f"  [dim]model {args.model} · endpoint {args.base_url}[/dim]\n")
    beat(args.pace * 2)

    # ---- 1. evidence intake ------------------------------------------------
    console.rule("[bold]1 · EVIDENCE INTAKE")
    console.print(f"  reading collected bundle [cyan]{args.bundle}[/cyan]")
    started = time.perf_counter()
    bundle = EvidenceBundle.load(args.bundle)
    console.print(f"  {len(bundle.files)} artefacts · case [bold]{bundle.case_id}[/bold]")
    beat(args.pace)

    integrity = bundle.integrity
    status = integrity.get("status")
    colour = "green" if status == "verified" else "red"
    console.print(
        f"  SHA-256 manifest: [{colour}]{status}[/{colour}] "
        f"({integrity.get('checked')} files checked, {len(integrity.get('failed', []))} mismatched)"
    )
    for path in sorted(bundle.files)[:6]:
        console.print(f"    [dim]{bundle.file_hashes[path][:16]}…  {path}[/dim]")
        beat(args.pace * 0.3)
    console.print(f"    [dim]… {max(0, len(bundle.files) - 6)} more[/dim]\n")
    beat(args.pace)

    # ---- 2. deterministic reconstruction -----------------------------------
    console.rule("[bold]2 · DETERMINISTIC RECONSTRUCTION  [dim](no model involved)[/dim]")
    t0 = time.perf_counter()
    graph = DeterministicAnalyzer().analyze(bundle)
    report = build_deterministic_report(graph)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    console.print(
        f"  graph built in [bold green]{elapsed_ms:.0f} ms[/bold green] — "
        f"{len(graph.nodes)} nodes, {len(graph.edges)} relations, {len(graph.evidence)} sourced facts"
    )
    for warning in graph.warnings:
        console.print(f"  [yellow]warning:[/yellow] {warning}")
    beat(args.pace)

    console.print("\n  [bold]attack path[/bold]")
    for step in report.attack_path:
        console.print(f"    [cyan]{step['step']:>2}[/cyan]  {step['summary']}")
        console.print(f"        [dim]evidence {', '.join(step['evidence_ids'])}[/dim]")
        beat(args.pace)

    if report.policy_alerts:
        console.print()
        for alert in report.policy_alerts:
            excerpt = graph.evidence[alert["evidence_ids"][0]].excerpt if alert.get("evidence_ids") else ""
            console.print(
                Panel(
                    f"type: {alert['type']}   decision: [bold]{alert['decision']}[/bold]\n\n"
                    f"[dim]{excerpt}[/dim]\n\n[dim]{', '.join(alert['evidence_ids'])}[/dim]",
                    title="[bold red]POLICY BOUNDARY — untrusted instruction quarantined[/bold red]",
                    border_style="red",
                )
            )
            beat(args.pace)

    if args.skip_llm:
        console.print("\n  [dim]--skip-llm set; stopping before the model.[/dim]")
        return

    # ---- 3. the agent ------------------------------------------------------
    console.rule("[bold]3 · GEMMA 4 INVESTIGATION  [dim](read-only tools, air-gapped)[/dim]")

    def on_event(event: dict) -> None:
        kind = event.get("type")
        if kind == "phase":
            label = {
                "preflight": "grounding the investigation with read-only tools",
                "model_request": "handing the grounded case to Gemma 4",
            }.get(event.get("phase", ""), event.get("phase", ""))
            console.print(f"  [magenta]▸[/magenta] {label}")
        elif kind == "tool_call":
            mark = "[green]ok[/green]" if event.get("ok") else "[red]blocked[/red]"
            console.print(f"      [dim]tool[/dim] [bold]{event['name']:<28}[/bold] {mark}")
        beat(args.pace * 0.6)

    # The planner grew a richer multi-round loop on the integration branch. Pass
    # bundle and the progress hook only when this build accepts them, so the demo
    # keeps working across both signatures.
    accepted = inspect.signature(IRPlanner.__init__).parameters
    kwargs: dict[str, object] = {
        "base_url": args.base_url,
        "model": args.model,
        "api_key": args.api_key,
        "timeout_seconds": args.timeout,
    }
    if "bundle" in accepted:
        kwargs["bundle"] = bundle
    if "on_event" in accepted:
        kwargs["on_event"] = on_event
    else:
        console.print("      [dim]tool calls stream in the report, not live on this build[/dim]")
    planner = IRPlanner(graph, **kwargs)
    t1 = time.perf_counter()
    with console.status("[bold]Gemma 4 is reasoning over the incident graph…", spinner="dots"):
        envelope = planner.analyze()
    took = time.perf_counter() - t1

    if envelope.mode == "llm":
        console.print(f"\n  [bold green]model plan accepted[/bold green] in {took:.1f}s — grounding validated")
    else:
        console.print(f"\n  [bold yellow]model unavailable[/bold yellow] after {took:.1f}s")
        console.print(f"  [yellow]{envelope.fallback_reason}[/yellow]")
        console.print("  [bold]falling back to the deterministic report — the product still answers.[/bold]")
    beat(args.pace * 2)

    # ---- 4. post-mortem ----------------------------------------------------
    console.rule("[bold]4 · POST-MORTEM")
    analysis = envelope.llm_analysis or {}
    summary = analysis.get("executive_summary")
    if summary:
        console.print(Panel(str(summary), title="[bold]executive summary", border_style="cyan"))
        beat(args.pace)

    techniques = Table(title="MITRE ATT&CK", show_header=True, header_style="bold")
    techniques.add_column("technique")
    techniques.add_column("name")
    for tech in report.techniques:
        techniques.add_row(tech["technique_id"], tech["name"])
    console.print(techniques)
    beat(args.pace)

    iocs = Table(title="Indicators of compromise", show_header=True, header_style="bold")
    iocs.add_column("type")
    iocs.add_column("value")
    iocs.add_column("evidence", overflow="fold")
    for ioc in report.iocs:
        iocs.add_row(ioc["type"], ioc["value"], ", ".join(ioc["evidence_ids"][:2]))
    console.print(iocs)
    beat(args.pace)

    console.print("\n  [bold]remediation — every modifying action gated on human approval[/bold]")
    for item in report.remediation:
        gate = "[red]REQUIRES HUMAN APPROVAL[/red]" if item.requires_human_approval else "[green]read-only[/green]"
        console.print(f"    • {item.action}  {gate}")
        beat(args.pace * 0.5)

    console.print(
        f"\n  [dim]{len(graph.evidence)} sourced facts · analysed entirely on this machine · "
        f"no evidence left the appliance[/dim]\n"
    )


if __name__ == "__main__":
    main()
