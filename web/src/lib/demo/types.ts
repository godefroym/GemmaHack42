export interface GraphNode {
  id: string;
  type: string;
  label: string;
  properties: { ioc?: boolean } & Record<string, unknown>;
  evidence_ids: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  status: string;
  confidence: number;
  evidence_ids: string[];
}

export interface IncidentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TraceEntry {
  tool_call_id: string;
  round: number;
  name: string;
  arguments: Record<string, unknown>;
  ok: boolean;
  blocked: boolean;
}

export interface LlmAnalysis {
  executive_summary: string;
  incident_classification: unknown;
  observed_attack_path: unknown;
  root_cause: unknown;
  scope: unknown;
  exfiltration_assessment: string;
  techniques: unknown;
  findings: unknown;
  hypotheses: unknown;
  unknowns: unknown;
  remediation_plan: unknown;
  validation_plan: unknown;
  confidence: number;
}

export interface Investigation {
  tool_trace: TraceEntry[];
  llm_analysis: LlmAnalysis;
  policy_enforcements: unknown[];
}

export function isIncidentGraph(x: unknown): x is IncidentGraph {
  const g = x as IncidentGraph;
  return !!g && Array.isArray(g.nodes) && Array.isArray(g.edges);
}

export function isInvestigation(x: unknown): x is Investigation {
  const v = x as Investigation;
  return (
    !!v &&
    Array.isArray(v.tool_trace) &&
    !!v.llm_analysis &&
    typeof v.llm_analysis.confidence === "number"
  );
}
