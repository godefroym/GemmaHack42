import { SPARK_KPIS, type TraceStats } from "@/lib/demo/kpis";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-hairline bg-white px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-lg font-medium text-ink">{value}</div>
    </div>
  );
}

export function KpiBar({ stats }: { stats: TraceStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
      <Tile label="Model" value={SPARK_KPIS.model} />
      <Tile label="Hardware" value={SPARK_KPIS.hardware} />
      <Tile label="Median TTFT" value={`${SPARK_KPIS.medianTtftSeconds}s`} />
      <Tile label="Decode" value={`${SPARK_KPIS.decodeTokensPerSecond} tok/s`} />
      <Tile label="Tool calls" value={`${stats.toolCalls}`} />
      <Tile label="Rounds" value={`${stats.rounds}`} />
      <Tile label="Blocked" value={`${stats.blocked}`} />
    </div>
  );
}
