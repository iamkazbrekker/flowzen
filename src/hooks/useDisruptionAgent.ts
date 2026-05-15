"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Journey, JourneyLeg } from "../components/JourneyBuilder";
import type { DisruptionEvent } from "@/lib/types";
import type { RerouteResult } from "../api/agent/reroute/route";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LegAnalysis {
  legId: string;
  result: RerouteResult;
  loading: boolean;
}

export interface AgentState {
  disruptions: DisruptionEvent[];
  analyses: LegAnalysis[];
  loading: boolean;
  lastFetched: string | null;
  error: string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDisruptionAgent(journeys: Journey[]) {
  const [state, setState] = useState<AgentState>({
    disruptions: [],
    analyses: [],
    loading: false,
    lastFetched: null,
    error: null,
  });

  const analysedLegs = useRef<Set<string>>(new Set());

  // Fetch active disruptions from Supabase (via our API)
  const fetchDisruptions = useCallback(async () => {
    try {
      const res = await fetch("/api/disruptions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setState((prev) => ({
        ...prev,
        disruptions: json.disruptions ?? [],
        lastFetched: json.fetched_at ?? new Date().toISOString(),
        error: null,
      }));
      return json.disruptions as DisruptionEvent[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, error: msg }));
      return [] as DisruptionEvent[];
    }
  }, []);

  // Run the reroute agent on a single leg
  const analyseLeg = useCallback(
    async (leg: JourneyLeg, disruptions: DisruptionEvent[]) => {
      if (!leg.from || !leg.to || analysedLegs.current.has(leg.id)) return;
      analysedLegs.current.add(leg.id);

      setState((prev) => ({
        ...prev,
        analyses: [
          ...prev.analyses.filter((a) => a.legId !== leg.id),
          { legId: leg.id, result: {} as RerouteResult, loading: true },
        ],
      }));

      try {
        const res = await fetch("/api/agent/reroute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leg: {
              id: leg.id,
              fromName: leg.from.name,
              fromLat: leg.from.lat,
              fromLng: leg.from.lng,
              toName: leg.to.name,
              toLat: leg.to.lat,
              toLng: leg.to.lng,
              mode: leg.mode,
            },
            disruptions,
          }),
        });

        const result: RerouteResult = await res.json();
        setState((prev) => ({
          ...prev,
          analyses: prev.analyses.map((a) =>
            a.legId === leg.id ? { ...a, result, loading: false } : a
          ),
        }));
      } catch {
        analysedLegs.current.delete(leg.id); // Allow retry on error
        setState((prev) => ({
          ...prev,
          analyses: prev.analyses.filter((a) => a.legId !== leg.id),
        }));
      }
    },
    []
  );

  // Re-run agent whenever journeys change
  useEffect(() => {
    const allLegs = journeys.flatMap((j) => j.legs).filter((l) => l.from && l.to);
    if (allLegs.length === 0) return;

    let cancelled = false;

    (async () => {
      setState((prev) => ({ ...prev, loading: true }));
      const disruptions = await fetchDisruptions();
      if (cancelled) return;
      setState((prev) => ({ ...prev, loading: false }));

      // Stagger analyses to avoid hammering the API
      for (const leg of allLegs) {
        if (cancelled) break;
        await analyseLeg(leg, disruptions);
        await new Promise((r) => setTimeout(r, 150));
      }
    })();

    return () => { cancelled = true; };
  }, [journeys, fetchDisruptions, analyseLeg]);

  // Helper: get analysis for a specific leg
  const getLegAnalysis = (legId: string): LegAnalysis | undefined =>
    state.analyses.find((a) => a.legId === legId);

  // Critical/high disruptions across all legs
  const criticalAlerts = state.analyses.filter(
    (a) => !a.loading && a.result.affected && (a.result.severity === "critical" || a.result.severity === "high")
  );

  return { ...state, getLegAnalysis, criticalAlerts };
}
