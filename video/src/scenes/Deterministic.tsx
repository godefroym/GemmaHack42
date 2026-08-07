import { useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { CASE } from "../data/case";
import { Chip, H, Shell } from "./Shell";
import { countTo, ease, fade, fadeUp, mulberry32 } from "../anim";

const DUR = 600;

/* Move boundaries. Each move gets its own 200 frames of the stage. */
const A = 10; // bundle verification
const B = 200; // EV-ID anatomy
const Cc = 400; // graph assembling

/** Cross-fade a stage move in and out so the three never collide. */
const move = (frame: number, start: number, end: number) => ({
  opacity: Math.min(ease(frame, [start, start + 22], [0, 1]), ease(frame, [end - 22, end], [1, 0])),
  position: "absolute" as const,
  inset: 0,
});

/* ------------------------------------------------------------------ move A */

const Verify: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={move(frame, A, B + 10)}>
    <div
      style={{
        fontFamily: F.mono,
        fontSize: 22,
        letterSpacing: "0.1em",
        color: C.muted,
        marginBottom: 26,
      }}
    >
      28 COLLECTED ARTIFACTS · 10,787 SEARCHABLE LINES
    </div>

    {CASE.bundle.map((f, i) => {
      const at = A + 14 + i * 5;
      const done = ease(frame, [at, at + 12], [0, 1]);
      return (
        <div
          key={f.path}
          style={{
            display: "flex",
            gap: 26,
            alignItems: "baseline",
            fontFamily: F.mono,
            fontSize: 23,
            padding: "6px 0",
            ...fade(frame, at - 6, 10),
          }}
        >
          {/* The hash resolves from grey to ink as the file verifies. */}
          <span style={{ width: 200, color: `rgba(20,20,26,${0.25 + done * 0.75})` }}>
            {f.sha}
          </span>
          <span style={{ color: C.ink, flex: 1 }}>{f.path.replace("./", "")}</span>
          <span style={{ color: C.muted, opacity: done }}>verified</span>
        </div>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ move B */

const Anatomy: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ ...move(frame, B, Cc + 10), display: "flex", alignItems: "center" }}>
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: F.mono, fontSize: 22, color: C.muted, marginBottom: 34 }}>
        EVERY LINE GETS AN ID DERIVED FROM ITS OWN CONTENTS
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 22, whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: F.mono, fontSize: 24, color: C.muted, ...fadeUp(frame, B + 10) }}>
          sha256( path : line : text )
        </span>
        <span style={{ color: C.muted, fontSize: 24, ...fade(frame, B + 34) }}>→</span>
        <span style={fade(frame, B + 44)}>
          <Chip tone="accent">{CASE.injection.evidenceId}</Chip>
        </span>
        <span style={{ color: C.muted, fontSize: 24, ...fade(frame, B + 70) }}>→</span>
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 24,
            color: C.ink,
            ...fadeUp(frame, B + 80),
          }}
        >
          {CASE.injection.sourcePath} · line {CASE.injection.lineNumber} · file hash · excerpt
        </span>
      </div>

      <div
        style={{
          marginTop: 40,
          fontSize: 26,
          color: C.muted,
          ...fade(frame, B + 110),
        }}
      >
        Resolvable, or the claim does not stand.
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ move C */

/**
 * 31 nodes and 49 edges, laid out by a seeded PRNG so the constellation is identical
 * on every render, and drawn edge by edge. `observed` edges are solid, `derived` are
 * dashed — the same distinction the graph carries in the data model.
 */
const GRAPH = (() => {
  const rand = mulberry32(0x9e3779b9);
  const nodes = Array.from({ length: 31 }, () => ({
    x: 40 + rand() * 1480,
    y: 30 + rand() * 300,
  }));

  const edges: { a: number; b: number; derived: boolean }[] = [];
  for (let i = 0; i < nodes.length && edges.length < 49; i++) {
    const near = nodes
      .map((n, j) => ({ j, d: (n.x - nodes[i].x) ** 2 + (n.y - nodes[i].y) ** 2 }))
      .filter((n) => n.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    for (const n of near) {
      if (edges.length >= 49) break;
      if (!edges.some((e) => (e.a === i && e.b === n.j) || (e.a === n.j && e.b === i))) {
        edges.push({ a: i, b: n.j, derived: rand() > 0.62 });
      }
    }
  }
  return { nodes, edges };
})();

const Stat: React.FC<{ value: string; label: string; frame: number; at: number }> = ({
  value,
  label,
  frame,
  at,
}) => (
  <div style={fadeUp(frame, at, 22, 14)}>
    <div style={{ fontSize: 88, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1 }}>
      {value}
    </div>
    <div
      style={{
        fontFamily: F.mono,
        fontSize: 21,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: C.muted,
        marginTop: 14,
      }}
    >
      {label}
    </div>
  </div>
);

const Graph: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={move(frame, Cc, DUR + 30)}>
    <svg width={1560} height={360} style={{ overflow: "visible" }}>
      {GRAPH.edges.map((e, i) => {
        const at = Cc + 6 + i * 2.2;
        const p = ease(frame, [at, at + 20], [0, 1]);
        const a = GRAPH.nodes[e.a];
        const b = GRAPH.nodes[e.b];
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={a.x + (b.x - a.x) * p}
            y2={a.y + (b.y - a.y) * p}
            stroke={C.muted2}
            strokeWidth={1}
            strokeDasharray={e.derived ? "6 5" : undefined}
            opacity={0.75}
          />
        );
      })}
      {GRAPH.nodes.map((n, i) => {
        const at = Cc + i * 2.5;
        return (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={ease(frame, [at, at + 14], [0, 4])}
            fill={C.ink}
          />
        );
      })}
    </svg>
  </div>
);

/* ------------------------------------------------------------------- scene */

export const Deterministic: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Shell scene="01 · Reconstruct" kicker="Evidence bundle · pacs-prod-01" duration={DUR}>
      <H style={fadeUp(frame, 4)}>No model has run yet.</H>

      {/* The stage: three moves cross-fading in one fixed region. */}
      <div style={{ position: "relative", flex: 1, marginTop: 54 }}>
        <Verify frame={frame} />
        <Anatomy frame={frame} />
        <Graph frame={frame} />
      </div>

      {/* The result, landing under the graph. Counters settle, never spin. */}
      <div style={{ display: "flex", gap: 118 }}>
        <Stat
          value={String(Math.round(countTo(frame, Cc + 40, 70, 31)))}
          label="graph nodes"
          frame={frame}
          at={Cc + 40}
        />
        <Stat
          value={String(Math.round(countTo(frame, Cc + 52, 70, 49)))}
          label="edges"
          frame={frame}
          at={Cc + 52}
        />
        <Stat value={String(CASE.attackSteps)} label="attack steps" frame={frame} at={Cc + 64} />
        <Stat value="6" label="ATT&CK techniques" frame={frame} at={Cc + 76} />
        <Stat
          value={`${countTo(frame, Cc + 88, 70, 0.73).toFixed(2)} s`}
          label="end to end"
          frame={frame}
          at={Cc + 88}
        />
      </div>
    </Shell>
  );
};
