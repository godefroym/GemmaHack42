"use client";

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { Topbar } from "@/components/site/topbar";
import { useInvestigation } from "@/components/demo/use-investigation";
import { useAutoLoop } from "@/components/demo/use-auto-loop";
import { KillChain } from "@/components/demo/kill-chain";
import { Terminal } from "@/components/demo/terminal";
import { KpiBar } from "@/components/demo/kpi-bar";
import { CaseBrief } from "@/components/demo/case-brief";
import { deriveTraceStats } from "@/lib/demo/kpis";
import { buildKillChain } from "@/lib/demo/kill-chain";
import { CASE, MODEL } from "@/lib/demo/scenarios";

export default function DemoPage() {
  const reduced = useReducedMotion();
  const { investigation, loading, error } = useInvestigation(CASE.json);

  const trace = investigation?.tool_trace ?? [];
  const steps = useMemo(
    () => (investigation ? buildKillChain(investigation.deterministic_report) : []),
    [investigation],
  );

  // Two independent loops: the kill chain rebuilds step by step, the terminal
  // replays Gemma's tool calls.
  const stepCursor = useAutoLoop(steps.length, { enabled: !reduced, stepMs: 1000, holdEndMs: 2600 });
  const traceCursor = useAutoLoop(trace.length, { enabled: !reduced });

  const stats = useMemo(() => deriveTraceStats(trace), [trace]);
  const injectionBlocked = (investigation?.deterministic_report.policy_alerts ?? []).some(
    (a) => a.type === "prompt_injection",
  );

  return (
    <>
      <Topbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium tracking-tight text-ink">{CASE.label}</h1>
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              live incident reconstruction · case {CASE.caseId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="blink h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[11px] text-ink">
              {MODEL} <span className="text-muted">· DGX Spark GB10</span>
            </span>
          </div>
        </header>

        {error && <p className="mt-6 font-mono text-sm text-accent">{error}</p>}
        {loading && !investigation && (
          <p className="mt-6 font-mono text-sm text-muted">Loading investigation…</p>
        )}

        {investigation && (
          <div className="mt-5 flex flex-col gap-5">
            <CaseBrief analysis={investigation.llm_analysis} fallback={CASE.label} />
            <KpiBar stats={stats} />
            <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
              <KillChain steps={steps} cursor={stepCursor} injectionBlocked={injectionBlocked} />
              <div className="h-[440px] lg:h-auto lg:min-h-[440px]">
                <Terminal
                  scenario={CASE}
                  trace={trace}
                  confidence={investigation.llm_analysis.confidence}
                  cursor={traceCursor}
                  animate={!reduced}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
