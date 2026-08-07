import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, F, MARGIN, meta } from "../theme";
import { ease, fade, sceneFade } from "../anim";

/**
 * The page every scene is printed on. Cream paper, a hairline rule under the running
 * head, and the case-file chrome: case id left, scene marker right.
 *
 * The background is transparent — the paper and the radar live in Pandar.tsx, so they
 * are continuous across cuts. Only what is printed on the page changes.
 */
export const Shell: React.FC<{
  scene: string;
  kicker?: string;
  duration: number;
  children: React.ReactNode;
}> = ({ scene, kicker, duration, children }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        color: C.ink,
        fontFamily: F.sans,
        padding: MARGIN,
        display: "flex",
        flexDirection: "column",
        ...sceneFade(frame, duration),
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingBottom: 22,
          position: "relative",
          ...fade(frame, 0, 14),
        }}
      >
        <span style={meta()}>{kicker ?? "Case hospital-demo"}</span>
        <span style={meta()}>{scene}</span>

        {/* The rule draws in from the left — the first mark on the page. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            backgroundColor: C.hairline,
            transform: `scaleX(${ease(frame, [4, 34], [0, 1])})`,
            transformOrigin: "left",
          }}
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 56 }}>
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** A mono chip — evidence IDs, tool names, statuses. */
export const Chip: React.FC<{
  children: React.ReactNode;
  tone?: "ink" | "accent" | "muted";
  style?: React.CSSProperties;
}> = ({ children, tone = "ink", style }) => {
  const color = tone === "accent" ? C.accent : tone === "muted" ? C.muted : C.ink;
  return (
    <span
      style={{
        fontFamily: F.mono,
        fontSize: 24,
        letterSpacing: "0.04em",
        color,
        border: `1px solid ${tone === "accent" ? C.accent : C.hairline}`,
        backgroundColor: tone === "accent" ? C.accentWash : "transparent",
        borderRadius: 6,
        padding: "8px 14px",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/** Scene headline. One line, tight, never a question. */
export const H: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 76, style }) => (
  <h1
    style={{
      fontSize: size,
      fontWeight: 500,
      letterSpacing: "-0.025em",
      lineHeight: 1.08,
      margin: 0,
      maxWidth: 1400,
      ...style,
    }}
  >
    {children}
  </h1>
);
