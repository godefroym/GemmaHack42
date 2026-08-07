import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "./theme";

/**
 * PANDAR is "the radar inside Pandora's box". This is that radar, running
 * continuously underneath all seven scenes — one sweep every 12 seconds, at an
 * opacity where you notice it only if you look for it.
 *
 * It is the one continuous element in a film made of hard cuts, and it is what
 * keeps the seven scenes reading as one object.
 */
export const Radar: React.FC = () => {
  const frame = useCurrentFrame();
  const angle = (frame / 360) * 360; // one revolution per 12 s

  const cx = 1560;
  const cy = 540;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1920} height={1080} style={{ opacity: 0.05 }}>
        <defs>
          <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0" />
            <stop offset="100%" stopColor={C.accent} stopOpacity="1" />
          </linearGradient>
        </defs>

        {[220, 400, 580, 760].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={C.ink} strokeWidth={1} />
        ))}

        <g transform={`rotate(${angle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy} x2={cx + 760} y2={cy} stroke="url(#sweep)" strokeWidth={2} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
