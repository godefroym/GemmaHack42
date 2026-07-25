from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any

from gemma_ir.execution import TOOL_LABELS, TOOL_PRESENTATIONS
from gemma_ir.models import PlannerEnvelope
from gemma_ir.tools import ForensicToolRegistry

STAGES = {
    1: (
        "ORIENT",
        "Verify archive integrity and establish collection coverage.",
    ),
    2: (
        "INSPECT",
        "Inspect trust alerts, source inventory and captured host state.",
    ),
    3: (
        "SEARCH",
        "Pivot on exact ransomware indicators in raw evidence.",
    ),
    4: (
        "CORRELATE",
        "Combine normalized events, IOCs, ATT&CK mappings and targeted raw hits.",
    ),
    5: (
        "VERIFY",
        "Read source-line context around selected evidence IDs.",
    ),
    6: (
        "DECIDE",
        "Constrain incident scope, exfiltration status and remediation policy.",
    ),
}

STAGE_TITLES = {
    "ORIENT": "Trust the evidence first",
    "INSPECT": "Check host state and hostile input",
    "SEARCH": "Find ransomware markers",
    "CORRELATE": "Build one attack sequence",
    "VERIFY": "Read the surrounding log sequence",
    "DECIDE": "Bound impact and recovery",
}

CALL_LOGIC = {
    "get_case_overview": "Anchor the investigation to verified collection coverage.",
    "inspect_policy_alerts": "Quarantine attacker-controlled instructions before raw review.",
    "list_artifacts": "Confirm which forensic sources exist before selecting pivots.",
    "query_system_state": "Inspect one bounded host-state dataset from the collection snapshot.",
    "search_raw_evidence": "Test exact ransomware indicators against original captured lines.",
    "search_events": "Correlate the current lead with normalized chronological events.",
    "list_iocs": "Extract stable indicators for containment and wider hunting.",
    "map_attack_techniques": "Attach evidence-backed ATT&CK labels to the reconstructed activity.",
    "get_evidence_context": "Validate a selected hit against adjacent lines in the same source.",
    "get_evidence": "Resolve one final claim to its exact immutable source record.",
    "assess_incident_scope": "Separate observed host impact from uncollected infrastructure.",
    "assess_exfiltration": "Separate a transfer attempt from corroborated data loss.",
    "get_remediation_constraints": "Load preservation and approval rules before proposing changes.",
}


def _escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _truncate(value: Any, *, depth: int = 0) -> Any:
    if depth >= 3:
        return "…"
    if isinstance(value, str):
        return value if len(value) <= 180 else value[:177] + "..."
    if isinstance(value, list):
        items = [_truncate(item, depth=depth + 1) for item in value[:5]]
        if len(value) > 5:
            items.append(f"… {len(value) - 5} more")
        return items
    if isinstance(value, dict):
        return {
            str(key): _truncate(child, depth=depth + 1)
            for key, child in list(value.items())[:12]
        }
    return value


