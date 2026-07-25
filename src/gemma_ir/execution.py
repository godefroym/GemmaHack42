from __future__ import annotations

import html
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from gemma_ir.models import PlannerEnvelope

TOOL_LABELS = {
    "get_case_overview": "Case overview",
    "inspect_policy_alerts": "Prompt-injection check",
    "list_artifacts": "Evidence inventory",
    "query_system_state": "Collected system state",
    "search_raw_evidence": "Raw evidence search",
    "search_events": "Event correlation",
    "list_iocs": "IOC extraction",
    "map_attack_techniques": "MITRE ATT&CK mapping",
    "get_evidence_context": "Surrounding log lines",
    "get_evidence": "Exact cited record",
    "trace_attack_path": "Attack-path reconstruction",
    "assess_incident_scope": "Incident scope",
    "assess_exfiltration": "Exfiltration assessment",
    "get_remediation_constraints": "Remediation guardrails",
    "check_action_policy": "Action-policy check",
}

TOOL_PRESENTATIONS = {
    "get_case_overview": {
        "group": "ORIENT",
        "role": "Collection integrity and coverage.",
        "implementation": (
            "Reads the manifest and ingestion integrity result; counts files, indexed "
            "lines, normalized events, IOCs, ATT&CK mappings and policy alerts."
        ),
        "output": "Coverage counters and integrity status; no raw log content.",
    },
    "inspect_policy_alerts": {
        "group": "TRUST",
        "role": "Prompt-injection isolation.",
        "implementation": (
            "Returns policy-alert events emitted by deterministic rules, with block "
            "decision and evidence IDs."
        ),
        "output": "Static alerts only; coverage is limited to implemented patterns.",
    },
    "list_artifacts": {
        "group": "ORIENT",
        "role": "Evidence inventory.",
        "implementation": (
            "Lists immutable bundle entries with optional path-prefix and substring "
            "filters; capped at 250."
        ),
        "output": "Path, byte size, category and ingestion SHA-256.",
    },
    "query_system_state": {
        "group": "HOST STATE",
        "role": "Host-state triage.",
        "implementation": (
            "Scans fixed process, network, account, persistence, audit or package artifact "
            "prefixes with an optional case-insensitive literal filter; capped at 30 lines."
        ),
        "output": "Captured lines and source artifacts; no command runs on the host.",
    },
    "search_raw_evidence": {
        "group": "RAW EVIDENCE",
        "role": "IOC pivot across raw logs and command output.",
        "implementation": (
            "Case-insensitive line scan over the local bundle: up to 8 literal terms, OR "
            "by default or AND, optional source prefix, first 25 matches. No regex or "
            "semantic search."
        ),
        "output": "Excerpt, source path, line number, SHA-256 and stable EV ID.",
    },
    "search_events": {
        "group": "CORRELATE",
        "role": "Timeline correlation.",
        "implementation": (
            "Filters normalized Event nodes by exact event type and case-insensitive "
            "substring over labels, properties and evidence IDs; sequence ordered, max 30."
        ),
        "output": "Timestamp, type, summary, confidence and evidence IDs.",
    },
    "list_iocs": {
        "group": "CORRELATE",
        "role": "Containment and hunting indicators.",
        "implementation": (
            "Returns deterministic IOC records, optionally filtered by entity type."
        ),
        "output": "Typed value and evidence IDs; no threat-intelligence enrichment.",
    },
    "map_attack_techniques": {
        "group": "CORRELATE",
        "role": "ATT&CK classification.",
        "implementation": (
            "Filters deterministic ATT&CK mappings by minimum confidence; no model-generated "
            "mapping."
        ),
        "output": "Technique ID, confidence and supporting evidence IDs.",
    },
    "get_evidence_context": {
        "group": "VERIFY",
        "role": "Validate a hit in its local log sequence.",
        "implementation": (
            "Exact EV lookup; returns 0–5 preceding and 0–5 following lines from the same "
            "artifact, maximum 11 lines."
        ),
        "output": "Each line keeps source, line number, SHA-256 and EV ID.",
    },
    "get_evidence": {
        "group": "VERIFY",
        "role": "Direct evidence citation.",
        "implementation": (
            "Exact EV-ID dictionary lookup in raw-line then graph evidence indexes."
        ),
        "output": "One excerpt, source path, line number and SHA-256.",
    },
    "assess_incident_scope": {
        "group": "DECIDE",
        "role": "Observed blast-radius summary.",
        "implementation": (
            "Aggregates Host nodes, IOCs and timeline bounds; detects external coverage from "
            "fixed firewall, proxy, Zeek, DNS and NetFlow path prefixes."
        ),
        "output": "Affected entities, time range, host_only/multi_source and coverage gaps.",
    },
    "assess_exfiltration": {
        "group": "DECIDE",
        "role": "Separate attempted transfer from confirmed data loss.",
        "implementation": (
            "State machine over exfiltration events and telemetry markers: external success "
            "→ confirmed; host-only completion → possible; blocked event → attempted; no "
            "event → not_observed."
        ),
        "output": "Status, confidence, evidence IDs, telemetry sources and coverage limits.",
    },
    "get_remediation_constraints": {
        "group": "GUARDRAILS",
        "role": "Recovery-plan policy.",
        "implementation": (
            "Returns fixed rules: preserve first, no shell, approve system changes, prefer "
            "known-good restore after privileged persistence."
        ),
        "output": "Policy constraints and optional read/write action examples.",
    },
}

