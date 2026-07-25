"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* PANDAR emblem — a radar sweep boxed inside a sealed square.
   The box is Pandora's box, the arc is the sweep, the red dot is the blip. */
export function Emblem({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="PANDAR emblem"
    >
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="4"
        fill="currentColor"
        opacity="0.06"
      />
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4.5 13.5a6 6 0 0 1 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M4.5 8a11.5 11.5 0 0 1 11.5 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.2"
      />
      <path
        d="M4.6 19.4 17.5 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="14.2" cy="9.8" r="2.7" fill="var(--accent)" />
    </svg>
  );
}

/* The severity ramp, lifted from render.py's EVENT_COLORS.
   Sits at the very bottom of the page as the brand footer bar. */
const SEV = [
  "var(--sev-1)",
  "var(--sev-2)",
  "var(--sev-3)",
  "var(--sev-4)",
  "var(--sev-5)",
];

export function SeverityStrip({ barHeight = 4 }: { barHeight?: number }) {
  return (
    <div aria-hidden="true">
      {SEV.map((c) => (
        <div key={c} style={{ height: barHeight, background: c }} />
      ))}
    </div>
  );
}

export function SeverityDots({ active = 5 }: { active?: number }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {SEV.map((c, i) => (
        <span
          key={c}
          className="h-2 w-2 rounded-[1px] transition-opacity"
          style={{ background: c, opacity: i < active ? 1 : 0.18 }}
        />
      ))}
    </div>
  );
}

/* Radar scatter — deterministic (seeded) blips fanning out of a corner, the
   quiet decorative counterpart to the sweep. Server and client agree. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCATTER_COLORS = [
  "var(--sev-1)",
  "var(--sev-2)",
  "var(--sev-3)",
  "var(--sev-4)",
  "var(--sev-5)",
];

export function RadarScatter({
  corner,
  seed = 7,
  count = 30,
  spread = 220,
}: {
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  seed?: number;
  count?: number;
  spread?: number;
}) {
  // Decorative only — mount-gated so the seeded layout is never part of the
  // server-rendered HTML that React has to reconcile.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rand = mulberry32(seed);
  const blips = Array.from({ length: count }, (_, i) => {
    const d = Math.sqrt(rand()) * spread;
    const angle = rand() * (Math.PI / 2);
    const size = rand() < 0.28 ? 8 : rand() < 0.62 ? 6 : 4;
    return {
      key: i,
      x: Math.cos(angle) * d,
      y: Math.sin(angle) * d,
      size,
      color: SCATTER_COLORS[Math.floor(rand() * SCATTER_COLORS.length)],
    };
  });

  const anchor = {
    "top-left": { top: 0, left: 0 },
    "top-right": { top: 0, right: 0 },
    "bottom-left": { bottom: 0, left: 0 },
    "bottom-right": { bottom: 0, right: 0 },
  }[corner];
  const fromRight = corner.endsWith("right");
  const fromBottom = corner.startsWith("bottom");

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ ...anchor, width: spread, height: spread }}
    >
      {blips.map((b) => (
        <div
          key={b.key}
          className="absolute rounded-[1px]"
          style={{
            [fromRight ? "right" : "left"]: b.x,
            [fromBottom ? "bottom" : "top"]: b.y,
            width: b.size,
            height: b.size,
            background: b.color,
          }}
        />
      ))}
    </div>
  );
}

/* Fade-and-rise on first view. Small on purpose. */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px -6% 0px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* Section header: mono index in accent, then the title. */
export function SectionHead({
  index,
  kicker,
  title,
  children,
  dark = false,
}: {
  index: string;
  kicker: string;
  title: ReactNode;
  children?: ReactNode;
  dark?: boolean;
}) {
  return (
    <Reveal>
      <p className="meta flex items-center gap-2.5">
        <span className="text-accent">{index}</span>
        <span className={dark ? "text-white/45" : undefined}>{kicker}</span>
      </p>
      <h2
        className={`mt-5 max-w-2xl text-balance text-3xl font-medium leading-[1.06] tracking-[-0.025em] sm:text-4xl md:text-[44px] ${
          dark ? "text-paper" : ""
        }`}
      >
        {title}
      </h2>
      {children}
    </Reveal>
  );
}

/* Animated measure bar for the benchmark comparison. */
export function Bar({
  value,
  max,
  tone = "ink",
  delay = 0,
  track = "light",
}: {
  value: number;
  max: number;
  tone?: "ink" | "accent" | "paper";
  delay?: number;
  track?: "light" | "dark";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill =
    tone === "accent" ? "bg-accent" : tone === "paper" ? "bg-paper" : "bg-ink";
  return (
    <div
      ref={ref}
      className={`h-1.5 w-full overflow-hidden rounded-full ${
        track === "dark" ? "bg-white/12" : "bg-ink/10"
      }`}
    >
      <motion.div
        className={`h-full rounded-full ${fill}`}
        initial={{ width: 0 }}
        animate={inView ? { width: `${pct}%` } : undefined}
        transition={{ duration: 1, delay, ease: EASE }}
      />
    </div>
  );
}

/* Small pill used for tool names and technique IDs. */
export function Chip({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "dark" | "accent";
}) {
  const tones = {
    light: "border-hairline bg-white text-ink",
    dark: "border-night-line bg-night-2 text-white/70",
    accent: "border-accent/35 bg-accent-wash text-accent-hover",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1.5 font-mono text-[11.5px] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Dashes({ n = 16 }: { n?: number }) {
  return (
    <p className="dashes" aria-hidden="true">
      {"– ".repeat(n)}
    </p>
  );
}
