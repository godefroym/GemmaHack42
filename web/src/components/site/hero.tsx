"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import KineticGrid from "@/components/originkit/kinetic-grid";
import Typewriter from "@/components/originkit/typewriter";
import ShinyPill from "@/components/originkit/shiny-pill";
import SwipeStack from "@/components/originkit/swipe-stack";
import { EvidenceCard } from "./evidence-card";
import { EASE, Emblem, RadarScatter } from "./kit";
import { EVIDENCE, HERO, LINKS } from "@/lib/content";

// StickerPeel is WebGL (three.js) — client-only, no SSR.
const StickerPeel = dynamic(
  () => import("@/components/originkit/sticker-peel"),
  { ssr: false },
);

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Origin Kit — Kinetic Grid. The radar field: a dot mesh pulled toward
          the cursor, leaving a red sweep trail behind it. */}
      <div className="absolute inset-0">
        <KineticGrid
          background="transparent"
          dotColor="#8f8b80"
          lineColor="#ff2b3a"
          trailColor="#ff2b3a"
          spacing={36}
          radius={280}
          strength={3}
        />
      </div>
      {/* Feather the field out toward the page edges. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(115%_95%_at_50%_40%,transparent_0%,transparent_34%,var(--paper)_88%)]" />
      <RadarScatter corner="bottom-left" seed={31} count={26} spread={230} />

      <div className="pointer-events-none relative mx-auto grid w-full max-w-6xl items-center gap-16 px-6 py-14 md:px-10 md:py-20 lg:grid-cols-[1.08fr_1fr] lg:gap-14">
        {/* Left — the claim */}
        <div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="pointer-events-auto mb-8 inline-flex items-center gap-2.5 rounded-full border border-hairline bg-white/70 px-3.5 py-2 backdrop-blur-sm"
          >
            <span className="blink h-1.5 w-1.5 rounded-full bg-accent" />
            {/* Origin Kit — Shiny Pill: a sheen sweeping the status chip. */}
            <ShinyPill
              text="READ ONLY · INTEGRITY VERIFIED"
              textColor="#a1a1aa"
              shineColor="#14141a"
              speed={3.6}
              font={{
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                lineHeight: "1em",
              }}
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.05 }}
            className="text-balance text-[40px] font-medium leading-[1.02] tracking-[-0.032em] sm:text-[54px] md:text-[64px]"
          >
            {HERO.h1a}
            <br />
            <span className="text-accent">{HERO.h1b}</span>
          </motion.h1>

          {/* Origin Kit — Typewriter: the product's five promises, typed out. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.4 }}
            className="mt-7 h-8 md:h-9"
          >
            <Typewriter
              prefix="It "
              texts={[...HERO.typed]}
              color="#14141a"
              typedColor="#ff2b3a"
              cursorColor="#ff2b3a"
              cursorChar="_"
              showCursor
              hideCursorOnType={false}
              deleteSpeed={0.028}
              ease={{ type: "tween", duration: 0.05, delay: 1.5 }}
              font={{
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: "21px",
                fontWeight: 700,
                lineHeight: "1.4em",
              }}
            />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
            className="mt-7 max-w-lg text-[16.5px] leading-relaxed text-muted"
          >
            {HERO.body}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.6 }}
            className="pointer-events-auto mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              href="/demo"
              className="inline-flex h-12 items-center gap-3 rounded-md bg-ink px-6 text-sm font-medium tracking-wide text-paper transition-colors hover:bg-accent"
            >
              <Emblem size={18} />
              Try demo
            </Link>
            <a
              href={LINKS.repo}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center rounded-md border border-ink/15 px-5 text-sm font-medium tracking-wide text-ink transition-colors hover:border-ink hover:bg-white"
            >
              GitHub repo
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.7 }}
            className="meta mt-5"
          >
            {HERO.spec}
          </motion.p>
        </div>

        {/* Right — the evidence deck you can throw around, sealed shut. */}
        <div className="pointer-events-auto relative hidden justify-center lg:flex">
          <div className="h-[438px] w-[340px]">
            <SwipeStack
              cards={EVIDENCE.map((c) => (
                <EvidenceCard key={c.step} card={c} />
              ))}
              cardWidth={318}
              cardHeight={410}
              cardRadius={10}
              tiltAngle={-9}
              xOffset={34}
              swipeThreshold={50}
            />
          </div>

          {/* Origin Kit — Sticker Peel: the custody seal, peelable. */}
          <div className="absolute -right-12 -top-[74px] z-10">
            <div className="h-[158px] w-[158px]">
              <StickerPeel
                image={{ src: "/seal.png" }}
                imageWidth={158}
                imageHeight={158}
                hoverPeel={44}
                pressPeel={64}
                curlRotation={240}
                backColor="#ff2b3a"
                shadowEnabled
                shadow={{ opacity: 22, color: "#14141a", x: -210, y: 130 }}
              />
            </div>
          </div>

          <p className="meta absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
            ← {HERO.deckHint} →
          </p>
        </div>
      </div>

      {/* Mobile: the deck, below the copy. */}
      <div className="relative px-6 pb-20 lg:hidden">
        <div className="mx-auto h-[430px] w-[300px]">
          <SwipeStack
            cards={EVIDENCE.map((c) => (
              <EvidenceCard key={c.step} card={c} />
            ))}
            cardWidth={286}
            cardHeight={404}
            cardRadius={10}
            tiltAngle={-8}
            xOffset={22}
            swipeThreshold={50}
          />
        </div>
        <p className="meta mt-6 text-center">← {HERO.deckHint} →</p>
      </div>
    </section>
  );
}
