import type { TraceEntry } from "./types";

// Sourced from eval/results/spark-vllm-26b-fp8.json (DGX Spark GB10, online fp8).
export const SPARK_KPIS = {
  model: "gemma4:26b-fp8",
  hardware: "DGX Spark GB10",
  medianTtftSeconds: 1.4,
  decodeTokensPerSecond: 38,
} as const;

export interface TraceStats {
  toolCalls: number;
  rounds: number;
  blocked: number;
  distinctTools: number;
}

export function deriveTraceStats(trace: TraceEntry[]): TraceStats {
  return {
    toolCalls: trace.length,
    rounds: new Set(trace.map((t) => t.round)).size,
    blocked: trace.filter((t) => t.blocked).length,
    distinctTools: new Set(trace.map((t) => t.name)).size,
  };
}
