import { useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { H, Shell } from "./Shell";
import { caret, ease, fade, fadeUp, typed } from "../anim";

const DUR = 450;

/** planner.py _validate_grounding — the checks a report must survive to be accepted. */
const GATE = [
  "at least four evidence citations that resolve",
  "a non-empty observed attack path",
  "the prompt-injection alert, cited",
  "no confirmed exfiltration without external telemetry",
] as const;

/** docs/ARCHITECTURE.md — Scope semantics. */
const STATES = ["not_observed", "attempted_and_blocked", "possible", "confirmed"] as const;

const FAIL = "Investigation failed: <reason>";
const FAIL_AT = 180;

export const NoTheatre: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Shell scene="04 · Validation" duration={DUR}>
      <H style={fadeUp(frame, 4)}>If it cannot cite it, it does not ship.</H>

      <div style={{ display: "flex", gap: 110, marginTop: 54, flex: 1 }}>
        <div style={{ flex: 1.15 }}>
          {GATE.map((g, i) => {
            const at = 30 + i * 30;
            return (
              <div
                key={g}
                style={{
                  display: "flex",
                  gap: 18,
                  alignItems: "baseline",
                  padding: "17px 0",
                  position: "relative",
                  fontSize: 29,
                  ...fade(frame, at, 14),
                }}
              >
                {/* The tick draws as a stroke rather than popping in. */}
                <svg width={20} height={20} style={{ overflow: "visible" }}>
                  <path
                    d="M2 10 L8 16 L18 3"
                    fill="none"
                    stroke={C.muted}
                    strokeWidth={2}
                    strokeDasharray={26}
                    strokeDashoffset={ease(frame, [at + 4, at + 18], [26, 0])}
                  />
                </svg>
                <span>{g}</span>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 1,
                    backgroundColor: C.hairline,
                    transform: `scaleX(${ease(frame, [at, at + 22], [0, 1])})`,
                    transformOrigin: "left",
                  }}
                />
              </div>
            );
          })}

          {/* The honest failure. The only typewriter in the film — which is why it lands. */}
          <div
            style={{
              marginTop: 46,
              fontFamily: F.mono,
              fontSize: 28,
              color: C.accent,
              minHeight: 36,
            }}
          >
            {typed(FAIL, frame, FAIL_AT, 1.4)}
            {caret(frame, FAIL_AT, FAIL.length, 1.4) ? (
              <span style={{ opacity: 0.7 }}>▌</span>
            ) : null}
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: F.mono,
              fontSize: 23,
              color: C.muted,
              ...fade(frame, FAIL_AT + 34, 16),
            }}
          >
            CLI exit code 2 · API HTTP 502
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 25,
              color: C.muted,
              maxWidth: 720,
              lineHeight: 1.45,
              ...fadeUp(frame, FAIL_AT + 52, 22, 10),
            }}
          >
            Static outputs remain available as forensic facts — never presented as
            Gemma&rsquo;s diagnosis.
          </div>
        </div>

        {/* The bounded vocabulary. It cannot say "probably exfiltrated". */}
        <div style={{ flex: 0.8 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 20,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.muted,
              marginBottom: 20,
              ...fade(frame, 270, 16),
            }}
          >
            Exfiltration · four allowed answers
          </div>
          {STATES.map((s, i) => {
            const on = s === "attempted_and_blocked";
            // The right answer settles into accent; the other three stay quiet.
            const sel = on ? ease(frame, [330, 360], [0, 1]) : 0;
            return (
              <div
                key={s}
                style={{
                  fontFamily: F.mono,
                  fontSize: 26,
                  color: on ? `rgba(20,20,26,${0.45 + sel * 0.55})` : C.muted2,
                  border: `1px solid ${on && sel > 0.5 ? C.accent : C.hairline}`,
                  backgroundColor: on ? `rgba(255,241,242,${sel})` : "transparent",
                  borderRadius: 6,
                  padding: "14px 18px",
                  marginBottom: 12,
                  ...fadeUp(frame, 285 + i * 8, 16, 8),
                }}
              >
                {s}
              </div>
            );
          })}
          <div
            style={{
              marginTop: 24,
              fontFamily: F.mono,
              fontSize: 22,
              color: C.muted,
              ...fade(frame, 370, 18),
            }}
          >
            scope: host_only
          </div>
        </div>
      </div>
    </Shell>
  );
};
