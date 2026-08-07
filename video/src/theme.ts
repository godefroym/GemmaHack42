/**
 * Design tokens, lifted verbatim from web/src/app/globals.css so the video and the
 * landing page are the same object. Warm off-white paper, blue-black ink, one red.
 */

export const C = {
  paper: "#fbfaf7",
  paper2: "#f4f2ec",
  ink: "#14141a",
  muted: "#71717a",
  muted2: "#a1a1aa",
  accent: "#ff2b3a",
  accentHover: "#e5142a",
  accentWash: "#fff1f2",
  hairline: "#e5e2da",
  night: "#0b0b11",
  night2: "#16161f",
  nightLine: "#2b2b35",
} as const;

/** Severity ramp, account_created → exfiltration_attempt (src/gemma_ir/render.py). */
export const SEV = ["#ffb454", "#ff9f43", "#e8590c", "#fa5252", "#d6336c"] as const;

export const F = {
  sans: "Geist, ui-sans-serif, system-ui, sans-serif",
  mono: "'Space Mono', ui-monospace, 'SF Mono', monospace",
} as const;

/** The landing page's easing constant (web/README.md). Everything uses this. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const RADIUS = 10;

/** 1920x1080 page margin — generous, this is a case file, not a dashboard. */
export const MARGIN = 132;

/**
 * Mono meta label — the "case-file chrome" style from globals.css .meta.
 * Scaled up for 1080p: 11px on the web reads as ~26px here.
 */
export const meta = (size = 26) =>
  ({
    fontFamily: F.mono,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: C.muted,
  }) as const;
