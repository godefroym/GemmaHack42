import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { C, F, meta } from "../theme";
import { caret, ease, fade, fadeUp, typed } from "../anim";

const DUR = 240;
const CMD = "./scripts/run-demo.sh eval/fixtures/hospital-demo --serve";
const CMD_AT = 78;

/**
 * Scene 7 · 1:52–2:00 · EVIDENCE GOES IN. NOTHING COMES OUT.
 *
 * The statement letter-spaces open while the seal shrinks into the corner mark. The
 * last 40 frames are a dead hold — it is the frame people screenshot.
 */
export const Close: React.FC = () => {
  const frame = useCurrentFrame();

  const track = ease(frame, [0, 60], [-0.02, 0.1]);

  return (
    <AbsoluteFill
      style={{
        color: C.ink,
        fontFamily: F.sans,
        padding: 132,
        justifyContent: "center",
        opacity: ease(frame, [0, 10], [0, 1]),
      }}
    >
      <Img
        src={staticFile("seal.png")}
        style={{
          position: "absolute",
          top: 110,
          right: 132,
          width: 120,
          height: 120,
          transform: `scale(${ease(frame, [0, 40], [3.2, 1])})`,
          opacity: ease(frame, [0, 24], [0, 1]),
        }}
      />

      <div
        style={{
          fontFamily: F.mono,
          fontSize: 70,
          fontWeight: 700,
          letterSpacing: `${track}em`,
          lineHeight: 1.3,
          opacity: ease(frame, [0, 26], [0, 1]),
        }}
      >
        EVIDENCE GOES IN.
        <br />
        NOTHING COMES OUT.
      </div>

      <div
        style={{
          marginTop: 76,
          fontFamily: F.mono,
          fontSize: 27,
          color: C.muted,
          lineHeight: 1.75,
          minHeight: 96,
        }}
      >
        <div style={fade(frame, 52, 20)}>github.com/godefroym/GemmaHack42</div>
        <div style={{ color: C.ink }}>
          {typed(CMD, frame, CMD_AT, 1.6)}
          {caret(frame, CMD_AT, CMD.length, 1.6) ? <span style={{ opacity: 0.6 }}>▌</span> : null}
        </div>
      </div>

      <div style={{ ...meta(24), marginTop: 64, ...fadeUp(frame, 140, 24, 10) }}>
        Gemma 4 Hackathon — 42 Paris · July 25th 2026
      </div>
    </AbsoluteFill>
  );
};
