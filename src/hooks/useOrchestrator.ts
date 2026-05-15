"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Journey, JourneyLeg } from "../app/components/JourneyBuilder";
import type { LegAnalysis } from "./useDisruptionAgent";
import type { DisruptionEvent } from "@/lib/types";
import type { OrchestrationResult, AgentStep } from "../app/api/agent/orchestrate/route";

export interface OrchestratorState {
  running: boolean;
  results: OrchestrationResult[];
  steps: AgentStep[];
  error: string | null;
  lastRunKey: string;
}

/**
 * Builds a stable string key from the current affected-leg state.
 * Changes whenever: a new leg becomes affected, disruptions change, or legs
 * recover (previously affected legs are no longer affected).
 */
function buildRunKey(
  analyses: LegAnalysis[],
  simDisruptions: DisruptionEvent[]
): string {
  const affectedIds = analyses
    .filter(a => !a.loading && a.result?.affected)
    .map(a => `${a.legId}:${a.result.severity}:${a.result.alternativeMode ?? ""}`)
    .sort()
    .join("|");

  const simKey = simDisruptions
    .map(d => `${d.title}:${d.severity}`)
    .sort()
    .join("|");

  return `${affectedIds}||${simKey}`;
}

export function useOrchestrator(
  journeys: Journey[],
  analyses: LegAnalysis[],
  simDisruptions: DisruptionEvent[],
  costThresholdUsd: number = 50_000
): OrchestratorState & { rerun: () => void } {
  const [state, setState] = useState<OrchestratorState>({
    running: false,
    results: [],
    steps: [],
    error: null,
    lastRunKey: "",
  });

  // Track last key we fired for — prevents duplicate runs
  const lastFiredKey = useRef<string>("");
  // Abort controller for in-flight requests
  const abortRef = useRef<AbortController | null>(null);
  // Debounce timer — wait for all analyses to settle before firing
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runOrchestration = useCallback(async (
    affectedLegs: JourneyLeg[],
    allDisruptions: DisruptionEvent[],
    runKey: string
  ) => {
    if (affectedLegs.length === 0) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setState(prev => ({
      ...prev,
      running: true,
      results: [],
      steps: [],
      error: null,
      lastRunKey: runKey,
    }));

    const newResults: OrchestrationResult[] = [];
    const newSteps: AgentStep[] = [];

    for (const leg of affectedLegs) {
      if (!leg.from || !leg.to || signal.aborted) break;

      try {
        const res = await fetch("/api/agent/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
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
              cargoWeightKg: 5000,
              cargoType: "general",
            },
            disruptions: allDisruptions,
            costThresholdUsd,
            maxIterations: 4,
          }),
        });

        if (signal.aborted) break;
        if (!res.ok) throw new Error(`Orchestrate API error: HTTP ${res.status}`);

        const data: OrchestrationResult = await res.json();
        newResults.push(data);
        newSteps.push(...data.steps);

        setState(prev => ({
          ...prev,
          results: [...newResults],
          steps: [...newSteps],
        }));
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") break;
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : "Orchestration failed",
        }));
        break;
      }
    }

    if (!signal.aborted) {
      setState(prev => ({ ...prev, running: false }));
    }
  }, [costThresholdUsd]);

  // Main auto-trigger effect
  useEffect(() => {
    // Clear any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Don't fire if any analysis is still loading — wait for them to settle
    const stillLoading = analyses.some(a => a.loading);
    if (stillLoading) return;

    // Compute what's affected
    const affectedLegs = journeys
      .flatMap(j => j.legs)
      .filter(leg => {
        if (!leg.from || !leg.to) return false;
        const analysis = analyses.find(a => a.legId === leg.id);
        return analysis && !analysis.loading && analysis.result?.affected;
      });

    // Nothing to orchestrate
    if (affectedLegs.length === 0) {
      setState(prev =>
        prev.results.length > 0
          ? { ...prev, results: [], steps: [], lastRunKey: "" }
          : prev
      );
      lastFiredKey.current = "";
      return;
    }

    // Build run key — if unchanged, don't re-fire
    const allDisruptions = [
      ...simDisruptions,
      ...analyses.flatMap(a => a.result?.matchedDisruptions ?? []),
    ];
    const uniqueDisruptions = Array.from(
      new Map(allDisruptions.map(d => [d.title, d])).values()
    );

    const runKey = buildRunKey(analyses, simDisruptions);
    if (runKey === lastFiredKey.current) return;

    // Debounce 1.2 s — let analyses fully settle before firing
    debounceRef.current = setTimeout(() => {
      lastFiredKey.current = runKey;
      runOrchestration(affectedLegs, uniqueDisruptions, runKey);
    }, 1200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [analyses, journeys, simDisruptions, runOrchestration]);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Manual re-run: reset key so the effect fires again
  const rerun = useCallback(() => {
    lastFiredKey.current = "";
    abortRef.current?.abort();
    setState(prev => ({ ...prev, results: [], steps: [], error: null }));
  }, []);

  return { ...state, rerun };
}