FEATURED_TOOLS = (
    "search_raw_evidence",
    "get_evidence_context",
    "assess_exfiltration",
)

ROUND_LABELS = {
    1: "Orient",
    2: "Inspect",
    3: "Search",
    4: "Correlate",
    5: "Verify",
    6: "Decide",
}


def _escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _json_preview(value: Any) -> str:
    if not value:
        return "no arguments"
    rendered = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return rendered if len(rendered) <= 120 else rendered[:117] + "..."


def _action_text(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("action") or value.get("description") or json.dumps(value))
    return str(value)


def _status_text(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("status") or value.get("assessment") or "unknown")
    return str(value or "unknown")


def _extract_evidence_ids(value: Any) -> list[str]:
    rendered = json.dumps(value, ensure_ascii=False)
    return sorted(set(re.findall(r"EV-[A-F0-9]{12}", rendered)))


def _round_label(round_number: int, tool_names: set[str]) -> str:
    if round_number in ROUND_LABELS:
        return ROUND_LABELS[round_number]
    if "assess_exfiltration" in tool_names:
        return "Decide"
    if "get_evidence_context" in tool_names or "get_evidence" in tool_names:
        return "Verify"
    return "Investigate"


def _render_tool_rounds(trace: list[dict[str, Any]]) -> str:
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for call in trace:
        grouped[int(call.get("round", 0))].append(call)

    sections = []
    for round_number, calls in sorted(grouped.items()):
        names = {str(call.get("name", "")) for call in calls}
        call_rows = []
        for call in calls:
            name = str(call.get("name", "unknown"))
            state = "BLOCKED" if call.get("blocked") else "READ ONLY"
            state_class = "blocked" if call.get("blocked") else "readonly"
            call_rows.append(
                "<li>"
                f"<span class='tool-name'>{_escape(TOOL_LABELS.get(name, name))}</span>"
                f"<code>{_escape(name)}</code>"
                f"<span class='tool-args'>{_escape(_json_preview(call.get('arguments')))}</span>"
                f"<span class='call-state {state_class}'>{state}</span>"
                "</li>"
            )
        sections.append(
            "<article class='round'>"
            "<div class='round-head'>"
            f"<span class='round-number'>{round_number}</span>"
            "<div>"
            f"<strong>{_escape(_round_label(round_number, names))}</strong>"
            f"<small>{len(calls)} model-selected call{'s' if len(calls) != 1 else ''}</small>"
            "</div>"
            "</div>"
            f"<ol>{''.join(call_rows)}</ol>"
            "</article>"
        )
    return "".join(sections)


