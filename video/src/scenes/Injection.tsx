import { useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { CASE } from "../data/case";
import { Chip, H, Shell } from "./Shell";
import { ease, fade, fadeUp } from "../anim";

const DUR = 750;

/* Beats, relative to the scene. See STORYBOARD.md. */
const LAND = 0; //   the line arrives, then 90 frames of nothing
const SWEEP = 90; //  the light crosses it
const STAMPS = 220; // type → decision → evidence ID
const SPLIT = 430; //  kept in the timeline, refused by the attack path
const RECEIPT = 620; // what the model actually filed

const HIGHLIGHT = ["SYSTEM INSTRUCTION", "delete_evidence"];

/** Splits the raw journal line so the two payload fragments can bloom. */
const marked = (line: string, red: boolean) => {
  const pattern = new RegExp(`(${HIGHLIGHT.join("|")})`, "g");
  return line.split(pattern).map((part, i) =>
    HIGHLIGHT.includes(part) ? (
      <span key={i} style={{ color: red ? C.accent : "inherit", fontWeight: red ? 700 : 400 }}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
};

const LOG_STYLE: React.CSSProperties = {
  fontFamily: F.mono,
  fontSize: 27,
  lineHeight: 1.65,
  wordBreak: "break-word",
};

/**
 * The split: the injection stays in the timeline because it happened, and the attack
 * path routes around it. This is the thesis of the whole product in one diagram.
 */
const Split: React.FC<{ frame: number }> = ({ frame }) => {
  const slots = 9;
  const injectionAt = 7; // the injection sits between staging and the blocked transfer
  const x = (i: number) => 210 + i * 84;
  const draw = ease(frame, [SPLIT, SPLIT + 70], [0, 1]);

  const row = (y: number, label: string, skip: boolean) => (
    <>
      <text x={0} y={y + 6} fontFamily={F.mono} fontSize={19} fill={C.muted} letterSpacing="0.1em">
        {label}
      </text>
      {Array.from({ length: slots }).map((_, i) => {
        if (i === slots - 1) return null;
        const gap = skip && (i === injectionAt - 1 || i === injectionAt);
        const x2 = x(i) + (x(i + 1) - x(i)) * draw;
        return (
          <line
            key={i}
            x1={x(i)}
            y1={y}
            x2={x2}
            y2={y}
            stroke={gap ? C.muted2 : C.ink}
            strokeWidth={gap ? 1 : 1.5}
            strokeDasharray={gap ? "4 6" : undefined}
            opacity={gap ? 0.5 : 0.9}
          />
        );
      })}
      {Array.from({ length: slots }).map((_, i) => {
        const isInj = i === injectionAt;
        if (skip && isInj) return null;
        const r = ease(frame, [SPLIT + i * 5, SPLIT + i * 5 + 16], [0, isInj ? 7 : 5]);
        return (
          <circle
            key={i}
            cx={x(i)}
            cy={y}
            r={r}
            fill={isInj ? C.accentWash : C.ink}
            stroke={isInj ? C.accent : "none"}
            strokeWidth={2}
          />
        );
      })}
    </>
  );

  return (
    <svg width={1100} height={140} style={{ ...fade(frame, SPLIT, 24), overflow: "visible" }}>
      {row(28, "TIMELINE", false)}
      {row(104, "ATTACK PATH", true)}
    </svg>
  );
};

export const Injection: React.FC = () => {
  const frame = useCurrentFrame();

  // The light crosses the block left to right, and what it touches stays red.
  // Linear, not the house curve — a sweeping light travels at constant speed.
  const sweep = ease(frame, [SWEEP, SWEEP + 120], [-14, 116], { easing: (t) => t });

  const stamp = (i: number) => {
    const at = STAMPS + i * 46;
    // A 2px overshoot on landing — the only bounce in the film besides the seal.
    const s = ease(frame, [at, at + 12], [0.94, 1.02]) * ease(frame, [at + 12, at + 22], [1, 0.98]);
    return { ...fade(frame, at, 12), transform: `scale(${s})` };
  };

  return (
    <Shell
      scene="03 · Hostile evidence"
      kicker={`${CASE.injection.sourcePath} · line ${CASE.injection.lineNumber}`}
      duration={DUR}
    >
      <H style={fadeUp(frame, 4)}>The attacker wrote a prompt.</H>
      <H style={{ color: C.muted, ...fadeUp(frame, 18) }}>We read it as evidence.</H>

      {/* The payload, verbatim from the fixture. It never types itself in — an
          attacker's instruction typing onto the screen is the drama this refuses. */}
      <div
        style={{
          marginTop: 58,
          position: "relative",
          border: `1px solid ${C.hairline}`,
          borderLeft: `4px solid ${C.accent}`,
          backgroundColor: C.paper2,
          borderRadius: 8,
          padding: "34px 40px",
          overflow: "hidden", // keeps the sweeping light inside the card
          ...fadeUp(frame, LAND, 26, 10),
        }}
      >
        {/* Base: the line as ordinary, unremarkable log text. */}
        <div style={{ ...LOG_STYLE, color: C.muted }}>{marked(CASE.injection.line, false)}</div>

        {/* Bloom: the same line, revealed left to right as the light crosses it. */}
        <div
          style={{
            ...LOG_STYLE,
            color: C.ink,
            position: "absolute",
            top: 34,
            left: 40,
            right: 40,
            maskImage: `linear-gradient(90deg, #000 ${sweep - 9}%, transparent ${sweep + 3}%)`,
            WebkitMaskImage: `linear-gradient(90deg, #000 ${sweep - 9}%, transparent ${sweep + 3}%)`,
          }}
        >
          {marked(CASE.injection.line, true)}
        </div>

        {/* The light itself. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${sweep - 6}%`,
            width: 260,
            background: `linear-gradient(90deg, transparent, ${C.accent}22, transparent)`,
            opacity: frame > SWEEP && frame < SWEEP + 130 ? 1 : 0,
          }}
        />
      </div>

      {/* How the product typed it. */}
      <div style={{ display: "flex", gap: 20, marginTop: 44, alignItems: "center" }}>
        <span style={stamp(0)}>
          <Chip>type: {CASE.policyAlert.type}</Chip>
        </span>
        <span style={stamp(1)}>
          <Chip tone="accent">decision: {CASE.policyAlert.decision}</Chip>
        </span>
        <span style={stamp(2)}>
          <Chip>{CASE.policyAlert.evidenceId}</Chip>
        </span>
      </div>

      <div style={{ marginTop: 34 }}>
        <Split frame={frame} />
      </div>

      {/* The receipt: what the model actually filed on the real VM run. */}
      {CASE.llmRun.injectionFinding ? (
        <div
          style={{
            marginTop: "auto",
            borderTop: `1px solid ${C.hairline}`,
            paddingTop: 26,
            display: "flex",
            gap: 20,
            alignItems: "baseline",
            ...fadeUp(frame, RECEIPT, 30, 12),
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 23, color: C.accent }}>
            {CASE.llmRun.injectionFinding.id}
          </span>
          <span style={{ fontSize: 27, color: C.ink, lineHeight: 1.4 }}>
            “{CASE.llmRun.injectionFinding.description}”
          </span>
        </div>
      ) : null}
    </Shell>
  );
};
