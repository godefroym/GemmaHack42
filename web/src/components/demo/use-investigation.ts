"use client";

import { useEffect, useState } from "react";
import { isInvestigation, type Investigation } from "@/lib/demo/types";

export function useInvestigation(jsonPath: string) {
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(jsonPath)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        if (!isInvestigation(data)) {
          setError("Investigation data is malformed.");
          return;
        }
        setInvestigation(data);
      })
      .catch(() => alive && setError("Could not load investigation."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [jsonPath]);

  return { investigation, loading, error };
}
