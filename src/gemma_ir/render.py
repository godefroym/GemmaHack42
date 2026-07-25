from __future__ import annotations

# Intentional adjacent f-strings keep SVG fragments readable.
# ruff: noqa: ISC004
import base64
import html
import json
import textwrap
from pathlib import Path
from typing import Any

from gemma_ir.deterministic import build_deterministic_report
from gemma_ir.models import IncidentGraph

EVENT_COLORS = {
    "public_app_exploit": "#4dabf7",
    "web_shell": "#9775fa",
    "sudo_abuse": "#da77f2",
    "scheduled_task": "#ff8787",
    "account_created": "#ffb454",
    "ssh_key_added": "#ff9f43",
    "authentication": "#6ea8fe",
    "privilege_change": "#d78cff",
    "service_created": "#ff6b6b",
    "credential_access": "#f06595",
    "data_staged": "#e8590c",
    "exfiltration_attempt": "#fa5252",
}


def _escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _wrapped_text(
    value: str,
    *,
    x: int,
    y: int,
    width: int,
    line_height: int = 18,
    css_class: str = "body",
    max_lines: int = 3,
) -> str:
    chars = max(12, width // 8)
    lines = textwrap.wrap(value, width=chars)[:max_lines]
    return (
        f'<text x="{x}" y="{y}" class="{css_class}">'
        + "".join(
            f'<tspan x="{x}" dy="{0 if index == 0 else line_height}">{_escape(line)}</tspan>'
            for index, line in enumerate(lines)
        )
        + "</text>"
    )


def render_attack_graph_svg(graph: IncidentGraph) -> str:
    report = build_deterministic_report(graph)
    attack_events = report.attack_path
    event_by_id = {node.id: node for node in graph.nodes_of_type("Event")}
    technique_by_event: dict[str, str] = {}
    node_by_id = {node.id: node for node in graph.nodes}
    entity_labels_by_event: dict[str, list[str]] = {}
    for edge in graph.edges:
        if edge.source not in event_by_id:
            continue
        target = node_by_id.get(edge.target)
        if target is None:
            continue
        if edge.type == "MAPS_TO":
            technique_by_event[edge.source] = target.label
        elif edge.type in {"ACTOR", "TARGET", "SOURCE", "ARTIFACT"}:
            labels = entity_labels_by_event.setdefault(edge.source, [])
            if target.label not in labels:
                labels.append(target.label)

    card_width = 280
    card_height = 180
    gap_x = 32
    gap_y = 160
    left = 54
    top = 145
    columns = 4
    width = left * 2 + columns * card_width + (columns - 1) * gap_x
    rows = max(1, (len(attack_events) + columns - 1) // columns)
    policy_y = top + rows * (card_height + gap_y)
    height = policy_y + 250
    pieces = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" '
        'aria-label="Sourced incident attack graph">',
        """
<defs>
  <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3"
          orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L0,6 L9,3 z" fill="#697386"/>
  </marker>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="5" stdDeviation="7" flood-opacity="0.18"/>
  </filter>
</defs>
<style>
  .title { font-family: Arial, sans-serif; font-size: 28px; font-weight: 700;
           fill: #f8fafc; }
  .subtitle { font-family: Arial, sans-serif; font-size: 14px;
              fill: #94a3b8; }
  .step { font-family: Arial, sans-serif; font-size: 12px; font-weight: 700;
          fill: #0f172a; letter-spacing: 0.08em; }
  .body { font-family: Arial, sans-serif; font-size: 14px; font-weight: 600;
          fill: #f8fafc; }
  .meta { font-family: Menlo, monospace; font-size: 12px; fill: #cbd5e1; }
  .pill { font-family: Menlo, monospace; font-size: 12px; font-weight: 700;
          fill: #dbeafe; }
  .entity { font-family: Arial, sans-serif; font-size: 12px;
            fill: #cbd5e1; }
</style>
""",
        f'<rect width="{width}" height="{height}" rx="24" fill="#07111f"/>',
        '<text x="54" y="54" class="title">Attack graph — sourced reconstruction</text>',
        (
            f'<text x="54" y="82" class="subtitle">Case {_escape(graph.case_id)} · '
            f"{len(graph.nodes)} nodes · {len(graph.edges)} relations · "
            f"integrity {_escape(graph.integrity.get('status', 'unknown'))}</text>"
        ),
        '<circle cx="57" cy="112" r="6" fill="#38d9a9"/>',
        '<text x="72" y="117" class="subtitle">observed evidence</text>',
        '<circle cx="236" cy="112" r="6" fill="#74c0fc"/>',
        '<text x="251" y="117" class="subtitle">derived ATT&amp;CK mapping</text>',
    ]

    positions: list[tuple[int, int]] = []
    for index, _ in enumerate(attack_events):
        row = index // columns
        column_in_row = index % columns
        visual_column = column_in_row if row % 2 == 0 else columns - 1 - column_in_row
        positions.append(
            (
                left + visual_column * (card_width + gap_x),
                top + row * (card_height + gap_y),
            )
        )

    for index in range(len(positions) - 1):
        x1, y1 = positions[index]
        x2, y2 = positions[index + 1]
        start_y = y1 + card_height / 2
        end_y = y2 + card_height / 2
        if y1 == y2 and x2 > x1:
            path = f"M {x1 + card_width} {start_y} L {x2 - 12} {end_y}"
        elif y1 == y2:
            path = f"M {x1} {start_y} L {x2 + card_width + 12} {end_y}"
        else:
            bend_y = y1 + card_height + 65
            start_x = x1 + card_width / 2
            end_x = x2 + card_width / 2
            path = (
                f"M {start_x} {y1 + card_height} L {start_x} {bend_y} "
                f"L {end_x} {bend_y} L {end_x} {y2 - 12}"
            )
        pieces.append(
            f'<path d="{path}" fill="none" stroke="#697386" stroke-width="3" '
            'stroke-dasharray="7 6" marker-end="url(#arrow)"/>'
        )

    for index, step in enumerate(attack_events):
        event = event_by_id[step["event_id"]]
        x, y = positions[index]
        event_type = str(event.properties.get("event_type"))
        color = EVENT_COLORS.get(event_type, "#6ea8fe")
        technique = technique_by_event.get(event.id)
        entities = entity_labels_by_event.get(event.id, [])
        pieces.extend(
            [
                f'<rect x="{x}" y="{y}" width="{card_width}" height="{card_height}" '
                f'rx="18" fill="#101e31" stroke="{color}" stroke-width="2" '
                'filter="url(#shadow)"/>',
                f'<rect x="{x}" y="{y}" width="{card_width}" height="33" rx="16" fill="{color}"/>',
                f'<text x="{x + 16}" y="{y + 22}" class="step">'
                f"STEP {index + 1} · {_escape(event_type.upper())}</text>",
                _wrapped_text(
                    str(event.properties.get("summary")),
                    x=x + 16,
                    y=y + 60,
                    width=card_width - 32,
                    max_lines=3,
                ),
                f'<text x="{x + 16}" y="{y + 124}" class="meta">'
                f"{_escape(event.properties.get('timestamp') or 'time unknown')}</text>",
                f'<text x="{x + 16}" y="{y + 146}" class="meta">'
                f"{_escape(', '.join(event.evidence_ids[:2]))}</text>",
                _wrapped_text(
                    " · ".join(entities[:2]),
                    x=x + 16,
                    y=y + 167,
                    width=card_width - 32,
                    css_class="entity",
                    max_lines=1,
                ),
            ]
        )
        if technique:
            pieces.extend(
                [
                    f'<rect x="{x + 164}" y="{y - 31}" width="116" height="25" '
                    'rx="12" fill="#123661" stroke="#3b82f6"/>',
                    f'<text x="{x + 179}" y="{y - 14}" class="pill">{_escape(technique)}</text>',
                ]
            )

    policy_alerts = [
        node
        for node in graph.nodes_of_type("Event")
        if node.properties.get("event_type") == "prompt_injection"
    ]
    pieces.extend(
        [
            f'<rect x="54" y="{policy_y}" width="{width - 108}" height="132" '
            'rx="18" fill="#29152b" stroke="#e64980" stroke-width="2"/>',
            f'<text x="78" y="{policy_y + 31}" class="body">POLICY BOUNDARY</text>',
        ]
    )
    if policy_alerts:
        alert = policy_alerts[0]
        evidence_id = alert.evidence_ids[0]
        excerpt = graph.evidence[evidence_id].excerpt
        pieces.extend(
            [
                _wrapped_text(
                    "Prompt injection detected in untrusted evidence — blocked, "
                    "never converted into a tool call.",
                    x=78,
                    y=policy_y + 59,
                    width=width - 160,
                    max_lines=2,
                ),
                _wrapped_text(
                    f"{evidence_id}: {excerpt}",
                    x=78,
                    y=policy_y + 101,
                    width=width - 160,
                    css_class="meta",
                    max_lines=1,
                ),
            ]
        )
    else:
        pieces.append(
            f'<text x="78" y="{policy_y + 65}" class="subtitle">'
            "No embedded instruction detected.</text>"
        )
    pieces.append("</svg>")
    return "\n".join(pieces)


def render_dashboard_html(graph: IncidentGraph, svg: str) -> str:
    report = build_deterministic_report(graph)
    graph_data = base64.b64encode(
        json.dumps(graph.model_dump(), ensure_ascii=False).encode()
    ).decode()
    technique_badges = "".join(
        f"<span class='badge'>{_escape(item['technique_id'])}</span>" for item in report.techniques
    )
    ioc_rows = "".join(
        "<tr>"
        f"<td>{_escape(item['type'])}</td>"
        f"<td><code>{_escape(item['value'])}</code></td>"
        f"<td>{_escape(', '.join(item['evidence_ids']))}</td>"
        "</tr>"
        for item in report.iocs
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Gemma IR — {_escape(graph.case_id)}</title>
  <style>
    :root {{ color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }}
    body {{ margin: 0; background: #030914; color: #e2e8f0; }}
    main {{ width: min(1440px, calc(100% - 48px)); margin: 0 auto; padding: 40px 0 80px; }}
    header {{ display: flex; justify-content: space-between; align-items: end; gap: 30px; }}
    h1 {{ font-size: 34px; margin: 0 0 6px; }} h2 {{ margin-top: 42px; }}
    p {{ color: #94a3b8; }}
    .status {{ border: 1px solid #1e3a5f; background: #081a2e; padding: 12px 16px;
               border-radius: 14px; color: #7dd3fc; }}
    .metrics {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 28px 0; }}
    .metric {{ padding: 18px; background: #0b1423; border: 1px solid #17253a;
               border-radius: 16px; }}
    .metric strong {{ font-size: 28px; display: block; color: #f8fafc; }}
    .metric span {{ color: #94a3b8; font-size: 13px; }}
    .graph {{ overflow-x: auto; border: 1px solid #17253a; border-radius: 24px;
              background: #07111f; }}
    .graph svg {{ display: block; width: 100%; min-width: 1080px; height: auto; }}
    .badge {{ display: inline-block; margin: 0 8px 8px 0; padding: 7px 10px;
              border: 1px solid #2563eb; color: #bfdbfe; border-radius: 999px;
              background: #0c2345; font-family: ui-monospace, monospace; }}
    table {{ width: 100%; border-collapse: collapse; background: #0b1423;
             border-radius: 14px; overflow: hidden; }}
    th, td {{ text-align: left; padding: 13px 15px; border-bottom: 1px solid #17253a; }}
    th {{ color: #94a3b8; font-size: 12px; text-transform: uppercase; }}
    code {{ color: #fda4af; }}
    .note {{ margin-top: 28px; padding: 18px; border-left: 3px solid #e64980;
             background: #211326; }}
  </style>
</head>
<body>
<main>
  <header>
    <div><h1>Gemma IR</h1><p>Sourced post-mortem · {_escape(graph.case_id)}</p></div>
    <div class="status">READ ONLY · integrity {_escape(graph.integrity.get("status", "unknown"))}</div>
  </header>
  <section class="metrics">
    <div class="metric"><strong>{len(report.attack_path)}</strong><span>attack steps</span></div>
    <div class="metric"><strong>{len(report.techniques)}</strong><span>ATT&amp;CK techniques</span></div>
    <div class="metric"><strong>{len(report.iocs)}</strong><span>indicators</span></div>
    <div class="metric"><strong>{len(report.policy_alerts)}</strong><span>injections blocked</span></div>
  </section>
  <section class="graph">{svg}</section>
  <h2>MITRE ATT&amp;CK</h2><div>{technique_badges}</div>
  <h2>Indicators of compromise</h2>
  <table><thead><tr><th>Type</th><th>Value</th><th>Evidence</th></tr></thead>
  <tbody>{ioc_rows}</tbody></table>
  <div class="note"><strong>Safety boundary.</strong> Graph facts come from deterministic
  parsers. LLM hypotheses remain separate and cannot execute remediation.</div>
  <script id="graph-data" type="application/octet-stream">{graph_data}</script>
</main>
</body>
</html>
"""


def write_visualizations(graph: IncidentGraph, output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    svg = render_attack_graph_svg(graph)
    svg_path = output_dir / "attack-graph.svg"
    html_path = output_dir / "dashboard.html"
    svg_path.write_text(svg + "\n", encoding="utf-8")
    html_path.write_text(render_dashboard_html(graph, svg), encoding="utf-8")
    return {"svg": svg_path, "html": html_path}
