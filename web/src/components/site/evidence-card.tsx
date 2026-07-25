"use client";

import { SeverityDots } from "./kit";
import type { EvidenceCard as Card } from "@/lib/content";

/* A single exhibit from the sealed hospital-demo bundle, styled like the dark
   slides in the deck: mono label with an accent index, dashed separators, and
   the evidence ID it resolves to. Card 08 is the attacker's own text, so it
   wears the quarantine treatment. */
export function EvidenceCard({ card }: { card: Card }) {
  const q = card.quarantined;
  return (
    <div
      className={`flex h-full w-full flex-col justify-between p-6 text-left ${
        q
          ? "border border-accent/60 bg-[#170a0d]"
          : "border border-night-line bg-night"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[13px] font-bold text-white">
          STEP
          <span className="text-accent">_{card.step}</span>
        </p>
        <p className="font-mono text-[11px] tabular-nums text-white/35">
          {card.time}
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center py-6">
        <Dash />
        <p
          className={`mt-4 font-mono text-[13px] font-bold uppercase tracking-[0.06em] ${
            q ? "text-accent" : "text-white/45"
          }`}
        >
          {q ? "⚠ quarantined" : card.type}
        </p>
        <h3
          className={`mt-3 font-mono text-[15px] font-bold leading-[1.5] ${
            q ? "text-accent/95" : "text-white"
          }`}
        >
          {card.summary}
        </h3>
        <Dash className="mt-5" />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10.5px] text-white/40">{card.ev}</p>
          {card.technique && (
            <p className="mt-1.5 font-mono text-[10.5px] text-white/60">
              ATT&amp;CK {card.technique}
            </p>
          )}
        </div>
        <SeverityDots active={card.sev} />
      </div>
    </div>
  );
}

function Dash({ className = "" }: { className?: string }) {
  return (
    <p
      className={`font-mono text-[11px] tracking-[0.34em] text-white/15 ${className}`}
      aria-hidden="true"
    >
      {"– ".repeat(13)}
    </p>
  );
}
