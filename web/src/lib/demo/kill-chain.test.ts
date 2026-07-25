import { describe, it, expect } from "vitest";
import { buildKillChain } from "./kill-chain";
import ransomware from "../../../public/demo/ransomware.json";
import type { DeterministicReport } from "./types";

const report = ransomware.deterministic_report as DeterministicReport;

describe("buildKillChain", () => {
  it("reconstructs the ordered ransomware kill chain", () => {
    const steps = buildKillChain(report);
    expect(steps).toHaveLength(7);
    expect(steps[0].step).toBe(1);
    expect(steps[0].eventType).toBe("authentication");
    expect(steps[0].time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("maps ATT&CK techniques and flags impact stages", () => {
    const steps = buildKillChain(report);
    const encrypt = steps.find((s) => s.eventType === "data_encrypted");
    expect(encrypt?.technique).toBe("T1486");
    expect(encrypt?.impact).toBe(true);
    expect(steps.find((s) => s.eventType === "authentication")?.impact).toBe(false);
  });
});
