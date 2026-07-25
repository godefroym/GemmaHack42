import type { LlmAnalysis } from "@/lib/demo/types";

export function ReportPanel({ analysis }: { analysis: LlmAnalysis }) {
  return (
    <div className="rounded-card border border-hairline bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-ink">Investigation report</h2>
        <div className="flex gap-4 font-mono text-[11px] uppercase tracking-wider text-muted">
          <span>Exfiltration: {analysis.exfiltration_assessment}</span>
          <span>Confidence: {(analysis.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted">
        {analysis.executive_summary}
      </p>
    </div>
  );
}
