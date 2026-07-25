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
