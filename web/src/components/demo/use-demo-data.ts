"use client";

import { useEffect, useState } from "react";
import {
  isIncidentGraph,
  isInvestigation,
  type IncidentGraph,
  type Investigation,
} from "@/lib/demo/types";

export function useDemoData() {
  const [graph, setGraph] = useState<IncidentGraph | null>(null);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/demo/incident-graph.json").then((r) => r.json()),
      fetch("/demo/llm-investigation.json").then((r) => r.json()),
    ])
      .then(([g, inv]) => {
        if (!alive) return;
        if (!isIncidentGraph(g) || !isInvestigation(inv)) {
          setError("Demo data is malformed.");
          return;
        }
        setGraph(g);
        setInvestigation(inv);
      })
      .catch(() => alive && setError("Could not load demo data."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { graph, investigation, loading, error };
}
