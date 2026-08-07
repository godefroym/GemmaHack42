import { Composition } from "remotion";
import { Pandar } from "./Pandar";

/**
 * 120.000 s at 30 fps = 3600 frames exactly. The scene boundaries in Pandar.tsx are
 * the contract with VO.txt — if you move one, move the narration with it.
 */
export const Root: React.FC = () => (
  <Composition
    id="Pandar"
    component={Pandar}
    durationInFrames={3600}
    fps={30}
    width={1920}
    height={1080}
  />
);
