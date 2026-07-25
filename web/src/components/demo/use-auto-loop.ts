"use client";

import { useEffect, useRef, useState } from "react";

interface AutoLoopOpts {
  stepMs?: number;
  holdEndMs?: number;
  enabled?: boolean;
}

// Drives a cursor 0..length that advances one step every `stepMs`, holds at the
// end for `holdEndMs`, then loops back to 0. `enabled: false` (e.g. reduced
// motion) parks the cursor at the end so the whole trace is shown statically.
export function useAutoLoop(length: number, opts: AutoLoopOpts = {}): number {
  const stepMs = opts.stepMs ?? 2600;
  const holdEndMs = opts.holdEndMs ?? 3200;
  const enabled = opts.enabled ?? true;
  const [cursor, setCursor] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || length === 0) {
      setCursor(length);
      return;
    }
    setCursor(0);
    let current = 0;
    const tick = () => {
      current += 1;
      setCursor(current);
      if (current >= length) {
        timer.current = setTimeout(() => {
          current = 0;
          setCursor(0);
          timer.current = setTimeout(tick, stepMs);
        }, holdEndMs);
      } else {
        timer.current = setTimeout(tick, stepMs);
      }
    };
    timer.current = setTimeout(tick, stepMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [length, stepMs, holdEndMs, enabled]);

  return cursor;
}