def _compact_result(name: str, response: dict[str, Any]) -> dict[str, Any]:
    if not response.get("ok"):
        return {
            "ok": False,
            "blocked": response.get("blocked", False),
            "error": response.get("error"),
        }
    result = response.get("result")
    if not isinstance(result, dict):
        return {"ok": True, "result": _truncate(result)}

    if name == "get_case_overview":
        static = result.get("static_analysis", {})
        return {
            "integrity": result.get("integrity", {}).get("status"),
            "artifacts": result.get("collected_artifacts"),
            "searchable_lines": result.get("searchable_evidence_lines"),
            "events": static.get("events"),
            "attack_steps": static.get("candidate_attack_steps"),
            "policy_alerts": static.get("policy_alerts"),
        }
    if name == "list_artifacts":
        return {
            "count": result.get("count"),
            "paths": [item.get("path") for item in result.get("artifacts", [])[:5]],
        }
    if name == "query_system_state":
        return {
            "dataset": result.get("dataset"),
            "matches": result.get("count"),
            "sources": result.get("sources", [])[:4],
            "sample": [
                {
                    "evidence_id": item.get("evidence_id"),
                    "excerpt": _truncate(item.get("excerpt")),
                }
                for item in result.get("results", [])[:2]
            ],
        }
    if name == "search_raw_evidence":
        return {
            "query": result.get("query"),
            "matches": result.get("count"),
            "sample": [
                {
                    "evidence_id": item.get("evidence_id"),
                    "source": f"{item.get('source_path')}:{item.get('line_number')}",
                    "excerpt": _truncate(item.get("excerpt")),
                }
                for item in result.get("matches", [])[:3]
            ],
        }
    if name == "search_events":
        return {
            "count": result.get("count"),
            "events": [
                {
                    "timestamp": item.get("timestamp"),
                    "type": item.get("event_type"),
                    "summary": item.get("summary"),
                    "evidence_ids": item.get("evidence_ids"),
                }
                for item in result.get("events", [])[:4]
            ],
        }
    if name == "list_iocs":
        return {
            "count": result.get("count"),
            "iocs": [
                {
                    "type": item.get("type"),
                    "value": item.get("value"),
                    "evidence_ids": item.get("evidence_ids"),
                }
                for item in result.get("iocs", [])[:8]
            ],
        }
    if name == "map_attack_techniques":
        return {
            "count": result.get("count"),
            "techniques": [
                {
                    "technique_id": item.get("technique_id"),
                    "name": item.get("name"),
                    "confidence": item.get("confidence"),
                    "evidence_ids": item.get("evidence_ids"),
                }
                for item in result.get("techniques", [])
            ],
        }
    if name == "get_evidence_context":
        return {
            "found": result.get("found"),
            "focus": result.get("focus_evidence_id"),
            "lines": [
                {
                    "evidence_id": item.get("evidence_id"),
                    "source": f"{item.get('source_path')}:{item.get('line_number')}",
                    "excerpt": _truncate(item.get("excerpt")),
                }
                for item in result.get("context", [])
            ],
        }
    if name == "get_evidence":
        return _truncate(
            {
                "found": result.get("found"),
                "evidence": result.get("evidence"),
            }
        )
    if name == "inspect_policy_alerts":
        return {
            "count": result.get("count"),
            "alerts": [
                {
                    "type": item.get("type"),
                    "decision": item.get("decision"),
                    "evidence_ids": item.get("evidence_ids"),
                }
                for item in result.get("alerts", [])
            ],
        }
    if name == "get_remediation_constraints":
        return {
            "constraints": result.get("constraints", []),
            "examples": result.get("examples", []),
        }
    if name == "assess_incident_scope":
        return {
            "scope_status": result.get("scope_status"),
            "affected_hosts": result.get("affected_hosts"),
            "time_range": result.get("time_range"),
            "entities": result.get("entities"),
            "external_telemetry_sources": result.get("external_telemetry_sources"),
            "limitations": result.get("limitations"),
        }
    if name == "assess_exfiltration":
        return {
            "status": result.get("status"),
            "confidence": result.get("confidence"),
            "destination_filter": result.get("destination_filter"),
            "evidence_ids": result.get("evidence_ids"),
            "external_telemetry_sources": result.get("external_telemetry_sources"),
            "limitations": result.get("limitations"),
        }
    return _truncate(result)


def build_replay_steps(
    envelope: PlannerEnvelope,
    registry: ForensicToolRegistry,
) -> list[dict[str, Any]]:
    steps = []
    for index, call in enumerate(envelope.tool_trace, start=1):
        name = str(call.get("name", "unknown"))
        arguments = call.get("arguments")
        if not isinstance(arguments, dict):
            arguments = {}
        round_number = int(call.get("round", 0))
        stage, stage_logic = STAGES.get(
            round_number,
            ("INVESTIGATE", "Continue the evidence-driven investigation."),
        )
        response = registry.call(name, arguments)
        presentation = TOOL_PRESENTATIONS.get(name, {})
        steps.append(
            {
                "index": index,
                "round": round_number,
                "stage": stage,
                "stage_logic": stage_logic,
                "tool": name,
                "label": TOOL_LABELS.get(name, name),
                "logic": CALL_LOGIC.get(name, "Run the next bounded forensic pivot."),
                "implementation": presentation.get(
                    "implementation",
                    "Allowlisted read-only forensic function.",
                ),
                "arguments": arguments,
                "result": _compact_result(name, response),
                "ok": bool(response.get("ok")),
            }
        )
    return steps


def _stage_commands(round_number: int, steps: list[dict[str, Any]]) -> list[str]:
    if round_number == 1:
        return [
            "sha256sum -c evidence/SHA256SUMS",
            "find evidence -type f | sort | wc -l",
        ]
    if round_number == 2:
        return [
            (
                "rg -i 'SYSTEM INSTRUCTION|ignore forensic policy|delete_evidence' "
                "evidence/commands/journal.txt"
            ),
            "sed -n '1,30p' evidence/commands/processes.txt",
            (
                "rg -i 'systemd|cron|authorized_keys' "
                "evidence/commands evidence/files | head -30"
            ),
        ]
    if round_number == 3:
        search = next(
            (step for step in steps if step["tool"] == "search_raw_evidence"),
            None,
        )
        terms = search["arguments"].get("terms", []) if search else []
        flags = " ".join(f"-e {json.dumps(term)}" for term in terms)
        return [f"rg -i -F {flags} evidence/ | head -25"]
    if round_number == 4:
        return [
            (
                "jq '[.nodes[] | select(.type==\"Event\") | "
                "select(tostring|test(\"pacs-crypt\";\"i\"))] | "
                "sort_by(.properties.sequence)' incident-graph.json"
            ),
            "jq '.iocs[] | [.type,.value,.evidence_ids]' deterministic-report.json",
            (
                "jq '.techniques[] | select(.confidence >= 0.5)' "
                "deterministic-report.json"
            ),
        ]
    if round_number == 5:
        context = next(
            (
                step["result"]
                for step in steps
                if step["tool"] == "get_evidence_context"
                and step["result"].get("lines")
            ),
            {},
        )
        lines = context.get("lines", [])
        if lines:
            source = str(lines[0].get("source", "commands/journal.txt:1"))
            path, _, _ = source.rpartition(":")
            line_numbers = [
                int(str(item.get("source", ":0")).rpartition(":")[2])
                for item in lines
            ]
            return [
                f"sed -n '{min(line_numbers)},{max(line_numbers)}p' evidence/{path}",
                "sha256sum evidence/commands/journal.txt",
            ]
        return ["resolve-evidence --context 2 EV-*"]
    if round_number == 6:
        return [
            (
                "jq '{hosts:[.nodes[]|select(.type==\"Host\")], "
                "first:.timeline[0], last:.timeline[-1]}' incident-graph.json"
            ),
            (
                "rg -i 'allowed|completed|bytes_out|bytes sent' "
                "evidence/{proxy,firewall,zeek,dns,netflow}/"
            ),
            "policy: preserve_first=true shell=false approval_on_write=true",
        ]
    return [f"replay-stage {round_number}"]


