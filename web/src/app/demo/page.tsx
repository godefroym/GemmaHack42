"use client";

import { useMemo } from "react";
import { Topbar } from "@/components/site/topbar";
import { useDemoData } from "@/components/demo/use-demo-data";
import { useReplay } from "@/components/demo/use-replay";
import { AttackGraph } from "@/components/demo/attack-graph";
import { SandboxTrace } from "@/components/demo/sandbox-trace";
import { KpiBar } from "@/components/demo/kpi-bar";
import { ReportPanel } from "@/components/demo/report-panel";
import { deriveTraceStats } from "@/lib/demo/kpis";

export default function DemoPage() {
  const { graph, investigation, loading, error } = useDemoData();
  const trace = investigation?.tool_trace ?? [];
  const { cursor, playing, dispatch } = useReplay(trace.length);

  const stats = useMemo(() => deriveTraceStats(trace), [trace]);

  const activeEvidenceIds = useMemo(() => {
    const ids = new Set<string>();
    if (!graph || trace.length === 0) return ids;
    // tool_trace has no per-action evidence_ids, so we drive the graph highlight by replay progress: reveal nodes proportionally as the cursor advances.
    const revealCount = Math.ceil((cursor / trace.length) * graph.nodes.length);
    graph.nodes.slice(0, revealCount).forEach((n) => n.evidence_ids.forEach((id) => ids.add(id)));
    return ids;
  }, [graph, trace.length, cursor]);

  return (
    <>
      <Topbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        {loading && <p className="font-mono text-sm text-muted">Loading demo…</p>}
        {error && <p className="font-mono text-sm text-accent">{error}</p>}
        {graph && investigation && (
          <div className="flex flex-col gap-6">
            <KpiBar stats={stats} />
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="min-h-[560px] rounded-card border border-hairline bg-paper-2">
                <AttackGraph graph={graph} activeEvidenceIds={activeEvidenceIds} />
              </div>
              <div className="min-h-[560px]">
                <SandboxTrace
                  trace={trace}
                  cursor={cursor}
                  playing={playing}
                  onControl={dispatch}
                />
              </div>
            </div>
            <ReportPanel analysis={investigation.llm_analysis} />
          </div>
        )}
      </main>
    </>
  );
}
