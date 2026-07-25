# PANDAR — Landing → Demo Dashboard

**Date:** 2026-07-25
**Status:** design, pending approval

## Goal

Transform the PANDAR web app from a full marketing landing page into:

1. A **minimal landing** (`/`) — only the white "part 01" hero, with a **Try demo** CTA.
2. A **demo dashboard** (`/demo`) that shows a real incident investigation: the
   attack graph, the LLM's step-by-step actions on the attack ("sandbox"), and
   inference KPIs.

The dashboard is a **static replay** of pre-computed, real investigation
artifacts — no live backend, no model endpoint required. It must render
correctly with zero external dependencies so it is demo-proof.

## Decisions (locked)

- **Data source:** static replay of committed artifacts. No live backend.
- **Inference KPIs:** derived from the DGX Spark benchmark results.
- **Landing scope:** keep only the hero (section "01"). Remove Proof (02),
  How (03), Injection, Exhibit, Close.
- **Graph rendering:** lightweight home-made 2D force layout in SVG. No new
  heavy dependency (no reactflow, three.js not used for this).

## Source data

Copied into `web/public/demo/` at build/setup time (static assets fetched by
the client):

| File | Source | Feeds |
|---|---|---|
| `incident-graph.json` | `artifacts/hf-real-vm/incident-graph.json` | Graph panel (31 nodes, 49 edges) |
| `llm-investigation.json` | `artifacts/hf-real-vm/llm-investigation.json` | Trace panel (`tool_trace`, 21 actions) + report (`llm_analysis`) |

These artifacts live on the `agent/integration-hackathon` branch. They are
extracted from there into `web/public/demo/` (via `git show`) as part of setup.

KPI values are **embedded as constants** in a small content module
(`web/src/lib/demo-kpis.ts`), sourced from `eval/results/spark-vllm-26b-fp8.json`:

- Model: `gemma4:26b-fp8` · DGX Spark GB10
- Median TTFT: **1.4 s**
- Decode throughput: **~38 tok/s**
- Plus counters derived at runtime from the loaded trace: tool-call count (21),
  round count, blocked-by-policy count (from `tool_trace[].blocked` /
  `policy_enforcements`).

## Components

### Landing (`/`)
- `web/src/app/page.tsx` — renders `Topbar` + `Hero` only.
- `web/src/components/site/hero.tsx` — primary CTA changes to **Try demo**
  (`next/link` → `/demo`). "GitHub repo" stays as secondary. "Read the writeup"
  is dropped or demoted (kept as a small text link).
- Removed section components are left on disk but no longer imported (no
  deletion of Edouard's work; just unwired from the page).

### Dashboard (`/demo`)
New route `web/src/app/demo/page.tsx`. Layout, top to bottom:

1. **`KpiBar`** (`components/demo/kpi-bar.tsx`) — horizontal band of KPI tiles.
2. Two-column main area:
   - **`AttackGraph`** (left, wide) — `components/demo/attack-graph.tsx`.
     SVG node-link diagram with a small force simulation (custom, ~100 lines).
     Nodes colored by type; the node tied to the current replay step is
     highlighted.
   - **`SandboxTrace`** (right) — `components/demo/sandbox-trace.tsx`.
     Plays the 21 `tool_trace` entries one by one (Play / step controls).
     Each row: round, tool name, arguments, ok/blocked status.
3. **`ReportPanel`** (bottom) — `components/demo/report-panel.tsx`.
   Renders `llm_analysis`: executive summary, attack path, exfiltration
   assessment, techniques, confidence.

### State / data flow
- `components/demo/use-demo-data.ts` — a hook that fetches both JSON files from
  `/demo/*.json`, exposes `{ graph, trace, analysis, loading, error }`.
- `components/demo/use-replay.ts` — a hook holding the replay cursor
  (`currentStep`), play/pause, and step controls. The current step drives both
  the highlighted graph node and the visible trace rows.

Each unit is independently testable: the graph takes `nodes/edges/activeId` and
renders; the trace takes `trace/currentStep`; the replay hook is pure state.

## Visual consistency
Reuse the existing design tokens (`--paper`, `bg-night`, `hairline`, `accent`,
Space Mono font) so `/demo` reads as the same product as the hero. The KPI bar
and trace use the dark `bg-night` treatment already used by Proof/Exhibit; the
graph sits on paper. Framer-motion (already a dependency) handles step
transitions.

## Error handling
- If a JSON file fails to load, `use-demo-data` surfaces an error and `/demo`
  shows a clear inline message instead of a blank screen.
- The force simulation runs a fixed number of iterations then freezes (no
  runaway animation); layout is deterministic given a fixed seed.

## Testing
- Graph: unit-test the force layout produces stable, finite coordinates for the
  real 31-node graph; nodes stay within the viewbox.
- Replay hook: stepping forward/back stays within `[0, trace.length]`.
- Smoke: `pnpm build` succeeds; `/` and `/demo` render (drive with a browser,
  check the graph is not a blank frame and the trace advances).

## Out of scope
- Live model invocation from the browser.
- Editing / re-running investigations.
- Any change to the Python backend.
- Mobile-perfect graph interaction (graph is best-effort responsive; priority is
  the desktop demo view).

## Open item for review
- **Base branch:** the frontend lives on `edouard`; the real artifacts live on
  `agent/integration-hackathon`. Proposed: branch this work off `edouard` and
  pull the two JSON artifacts across. Confirm before implementation.