def _stage_summary(round_number: int, steps: list[dict[str, Any]]) -> str:
    by_tool = {step["tool"]: step["result"] for step in steps}
    if round_number == 1:
        result = by_tool.get("get_case_overview", {})
        return (
            f"Integrity {result.get('integrity')} · {result.get('artifacts')} artifacts · "
            f"{result.get('searchable_lines'):,} indexed lines · "
            f"{result.get('attack_steps')} candidate attack steps"
        )
    if round_number == 2:
        alerts = by_tool.get("inspect_policy_alerts", {})
        state_calls = [
            step["result"]
            for step in steps
            if step["tool"] == "query_system_state"
        ]
        datasets = ", ".join(str(item.get("dataset")) for item in state_calls)
        return (
            f"{alerts.get('count', 0)} prompt-injection alert blocked · "
            f"captured datasets inspected: {datasets}"
        )
    if round_number == 3:
        result = by_tool.get("search_raw_evidence", {})
        sample = result.get("sample", [])
        first = sample[0].get("excerpt") if sample else "no matching line"
        return f"{result.get('matches', 0)} raw matches · first hit: {first}"
    if round_number == 4:
        events = by_tool.get("search_events", {})
        iocs = by_tool.get("list_iocs", {})
        techniques = by_tool.get("map_attack_techniques", {})
        return (
            f"{events.get('count', 0)} pacs-crypt events · "
            f"{iocs.get('count', 0)} IOCs · "
            f"{techniques.get('count', 0)} evidence-backed ATT&CK techniques"
        )
    if round_number == 5:
        context_steps = [
            step
            for step in steps
            if step["tool"] == "get_evidence_context"
        ]
        resolved = sum(bool(step["result"].get("found")) for step in context_steps)
        return (
            f"{resolved}/{len(context_steps)} evidence pivots resolved · "
            "SSH success is followed by service stop, backup deletion, snapshot removal "
            "and encryption in adjacent journal lines"
        )
    if round_number == 6:
        scope = by_tool.get("assess_incident_scope", {})
        exfiltration = by_tool.get("assess_exfiltration", {})
        return (
            f"Scope {scope.get('scope_status')} · exfiltration "
            f"{exfiltration.get('status')} ({exfiltration.get('confidence')}) · "
            "every modifying remediation requires approval"
        )
    return f"{len(steps)} recorded calls completed"


def build_stage_replay(
    envelope: PlannerEnvelope,
    registry: ForensicToolRegistry,
) -> list[dict[str, Any]]:
    calls = build_replay_steps(envelope, registry)
    stages = []
    for round_number, (stage, logic) in STAGES.items():
        round_steps = [step for step in calls if step["round"] == round_number]
        if not round_steps:
            continue
        stages.append(
            {
                "round": round_number,
                "stage": stage,
                "title": STAGE_TITLES[stage],
                "logic": logic,
                "commands": _stage_commands(round_number, round_steps),
                "summary": _stage_summary(round_number, round_steps),
                "tool_calls": len(round_steps),
                "tools": list(dict.fromkeys(step["tool"] for step in round_steps)),
            }
        )
    return stages