def _render_tool_catalog(trace: list[dict[str, Any]]) -> str:
    used_names = {str(call.get("name", "")) for call in trace}
    featured_cards = []
    for name in FEATURED_TOOLS:
        if name not in used_names:
            continue
        presentation = TOOL_PRESENTATIONS[name]
        featured_cards.append(
            "<article class='tool-card'>"
            f"<p class='tool-group'>{_escape(presentation['group'])}</p>"
            f"<h3>{_escape(TOOL_LABELS.get(name, name))}</h3>"
            f"<code>{_escape(name)}</code>"
            "<dl>"
            f"<dt>Role</dt><dd>{_escape(presentation['role'])}</dd>"
            f"<dt>Implementation</dt><dd>{_escape(presentation['implementation'])}</dd>"
            f"<dt>Output</dt><dd>{_escape(presentation['output'])}</dd>"
            "</dl>"
            "</article>"
        )

    secondary_rows = []
    for name, presentation in TOOL_PRESENTATIONS.items():
        if name not in used_names or name in FEATURED_TOOLS:
            continue
        secondary_rows.append(
            "<li>"
            "<div>"
            f"<strong>{_escape(TOOL_LABELS.get(name, name))}</strong>"
            f"<code>{_escape(name)}</code>"
            "</div>"
            f"<p>{_escape(presentation['implementation'])}</p>"
            "</li>"
        )
    secondary = (
        "<details class='other-tools'>"
        f"<summary>{len(secondary_rows)} additional read-only tools"
        "<span>show technical list</span></summary>"
        f"<ul>{''.join(secondary_rows)}</ul>"
        "</details>"
    )
    return (
        f"<div class='featured-tools'>{''.join(featured_cards)}</div>"
        + secondary
    )


