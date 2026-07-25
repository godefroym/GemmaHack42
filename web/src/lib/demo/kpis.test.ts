import { describe, it, expect } from "vitest";
import { SPARK_KPIS, deriveTraceStats } from "./kpis";
import investigation from "../../../public/demo/llm-investigation.json";
import type { TraceEntry } from "./types";

const trace = investigation.tool_trace as TraceEntry[];

describe("SPARK_KPIS", () => {
  it("reports the benchmarked model and throughput", () => {
    expect(SPARK_KPIS.model).toBe("gemma4:26b-fp8");
    expect(SPARK_KPIS.medianTtftSeconds).toBeCloseTo(1.4, 1);
    expect(SPARK_KPIS.decodeTokensPerSecond).toBeGreaterThan(35);
  });
});

describe("deriveTraceStats", () => {
  it("counts calls, rounds and blocks from the real trace", () => {
    const s = deriveTraceStats(trace);
    expect(s.toolCalls).toBe(21);
    expect(s.rounds).toBe(8); // distinct rounds present: 1..7,9
    expect(s.blocked).toBe(0);
    expect(s.distinctTools).toBeGreaterThan(5);
  });

  it("handles an empty trace", () => {
    expect(deriveTraceStats([])).toEqual({
      toolCalls: 0,
      rounds: 0,
      blocked: 0,
      distinctTools: 0,
    });
  });
});