def _render_terminal_call_replay_html(
    envelope: PlannerEnvelope,
    registry: ForensicToolRegistry,
) -> str:
    steps = build_replay_steps(envelope, registry)
    encoded_steps = (
        json.dumps(steps, ensure_ascii=False)
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )
    stage_items = "".join(
        f"<li data-stage='{_escape(label)}'><span>{number:02d}</span>{_escape(label)}</li>"
        for number, (label, _) in STAGES.items()
    )
    model = envelope.model or "endpoint model"

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SSH investigation replay — {_escape(envelope.case_id)}</title>
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
    body {{ margin: 0; background: var(--paper); color: var(--ink);
            -webkit-font-smoothing: antialiased; }}
    main {{ width: min(1180px, calc(100% - 48px)); margin: auto; padding: 38px 0 70px; }}
    header {{ display: flex; align-items: end; justify-content: space-between; gap: 30px; }}
    .meta {{ color: var(--accent); font: 700 10px ui-monospace, monospace;
             letter-spacing: .1em; text-transform: uppercase; }}
    h1 {{ margin: 8px 0 0; font-size: clamp(36px, 5vw, 62px); font-weight: 500;
          line-height: 1.02; letter-spacing: -.035em; }}
    header p {{ max-width: 410px; margin: 0; color: var(--muted);
                font-size: 14px; line-height: 1.55; text-align: right; }}
    .stages {{ display: grid; grid-template-columns: repeat(6, 1fr); list-style: none;
               margin: 36px 0 14px; padding: 0; border: 1px solid var(--hairline);
               border-radius: 9px; overflow: hidden; background: var(--hairline); gap: 1px; }}
    .stages li {{ display: flex; align-items: center; gap: 8px; padding: 13px 12px;
                  background: white; color: var(--muted);
                  font: 700 10px ui-monospace, monospace; }}
    .stages li span {{ color: var(--muted-2); }}
    .stages li.active {{ background: var(--accent); color: white; }}
    .stages li.active span {{ color: #ffffffaa; }}
    .shell {{ overflow: hidden; border-radius: 11px; border: 1px solid var(--night-line);
              background: var(--night); color: var(--paper); box-shadow: 0 28px 80px #14141a18; }}
    .shell-bar {{ display: flex; align-items: center; justify-content: space-between;
                  padding: 12px 15px; border-bottom: 1px solid var(--night-line);
                  background: var(--night-2); }}
    .dots {{ display: flex; gap: 7px; }}
    .dots i {{ width: 9px; height: 9px; border-radius: 50%; background: #ffffff20; }}
    .dots i:first-child {{ background: var(--accent); }}
    .shell-bar code {{ color: #ffffff55; font: 10px ui-monospace, monospace; }}
    .terminal {{ min-height: 400px; max-height: 58vh; overflow: auto; margin: 0;
                 padding: 22px; white-space: pre-wrap; overflow-wrap: anywhere;
                 color: #e8e5dd; font: 12px/1.72 ui-monospace, "SFMono-Regular", monospace; }}
    .controls {{ display: flex; align-items: center; justify-content: space-between;
                 gap: 16px; margin-top: 14px; }}
    .controls p {{ margin: 0; color: var(--muted); font: 11px ui-monospace, monospace; }}
    button {{ appearance: none; border: 1px solid var(--hairline); border-radius: 7px;
              background: white; color: var(--ink); padding: 11px 15px;
              font: 700 10px ui-monospace, monospace; letter-spacing: .05em;
              text-transform: uppercase; cursor: pointer; }}
    button.primary {{ border-color: var(--accent); background: var(--accent); color: white; }}
    button:disabled {{ opacity: .35; cursor: default; }}
    .buttons {{ display: flex; gap: 8px; }}
    dialog {{ width: min(720px, calc(100% - 30px)); padding: 0; border: 0;
              border-radius: 11px; background: white; color: var(--ink);
              box-shadow: 0 30px 120px #00000055; }}
    dialog::backdrop {{ background: #0b0b11b8; backdrop-filter: blur(3px); }}
    .dialog-head {{ display: flex; justify-content: space-between; gap: 20px;
                    padding: 18px 21px; border-bottom: 1px solid var(--hairline); }}
    .dialog-head span {{ color: var(--accent); font: 700 10px ui-monospace, monospace;
                         letter-spacing: .09em; }}
    .dialog-head code {{ color: var(--muted); font: 10px ui-monospace, monospace; }}
    .dialog-body {{ padding: 21px; }}
    .dialog-body h2 {{ margin: 0 0 4px; font-size: 25px; font-weight: 500;
                       letter-spacing: -.025em; }}
    .dialog-body > code {{ color: var(--muted); font: 11px ui-monospace, monospace; }}
    .explain {{ display: grid; grid-template-columns: 120px 1fr; gap: 12px 20px;
                margin: 23px 0; }}
    .explain dt {{ color: var(--muted-2); font: 700 9px ui-monospace, monospace;
                   letter-spacing: .08em; text-transform: uppercase; }}
    .explain dd {{ margin: 0; font-size: 13.5px; line-height: 1.5; }}
    .payloads {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
    .payload {{ min-width: 0; border: 1px solid var(--hairline); border-radius: 8px;
                background: var(--paper-2); padding: 13px; }}
    .payload strong {{ display: block; margin-bottom: 9px; color: var(--muted);
                       font: 700 9px ui-monospace, monospace; letter-spacing: .08em;
                       text-transform: uppercase; }}
    .payload pre {{ max-height: 190px; overflow: auto; margin: 0; white-space: pre-wrap;
                    overflow-wrap: anywhere; font: 10.5px/1.55 ui-monospace, monospace; }}
    .dialog-actions {{ display: flex; justify-content: space-between; gap: 10px;
                       padding: 15px 21px; border-top: 1px solid var(--hairline);
                       background: var(--paper); }}
    .dialog-actions div {{ display: flex; gap: 8px; }}
    @media (max-width: 760px) {{
      main {{ width: min(100% - 24px, 1180px); }}
      header {{ display: block; }}
      header p {{ margin-top: 16px; text-align: left; }}
      .stages {{ grid-template-columns: repeat(3, 1fr); }}
      .payloads {{ grid-template-columns: 1fr; }}
      .explain {{ grid-template-columns: 1fr; gap: 5px; }}
      .controls {{ align-items: start; flex-direction: column; }}
    }}
  </style>
</head>
<body>
<main>
  <header>
    <div>
      <p class="meta">Recorded model execution · {_escape(envelope.case_id)}</p>
      <h1>SSH investigation replay</h1>
    </div>
    <p>
      Terminal session on the isolated analysis appliance. The victim remains
      offline; every tool reads the local immutable evidence bundle.
      Model: <code>{_escape(model)}</code>
    </p>
  </header>

  <ol class="stages" id="stages">{stage_items}</ol>

  <section class="shell" aria-label="Recorded SSH terminal">
    <div class="shell-bar">
      <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
      <code>analyst@pandar-ir · read-only evidence session</code>
    </div>
    <pre class="terminal" id="terminal" aria-live="polite"></pre>
  </section>

  <div class="controls">
    <p id="progress">Ready · 19 recorded calls</p>
    <div class="buttons">
      <button type="button" id="restart">Restart</button>
      <button type="button" class="primary" id="start">Start replay</button>
    </div>
  </div>

  <dialog id="call-dialog">
    <div class="dialog-head">
      <span id="dialog-stage"></span>
      <code id="dialog-progress"></code>
    </div>
    <div class="dialog-body">
      <h2 id="dialog-title"></h2>
      <code id="dialog-tool"></code>
      <dl class="explain">
        <dt>Stage</dt><dd id="dialog-stage-logic"></dd>
        <dt>Call logic</dt><dd id="dialog-logic"></dd>
        <dt>Implementation</dt><dd id="dialog-implementation"></dd>
      </dl>
      <div class="payloads">
        <div class="payload"><strong>Arguments</strong><pre id="dialog-arguments"></pre></div>
        <div class="payload"><strong>Compact result</strong><pre id="dialog-result"></pre></div>
      </div>
    </div>
    <div class="dialog-actions">
      <button type="button" id="close-dialog">Inspect terminal</button>
      <div>
        <button type="button" id="previous">Previous</button>
        <button type="button" class="primary" id="continue">Continue</button>
      </div>
    </div>
  </dialog>
</main>
<script id="replay-data" type="application/json">{encoded_steps}</script>
<script>
  (() => {{
    const steps = JSON.parse(document.getElementById("replay-data").textContent);
    const terminal = document.getElementById("terminal");
    const dialog = document.getElementById("call-dialog");
    const progress = document.getElementById("progress");
    let current = -1;

    const setText = (id, value) => {{
      document.getElementById(id).textContent = value;
    }};
    const pretty = (value) => JSON.stringify(value, null, 2);
    const prompt = [
      "local$ ssh analyst@pandar-ir",
      "Connected to isolated inference appliance.",
      "Victim network route: NONE",
      "Evidence mount: READ ONLY",
      "",
      "analyst@pandar-ir:~$ gemma-ir investigate hospital-ransomware",
      "model  {_escape(model)}",
      ""
    ];

    function activateStage(stage) {{
      document.querySelectorAll("#stages li").forEach((item) => {{
        item.classList.toggle("active", item.dataset.stage === stage);
      }});
    }}

    function terminalLines(until) {{
      const lines = [...prompt];
      for (let i = 0; i <= until; i += 1) {{
        const step = steps[i];
        lines.push(`[${{step.stage}}:${{String(step.round).padStart(2, "0")}}] ${{step.logic}}`);
        lines.push(`gemma -> ${{step.tool}} ${{JSON.stringify(step.arguments)}}`);
        const verdict = step.ok ? "ok" : "blocked";
        lines.push(`tool  <- ${{verdict}} ${{JSON.stringify(step.result)}}`);
        lines.push("");
      }}
      return lines.join("\\n");
    }}

    function show(index) {{
      if (index < 0 || index >= steps.length) return;
      current = index;
      const step = steps[index];
      terminal.textContent = terminalLines(index);
      terminal.scrollTop = terminal.scrollHeight;
      activateStage(step.stage);
      progress.textContent = `Call ${{index + 1}} / ${{steps.length}} · ${{step.stage}}`;
      setText("dialog-stage", `${{step.stage}} · ROUND ${{String(step.round).padStart(2, "0")}}`);
      setText("dialog-progress", `${{index + 1}} / ${{steps.length}}`);
      setText("dialog-title", step.label);
      setText("dialog-tool", step.tool);
      setText("dialog-stage-logic", step.stage_logic);
      setText("dialog-logic", step.logic);
      setText("dialog-implementation", step.implementation);
      setText("dialog-arguments", pretty(step.arguments));
      setText("dialog-result", pretty(step.result));
      document.getElementById("previous").disabled = index === 0;
      document.getElementById("continue").textContent =
        index === steps.length - 1 ? "Finish" : "Continue";
      if (!dialog.open) dialog.showModal();
    }}

    function reset() {{
      current = -1;
      terminal.textContent = prompt.join("\\n");
      activateStage("");
      progress.textContent = `Ready · ${{steps.length}} recorded calls`;
      if (dialog.open) dialog.close();
    }}

    document.getElementById("start").addEventListener("click", () => show(0));
    document.getElementById("restart").addEventListener("click", reset);
    document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
    document.getElementById("previous").addEventListener("click", () => show(current - 1));
    document.getElementById("continue").addEventListener("click", () => {{
      if (current < steps.length - 1) {{
        show(current + 1);
      }} else {{
        dialog.close();
        progress.textContent = `Complete · ${{steps.length}} / ${{steps.length}} calls`;
        terminal.textContent += "\\nInvestigation trace complete. Final report accepted.";
        terminal.scrollTop = terminal.scrollHeight;
      }}
    }});
    reset();
  }})();
</script>
</body>
</html>
"""


def render_terminal_replay_html(
    envelope: PlannerEnvelope,
    registry: ForensicToolRegistry,
) -> str:
    stages = build_stage_replay(envelope, registry)
    encoded_stages = (
        json.dumps(stages, ensure_ascii=False)
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )
    stage_buttons = "".join(
        (
            f"<button type='button' class='stage' data-index='{index}'>"
            f"<span>{item['round']:02d}</span>{_escape(item['stage'])}</button>"
        )
        for index, item in enumerate(stages)
    )
    model = envelope.model or "endpoint model"
    stage_count = len(stages)
    call_count = len(envelope.tool_trace)

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Investigation replay — {_escape(envelope.case_id)}</title>
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
      --hairline: #e5e2da;
      --night: #0b0b11;
      --night-2: #16161f;
      --night-line: #2b2b35;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: var(--paper); color: var(--ink);
            -webkit-font-smoothing: antialiased; }}
    main {{ width: min(1240px, calc(100% - 48px)); margin: auto; padding: 36px 0 58px; }}
    header {{ display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 28px; }}
    .meta {{ margin: 0; color: var(--accent); font: 700 10px ui-monospace, monospace;
             letter-spacing: .1em; text-transform: uppercase; }}
    h1 {{ margin: 8px 0 0; font-size: clamp(38px, 5vw, 66px); font-weight: 500;
          line-height: 1; letter-spacing: -.04em; }}
    .intro {{ max-width: 440px; margin: 0; color: var(--muted); font-size: 14px;
              line-height: 1.55; text-align: right; }}
    .intro code {{ color: var(--ink); font: 10.5px ui-monospace, monospace; }}
    .toolbar {{ display: flex; align-items: center; justify-content: space-between;
                gap: 20px; margin: 30px 0 13px; }}
    .toolbar p {{ margin: 0; color: var(--muted); font: 11px ui-monospace, monospace; }}
    .actions {{ display: flex; gap: 8px; }}
    button {{ appearance: none; border: 1px solid var(--hairline); border-radius: 7px;
              background: white; color: var(--ink); padding: 10px 14px;
              font: 700 10px ui-monospace, monospace; letter-spacing: .05em;
              text-transform: uppercase; cursor: pointer; }}
    button.primary {{ border-color: var(--accent); background: var(--accent); color: white; }}
    .progress {{ height: 3px; overflow: hidden; border-radius: 3px;
                 background: var(--hairline); }}
    .progress span {{ display: block; width: 0; height: 100%; background: var(--accent);
                      transition: width .5s ease; }}
    .stages {{ display: grid; grid-template-columns: repeat(6, 1fr); margin: 13px 0;
               border: 1px solid var(--hairline); border-radius: 9px;
               overflow: hidden; background: var(--hairline); gap: 1px; }}
    .stage {{ display: flex; align-items: center; gap: 8px; border: 0; border-radius: 0;
              padding: 13px 12px; color: var(--muted); }}
    .stage span {{ color: var(--muted-2); }}
    .stage.active {{ background: var(--accent); color: white; }}
    .stage.active span {{ color: #ffffffaa; }}
    .replay {{ display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(330px, .55fr);
               min-height: 490px; overflow: hidden; border: 1px solid var(--night-line);
               border-radius: 11px; background: var(--night); box-shadow: 0 28px 80px #14141a18; }}
    .shell {{ min-width: 0; border-right: 1px solid var(--night-line); }}
    .shell-bar {{ display: flex; align-items: center; justify-content: space-between;
                  padding: 12px 15px; border-bottom: 1px solid var(--night-line);
                  background: var(--night-2); }}
    .dots {{ display: flex; gap: 7px; }}
    .dots i {{ width: 9px; height: 9px; border-radius: 50%; background: #ffffff20; }}
    .dots i:first-child {{ background: var(--accent); }}
    .shell-bar code {{ color: #ffffff55; font: 10px ui-monospace, monospace; }}
    .terminal {{ height: 442px; overflow: auto; margin: 0; padding: 21px;
                 white-space: pre-wrap; overflow-wrap: anywhere; color: #e8e5dd;
                 font: 11.5px/1.72 ui-monospace, "SFMono-Regular", monospace; }}
    .spotlight {{ display: flex; flex-direction: column; padding: 25px;
                  background: var(--night-2); color: var(--paper); }}
    .spotlight .phase {{ margin: 0; color: var(--accent);
                         font: 700 10px ui-monospace, monospace;
                         letter-spacing: .1em; }}
    .spotlight h2 {{ margin: 14px 0 12px; font-size: 29px; font-weight: 500;
                     line-height: 1.05; letter-spacing: -.03em; }}
    .spotlight .logic {{ margin: 0; color: #ffffff8c; font-size: 14px; line-height: 1.55; }}
    .operation {{ margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--night-line); }}
    .operation strong, .result strong {{ display: block; margin-bottom: 10px;
                                         color: #ffffff55;
                                         font: 700 9px ui-monospace, monospace;
                                         letter-spacing: .09em; text-transform: uppercase; }}
    .operation code {{ display: block; margin: 7px 0; color: #ffffffc9;
                       font: 10px/1.45 ui-monospace, monospace; overflow-wrap: anywhere; }}
    .result {{ margin-top: auto; padding-top: 18px; border-top: 1px solid var(--night-line); }}
    .result p {{ margin: 0; color: var(--paper); font-size: 13.5px; line-height: 1.55; }}
    .result small {{ display: block; margin-top: 12px; color: #ffffff45;
                     font: 9.5px ui-monospace, monospace; }}
    .ready {{ color: #ffffff48; }}
    footer {{ display: flex; justify-content: space-between; gap: 20px; margin-top: 13px;
              color: var(--muted); font: 10px ui-monospace, monospace; }}
    @media (max-width: 900px) {{
      header {{ grid-template-columns: 1fr; }}
      .intro {{ text-align: left; }}
      .stages {{ grid-template-columns: repeat(3, 1fr); }}
      .replay {{ grid-template-columns: 1fr; }}
      .shell {{ border-right: 0; border-bottom: 1px solid var(--night-line); }}
      .spotlight {{ min-height: 330px; }}
    }}
    @media (max-width: 620px) {{
      main {{ width: min(100% - 24px, 1240px); }}
      .toolbar {{ align-items: start; flex-direction: column; }}
      .terminal {{ height: 360px; }}
      footer {{ flex-direction: column; }}
    }}
  </style>
</head>
<body>
<main>
  <header>
    <div>
      <p class="meta">{stage_count} diagnostic highlights · {_escape(envelope.case_id)}</p>
      <h1>Incident replay</h1>
    </div>
    <p class="intro">
      One click replays the investigation on the isolated analysis appliance.
      Commands shown are shell-equivalent views of the internal read-only
      operations. Model: <code>{_escape(model)}</code>
    </p>
  </header>

  <div class="toolbar">
    <p id="status">Ready · {stage_count} diagnostic highlights · {call_count} recorded tool calls</p>
    <div class="actions">
      <button type="button" id="restart">Restart</button>
      <button type="button" class="primary" id="play">Start replay</button>
    </div>
  </div>
  <div class="progress" aria-hidden="true"><span id="progress"></span></div>
  <nav class="stages" id="stages" aria-label="Investigation stages">{stage_buttons}</nav>

  <section class="replay">
    <div class="shell">
      <div class="shell-bar">
        <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
        <code>analyst@pandar-ir · evidence mounted read-only</code>
      </div>
      <pre class="terminal" id="terminal" aria-live="polite"></pre>
    </div>
    <aside class="spotlight" aria-live="polite">
      <p class="phase" id="phase">READY</p>
      <h2 id="title">Press Start replay</h2>
      <p class="logic" id="logic">
        The sequence advances automatically through the points that change
        the diagnosis.
      </p>
      <div class="operation">
        <strong>Concrete operation</strong>
        <div id="commands"><code class="ready">Waiting for replay.</code></div>
      </div>
      <div class="result">
        <strong>Diagnostic result</strong>
        <p id="result">No stage selected.</p>
        <small id="calls"></small>
      </div>
    </aside>
  </section>

  <footer>
    <span>SSH session: analysis appliance, never the victim</span>
    <span>Replay source: immutable evidence bundle + recorded Gemma trace</span>
  </footer>
</main>
<script id="stage-data" type="application/json">{encoded_stages}</script>
<script>
  (() => {{
    const stages = JSON.parse(document.getElementById("stage-data").textContent);
    const terminal = document.getElementById("terminal");
    const playButton = document.getElementById("play");
    const progress = document.getElementById("progress");
    const status = document.getElementById("status");
    let current = -1;
    let timer = null;
    let playing = false;

    const intro = [
      "local$ ssh analyst@pandar-ir",
      "Connected to isolated analysis appliance.",
      "Victim route: NONE",
      "Evidence mount: READ ONLY",
      "",
      "analyst@pandar-ir:~$ gemma-ir investigate hospital-ransomware",
      ""
    ];

    function terminalText(index) {{
      const lines = [...intro];
      for (let i = 0; i <= index; i += 1) {{
        const stage = stages[i];
        lines.push(`# ${{stage.stage}} — ${{stage.title}}`);
        for (const command of stage.commands) lines.push(`$ ${{command}}`);
        lines.push(`→ ${{stage.summary}}`, "");
      }}
      return lines.join("\\n");
    }}

    function render(index) {{
      current = index;
      const stage = stages[index];
      document.querySelectorAll(".stage").forEach((button, buttonIndex) => {{
        button.classList.toggle("active", buttonIndex === index);
      }});
      document.getElementById("phase").textContent =
        `${{stage.stage}} · ${{String(stage.round).padStart(2, "0")}}`;
      document.getElementById("title").textContent = stage.title;
      document.getElementById("logic").textContent = stage.logic;
      const commands = document.getElementById("commands");
      commands.replaceChildren();
      for (const value of stage.commands) {{
        const code = document.createElement("code");
        code.textContent = `$ ${{value}}`;
        commands.appendChild(code);
      }}
      document.getElementById("result").textContent = stage.summary;
      document.getElementById("calls").textContent =
        `${{stage.tool_calls}} recorded tool call${{stage.tool_calls === 1 ? "" : "s"}} condensed`;
      terminal.textContent = terminalText(index);
      terminal.scrollTop = terminal.scrollHeight;
      progress.style.width = `${{((index + 1) / stages.length) * 100}}%`;
      status.textContent = `Playing · ${{index + 1}} / ${{stages.length}} · ${{stage.stage}}`;
    }}

    function pause(label = "Resume replay") {{
      playing = false;
      clearTimeout(timer);
      timer = null;
      playButton.textContent = label;
    }}

    function schedule() {{
      clearTimeout(timer);
      timer = setTimeout(() => {{
        if (!playing) return;
        if (current < stages.length - 1) {{
          render(current + 1);
          schedule();
        }} else {{
          pause("Replay");
          status.textContent = `Complete · ${{stages.length}} diagnostic highlights`;
          terminal.textContent += "\\nDiagnostic replay complete.";
          terminal.scrollTop = terminal.scrollHeight;
        }}
      }}, 4600);
    }}

    function start() {{
      if (current >= stages.length - 1) current = -1;
      if (current < 0) render(0);
      playing = true;
      playButton.textContent = "Pause";
      schedule();
    }}

    function reset() {{
      pause("Start replay");
      current = -1;
      terminal.textContent = intro.join("\\n");
      progress.style.width = "0";
      status.textContent = "Ready · {stage_count} diagnostic highlights · {call_count} recorded tool calls";
      document.querySelectorAll(".stage").forEach((button) => button.classList.remove("active"));
      document.getElementById("phase").textContent = "READY";
      document.getElementById("title").textContent = "Press Start replay";
      document.getElementById("logic").textContent =
        "The sequence advances automatically through the points that change the diagnosis.";
      document.getElementById("commands").innerHTML =
        '<code class="ready">Waiting for replay.</code>';
      document.getElementById("result").textContent = "No stage selected.";
      document.getElementById("calls").textContent = "";
    }}

    playButton.addEventListener("click", () => {{
      if (playing) pause();
      else start();
    }});
    document.getElementById("restart").addEventListener("click", () => {{
      reset();
      start();
    }});
    document.querySelectorAll(".stage").forEach((button) => {{
      button.addEventListener("click", () => {{
        pause();
        render(Number(button.dataset.index));
      }});
    }});
    reset();
  }})();
</script>
</body>
</html>
"""


def write_terminal_replay(
    envelope: PlannerEnvelope,
    registry: ForensicToolRegistry,
    output_path: Path,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        render_terminal_replay_html(envelope, registry),
        encoding="utf-8",
    )
    return output_path
