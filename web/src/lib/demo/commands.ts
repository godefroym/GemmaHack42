import type { TraceEntry } from "./types";

// Render one of Gemma's real tool calls as the command it issued, e.g.
//   search_raw_evidence(terms=["error","fail", +6])
//   assess_exfiltration(destination="203.0.113.10")
// Arguments come verbatim from the recorded run; nothing is invented.
export function renderToolCall(entry: TraceEntry): string {
  const args = entry.arguments ?? {};
  const parts: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    parts.push(`${key}=${formatArg(value)}`);
  }
  return `${entry.name}(${parts.join(", ")})`;
}

function formatArg(value: unknown): string {
  if (Array.isArray(value)) {
    const head = value.slice(0, 2).map((v) => JSON.stringify(v));
    const rest = value.length > 2 ? `, +${value.length - 2}` : "";
    return `[${head.join(", ")}${rest}]`;
  }
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}
