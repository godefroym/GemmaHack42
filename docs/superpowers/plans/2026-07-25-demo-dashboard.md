# Demo Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the PANDAR web app into a minimal hero landing with a "Try demo" CTA that opens a `/demo` dashboard replaying a real incident investigation (attack graph + LLM action trace + inference KPIs) from static artifacts.

**Architecture:** Static replay. Two committed JSON artifacts in `web/public/demo/` are fetched client-side. Pure-logic modules (data types, KPI derivation, force layout, replay reducer) are unit-tested with Vitest; presentational React components consume them and are validated by a browser smoke test + `pnpm build`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, framer-motion (already a dep), Vitest (added, node environment for pure logic). No graph library — a small custom SVG force layout.

## Global Constraints

- Work happens in `web/`. Current branch: `feat/demo-dashboard` (already created off `edouard`, artifacts already copied to `web/public/demo/`).
- No new heavy runtime dependency. Only `vitest` (+ `@vitejs/plugin-react` not needed for node-env pure tests) as a devDependency.
- Reuse existing design tokens from `web/src/app/globals.css`: `--paper #fbfaf7`, `--paper-2 #f4f2ec`, `--ink #14141a`, `--muted #71717a`, `--accent #ff2b3a`, `--night #0b0b11`, `--night-2 #16161f`, `--night-line #2b2b35`, `--hairline #e5e2da`. Font: Space Mono (`var(--font-space-mono)`).
- Do not delete Edouard's section components (`proof/how/injection/exhibit/close.tsx`); only unwire them from `page.tsx`.
- Package manager is `pnpm`. Dev server: `pnpm dev` (port 3000).

## Source data (already in place)

`web/public/demo/incident-graph.json`:
- `nodes: { id: string; type: string; label: string; properties: { ioc?: boolean }; evidence_ids: string[] }[]` (31 nodes). `type` ∈ Account, Endpoint, Event, File, Finding, Group, Host, Process, Service, Technique.
- `edges: { id: string; source: string; target: string; type: string; status: string; confidence: number; evidence_ids: string[] }[]` (49 edges).

`web/public/demo/llm-investigation.json`:
- `tool_trace: { tool_call_id: string; round: number; name: string; arguments: Record<string, unknown>; ok: boolean; blocked: boolean }[]` (21 entries; rounds 1–9; none blocked in this dataset).
- `llm_analysis: { executive_summary: string; incident_classification; observed_attack_path; root_cause; scope; exfiltration_assessment: string; techniques; findings; hypotheses; unknowns; remediation_plan; validation_plan; confidence: number }` (confidence 0.95, exfil "attempted_and_blocked").
- `policy_enforcements: unknown[]` (empty in this dataset).

## File Structure

- `web/vitest.config.ts` — Vitest config (node env).
- `web/src/lib/demo/types.ts` — shared TS types for graph, trace, analysis.
- `web/src/lib/demo/kpis.ts` — Spark KPI constants + `deriveTraceStats(trace)`.
- `web/src/lib/demo/force-layout.ts` — `layoutGraph(nodes, edges, opts)` → positioned nodes.
- `web/src/lib/demo/replay.ts` — `replayReducer` + helpers (pure cursor state).
- `web/src/lib/demo/*.test.ts` — Vitest unit tests for the three pure modules.
- `web/src/components/demo/use-demo-data.ts` — client hook, fetches both JSON.
- `web/src/components/demo/use-replay.ts` — client hook wrapping `replayReducer`.
- `web/src/components/demo/attack-graph.tsx` — SVG node-link view.
- `web/src/components/demo/sandbox-trace.tsx` — replayable action list + controls.
- `web/src/components/demo/kpi-bar.tsx` — KPI tiles.
- `web/src/components/demo/report-panel.tsx` — `llm_analysis` summary.
- `web/src/app/demo/page.tsx` — composes the dashboard.
- `web/src/components/site/hero.tsx` — CTA → "Try demo".
- `web/src/app/page.tsx` — Topbar + Hero only.

---

### Task 1: Vitest setup + demo data types

