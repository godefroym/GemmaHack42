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
  exfiltration_assessment: string;
  confidence: number;
  [key: string]: unknown;
}

export interface TimelineEvent {
  event_id: string;
  timestamp: string;
  event_type: string;
  summary: string;
  evidence_ids: string[];
}

export interface AttackPathStep {
  step: number;
  event_id: string;
  summary: string;
  evidence_ids: string[];
}

export interface Technique {
  technique_id: string;
  name: string;
  evidence_ids: string[];
}

export interface PolicyAlert {
  type: string;
  decision: string;
  evidence_ids: string[];
}

export interface DeterministicReport {
  timeline: TimelineEvent[];
  attack_path: AttackPathStep[];
  techniques: Technique[];
  policy_alerts: PolicyAlert[];
}

export interface Investigation {
  tool_trace: TraceEntry[];
  llm_analysis: LlmAnalysis;
  deterministic_report: DeterministicReport;
  policy_enforcements: unknown[];
}

export function isInvestigation(x: unknown): x is Investigation {
  const v = x as Investigation;
  return (
    !!v &&
    Array.isArray(v.tool_trace) &&
    !!v.llm_analysis &&
    typeof v.llm_analysis.confidence === "number" &&
    !!v.deterministic_report &&
    Array.isArray(v.deterministic_report.attack_path)
  );
}
