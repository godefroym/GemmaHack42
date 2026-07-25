"use client";

import { useEffect, useReducer } from "react";
import { initialReplay, replayReducer, type ReplayAction } from "@/lib/demo/replay";

export function useReplay(length: number, intervalMs = 900) {
  const [state, rawDispatch] = useReducer(
    (s: typeof initialReplay, a: ReplayAction) => replayReducer(s, a, length),
    initialReplay,
  );

  useEffect(() => {
    if (!state.playing) return;
    const id = setInterval(() => rawDispatch({ type: "next" }), intervalMs);
    return () => clearInterval(id);
  }, [state.playing, intervalMs]);

  return { cursor: state.cursor, playing: state.playing, dispatch: rawDispatch };
}
