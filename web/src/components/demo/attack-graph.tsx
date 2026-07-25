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