**Files:**
- Create: `web/vitest.config.ts`
- Create: `web/src/lib/demo/types.ts`
- Create: `web/src/lib/demo/types.test.ts`
- Modify: `web/package.json` (add `test` script + `vitest` devDep)

**Interfaces:**
- Produces: types `GraphNode`, `GraphEdge`, `IncidentGraph`, `TraceEntry`, `LlmAnalysis`, `Investigation`; type guards `isIncidentGraph(x)`, `isInvestigation(x)`.

- [ ] **Step 1: Add vitest + script**

```bash
cd web && pnpm add -D vitest
```
Then in `web/package.json` `scripts`, add: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: Vitest config**

Create `web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Write the failing test**

Create `web/src/lib/demo/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isIncidentGraph, isInvestigation } from "./types";
import graph from "../../../public/demo/incident-graph.json";
import investigation from "../../../public/demo/llm-investigation.json";

describe("demo data type guards", () => {
  it("accepts the real incident graph", () => {
    expect(isIncidentGraph(graph)).toBe(true);
    expect(graph.nodes.length).toBe(31);
    expect(graph.edges.length).toBe(49);
  });

  it("accepts the real investigation", () => {
    expect(isInvestigation(investigation)).toBe(true);
    expect(investigation.tool_trace.length).toBe(21);
  });

  it("rejects malformed input", () => {
    expect(isIncidentGraph({ nodes: {} })).toBe(false);
    expect(isInvestigation({})).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/demo/types.test.ts`
Expected: FAIL — cannot find `./types`. (If JSON import errors, ensure `resolveJsonModule` — Next's tsconfig already has it; Vitest reads it.)

- [ ] **Step 5: Implement types**

Create `web/src/lib/demo/types.ts`:
```ts
export interface GraphNode {
  id: string;
  type: string;
  label: string;
  properties: { ioc?: boolean } & Record<string, unknown>;
  evidence_ids: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  status: string;
  confidence: number;
  evidence_ids: string[];
}

export interface IncidentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TraceEntry {
  tool_call_id: string;
  round: number;
  name: string;
  arguments: Record<string, unknown>;
  ok: boolean;
  blocked: boolean;
}

export interface LlmAnalysis {
  executive_summary: string;
  incident_classification: unknown;
  observed_attack_path: unknown;
  root_cause: unknown;
  scope: unknown;
  exfiltration_assessment: string;
  techniques: unknown;
  findings: unknown;
  hypotheses: unknown;
  unknowns: unknown;
  remediation_plan: unknown;
  validation_plan: unknown;
  confidence: number;
}

export interface Investigation {
  tool_trace: TraceEntry[];
  llm_analysis: LlmAnalysis;
  policy_enforcements: unknown[];
}

export function isIncidentGraph(x: unknown): x is IncidentGraph {
  const g = x as IncidentGraph;
  return !!g && Array.isArray(g.nodes) && Array.isArray(g.edges);
}

export function isInvestigation(x: unknown): x is Investigation {
  const v = x as Investigation;
  return (
    !!v &&
    Array.isArray(v.tool_trace) &&
    !!v.llm_analysis &&
    typeof v.llm_analysis.confidence === "number"
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/demo/types.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add web/vitest.config.ts web/package.json web/pnpm-lock.yaml web/src/lib/demo/types.ts web/src/lib/demo/types.test.ts
git commit -m "test: add vitest + demo data types"
```

---

### Task 2: KPI constants + trace-derived stats

**Files:**
- Create: `web/src/lib/demo/kpis.ts`
- Create: `web/src/lib/demo/kpis.test.ts`

**Interfaces:**
- Consumes: `TraceEntry` from `./types`.
- Produces: constant `SPARK_KPIS` (`{ model, hardware, medianTtftSeconds, decodeTokensPerSecond }`) and `deriveTraceStats(trace: TraceEntry[]): { toolCalls: number; rounds: number; blocked: number; distinctTools: number }`.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/demo/kpis.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { SPARK_KPIS, deriveTraceStats } from "./kpis";
import investigation from "../../../public/demo/llm-investigation.json";
import type { TraceEntry } from "./types";

const trace = investigation.tool_trace as TraceEntry[];

describe("SPARK_KPIS", () => {
  it("reports the benchmarked model and throughput", () => {
    expect(SPARK_KPIS.model).toBe("gemma4:26b-fp8");
    expect(SPARK_KPIS.medianTtftSeconds).toBeCloseTo(1.4, 1);
    expect(SPARK_KPIS.decodeTokensPerSecond).toBeGreaterThan(35);
  });
});

describe("deriveTraceStats", () => {
  it("counts calls, rounds and blocks from the real trace", () => {
    const s = deriveTraceStats(trace);
    expect(s.toolCalls).toBe(21);
    expect(s.rounds).toBe(8); // distinct rounds present: 1..7,9
    expect(s.blocked).toBe(0);
    expect(s.distinctTools).toBeGreaterThan(5);
  });

  it("handles an empty trace", () => {
    expect(deriveTraceStats([])).toEqual({
      toolCalls: 0,
      rounds: 0,
      blocked: 0,
      distinctTools: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/demo/kpis.test.ts`
Expected: FAIL — cannot find `./kpis`.

- [ ] **Step 3: Implement**

Create `web/src/lib/demo/kpis.ts`:
```ts
import type { TraceEntry } from "./types";

// Sourced from eval/results/spark-vllm-26b-fp8.json (DGX Spark GB10, online fp8).
export const SPARK_KPIS = {
  model: "gemma4:26b-fp8",
  hardware: "DGX Spark GB10",
  medianTtftSeconds: 1.4,
  decodeTokensPerSecond: 38,
} as const;

export interface TraceStats {
  toolCalls: number;
  rounds: number;
  blocked: number;
  distinctTools: number;
}

export function deriveTraceStats(trace: TraceEntry[]): TraceStats {
  return {
    toolCalls: trace.length,
    rounds: new Set(trace.map((t) => t.round)).size,
    blocked: trace.filter((t) => t.blocked).length,
    distinctTools: new Set(trace.map((t) => t.name)).size,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/demo/kpis.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/demo/kpis.ts web/src/lib/demo/kpis.test.ts
git commit -m "feat: demo KPI constants and trace stats"
```

---

### Task 3: Deterministic force layout

**Files:**
- Create: `web/src/lib/demo/force-layout.ts`
- Create: `web/src/lib/demo/force-layout.test.ts`

**Interfaces:**
- Consumes: `GraphNode`, `GraphEdge` from `./types`.
- Produces: `layoutGraph(nodes, edges, opts?): PositionedNode[]` where `PositionedNode = GraphNode & { x: number; y: number }`; `opts = { width?: number; height?: number; iterations?: number; seed?: number }` (defaults 800×600, 300, 1). Deterministic given the same seed.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/demo/force-layout.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { layoutGraph } from "./force-layout";
import graph from "../../../public/demo/incident-graph.json";
import type { GraphEdge, GraphNode } from "./types";

const nodes = graph.nodes as GraphNode[];
const edges = graph.edges as GraphEdge[];

describe("layoutGraph", () => {
  it("positions every node with finite, in-bounds coordinates", () => {
    const out = layoutGraph(nodes, edges, { width: 800, height: 600 });
    expect(out).toHaveLength(nodes.length);
    for (const n of out) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(800);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(600);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = layoutGraph(nodes, edges, { seed: 7 });
    const b = layoutGraph(nodes, edges, { seed: 7 });
    expect(a.map((n) => [n.x, n.y])).toEqual(b.map((n) => [n.x, n.y]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/demo/force-layout.test.ts`
Expected: FAIL — cannot find `./force-layout`.

- [ ] **Step 3: Implement**

Create `web/src/lib/demo/force-layout.ts`:
```ts
import type { GraphEdge, GraphNode } from "./types";

export type PositionedNode = GraphNode & { x: number; y: number };

interface LayoutOpts {
  width?: number;
  height?: number;
  iterations?: number;
  seed?: number;
}

// Mulberry32 — small deterministic PRNG so layouts are reproducible.
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts: LayoutOpts = {},
): PositionedNode[] {
  const width = opts.width ?? 800;
  const height = opts.height ?? 600;
  const iterations = opts.iterations ?? 300;
  const rand = prng(opts.seed ?? 1);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.4;

  // Seed positions on a jittered circle.
  const pos = nodes.map((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    return {
      node: n,
      x: cx + Math.cos(angle) * radius + (rand() - 0.5) * 20,
      y: cy + Math.sin(angle) * radius + (rand() - 0.5) * 20,
    };
  });
  const index = new Map(pos.map((p) => [p.node.id, p]));

  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1));
  let temp = width / 10;
  const cool = temp / (iterations + 1);

  for (let iter = 0; iter < iterations; iter++) {
    const disp = pos.map(() => ({ dx: 0, dy: 0 }));

    // Repulsion between every pair.
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let dist = Math.hypot(dx, dy) || 0.01;
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        disp[i].dx += dx;
        disp[i].dy += dy;
        disp[j].dx -= dx;
        disp[j].dy -= dy;
      }
    }

    // Attraction along edges.
    for (const e of edges) {
      const s = index.get(e.source);
      const t = index.get(e.target);
      if (!s || !t) continue;
      const dx = s.x - t.x;
      const dy = s.y - t.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const force = (dist * dist) / k;
      const ox = (dx / dist) * force;
      const oy = (dy / dist) * force;
      const si = pos.indexOf(s);
      const ti = pos.indexOf(t);
      disp[si].dx -= ox;
      disp[si].dy -= oy;
      disp[ti].dx += ox;
      disp[ti].dy += oy;
    }

    // Apply, capped by temperature, then pull gently to centre.
    for (let i = 0; i < pos.length; i++) {
      const d = disp[i];
      const len = Math.hypot(d.dx, d.dy) || 0.01;
      pos[i].x += (d.dx / len) * Math.min(len, temp);
      pos[i].y += (d.dy / len) * Math.min(len, temp);
      pos[i].x += (cx - pos[i].x) * 0.01;
      pos[i].y += (cy - pos[i].y) * 0.01;
    }
    temp -= cool;
  }

  // Clamp into bounds with a margin.
  const m = 24;
  return pos.map((p) => ({
    ...p.node,
    x: Math.max(m, Math.min(width - m, p.x)),
    y: Math.max(m, Math.min(height - m, p.y)),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/demo/force-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/demo/force-layout.ts web/src/lib/demo/force-layout.test.ts
git commit -m "feat: deterministic SVG force layout for the attack graph"
```

---

### Task 4: Replay reducer

**Files:**
- Create: `web/src/lib/demo/replay.ts`
- Create: `web/src/lib/demo/replay.test.ts`

**Interfaces:**
- Produces: `type ReplayState = { cursor: number; playing: boolean }`; `type ReplayAction = { type: "play" } | { type: "pause" } | { type: "reset" } | { type: "next" } | { type: "prev" } | { type: "goto"; index: number }`; `replayReducer(state, action, length): ReplayState`. `cursor` is clamped to `[0, length]` (`length` = fully played). `initialReplay: ReplayState = { cursor: 0, playing: false }`.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/demo/replay.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { replayReducer, initialReplay } from "./replay";

const LEN = 21;

describe("replayReducer", () => {
  it("advances and stops at the end, auto-pausing", () => {
    let s = initialReplay;
    for (let i = 0; i < 100; i++) s = replayReducer(s, { type: "next" }, LEN);
    expect(s.cursor).toBe(LEN);
    expect(s.playing).toBe(false);
  });

  it("never goes below zero", () => {
    let s = { cursor: 0, playing: false };
    s = replayReducer(s, { type: "prev" }, LEN);
    expect(s.cursor).toBe(0);
  });

  it("reset returns to the start and pauses", () => {
    const s = replayReducer({ cursor: 10, playing: true }, { type: "reset" }, LEN);
    expect(s).toEqual({ cursor: 0, playing: false });
  });

  it("goto clamps into range", () => {
    expect(replayReducer(initialReplay, { type: "goto", index: 999 }, LEN).cursor).toBe(LEN);
    expect(replayReducer(initialReplay, { type: "goto", index: -5 }, LEN).cursor).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/demo/replay.test.ts`
Expected: FAIL — cannot find `./replay`.

- [ ] **Step 3: Implement**

Create `web/src/lib/demo/replay.ts`:
```ts
export interface ReplayState {
  cursor: number;
  playing: boolean;
}

export type ReplayAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "goto"; index: number };

export const initialReplay: ReplayState = { cursor: 0, playing: false };

const clamp = (n: number, len: number) => Math.max(0, Math.min(len, n));

export function replayReducer(
  state: ReplayState,
  action: ReplayAction,
  length: number,
): ReplayState {
  switch (action.type) {
    case "play":
      return state.cursor >= length ? { cursor: 0, playing: true } : { ...state, playing: true };
    case "pause":
      return { ...state, playing: false };
    case "reset":
      return { cursor: 0, playing: false };
    case "next": {
      const cursor = clamp(state.cursor + 1, length);
      return { cursor, playing: cursor >= length ? false : state.playing };
    }
    case "prev":
      return { ...state, cursor: clamp(state.cursor - 1, length) };
    case "goto":
      return { ...state, cursor: clamp(action.index, length) };
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/demo/replay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/demo/replay.ts web/src/lib/demo/replay.test.ts
git commit -m "feat: replay reducer for the LLM action trace"
```

---

### Task 5: Data + replay hooks

**Files:**
- Create: `web/src/components/demo/use-demo-data.ts`
- Create: `web/src/components/demo/use-replay.ts`

**Interfaces:**
- Consumes: types + `replayReducer`/`initialReplay`.
- Produces: `useDemoData(): { graph: IncidentGraph | null; investigation: Investigation | null; loading: boolean; error: string | null }`; `useReplay(length: number, intervalMs?): { cursor: number; playing: boolean; dispatch: (a: ReplayAction) => void }`.

- [ ] **Step 1: Implement `use-demo-data.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import {
  isIncidentGraph,
  isInvestigation,
  type IncidentGraph,
  type Investigation,
} from "@/lib/demo/types";

export function useDemoData() {
  const [graph, setGraph] = useState<IncidentGraph | null>(null);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/demo/incident-graph.json").then((r) => r.json()),
      fetch("/demo/llm-investigation.json").then((r) => r.json()),
    ])
      .then(([g, inv]) => {
        if (!alive) return;
        if (!isIncidentGraph(g) || !isInvestigation(inv)) {
          setError("Demo data is malformed.");
          return;
        }
        setGraph(g);
        setInvestigation(inv);
      })
      .catch(() => alive && setError("Could not load demo data."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { graph, investigation, loading, error };
}
```

- [ ] **Step 2: Implement `use-replay.ts`**

```ts
"use client";

import { useEffect, useReducer } from "react";
import { initialReplay, replayReducer, type ReplayAction } from "@/lib/demo/replay";

export function useReplay(length: number, intervalMs = 900) {
  const [state, rawDispatch] = useReducer(
    (s: typeof initialReplay, a: ReplayAction) => replayReducer(s, a, length),
    initialReplay,
  );

  useEffect(() => {
    if (!state.playing) return;
    const id = setInterval(() => rawDispatch({ type: "next" }), intervalMs);
    return () => clearInterval(id);
  }, [state.playing, intervalMs]);

  return { cursor: state.cursor, playing: state.playing, dispatch: rawDispatch };
}
```

- [ ] **Step 3: Type-check**

Run: `cd web && pnpm exec tsc --noEmit`
Expected: no errors from these files.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/demo/use-demo-data.ts web/src/components/demo/use-replay.ts
git commit -m "feat: demo data + replay hooks"
```

---

### Task 6: AttackGraph component

**Files:**
- Create: `web/src/components/demo/attack-graph.tsx`

**Interfaces:**
- Consumes: `IncidentGraph`, `layoutGraph`, `TraceEntry` (for the active evidence set).
- Produces: `<AttackGraph graph={IncidentGraph} activeEvidenceIds={Set<string>} />`.

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useMemo } from "react";
import { layoutGraph } from "@/lib/demo/force-layout";
import type { IncidentGraph } from "@/lib/demo/types";

const WIDTH = 820;
const HEIGHT = 620;

const TYPE_COLOR: Record<string, string> = {
  Account: "#ff2b3a",
  Host: "#14141a",
  Process: "#7c3aed",
  File: "#2563eb",
  Event: "#71717a",
  Service: "#0891b2",
  Technique: "#d97706",
  Finding: "#dc2626",
  Group: "#059669",
  Endpoint: "#334155",
};

export function AttackGraph({
  graph,
  activeEvidenceIds,
}: {
  graph: IncidentGraph;
  activeEvidenceIds: Set<string>;
}) {
  const nodes = useMemo(
    () => layoutGraph(graph.nodes, graph.edges, { width: WIDTH, height: HEIGHT, seed: 7 }),
    [graph],
  );
  const pos = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const isActive = (ids: string[]) =>
    activeEvidenceIds.size > 0 && ids.some((id) => activeEvidenceIds.has(id));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full">
      {graph.edges.map((e) => {
        const s = pos.get(e.source);
        const t = pos.get(e.target);
        if (!s || !t) return null;
        const active = isActive(e.evidence_ids);
        return (
          <line
            key={e.id}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke={active ? "#ff2b3a" : "#e5e2da"}
            strokeWidth={active ? 2 : 1}
            opacity={active ? 0.9 : 0.5}
          />
        );
      })}
      {nodes.map((n) => {
        const active = isActive(n.evidence_ids);
        const color = TYPE_COLOR[n.type] ?? "#71717a";
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            <circle
              r={n.properties.ioc ? 9 : 6}
              fill={color}
              stroke={active ? "#ff2b3a" : "#fbfaf7"}
              strokeWidth={active ? 3 : 1.5}
            />
            <text
              x={11}
              y={4}
              fontSize={10}
              fill="#14141a"
              className="font-mono"
              opacity={active ? 1 : 0.7}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/demo/attack-graph.tsx
git commit -m "feat: attack graph SVG component"
```

---

### Task 7: SandboxTrace + KpiBar + ReportPanel

**Files:**
- Create: `web/src/components/demo/sandbox-trace.tsx`
- Create: `web/src/components/demo/kpi-bar.tsx`
- Create: `web/src/components/demo/report-panel.tsx`

**Interfaces:**
- `<SandboxTrace trace={TraceEntry[]} cursor={number} playing={boolean} onControl={(a: ReplayAction) => void} />`
- `<KpiBar stats={TraceStats} />`
- `<ReportPanel analysis={LlmAnalysis} />`

- [ ] **Step 1: Implement `sandbox-trace.tsx`**

```tsx
"use client";

import type { TraceEntry } from "@/lib/demo/types";
import type { ReplayAction } from "@/lib/demo/replay";

export function SandboxTrace({
  trace,
  cursor,
  playing,
  onControl,
}: {
  trace: TraceEntry[];
  cursor: number;
  playing: boolean;
  onControl: (a: ReplayAction) => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-card border border-night-line bg-night text-paper">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/50">
          LLM sandbox · {Math.min(cursor, trace.length)}/{trace.length}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => onControl({ type: playing ? "pause" : "play" })}
            className="rounded border border-white/15 px-2.5 py-1 text-xs hover:border-accent"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => onControl({ type: "next" })}
            className="rounded border border-white/15 px-2.5 py-1 text-xs hover:border-accent"
          >
            Step
          </button>
          <button
            onClick={() => onControl({ type: "reset" })}
            className="rounded border border-white/15 px-2.5 py-1 text-xs hover:border-accent"
          >
            Reset
          </button>
        </div>
      </div>
      <ol className="flex-1 overflow-y-auto px-2 py-2">
        {trace.map((t, i) => {
          const revealed = i < cursor;
          const current = i === cursor - 1;
          return (
            <li
              key={t.tool_call_id}
              className={`rounded px-3 py-2 font-mono text-[12px] transition-opacity ${
                revealed ? "opacity-100" : "opacity-25"
              } ${current ? "bg-white/10" : ""}`}
            >
              <span className="text-white/40">r{t.round}</span>{" "}
              <span className="text-accent">{t.name}</span>
              {t.blocked && <span className="ml-2 text-red-400">BLOCKED</span>}
              {Object.keys(t.arguments).length > 0 && (
                <div className="mt-1 truncate text-white/45">
                  {JSON.stringify(t.arguments)}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Implement `kpi-bar.tsx`**

```tsx
import { SPARK_KPIS, type TraceStats } from "@/lib/demo/kpis";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-hairline bg-white px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-lg font-medium text-ink">{value}</div>
    </div>
  );
}

export function KpiBar({ stats }: { stats: TraceStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
      <Tile label="Model" value={SPARK_KPIS.model} />
      <Tile label="Hardware" value={SPARK_KPIS.hardware} />
      <Tile label="Median TTFT" value={`${SPARK_KPIS.medianTtftSeconds}s`} />
      <Tile label="Decode" value={`${SPARK_KPIS.decodeTokensPerSecond} tok/s`} />
      <Tile label="Tool calls" value={`${stats.toolCalls}`} />
      <Tile label="Blocked" value={`${stats.blocked}`} />
    </div>
  );
}
```

- [ ] **Step 3: Implement `report-panel.tsx`**

```tsx
import type { LlmAnalysis } from "@/lib/demo/types";

export function ReportPanel({ analysis }: { analysis: LlmAnalysis }) {
  return (
    <div className="rounded-card border border-hairline bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-ink">Investigation report</h2>
        <div className="flex gap-4 font-mono text-[11px] uppercase tracking-wider text-muted">
          <span>Exfiltration: {analysis.exfiltration_assessment}</span>
          <span>Confidence: {(analysis.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted">
        {analysis.executive_summary}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `cd web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/demo/sandbox-trace.tsx web/src/components/demo/kpi-bar.tsx web/src/components/demo/report-panel.tsx
git commit -m "feat: sandbox trace, KPI bar and report panel"
```

---

### Task 8: /demo page composition

**Files:**
- Create: `web/src/app/demo/page.tsx`

**Interfaces:**
- Consumes: all demo hooks + components. Computes `activeEvidenceIds` from the trace up to `cursor` (union of `evidence_ids` of revealed actions — but trace entries have no evidence_ids; instead map revealed actions → highlight nodes whose evidence overlaps the arguments is not available, so highlight is driven by cumulative revealed graph reach). See implementation: activeEvidenceIds is the union over revealed nodes selected by round progression — simplest correct behaviour: highlight grows with cursor by revealing graph evidence in node order.

- [ ] **Step 1: Implement**

Note: `tool_trace` entries carry no `evidence_ids`, so highlighting is driven by progress: as the cursor advances, reveal graph nodes proportionally (first `ceil(cursor/len * nodes)` nodes contribute their evidence ids). This keeps the graph visibly reacting to the replay without inventing data.

```tsx
"use client";

import { useMemo } from "react";
import { Topbar } from "@/components/site/topbar";
import { useDemoData } from "@/components/demo/use-demo-data";
import { useReplay } from "@/components/demo/use-replay";
import { AttackGraph } from "@/components/demo/attack-graph";
import { SandboxTrace } from "@/components/demo/sandbox-trace";
import { KpiBar } from "@/components/demo/kpi-bar";
import { ReportPanel } from "@/components/demo/report-panel";
import { deriveTraceStats } from "@/lib/demo/kpis";

export default function DemoPage() {
  const { graph, investigation, loading, error } = useDemoData();
  const trace = investigation?.tool_trace ?? [];
  const { cursor, playing, dispatch } = useReplay(trace.length);

  const stats = useMemo(() => deriveTraceStats(trace), [trace]);

  const activeEvidenceIds = useMemo(() => {
    const ids = new Set<string>();
    if (!graph || trace.length === 0) return ids;
    const revealCount = Math.ceil((cursor / trace.length) * graph.nodes.length);
    graph.nodes.slice(0, revealCount).forEach((n) => n.evidence_ids.forEach((id) => ids.add(id)));
    return ids;
  }, [graph, trace.length, cursor]);

  return (
    <>
      <Topbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        {loading && <p className="font-mono text-sm text-muted">Loading demo…</p>}
        {error && <p className="font-mono text-sm text-accent">{error}</p>}
        {graph && investigation && (
          <div className="flex flex-col gap-6">
            <KpiBar stats={stats} />
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="min-h-[560px] rounded-card border border-hairline bg-paper-2">
                <AttackGraph graph={graph} activeEvidenceIds={activeEvidenceIds} />
              </div>
              <div className="min-h-[560px]">
                <SandboxTrace
                  trace={trace}
                  cursor={cursor}
                  playing={playing}
                  onControl={dispatch}
                />
              </div>
            </div>
            <ReportPanel analysis={investigation.llm_analysis} />
          </div>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 2: Build**

Run: `cd web && pnpm build`
Expected: build succeeds, `/demo` listed as a route.

- [ ] **Step 3: Browser smoke test**

Start `pnpm dev`, open `http://localhost:3000/demo`. Verify: KPI tiles show; graph renders nodes+edges (not a blank frame); clicking Play advances the trace and the graph highlight grows; report shows executive summary + 95% confidence. Take a screenshot and look at it.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/demo/page.tsx
git commit -m "feat: /demo dashboard page"
```

---

### Task 9: Trim landing to hero + "Try demo" CTA

**Files:**
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/components/site/hero.tsx:118-135` (the CTA block)

**Interfaces:**
- Consumes: nothing new. Uses `next/link`.

- [ ] **Step 1: Trim `page.tsx` to Topbar + Hero**

Replace the body of `web/src/app/page.tsx` with:
```tsx
import { Topbar } from "@/components/site/topbar";
import { Hero } from "@/components/site/hero";

export default function Home() {
  return (
    <>
      <Topbar />
      <main className="flex-1">
        <Hero />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Make "Try demo" the primary CTA in `hero.tsx`**

Add `import Link from "next/link";` at the top of `web/src/components/site/hero.tsx`. Replace the CTA `<a href={LINKS.kaggle} …>Read the writeup</a>` (lines ~118-126) with:
```tsx
            <Link
              href="/demo"
              className="inline-flex h-12 items-center gap-3 rounded-md bg-ink px-6 text-sm font-medium tracking-wide text-paper transition-colors hover:bg-accent"
            >
              <Emblem size={18} />
              Try demo
            </Link>
```
Leave the "GitHub repo" secondary link unchanged.

- [ ] **Step 3: Build + smoke**

Run: `cd web && pnpm build`
Then open `http://localhost:3000/`: only the hero shows (no Proof/How/Injection/Exhibit/Close), and "Try demo" navigates to `/demo`.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/page.tsx web/src/components/site/hero.tsx
git commit -m "feat: trim landing to hero with Try demo CTA"
```

---

## Self-Review notes

- **Spec coverage:** landing trim (T9), /demo route (T8), graph (T3+T6), sandbox trace replay (T4+T5+T7), KPIs from Spark (T2+T7), report panel (T7), static data loading + error handling (T5), tokens/consistency (T6-T8), tests for pure logic (T1-T4). All spec sections map to a task.
- **Highlight caveat:** `tool_trace` has no `evidence_ids`; T8 drives graph highlight by replay progress over node order. This is an honest presentation choice (documented in T8), not fabricated per-action evidence.
- **Types:** `TraceStats`, `PositionedNode`, `ReplayState/ReplayAction`, `IncidentGraph/Investigation` names are used consistently across tasks.
- **Commit style:** repo uses Conventional Commits (`feat:`/`test:`); no Claude co-author trailer (per project convention).
```
