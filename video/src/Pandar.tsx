import { AbsoluteFill, Series } from "remotion";
import { useFonts } from "./fonts";
import { C } from "./theme";
import { Radar } from "./Radar";
import { Seal } from "./scenes/Seal";
import { Deterministic } from "./scenes/Deterministic";
import { Keyhole } from "./scenes/Keyhole";
import { Injection } from "./scenes/Injection";
import { NoTheatre } from "./scenes/NoTheatre";
import { OneNumber } from "./scenes/OneNumber";
import { Close } from "./scenes/Close";

/**
 * Seven scenes, 3600 frames. Durations are the beat sheet in SCRIPT.md:
 *
 *   Seal          360   0:00–0:12
 *   Deterministic 600   0:12–0:32
 *   Keyhole       750   0:32–0:57
 *   Injection     750   0:57–1:22   <- centrepiece, slowest, most air
 *   NoTheatre     450   1:22–1:37
 *   OneNumber     450   1:37–1:52
 *   Close         240   1:52–2:00
 */
export const Pandar: React.FC = () => {
  useFonts();

  return (
    <AbsoluteFill style={{ backgroundColor: C.paper }}>
      <Radar />
      <Scenes />
    </AbsoluteFill>
  );
};

const Scenes: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={360}>
      <Seal />
    </Series.Sequence>
    <Series.Sequence durationInFrames={600}>
      <Deterministic />
    </Series.Sequence>
    <Series.Sequence durationInFrames={750}>
      <Keyhole />
    </Series.Sequence>
    <Series.Sequence durationInFrames={750}>
      <Injection />
    </Series.Sequence>
    <Series.Sequence durationInFrames={450}>
      <NoTheatre />
    </Series.Sequence>
    <Series.Sequence durationInFrames={450}>
      <OneNumber />
    </Series.Sequence>
    <Series.Sequence durationInFrames={240}>
      <Close />
    </Series.Sequence>
  </Series>
);
