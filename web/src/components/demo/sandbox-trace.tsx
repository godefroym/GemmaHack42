"use client";

import type { TraceEntry } from "@/lib/demo/types";
import type { ReplayAction } from "@/lib/demo/replay";

export function SandboxTrace({
  trace,
  cursor,
  playing,
  onControl,
}: {
  trace: TraceEntry[];
  cursor: number;
  playing: boolean;
  onControl: (a: ReplayAction) => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-card border border-night-line bg-night text-paper">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/50">
          LLM sandbox · {Math.min(cursor, trace.length)}/{trace.length}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => onControl({ type: playing ? "pause" : "play" })}
            className="rounded border border-white/15 px-2.5 py-1 text-xs hover:border-accent"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => onControl({ type: "next" })}
            className="rounded border border-white/15 px-2.5 py-1 text-xs hover:border-accent"
          >
            Step
          </button>
          <button
            onClick={() => onControl({ type: "reset" })}
            className="rounded border border-white/15 px-2.5 py-1 text-xs hover:border-accent"
          >
            Reset
          </button>
        </div>
      </div>
      <ol className="flex-1 overflow-y-auto px-2 py-2">
        {trace.map((t, i) => {
          const revealed = i < cursor;
          const current = i === cursor - 1;
          return (
            <li
              key={t.tool_call_id}
              className={`rounded px-3 py-2 font-mono text-[12px] transition-opacity ${
                revealed ? "opacity-100" : "opacity-25"
              } ${current ? "bg-white/10" : ""}`}
            >
              <span className="text-white/40">r{t.round}</span>{" "}
              <span className="text-accent">{t.name}</span>
              {t.blocked && <span className="ml-2 text-red-400">BLOCKED</span>}
              {Object.keys(t.arguments).length > 0 && (
                <div className="mt-1 truncate text-white/45">
                  {JSON.stringify(t.arguments)}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
