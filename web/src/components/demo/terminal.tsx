"use client";

import { useEffect, useRef, useState } from "react";
import { renderToolCall } from "@/lib/demo/commands";
import { toolDoc } from "@/lib/demo/tool-docs";
import { ENDPOINT, MODEL, type Scenario } from "@/lib/demo/scenarios";
import type { TraceEntry } from "@/lib/demo/types";

export function Terminal({
  scenario,
  trace,
  confidence,
  cursor,
  animate,
}: {
  scenario: Scenario;
  trace: TraceEntry[];
  confidence: number;
  cursor: number;
  animate: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const revealed = trace.slice(0, cursor);
  const activeIndex = cursor - 1;
  const activeLine = activeIndex >= 0 ? renderToolCall(trace[activeIndex]) : "";

  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const reset = setTimeout(() => {
      setTyped(0);
      if (!activeLine) return;
      let i = 0;
      id = setInterval(() => {
        i += 1;
        setTyped(i);
        if (i >= activeLine.length && id) clearInterval(id);
      }, 16);
    }, 0);
    return () => {
      clearTimeout(reset);
      if (id) clearInterval(id);
    };
  }, [cursor, activeLine, animate]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cursor, typed]);

  const visibleCharacters = animate ? typed : activeLine.length;
  const cmdDone = visibleCharacters >= activeLine.length;
  const done = cursor >= trace.length && trace.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card border border-night-line bg-night">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate font-mono text-[11px] text-white/40">
          gemma-ir · agent trace · {scenario.caseId}
        </span>
        <span className="ml-auto font-mono text-[11px] text-white/30">
          {Math.min(cursor, trace.length)}/{trace.length}
        </span>
      </div>

      <div ref={scroller} className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-relaxed">
        {/* Real launch command */}
        <div>
          <span className="text-accent">$</span>{" "}
          <span className="text-white/90">gemma-ir investigate {scenario.fixture}</span>{" "}
          <span className="text-white/35">\</span>
        </div>
        <div className="pl-4 text-white/45">
          --model {MODEL} --base-url {ENDPOINT}
        </div>
        <div className="pb-1 text-white/55">
          <span className="text-[#28c840]">▸</span> connected · {MODEL} · case{" "}
          <span className="text-white/80">{scenario.caseId}</span> loaded
        </div>

        {/* Real tool calls Gemma issued, streamed */}
        {revealed.map((entry, i) => {
          const line = renderToolCall(entry);
          const isActive = i === activeIndex;
          const shown = isActive ? line.slice(0, visibleCharacters) : line;
          const showResult = !isActive || cmdDone;
          const head = shown.split("(")[0];
          const tail = shown.includes("(") ? "(" + shown.split("(").slice(1).join("(") : "";
          return (
            <div key={entry.tool_call_id}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-white/30">[r{entry.round}]</span>
                <span className="text-white/30">→</span>
                <span className="text-white/85">
                  <span className="text-accent">{head}</span>
                  {tail}
                </span>
                {isActive && !cmdDone && (
                  <span className="inline-block h-[12px] w-[6px] translate-y-[1px] animate-pulse bg-accent" />
                )}
                {showResult &&
                  (entry.blocked ? (
                    <span className="text-[#ff5f57]">blocked</span>
                  ) : (
                    <span className="text-[#28c840]/70">ok</span>
                  ))}
              </div>
              {showResult && (
                <div className="pl-6 text-[11px] text-white/35">↳ {toolDoc(entry.name)}</div>
              )}
            </div>
          );
        })}

        {done && (
          <div className="pt-1.5 text-white/55">
            <span className="text-[#28c840]">✓</span> investigation complete · confidence{" "}
            {confidence.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
