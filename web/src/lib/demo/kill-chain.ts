import type { DeterministicReport } from "./types";

export interface KillChainStep {
  step: number;
  kind: string; // human label, e.g. "Data encrypted"
  eventType: string; // raw, e.g. "data_encrypted"
  summary: string;
  time: string; // HH:MM:SS
  evidenceId: string;
  technique?: string; // ATT&CK id, e.g. "T1486"
  impact: boolean; // destructive stage (worth accenting)
}

const IMPACT_TYPES = new Set(["service_stop", "inhibit_recovery", "data_encrypted", "exfiltration"]);

function titleCase(eventType: string): string {
  return eventType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Reconstruct the ordered kill chain from the deterministic report: join each
// attack-path step to its timeline event (type, timestamp) and the ATT&CK
// technique that cites the same evidence.
export function buildKillChain(report: DeterministicReport): KillChainStep[] {
  const byEvent = new Map(report.timeline.map((e) => [e.event_id, e]));

  const techFor = (evidenceIds: string[]): string | undefined => {
    const set = new Set(evidenceIds);
    for (const t of report.techniques) {
      if (t.evidence_ids.some((id) => set.has(id))) return t.technique_id;
    }
    return undefined;
  };

  return report.attack_path.map((s) => {
    const ev = byEvent.get(s.event_id);
    const eventType = ev?.event_type ?? "event";
    return {
      step: s.step,
      kind: titleCase(eventType),
      eventType,
      summary: s.summary,
      time: (ev?.timestamp ?? "").slice(11, 19),
      evidenceId: s.evidence_ids[0] ?? "",
      technique: techFor(s.evidence_ids),
      impact: IMPACT_TYPES.has(eventType),
    };
  });
}
