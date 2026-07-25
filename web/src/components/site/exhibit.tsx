"use client";

import PixelReveal from "@/components/originkit/pixel-reveal";
import { Reveal, SectionHead } from "./kit";
import { EXHIBIT } from "@/lib/content";

export function Exhibit() {
  return (
    <section
      id="exhibit"
      className="mx-auto w-full max-w-6xl px-6 py-20 md:px-10 md:py-28"
    >
      <div className="flex flex-wrap items-end justify-between gap-8">
        <SectionHead
          index="05"
          kicker={EXHIBIT.kicker}
          title={EXHIBIT.title}
        />
        <Reveal delay={0.06}>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4 sm:gap-x-10">
            {EXHIBIT.facts.map((f) => (
              <div key={f.v}>
                <dt className="font-mono text-[26px] leading-none tabular-nums">
                  {f.k}
                </dt>
                <dd className="meta mt-2.5 max-w-[7rem] leading-snug">{f.v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>

      {/* Origin Kit — Pixel Reveal. The real render.py output dissolves in:
          the pixel grid clearing is the reconstruction happening. */}
      <Reveal delay={0.08}>
        <figure className="mt-12">
          <div className="overflow-hidden rounded-card border border-night-line bg-night">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
              <p className="meta text-white/40">
                artifacts/demo/attack-graph.png
              </p>
              <p className="meta hidden text-white/40 sm:block">
                render.py · deterministic
              </p>
            </div>
            <div className="h-[220px] w-full sm:h-[330px] md:h-[460px] lg:h-[560px]">
              <PixelReveal
                imageSrc="/attack-graph.png"
                gridSize={26}
                transitionColor="#ff2b3a"
                edgeHeight={14}
                direction="up"
                transition={{ type: "tween", duration: 2, ease: "easeInOut" }}
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>
          <figcaption className="mt-4 max-w-2xl text-[14px] leading-relaxed text-muted">
            {EXHIBIT.caption}
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}
