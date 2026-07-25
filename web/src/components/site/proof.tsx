"use client";

import ScrambleText from "@/components/originkit/scramble-text";
import { Bar, RadarScatter, Reveal } from "./kit";
import { PROOF, STATS } from "@/lib/content";

/* Inverted band. The jury brief says numbers beat adjectives, so the numbers
   get the loudest surface on the page. */
export function Proof() {
  return (
    <section id="proof" className="relative overflow-hidden bg-night text-paper">
      <RadarScatter corner="top-right" seed={11} count={22} spread={200} />

      {/* Stat strip */}
      <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-y-10 border-b border-night-line px-6 py-14 md:px-10 lg:grid-cols-4 lg:gap-y-0">
        {STATS.map((s, i) => (
          <Reveal
            key={s.label}
            delay={i * 0.07}
            className={`lg:px-8 lg:first:pl-0 lg:last:pr-0 ${
              i % 2 === 1 ? "border-l border-night-line pl-6 lg:pl-8" : ""
            } ${i === 2 ? "lg:border-l lg:border-night-line" : ""} ${
              i === 1 ? "lg:border-l lg:border-night-line" : ""
            } ${i === 3 ? "lg:border-l lg:border-night-line" : ""}`}
          >
            <p className="flex items-baseline gap-1">
              <span className="text-[38px] font-medium leading-none tracking-[-0.04em] md:text-[46px]">
                {s.value}
              </span>
              <span className="font-mono text-base text-accent">{s.unit}</span>
            </p>
            <p className="mt-4 max-w-[15rem] text-[13.5px] font-medium leading-snug text-paper">
              {s.label}
            </p>
            <p className="mt-2 max-w-[15rem] font-mono text-[10.5px] leading-relaxed text-white/40">
              {s.note}
            </p>
          </Reveal>
        ))}
      </div>

      {/* Comparison */}
      <div className="relative mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <Reveal>
              <p className="meta flex items-center gap-2.5">
                <span className="text-accent">02</span>
                <span className="text-white/45">{PROOF.kicker}</span>
              </p>
            </Reveal>

            {/* Origin Kit — Scramble Text: the headline decodes into place. */}
            <Reveal delay={0.05}>
              <div className="mt-5 h-[2.4em] w-full">
                <ScrambleText
                  words={PROOF.title}
                  color="#fbfaf7"
                  tag="div"
                  font={{
                    fontFamily: "var(--font-geist), sans-serif",
                    fontWeight: 500,
                    fontSize: "clamp(28px, 3.6vw, 44px)",
                    lineHeight: "1.08em",
                    letterSpacing: "-0.025em",
                  }}
                  enterAnimation={{
                    mode: "oneLine",
                    restState: "solid",
                    replay: false,
                    position: "above",
                    scrambleIntensity: 100,
                    ease: { type: "tween", duration: 1.5, ease: "linear" },
                    flickerEnabled: true,
                    flickerColor: "#ff2b3a",
                    flickerIntensity: 70,
                    flickerSpeed: 12,
                  }}
                  hoverAnimation={{
                    type: "diffusion",
                    lines: "oneLine",
                    radius: 2,
                    collapse: true,
                    collapseTime: 0.8,
                    glitchChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                    glitchShuffle: true,
                    flickerEnabled: true,
                    flickerColor: "#ff2b3a",
                    flickerIntensity: 50,
                    flickerSpeed: 14,
                  }}
                />
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-md text-[15.5px] leading-relaxed text-white/55">
                {PROOF.body}
              </p>
            </Reveal>

            {/* End-to-end runs, including the honest fallback row. */}
            <Reveal delay={0.14}>
              <div className="mt-10 rounded-card border border-night-line bg-night-2 p-5">
                <p className="meta text-white/40">
                  End-to-end, sealed hospital-demo bundle
                </p>
                <ul className="mt-4">
                  {PROOF.runs.map((r, i) => (
                    <li
                      key={r.config}
                      className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 ${
                        i > 0 ? "border-t border-white/8" : ""
                      }`}
                    >
                      <span className="text-[13.5px] font-medium text-paper">
                        {r.config}
                      </span>
                      <span className="font-mono text-[13px] tabular-nums text-accent">
                        {r.time}
                      </span>
                      <span className="w-full font-mono text-[11px] text-white/40">
                        {r.result}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* Model cards + per-case bars */}
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              {PROOF.models.map((m, i) => {
                const hot = m.tone === "accent";
                return (
                  <Reveal key={m.name} delay={i * 0.08}>
                    <div
                      className={`h-full rounded-card border p-5 ${
                        hot
                          ? "border-accent/45 bg-accent/8"
                          : "border-night-line bg-night-2"
                      }`}
                    >
                      <p className="meta text-white/45">{m.name}</p>
                      <p
                        className={`mt-4 text-[36px] font-medium leading-none tracking-[-0.04em] ${
                          hot ? "text-accent" : "text-paper"
                        }`}
                      >
                        {m.pct}
                      </p>
                      <div className="mt-4">
                        <Bar
                          value={m.score}
                          max={m.max}
                          tone={hot ? "accent" : "paper"}
                          track="dark"
                          delay={0.15 + i * 0.1}
                        />
                      </div>
                      <p className="mt-4 font-mono text-[11px] text-white/50">
                        {m.score}/{m.max} checks · {m.critical} critical
                      </p>
                      <p className="mt-1.5 font-mono text-[10.5px] text-white/35">
                        {m.detail}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            <Reveal delay={0.1}>
              <div className="mt-8">
                <div className="flex items-center justify-between gap-4 border-b border-night-line pb-3">
                  <p className="meta text-white/40">Per case</p>
                  <p className="meta text-white/40">
                    <span className="text-white/60">E4B</span> vs{" "}
                    <span className="text-accent">31B</span>
                  </p>
                </div>
                <ul>
                  {PROOF.cases.map((c, i) => (
                    <li
                      key={c.name}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2.5 border-b border-white/8 py-4"
                    >
                      <span className="text-[13.5px] font-medium text-paper">
                        {c.name}
                      </span>
                      <span className="font-mono text-[11.5px] tabular-nums text-white/45">
                        {c.e4b} <span className="text-white/25">→</span>{" "}
                        <span className="text-accent">{c.big}</span> / {c.max}
                      </span>
                      <div className="col-span-2 space-y-1.5">
                        <Bar
                          value={c.e4b}
                          max={c.max}
                          tone="paper"
                          track="dark"
                          delay={i * 0.05}
                        />
                        <Bar
                          value={c.big}
                          max={c.max}
                          tone="accent"
                          track="dark"
                          delay={i * 0.05 + 0.08}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>

        <Reveal delay={0.05}>
          <p className="mt-14 max-w-4xl font-mono text-[10.5px] leading-[1.9] text-white/35">
            {PROOF.caveats}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
