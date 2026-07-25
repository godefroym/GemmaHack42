import type { LlmAnalysis } from "@/lib/demo/types";

export function CaseBrief({ analysis, fallback }: { analysis: LlmAnalysis; fallback: string }) {
  const classification =
    typeof analysis.incident_classification === "string"
      ? analysis.incident_classification
      : fallback;

  return (
    <div className="rounded-card border border-hairline bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-accent/25 bg-accent-wash px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wide text-accent">
          {classification}
        </span>
        <span className="rounded-full border border-ink/15 bg-paper-2 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wide text-ink">
          exfil: {analysis.exfiltration_assessment.replace(/_/g, " ")}
        </span>
        <span className="rounded-full border border-ink/15 bg-paper-2 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wide text-ink">
          confidence {(analysis.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-muted">
        {analysis.executive_summary}
      </p>
    </div>
  );
}
