import { describe, it, expect } from "vitest";
import { isIncidentGraph, isInvestigation } from "./types";
import graph from "../../../public/demo/incident-graph.json";
import investigation from "../../../public/demo/llm-investigation.json";

describe("demo data type guards", () => {
  it("accepts the real incident graph", () => {
    expect(isIncidentGraph(graph)).toBe(true);
    expect(graph.nodes.length).toBe(31);
    expect(graph.edges.length).toBe(49);
  });

  it("accepts the real investigation", () => {
    expect(isInvestigation(investigation)).toBe(true);
    expect(investigation.tool_trace.length).toBe(21);
  });

  it("rejects malformed input", () => {
    expect(isIncidentGraph({ nodes: {} })).toBe(false);
    expect(isInvestigation({})).toBe(false);
  });
});
