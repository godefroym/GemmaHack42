"use client";

import SpotlightText from "@/components/originkit/spotlight-text";
import { Reveal, SectionHead } from "./kit";
import { INJECTION } from "@/lib/content";

export function Injection() {
  return (
    <section id="injection" className="border-y border-hairline bg-paper-2">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:px-10 md:py-28">
        <SectionHead
          index="04"
          kicker={INJECTION.kicker}
          title={
            <>
              The attacker wrote a prompt.{" "}
              <span className="text-accent">We read it as evidence.</span>
            </>
          }
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-14">
          {/* Origin Kit — Spotlight Text. The untrusted line sits in the dark
              until you shine a light on it, which is exactly the handling
              rule: nothing here is read until it has been classified. */}
          <Reveal>
            <div className="relative overflow-hidden rounded-card border border-accent/35 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/25 bg-accent-wash px-5 py-3.5">
                <p className="meta text-accent-hover">
                  <span className="blink mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
                  untrusted · quarantined
                </p>
                <p className="meta text-accent-hover/70">{INJECTION.ev}</p>
              </div>

              <div className="px-5 py-8 sm:px-7">
                <span className="sr-only">{INJECTION.log}</span>
                <div
                  aria-hidden
                  className="h-[13em] w-full sm:h-[9em] md:h-[7.5em] [&>div]:!cursor-crosshair"
                >
                  <SpotlightText
                    text={INJECTION.log}
                    brightColor="#14141a"
                    dimColor="#ded9d0"
                    maskSize={200}
                    intensity={40}
                    transition={{
                      type: "tween",
                      duration: 0.35,
                      ease: "easeOut",
                    }}
                    font={{
                      fontFamily: "var(--font-space-mono), monospace",
                      fontSize: "clamp(12px, 1.35vw, 17px)",
                      fontWeight: 700,
                      lineHeight: "1.85em",
                      letterSpacing: "0em",
                      textAlign: "left",
                    }}
                  />
                </div>
              </div>

              <p className="meta border-t border-hairline px-5 py-3.5 sm:px-7">
                move the cursor to shine a light
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.07}>
            <p className="text-[16px] leading-relaxed text-muted">
              {INJECTION.body}
            </p>
            <div className="mt-8 space-y-3">
              <Verdict
                who="PANDAR"
                what="typed prompt_injection, quarantined, zero tool calls"
                ok
              />
              <Verdict
                who="Unguarded E4B"
                what="read it as a possible attacker action"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Verdict({
  who,
  what,
  ok = false,
}: {
  who: string;
  what: string;
  ok?: boolean;
}) {
  return (
    <div
      className={`rounded-card border-l-2 bg-white px-5 py-4 ${
        ok ? "border-l-ink" : "border-l-accent"
      }`}
    >
      <p className="meta text-ink">{who}</p>
      <p className="mt-2.5 font-mono text-[12.5px] leading-relaxed text-muted">
        {what}
      </p>
    </div>
  );
}
