import { describe, it, expect } from "vitest";
import { isInvestigation } from "./types";
import ransomware from "../../../public/demo/ransomware.json";

describe("isInvestigation", () => {
  it("accepts the real ransomware investigation", () => {
    expect(isInvestigation(ransomware)).toBe(true);
    expect(ransomware.tool_trace.length).toBe(19);
    expect(ransomware.deterministic_report.attack_path.length).toBe(7);
  });

  it("rejects malformed input", () => {
    expect(isInvestigation({})).toBe(false);
    expect(isInvestigation({ tool_trace: [], llm_analysis: { confidence: 1 } })).toBe(false);
  });
});
