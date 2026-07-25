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