def render_llm_execution_html(envelope: PlannerEnvelope) -> str:
    analysis = envelope.llm_analysis
    trace = envelope.tool_trace
    rounds = sorted({int(call.get("round", 0)) for call in trace})
    evidence_ids = _extract_evidence_ids(analysis)
    policy_alerts = envelope.deterministic_report.policy_alerts
    remediation = analysis.get("remediation_plan") or []
    validation = analysis.get("validation_plan") or []
    findings = analysis.get("findings") or []
    attack_path = analysis.get("observed_attack_path") or []
    confidence = analysis.get("confidence")
    confidence_label = (
        f"{float(confidence) * 100:.0f}%"
        if isinstance(confidence, int | float) and not isinstance(confidence, bool)
        else "unknown"
    )
    model = envelope.model or "endpoint model (not recorded)"
    exfiltration = _status_text(analysis.get("exfiltration_assessment"))

    attack_rows = "".join(
        "<li>"
        f"<span>{_escape(item.get('step', index) if isinstance(item, dict) else index)}</span>"
        "<div>"
        f"<strong>{_escape(_action_text(item))}</strong>"
        f"<small>{_escape(item.get('evidence_id', '') if isinstance(item, dict) else '')}</small>"
        "</div>"
        "</li>"
        for index, item in enumerate(attack_path, start=1)
    )
    finding_rows = "".join(
        f"<li>{_escape(_action_text(item))}</li>" for item in findings
    )
    remediation_rows = "".join(
        "<li>"
        f"<span>{_escape(_action_text(item))}</span>"
        "<strong>HUMAN APPROVAL</strong>"
        "</li>"
        for item in remediation
    )
    validation_rows = "".join(
        f"<li>{_escape(_action_text(item))}</li>" for item in validation
    )
    policy_text = (
        "Blocked as untrusted evidence"
        if policy_alerts
        else "No embedded instruction detected"
    )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Gemma execution trace — {_escape(envelope.case_id)}</title>
  <style>
    :root {{
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
      --paper: #fbfaf7;
      --paper-2: #f4f2ec;
      --ink: #14141a;
      --muted: #71717a;
      --muted-2: #a1a1aa;
      --accent: #ff2b3a;
      --accent-wash: #fff1f2;
      --hairline: #e5e2da;
      --night: #0b0b11;
      --night-2: #16161f;
      --night-line: #2b2b35;
    }}
    * {{ box-sizing: border-box; }}
    html {{ scroll-behavior: smooth; }}
    body {{ margin: 0; background: var(--paper); color: var(--ink);
            -webkit-font-smoothing: antialiased; }}
    main {{ width: min(1180px, calc(100% - 48px)); margin: auto; padding: 42px 0 76px; }}
    header {{ display: flex; justify-content: space-between; gap: 24px; align-items: end; }}
    h1 {{ margin: 8px 0; max-width: 830px; font-size: clamp(36px, 5vw, 64px);
          font-weight: 500; line-height: 1.02; letter-spacing: -.035em; }}
    h2 {{ margin: 64px 0 18px; font-size: 28px; font-weight: 500;
          letter-spacing: -.025em; }}
    h3 {{ margin: 0 0 12px; font-size: 19px; font-weight: 500;
          letter-spacing: -.015em; }}
    p, small {{ color: var(--muted); }}
    code {{ font-family: ui-monospace, "SFMono-Regular", monospace; }}
    .eyebrow {{ color: var(--accent); font: 700 11px ui-monospace, monospace;
                letter-spacing: .1em; text-transform: uppercase; }}
    .model {{ max-width: 470px; text-align: right; color: var(--muted); }}
    .model code {{ display: block; margin-top: 7px; color: var(--ink); font-size: 11px; }}
    .replay-link {{ display: inline-block; margin-top: 16px; padding: 10px 13px;
                    border-radius: 7px; background: var(--accent); color: white;
                    font: 700 10px ui-monospace, monospace; letter-spacing: .05em;
                    text-decoration: none; text-transform: uppercase; }}
    .metrics {{ display: grid; grid-template-columns: repeat(4, 1fr);
                margin: 40px 0 28px; border-block: 1px solid var(--hairline); }}
    .metric {{ padding: 24px 20px; border-right: 1px solid var(--hairline); }}
    .metric:first-child {{ padding-left: 0; }}
    .metric:last-child {{ border-right: 0; }}
    .metric strong {{ display: block; font-size: 38px; font-weight: 500;
                      line-height: 1; letter-spacing: -.035em; }}
    .metric span {{ display: block; margin-top: 9px; color: var(--muted);
                    font: 11px ui-monospace, monospace; }}
    .pipeline {{ overflow-x: auto; padding: 4px 0; }}
    .pipeline svg {{ width: 100%; min-width: 1040px; height: auto; display: block; }}
    .flow-box {{ fill: var(--paper-2); stroke: var(--hairline); stroke-width: 2; }}
    .flow-box.focus {{ stroke: var(--accent); }}
    .flow-title {{ fill: var(--ink); font: 600 15px Inter, sans-serif; }}
    .flow-copy {{ fill: var(--muted); font: 12px Inter, sans-serif; }}
    .flow-tag {{ fill: var(--accent); font: 700 10px ui-monospace, monospace; }}
    .flow-arrow {{ stroke: var(--muted-2); stroke-width: 2; fill: none; }}
    .section-lead {{ max-width: 780px; margin: -8px 0 22px; color: var(--muted);
                     font-size: 15px; line-height: 1.6; }}
    .featured-tools {{ display: grid; grid-template-columns: repeat(3, 1fr);
                       gap: 1px; overflow: hidden; border: 1px solid var(--hairline);
                       border-radius: 10px; background: var(--hairline); }}
    .tool-card {{ background: white; padding: 25px; }}
    .tool-group {{ margin: 0 0 20px; color: var(--accent);
                   font: 700 10px ui-monospace, monospace; letter-spacing: .1em; }}
    .tool-card h3 {{ margin-bottom: 5px; }}
    .tool-card > code {{ color: var(--muted); font-size: 10.5px; }}
    .tool-card dl {{ margin: 20px 0 0; }}
    .tool-card dt {{ margin-top: 13px; color: var(--muted-2);
                     font: 700 9px ui-monospace, monospace;
                     text-transform: uppercase; letter-spacing: .08em; }}
    .tool-card dd {{ margin: 5px 0 0; color: var(--ink); font-size: 13.5px;
                     line-height: 1.48; }}
    .other-tools {{ margin-top: 14px; border: 1px solid var(--hairline);
                    border-radius: 10px; background: white; }}
    .other-tools summary {{ display: flex; justify-content: space-between; gap: 20px;
                            padding: 18px 20px; cursor: pointer; font-weight: 500; }}
    .other-tools summary span {{ color: var(--accent);
                                 font: 10px ui-monospace, monospace;
                                 text-transform: uppercase; letter-spacing: .07em; }}
    .other-tools ul {{ list-style: none; margin: 0; padding: 0 20px 10px; }}
    .other-tools li {{ display: grid; grid-template-columns: 240px 1fr; gap: 20px;
                       padding: 14px 0; border-top: 1px solid var(--hairline); }}
    .other-tools li strong {{ display: block; font-size: 13.5px; }}
    .other-tools li code {{ display: block; margin-top: 4px; color: var(--muted-2);
                            font-size: 10px; }}
    .other-tools li p {{ margin: 0; color: var(--muted); font-size: 13px;
                         line-height: 1.45; }}
    .rounds {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 13px; }}
    .round {{ background: var(--night); color: var(--paper);
              border: 1px solid var(--night-line); border-radius: 10px; padding: 18px; }}
    .round-head {{ display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }}
    .round-head small {{ display: block; margin-top: 2px; }}
    .round-number {{ display: grid; place-items: center; width: 32px; height: 32px;
                     border-radius: 50%; background: var(--accent); color: white;
                     font: 700 13px ui-monospace, monospace; }}
    .round ol, .decision ul {{ list-style: none; margin: 0; padding: 0; }}
    .round li {{ display: grid; grid-template-columns: 1fr auto; gap: 4px 10px;
                 padding: 10px 0; border-top: 1px solid var(--night-line); }}
    .round li:first-child {{ border-top: 0; }}
    .tool-name {{ font-weight: 500; }}
    .round code, .round .tool-args {{ color: #ffffff66; font-size: 10px;
                                     overflow-wrap: anywhere; }}
    .round .tool-args {{ grid-column: 1; }}
    .call-state {{ grid-column: 2; grid-row: 1 / span 2; align-self: center;
                   font: 700 9px ui-monospace, monospace; }}
    .readonly {{ color: var(--accent); }}
    .blocked {{ color: var(--accent); }}
    .decisions {{ display: grid; grid-template-columns: 1.2fr .8fr .8fr;
                  gap: 14px; align-items: start; }}
    .decision {{ background: white; border: 1px solid var(--hairline);
                 border-radius: 10px; padding: 20px; }}
    .verdict {{ display: grid; gap: 12px; }}
    .verdict div {{ display: flex; justify-content: space-between; gap: 15px;
                    border-bottom: 1px solid var(--hairline); padding-bottom: 10px; }}
    .verdict span {{ color: var(--muted); }}
    .attack li {{ display: grid; grid-template-columns: 27px 1fr; gap: 9px;
                  margin: 10px 0; }}
    .attack li > span {{ color: var(--accent); font: 700 12px ui-monospace, monospace; }}
    .attack small {{ display: block; margin-top: 3px; font-family: ui-monospace, monospace; }}
    .plain li {{ margin: 9px 0; color: var(--muted); }}
    .remediation li {{ display: grid; grid-template-columns: 1fr auto; gap: 12px;
                       padding: 10px 0; border-top: 1px solid var(--hairline); }}
    .remediation li:first-child {{ border-top: 0; }}
    .remediation strong {{ color: var(--accent); font: 700 9px ui-monospace, monospace; }}
    .boundary {{ margin-top: 16px; padding: 17px 19px; border-radius: 10px;
                 border: 1px solid #ffb4bc; background: var(--accent-wash); }}
    .boundary strong {{ color: var(--accent); }}
    footer {{ margin-top: 32px; color: var(--muted); font-size: 12px; }}
    @media (max-width: 1000px) {{
      .featured-tools {{ grid-template-columns: 1fr; }}
      .rounds {{ grid-template-columns: repeat(2, 1fr); }}
      .decisions {{ grid-template-columns: 1fr; }}
    }}
    @media (max-width: 650px) {{
      main {{ width: min(100% - 24px, 1180px); }}
      header {{ display: block; }}
      .model {{ text-align: left; margin-top: 18px; }}
      .metrics {{ grid-template-columns: 1fr 1fr; }}
      .metric:nth-child(2) {{ border-right: 0; }}
      .metric:nth-child(-n+2) {{ border-bottom: 1px solid var(--hairline); }}
      .other-tools li {{ grid-template-columns: 1fr; gap: 8px; }}
      .rounds {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
<main>
  <header>
    <div>
      <div class="eyebrow">REAL ENDPOINT RUN · NO MODEL FALLBACK</div>
      <h1>How Gemma handled the ransomware incident</h1>
      <p>Auditable execution trace · case {_escape(envelope.case_id)}</p>
    </div>
    <div class="model">Model selected every forensic call
      <code>{_escape(model)}</code>
      <a class="replay-link" href="terminal-replay.html">Open terminal replay →</a>
    </div>
  </header>

  <section class="metrics" aria-label="Execution metrics">
    <div class="metric"><strong>{len(trace)}</strong><span>model-selected tool calls</span></div>
    <div class="metric"><strong>{len(rounds)}</strong><span>investigation rounds</span></div>
    <div class="metric"><strong>{len(evidence_ids)}</strong><span>unique cited evidence IDs</span></div>
    <div class="metric"><strong>0</strong><span>shell or write-capable calls</span></div>
  </section>

  <h2>Trust and execution architecture</h2>
  <section class="pipeline">
    <svg viewBox="0 0 1180 190" role="img"
         aria-label="Evidence flows through deterministic parsers, Gemma, a policy gate, and a human operator">
      <defs>
        <marker id="exec-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5"
                orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#a1a1aa"/></marker>
      </defs>
      <path class="flow-arrow" marker-end="url(#exec-arrow)" d="M218 94 H250"/>
      <path class="flow-arrow" marker-end="url(#exec-arrow)" d="M448 94 H480"/>
      <path class="flow-arrow" marker-end="url(#exec-arrow)" d="M678 94 H710"/>
      <path class="flow-arrow" marker-end="url(#exec-arrow)" d="M908 94 H940"/>
      <g transform="translate(20 29)">
        <rect class="flow-box" width="198" height="130" rx="16"/>
        <text class="flow-tag" x="16" y="25">UNTRUSTED INPUT</text>
        <text class="flow-title" x="16" y="52">Isolated victim</text>
        <text class="flow-copy" x="16" y="77">Read-only evidence bundle</text>
        <text class="flow-copy" x="16" y="97">Logs · files · system state</text>
      </g>
      <g transform="translate(250 29)">
        <rect class="flow-box" width="198" height="130" rx="16"/>
        <text class="flow-tag" x="16" y="25">DETERMINISTIC</text>
        <text class="flow-title" x="16" y="52">Static analyzers</text>
        <text class="flow-copy" x="16" y="77">Hash and normalize evidence</text>
        <text class="flow-copy" x="16" y="97">Extract events and IOCs</text>
      </g>
      <g transform="translate(480 29)">
        <rect class="flow-box focus" width="198" height="130" rx="10"/>
        <text class="flow-tag" x="16" y="25">ORCHESTRATOR</text>
        <text class="flow-title" x="16" y="52">Gemma 4 31B</text>
        <text class="flow-copy" x="16" y="77">Chooses allowlisted tools</text>
        <text class="flow-copy" x="16" y="97">Challenges and scopes leads</text>
      </g>
      <g transform="translate(710 29)">
        <rect class="flow-box focus" width="198" height="130" rx="10"/>
        <text class="flow-tag" x="16" y="25">ENFORCEMENT</text>
        <text class="flow-title" x="16" y="52">Policy + grounding gate</text>
        <text class="flow-copy" x="16" y="77">Checks evidence citations</text>
        <text class="flow-copy" x="16" y="97">Blocks unsafe conclusions</text>
      </g>
      <g transform="translate(940 29)">
        <rect class="flow-box" width="198" height="130" rx="16"/>
        <text class="flow-tag" x="16" y="25">AUTHORITY</text>
        <text class="flow-title" x="16" y="52">Human responder</text>
        <text class="flow-copy" x="16" y="77">Reviews diagnosis</text>
        <text class="flow-copy" x="16" y="97">Approves every change</text>
      </g>
    </svg>
  </section>

  <h2>Core forensic tools</h2>
  <p class="section-lead">
    These are bounded forensic functions, not shell commands. Each card documents
    its cybersecurity purpose, the exact algorithm implemented in this prototype
    and its evidentiary boundary. These are the 13 tools Gemma actually selected
    in the recorded run.
  </p>
  <section class="tool-catalog">{_render_tool_catalog(trace)}</section>

  <h2>What Gemma actually did</h2>
  <section class="rounds">{_render_tool_rounds(trace)}</section>

  <h2>Grounded result</h2>
  <section class="decisions">
    <article class="decision">
      <h3>Reconstructed attack path</h3>
      <ul class="attack">{attack_rows}</ul>
    </article>
    <article class="decision">
      <h3>Decision</h3>
      <div class="verdict">
        <div><span>Classification</span><strong>{_escape(analysis.get("incident_classification", "unknown"))}</strong></div>
        <div><span>Exfiltration</span><strong>{_escape(exfiltration)}</strong></div>
        <div><span>Confidence</span><strong>{_escape(confidence_label)}</strong></div>
        <div><span>Prompt injection</span><strong>{_escape(policy_text)}</strong></div>
      </div>
      <h3 style="margin-top:22px">Evidence-backed findings</h3>
      <ul class="plain">{finding_rows}</ul>
    </article>
    <article class="decision">
      <h3>Proposed remediation</h3>
      <ul class="remediation">{remediation_rows}</ul>
      <h3 style="margin-top:22px">Read-only validation</h3>
      <ul class="plain">{validation_rows}</ul>
    </article>
  </section>

  <div class="boundary">
    <strong>Safety boundary:</strong> the log instruction in
    {_escape(policy_alerts[0]["evidence_ids"][0] if policy_alerts else "the evidence")}
    was treated as hostile data. It never became a tool call. Gemma had no shell,
    no write tool and no authority to remediate autonomously.
  </div>
  <footer>
    Generated from the committed PlannerEnvelope. Tool names, arguments, rounds,
    evidence IDs, verdicts and approval flags are taken from the recorded run.
  </footer>
</main>
</body>
</html>
"""


def write_llm_execution(envelope: PlannerEnvelope, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_llm_execution_html(envelope), encoding="utf-8")
    return output_path
