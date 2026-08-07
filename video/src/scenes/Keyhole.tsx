import { useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { CASE } from "../data/case";
import { H, Shell } from "./Shell";
import { ease, fade, fadeUp } from "../anim";

const DUR = 750;

/** src/gemma_ir/tools.py — ForensicToolRegistry, all 16, in the order the code groups them. */
const TOOLS = [
  ["Evidence access", ["get_case_overview", "list_artifacts", "search_raw_evidence", "get_evidence_context", "get_evidence"]],
  ["Host investigation", ["query_system_state", "search_events", "get_entity", "trace_attack_path", "list_iocs", "map_attack_techniques", "inspect_policy_alerts"]],
  ["Decision support", ["assess_exfiltration", "assess_incident_scope", "get_remediation_constraints", "check_action_policy"]],
] as const;

/** planner.py REQUIRED_TOOL_STAGES — it cannot return a report until all seven pass. */
const STAGES = [
  "case overview",
  "raw evidence",
  "evidence trust",
  "attack reconstruction",
  "scope",
  "exfiltration",
  "remediation constraints",
] as const;

/** web/src/lib/content.ts CANNOT[] — still accurate on this branch. */
const CANNOT = [
  "Access a shell",
  "Write to the victim host",
  "Delete or alter evidence",
  "Execute remediation",
  "Call anything off the allowlist",
  "Promote its own guess to fact",
] as const;

const GROUP_AT = [20, 70, 130];
const STAGE_AT = 250;
const CANNOT_AT = 520;

export const Keyhole: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Shell scene="02 · Investigate" duration={DUR}>
      <H style={fadeUp(frame, 4)}>Sixteen tools. All read-only.</H>

      <div style={{ display: "flex", gap: 88, marginTop: 40, flex: 1 }}>
        {/* Left: the tool surface, typing in group by group. */}
        <div style={{ flex: 1.4 }}>
          {TOOLS.map(([group, names], g) => (
            <div key={group} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 20,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: C.muted,
                  marginBottom: 12,
                  ...fade(frame, GROUP_AT[g], 14),
                }}
              >
                {group} · {names.length}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {names.map((n, i) => (
                  <span
                    key={n}
                    style={{
                      fontFamily: F.mono,
                      fontSize: 20,
                      color: C.ink,
                      border: `1px solid ${C.hairline}`,
                      backgroundColor: C.paper2,
                      borderRadius: 6,
                      padding: "6px 11px",
                      ...fadeUp(frame, GROUP_AT[g] + 8 + i * 3, 16, 8),
                    }}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Middle: the seven stages unlocking. A lock turning, not a checklist ticking. */}
        <div style={{ flex: 0.85 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 20,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.muted,
              marginBottom: 18,
              ...fade(frame, STAGE_AT - 20, 14),
            }}
          >
            Cannot finish until
          </div>
          {STAGES.map((s, i) => {
            const at = STAGE_AT + i * 34;
            // Locked → unlocked: the row's rule brightens and the text resolves to ink.
            const open = ease(frame, [at, at + 22], [0, 1]);
            return (
              <div
                key={s}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "baseline",
                  padding: "8px 0",
                  position: "relative",
                  ...fade(frame, STAGE_AT - 10 + i * 4, 14),
                }}
              >
                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: 19,
                    color: C.muted2,
                    opacity: 0.4 + open * 0.6,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: 23,
                    color: `rgba(20,20,26,${0.3 + open * 0.7})`,
                  }}
                >
                  {s}
                </span>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 1,
                    backgroundColor: C.hairline,
                    transform: `scaleX(${open})`,
                    transformOrigin: "left",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Right: what it can never do. Stamps, one line at a time. */}
        <div style={{ flex: 0.85 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 20,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.accent,
              marginBottom: 18,
              ...fade(frame, CANNOT_AT - 14, 12),
            }}
          >
            Cannot, ever
          </div>
          {CANNOT.map((c, i) => (
            <div
              key={c}
              style={{
                fontSize: 25,
                color: C.ink,
                padding: "9px 0",
                lineHeight: 1.2,
                ...fadeUp(frame, CANNOT_AT + i * 8, 14, 6),
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${C.hairline}`,
          paddingTop: 24,
          fontFamily: F.mono,
          fontSize: 24,
          color: C.muted,
          ...fade(frame, 600, 20),
        }}
      >
        Real VM run · {CASE.llmRun.toolCalls} model-selected tool calls · exfiltration{" "}
        <span style={{ color: C.ink }}>{CASE.llmRun.exfiltration}</span>
      </div>
    </Shell>
  );
};
