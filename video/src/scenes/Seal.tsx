import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, meta } from "../theme";
import { ease, fadeUp, sceneFade } from "../anim";

const DUR = 360;

/**
 * Scene 1 · 0:00–0:12 · the evidence is sealed, and it stays here.
 *
 * The seal is *pressed*, not faded — it is the only spring in the film besides the
 * scene-4 stamps, and it earns it: the whole product is a chain-of-custody argument.
 * Four seconds of stillness at the end. It reads as a document, not a slide.
 */
export const Seal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const press = spring({ frame, fps, config: { damping: 14, mass: 0.9 }, durationInFrames: 26 });
  const scale = ease(press, [0, 1], [1.06, 1]);

  // The ring settles a beat behind the seal, then vanishes — a press, not a pulse.
  const ring = ease(frame, [6, 34], [1.14, 1]);
  const ringOpacity = frame < 34 ? ease(frame, [6, 20], [0, 0.45]) : ease(frame, [34, 52], [0.45, 0]);

  return (
    <AbsoluteFill
      style={{
        color: C.ink,
        fontFamily: F.sans,
        alignItems: "center",
        justifyContent: "center",
        gap: 56,
        ...sceneFade(frame, DUR),
      }}
    >
      <div style={{ position: "relative", width: 420, height: 420 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${C.accent}`,
            transform: `scale(${ring})`,
            opacity: ringOpacity,
          }}
        />
        <Img
          src={staticFile("seal.png")}
          style={{
            width: 420,
            height: 420,
            transform: `scale(${scale})`,
            opacity: ease(frame, [0, 12], [0, 1]),
          }}
        />
      </div>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 92,
            fontWeight: 700,
            // The wordmark opens out of the seal's own tracking as it settles.
            letterSpacing: `${ease(frame, [24, 64], [0.1, 0.24])}em`,
            textIndent: `${ease(frame, [24, 64], [0.1, 0.24])}em`,
            ...fadeUp(frame, 24, 20, 12),
          }}
        >
          PANDAR
        </div>
        <div style={{ ...meta(28), marginTop: 26, ...fadeUp(frame, 40, 20, 10) }}>
          Local-first · Read-only · SHA-256 sourced
        </div>
      </div>
    </AbsoluteFill>
  );
};
