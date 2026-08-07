import { Easing, interpolate } from "remotion";

/**
 * One easing curve for the whole film — the landing page's constant.
 * Using a single curve everywhere is most of what makes a piece feel authored
 * rather than assembled.
 */
export const EASE_FN = Easing.bezier(0.22, 1, 0.36, 1);

type Opts = { easing?: (t: number) => number };

/** interpolate with the house curve and clamped extrapolation, always. */
export const ease = (
  frame: number,
  [f0, f1]: [number, number],
  [v0, v1]: [number, number],
  opts: Opts = {},
) =>
  interpolate(frame, [f0, f1], [v0, v1], {
    easing: opts.easing ?? EASE_FN,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** The workhorse entrance: rise and fade. Nothing in this film slides sideways. */
export const fadeUp = (frame: number, start: number, dur = 20, dy = 16) => ({
  opacity: ease(frame, [start, start + dur], [0, 1]),
  transform: `translateY(${ease(frame, [start, start + dur], [dy, 0])}px)`,
});

/** Fade only — for anything already in position. */
export const fade = (frame: number, start: number, dur = 18) => ({
  opacity: ease(frame, [start, start + dur], [0, 1]),
});

/**
 * Content fade at scene boundaries. The paper never flashes; only what is printed
 * on it changes. 10f in, 8f out.
 */
export const sceneFade = (frame: number, duration: number) => ({
  opacity: Math.min(
    ease(frame, [0, 10], [0, 1]),
    ease(frame, [duration - 8, duration], [1, 0]),
  ),
});

/** A number that runs and *lands*. The last frames are the settle, never a spin. */
export const countTo = (frame: number, start: number, dur: number, value: number) =>
  ease(frame, [start, start + dur], [0, value]);

/**
 * Characters revealed over time. Used exactly twice in the film — the failure line
 * in scene 5 and the command in scene 7 — so that it reads as emphasis, not decoration.
 */
export const typed = (text: string, frame: number, start: number, charsPerFrame = 2) => {
  const n = Math.floor(Math.max(0, frame - start) * charsPerFrame);
  return text.slice(0, n);
};

/** Blinking caret for the typed lines. Stops once the text is complete. */
export const caret = (frame: number, start: number, len: number, cpf = 2) =>
  frame < start + len / cpf + 20 && Math.floor(frame / 8) % 2 === 0;

/** Deterministic PRNG so the scene-2 graph layout is identical on every render. */
export const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
