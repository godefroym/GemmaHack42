import { useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { H, Shell } from "./Shell";
import { ease, fade, fadeUp } from "../anim";

const DUR = 450;

/**
 * Source: eval/SPARK-RESULTS.md, measured on a physical DGX Spark, raw JSON in
 * eval/results/. Do not use the stale README line claiming no Spark measurement.
 */
const ROWS = [
  {
    model: "Gemma 4 E4B",
    where: "analyst laptop · Ollama",
    score: 54,
    pct: "62.1%",
    critical: "3 / 11",
    tps: "24.4 tok/s",
    accent: false,
    at: 40,
  },
  {
    model: "Gemma 4 26B-A4B",
    where: "DGX Spark · on-premise · bf16",
    score: 79,
    pct: "90.8%",
    critical: "9 / 11",
    tps: "24.0 tok/s",
    accent: true,
    at: 100,
  },
];

export const OneNumber: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Shell scene="05 · Measured" kicker="87 weighted checks · 4 synthetic cases" duration={DUR}>
      {/* 79 − 54 = 25 checks. Not "twenty-nine" — that would be 28.7 percentage points
          rounded up, and the bars on screen are counting checks, not percent. */}
      <H style={fadeUp(frame, 4)}>Same speed. Twenty-five points better.</H>

      <div style={{ marginTop: 62, flex: 1 }}>
        {ROWS.map((r) => {
          const grow = ease(frame, [r.at + 30, r.at + 120], [0, 1]);
          return (
            <div key={r.model} style={{ marginBottom: 52 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  ...fadeUp(frame, r.at, 20, 10),
                }}
              >
                <div>
                  <span style={{ fontSize: 38, fontWeight: 500 }}>{r.model}</span>
                  <span
                    style={{ fontFamily: F.mono, fontSize: 23, color: C.muted, marginLeft: 20 }}
                  >
                    {r.where}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 40, alignItems: "baseline" }}>
                  <span style={{ fontFamily: F.mono, fontSize: 23, color: C.muted }}>
                    {r.critical} critical
                  </span>
                  {/* Fixed width so 24.4 and 24.0 land on the same tick. That
                      alignment is the shot — nothing points at it. */}
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 30,
                      color: C.ink,
                      width: 190,
                      textAlign: "right",
                    }}
                  >
                    {r.tps}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 18 }}>
                <div
                  style={{
                    flex: 1,
                    height: 26,
                    backgroundColor: C.paper2,
                    borderRadius: 4,
                    ...fade(frame, r.at + 22, 14),
                  }}
                >
                  <div
                    style={{
                      width: `${(r.score / 87) * 100}%`,
                      height: "100%",
                      borderRadius: 4,
                      backgroundColor: r.accent ? C.accent : C.muted2,
                      transform: `scaleX(${grow})`,
                      transformOrigin: "left",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: 34,
                    width: 300,
                    whiteSpace: "nowrap",
                    color: r.accent ? C.accent : C.muted,
                    ...fade(frame, r.at + 105, 20),
                  }}
                >
                  {r.score}/87 · {r.pct}
                </span>
              </div>
            </div>
          );
        })}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderTop: `1px solid ${C.hairline}`,
            paddingTop: 28,
            ...fadeUp(frame, 280, 24, 10),
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 27, color: C.muted }}>
            Cloud — not deployable
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 27, color: C.ink }}>
            0 B left the network
          </span>
        </div>
      </div>
    </Shell>
  );
};
