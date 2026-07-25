"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { REPLAY_STAGES } from "@/lib/presentation";

const STAGE_MS = 6500;

export function RansomwareReplay() {
  const reducedMotion = useReducedMotion();
  const [current, setCurrent] = useState(-1);
  const [running, setRunning] = useState(false);
  const terminal = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running || reducedMotion) return;
    if (current >= REPLAY_STAGES.length - 1) {
      const done = window.setTimeout(() => setRunning(false), STAGE_MS);
      return () => window.clearTimeout(done);
    }
    const timer = window.setTimeout(() => setCurrent((value) => value + 1), STAGE_MS);
    return () => window.clearTimeout(timer);
  }, [current, running, reducedMotion]);

  useEffect(() => {
    terminal.current?.scrollTo({ top: terminal.current.scrollHeight, behavior: "smooth" });
  }, [current]);

  const active = current >= 0 ? REPLAY_STAGES[current] : null;
  const complete = current === REPLAY_STAGES.length - 1 && !running;
  const start = () => {
    setCurrent(0);
    setRunning(!reducedMotion);
  };

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-white shadow-[0_22px_70px_rgba(20,20,26,0.08)]">
      <div className="border-b border-hairline bg-paper-2 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${running ? "blink bg-accent" : "bg-muted-2"}`} />
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
                hospital-ransomware · recorded Gemma investigation
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted">
                19 real tool calls condensed into 6 diagnostic pivots
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {current >= 0 && (
              <button
                type="button"
                onClick={() => setRunning((value) => !value)}
                disabled={complete || Boolean(reducedMotion)}
                className="h-10 rounded-md border border-hairline px-4 font-mono text-[10px] font-bold uppercase tracking-wider text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-35"
              >
                {running ? "Pause" : "Resume"}
              </button>
            )}
            <button
              type="button"
              onClick={start}
              className="h-10 rounded-md bg-ink px-5 font-mono text-[10px] font-bold uppercase tracking-wider text-paper transition-colors hover:bg-accent"
            >
              {current < 0 ? "Start replay" : "Restart"}
            </button>
          </div>
        </div>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700"
            style={{
              width: current < 0 ? "0%" : `${((current + 1) / REPLAY_STAGES.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="grid min-h-[600px] lg:grid-cols-[1.45fr_0.75fr]">
        <div className="flex min-h-[540px] flex-col bg-night text-white">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 font-mono text-[10px] text-white/35">
              analyst@dgx-spark · /cases/hospital-ransomware
            </span>
            <span className="ml-auto font-mono text-[10px] text-white/30">
              {Math.max(0, current + 1)} / {REPLAY_STAGES.length}
            </span>
          </div>

          <div
            ref={terminal}
            className="flex-1 overflow-y-auto px-5 py-5 font-mono text-[11px] leading-[1.65] md:text-[12px]"
          >
            <p>
              <span className="text-accent">$</span>{" "}
              <span className="text-white/85">
                gemma-ir investigate hospital-ransomware.tar.zst --endpoint /v1
              </span>
            </p>
            <p className="text-white/40">
              ▸ connected · Gemma 4 31B recorded run · endpoint-agnostic tool protocol
            </p>

            {current < 0 && (
              <div className="mt-20 flex flex-col items-center text-center">
                <p className="text-[13px] text-white/70">Ready to replay the investigation.</p>
                <p className="mt-2 max-w-md text-[11px] leading-relaxed text-white/35">
                  One click. Six stages. Concrete shell-equivalent views of the bounded,
                  read-only operations executed by the forensic tools.
                </p>
              </div>
            )}

            {REPLAY_STAGES.slice(0, current + 1).map((stage, stageIndex) => {
              const isActive = stageIndex === current;
              return (
                <div
                  key={stage.stage}
                  className={`mt-5 border-l-2 pl-4 transition-colors ${
                    isActive ? "border-accent" : "border-white/10"
                  }`}
                >
                  <p className="text-white/30">
                    [{String(stageIndex + 1).padStart(2, "0")}]{" "}
                    <span className={isActive ? "text-accent" : "text-white/55"}>
                      {stage.stage}
                    </span>{" "}
                    · {stage.tools}
                  </p>
                  {stage.commands.map((command) => (
                    <p key={command} className="mt-1 break-words">
                      <span className="text-accent/70">$</span>{" "}
                      <span className="text-white/80">{command}</span>
                    </p>
                  ))}
                  <p className="mt-1 text-[#56d364]">✓ {stage.result}</p>
                </div>
              );
            })}

            {complete && (
              <div className="mt-6 rounded border border-[#56d364]/25 bg-[#56d364]/8 px-4 py-3 text-[#56d364]">
                ✓ diagnosis complete · confidence 0.95 · 5 source pivots resolved
              </div>
            )}
          </div>
        </div>

        <aside className="relative flex min-h-[410px] flex-col justify-between bg-paper p-6 md:p-8">
          {active ? (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <p className="meta text-accent">Diagnostic logic</p>
                  <p className="font-mono text-[10px] text-muted">
                    {String(current + 1).padStart(2, "0")} / {REPLAY_STAGES.length}
                  </p>
                </div>
                <p className="mt-8 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
                  {active.stage}
                </p>
                <h3 className="mt-3 text-[30px] font-medium leading-[1.05] tracking-[-0.03em]">
                  {active.title}
                </h3>
                <p className="mt-5 text-[15px] leading-relaxed text-muted">{active.logic}</p>

                <div className="mt-8 rounded-card border border-hairline bg-white p-4">
                  <p className="meta">What Gemma receives</p>
                  <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink">
                    {active.result}
                  </p>
                </div>
              </div>

              <div className="mt-10">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  Next pivot
                </p>
                <p className="mt-2 text-sm text-ink">
                  {current < REPLAY_STAGES.length - 1
                    ? REPLAY_STAGES[current + 1].title
                    : "Sourced remediation plan + analyst approval"}
                </p>
                {running && (
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-ink/10">
                    <div
                      key={current}
                      className="replay-countdown h-full origin-left bg-ink/55"
                      style={{ animationDuration: `${STAGE_MS}ms` }}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="my-auto">
              <p className="meta text-accent">One-click execution</p>
              <h3 className="mt-5 text-[34px] font-medium leading-[1.04] tracking-[-0.035em]">
                Follow the reasoning,
                <br />
                not nineteen API calls.
              </h3>
              <p className="mt-5 text-[15px] leading-relaxed text-muted">
                The replay advances automatically every 6.5 seconds and highlights the
                forensic purpose of each command group.
              </p>
              <p className="mt-4 font-mono text-[10px] leading-relaxed text-muted">
                Recorded with the 31B endpoint · the same /v1 contract is served by the Spark
                26B configuration.
              </p>
              <button
                type="button"
                onClick={start}
                className="mt-8 h-12 rounded-md bg-accent px-6 font-mono text-[11px] font-bold uppercase tracking-wider text-white"
              >
                Start · ≈ 40 seconds
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
