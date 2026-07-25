// Plain-language description of each read-only forensic tool Gemma can call,
// so a viewer understands what the agent is doing at every step.
export const TOOL_DOCS: Record<string, string> = {
  get_case_overview: "read the case summary and entity counts",
  list_artifacts: "list the collected evidence artifacts",
  inspect_policy_alerts: "check untrusted evidence for prompt injection",
  query_system_state: "inspect collected system state (processes, persistence…)",
  search_raw_evidence: "grep the raw host logs for terms",
  search_events: "search the normalized event timeline",
  list_iocs: "list indicators of compromise",
  map_attack_techniques: "map findings to MITRE ATT&CK techniques",
  map_techniques: "map findings to MITRE ATT&CK techniques",
  trace_attack_path: "reconstruct the candidate attack path",
  get_evidence: "fetch and verify one evidence item",
  get_evidence_context: "read the context around an evidence id",
  get_entity: "look up a specific entity (account, host, file…)",
  assess_exfiltration: "check for data exfiltration to a destination",
  assess_incident_scope: "determine which hosts and accounts are affected",
  get_remediation_constraints: "read which containment actions are allowed",
  check_action_policy: "check whether an action is permitted by policy",
};

export function toolDoc(name: string): string {
  return TOOL_DOCS[name] ?? "read-only forensic tool";
}
