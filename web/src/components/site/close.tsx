"use client";

import DynamicWeight from "@/components/originkit/dynamic-weight";
import {
  Emblem,
  RadarScatter,
  Reveal,
  SeverityStrip,
} from "./kit";
import { CLOSE, LINKS, META } from "@/lib/content";

export function Close() {
  return (
    <>
      {/* Origin Kit — Dynamic Weight. Each letter's variable weight tracks the
          cursor, so the sentence thickens wherever you are reading. */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:px-10 md:py-20">
          <Reveal>
            <span className="sr-only">{CLOSE.statement}</span>
            <div
              aria-hidden
              className="h-[3.4em] w-full [&_span]:!text-[clamp(24px,5.6vw,74px)] [&>div]:!cursor-crosshair sm:h-[2.7em] md:h-[2.3em]"
            >
              <DynamicWeight
                label={CLOSE.statement}
                fromWeight={200}
                toWeight={800}
                strength={26}
                fontSize={74}
                color="#14141a"
                transition={{ type: "tween", duration: 0.26, ease: "easeOut" }}
                style={{ letterSpacing: "-0.03em" }}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Run-it-yourself band. */}
      <section
        id="run"
        className="relative overflow-hidden bg-night text-paper"
      >
        <RadarScatter corner="bottom-right" seed={53} count={28} spread={240} />

        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 md:px-10 md:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <Reveal>
            <p className="meta flex items-center gap-2.5">
              <span className="text-accent">06</span>
              <span className="text-white/45">Run it yourself</span>
            </p>
            <h2 className="mt-5 text-4xl font-medium leading-[1.05] tracking-[-0.03em] md:text-[46px]">
              {CLOSE.title}
            </h2>
            <p className="mt-6 max-w-md text-[15.5px] leading-relaxed text-white/55">
              {CLOSE.body}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href={LINKS.kaggle}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-3 rounded-md bg-accent px-6 text-sm font-medium tracking-wide text-white transition-colors hover:bg-accent-hover"
              >
                Kaggle writeup
              </a>
              <a
                href={LINKS.repo}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center rounded-md border border-white/20 px-5 text-sm font-medium tracking-wide text-paper transition-colors hover:border-paper hover:bg-paper hover:text-ink"
              >
                GitHub repo
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-card border border-night-line bg-night-2">
              <div className="flex items-center gap-2.5 border-b border-night-line px-5 py-3.5">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <p className="meta text-white/40">
                  no gpu · no network · sealed fixture
                </p>
              </div>
              <pre className="overflow-x-auto px-5 py-6 font-mono text-[12.5px] leading-[2.1] text-white/85">
                {CLOSE.commands.map((c) => (
                  <div key={c}>
                    {c.startsWith("#") ? (
                      <span className="text-white/30">{c}</span>
                    ) : (
                      <>
                        <span className="mr-3 select-none text-accent">$</span>
                        {c}
                      </>
                    )}
                  </div>
                ))}
              </pre>
            </div>
            <p className="mt-4 font-mono text-[10.5px] leading-relaxed text-white/35">
              The deterministic path satisfied every fixture assertion in 5 ms
              with no model loaded — so the demo is reachable by someone who is
              not us.
            </p>
          </Reveal>
        </div>

        <div className="relative border-t border-night-line">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
            <div className="flex items-center gap-2.5">
              <span className="text-paper">
                <Emblem size={22} />
              </span>
              <span className="font-mono text-[13px] font-bold">
                PANDAR<span className="text-accent">_</span>
              </span>
              <span className="ml-2 hidden font-mono text-[11px] text-white/35 sm:inline">
                {META.tagline}
              </span>
            </div>
            <p className="max-w-lg font-mono text-[10px] leading-relaxed text-white/30 md:text-right">
              Built at the {META.event}. Prototype on synthetic evidence — not a
              clinical or forensic validation. Animated components from
              originkit.dev.
            </p>
          </div>
        </div>
      </section>

      <SeverityStrip barHeight={4} />
    </>
  );
}
