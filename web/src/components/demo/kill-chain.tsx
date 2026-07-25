"use client";

import { motion } from "framer-motion";
import type { KillChainStep } from "@/lib/demo/kill-chain";

const EASE = [0.16, 1, 0.3, 1] as const;

export function KillChain({
  steps,
  cursor,
  injectionBlocked,
}: {
  steps: KillChainStep[];
  cursor: number;
  injectionBlocked: boolean;
}) {
  return (
    <div className="rounded-card border border-hairline bg-paper-2 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink">Reconstructed attack path</h2>
          <p className="mt-0.5 font-mono text-[11px] text-muted">
            sourced from evidence · rebuilt step by step
          </p>
        </div>
        <span className="font-mono text-[11px] text-muted">
          {Math.min(cursor, steps.length)}/{steps.length} steps
        </span>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const revealed = i < cursor;
          return (
            <motion.li
              key={s.step}
              animate={{ opacity: revealed ? 1 : 0.14, y: revealed ? 0 : 8 }}
              transition={{ duration: 0.45, ease: EASE }}
              className={`relative flex flex-col rounded-card border bg-white p-4 ${
                s.impact ? "border-accent/30" : "border-hairline"
              }`}
            >
              <span
                className={`absolute -top-px left-0 h-0.5 rounded-full transition-all duration-500 ${
                  s.impact ? "bg-accent" : "bg-ink/25"
                }`}
                style={{ width: revealed ? "100%" : "0%" }}
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  Step {String(s.step).padStart(2, "0")}
                </span>
                {s.technique && (
                  <span className="rounded-full border border-accent/25 bg-accent-wash px-2 py-0.5 font-mono text-[10px] text-accent">
                    {s.technique}
                  </span>
                )}
              </div>
              <div className="mt-2 text-[13px] font-medium text-ink">{s.kind}</div>
              <p className="mt-1 text-[12.5px] leading-snug text-muted">{s.summary}</p>
              <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-muted/80">
                <span>{s.time}</span>
                <span className="text-muted/40">·</span>
                <span className="truncate">{s.evidenceId}</span>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {injectionBlocked && (
        <div className="mt-4 flex items-start gap-2 rounded-card border border-accent/25 bg-accent-wash px-4 py-3">
          <span className="mt-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent">
            Policy boundary
          </span>
          <span className="text-[12.5px] text-ink">
            Prompt injection detected in untrusted evidence — blocked, never converted into a tool
            call.
          </span>
        </div>
      )}
    </div>
  );
}
