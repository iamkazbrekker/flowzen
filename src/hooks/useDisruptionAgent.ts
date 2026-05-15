"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Journey, JourneyLeg } from "../app/components/JourneyBuilder";
import type { DisruptionEvent } from "@/lib/types";
import type { RerouteResult } from "../app/api/agent/reroute/route";

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

export function useDisruptionAgent(
  journeys: Journey[],
  simulatedDisruptions: DisruptionEvent[] = []
) {
  const [state, setState] = useState<AgentState>({
    disruptions: [],
    analyses: [],
    loading: false,
    lastFetched: null,
    error: null,
  });

  // Cache real disruptions — avoid Supabase re-fetch on every sim injection
  const cachedReal = useRef<DisruptionEvent[]>([]);
  const lastRealFetch = useRef<number>(0);

  // Stable ref that always holds the latest simulated disruptions
  // so async callbacks always read the freshest value
  const simRef = useRef<DisruptionEvent[]>(simulatedDisruptions);
  simRef.current = simulatedDisruptions;

  // Generation counter — incremented each run to invalidate stale async results
  const gen = useRef(0);

  const fetchReal = useCallback(async (): Promise<DisruptionEvent[]> => {
    const now = Date.now();
    if (now - lastRealFetch.current < 60_000 && cachedReal.current.length > 0) {
      return cachedReal.current;
    }
    try {
      const res = await fetch("/api/disruptions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = (json.disruptions ?? []) as DisruptionEvent[];
      cachedReal.current = data;
      lastRealFetch.current = now;
      setState(prev => ({
        ...prev,
        disruptions: data,
        lastFetched: json.fetched_at ?? new Date().toISOString(),
        error: null,
      }));
      return data;
    } catch {
      return cachedReal.current;
    }
  }, []);

  const runAnalysis = useCallback(async (
    leg: JourneyLeg,
    realDisruptions: DisruptionEvent[],
    simDisruptions: DisruptionEvent[],
    myGen: number
  ) => {
    if (!leg.from || !leg.to) return;

    setState(prev => ({
      ...prev,
      analyses: [
        ...prev.analyses.filter(a => a.legId !== leg.id),
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
          disruptions: [...realDisruptions, ...simDisruptions],
        }),
      });
      if (gen.current !== myGen) return; // stale — a newer run started
      const result: RerouteResult = await res.json();
      if (gen.current !== myGen) return;
      setState(prev => ({
        ...prev,
        analyses: prev.analyses.map(a =>
          a.legId === leg.id ? { ...a, result, loading: false } : a
        ),
      }));
    } catch {
      if (gen.current !== myGen) return;
      setState(prev => ({
        ...prev,
        analyses: prev.analyses.filter(a => a.legId !== leg.id),
      }));
    }
  }, []);

  // Trigger re-run whenever journeys or simulatedDisruptions reference changes.
  // We use a separate effect that increments a counter-state so the main
  // effect dep is a stable primitive, not the mutable array.
  const [runTick, setRunTick] = useState(0);
  const prevSimLen = useRef(-1);
  const prevSimKey = useRef("");

  useEffect(() => {
    const key = simulatedDisruptions.map(d => d.title + d.severity).join("|");
    if (
      simulatedDisruptions.length !== prevSimLen.current ||
      key !== prevSimKey.current
    ) {
      prevSimLen.current = simulatedDisruptions.length;
      prevSimKey.current = key;
      setRunTick(t => t + 1);
    }
  }, [simulatedDisruptions]);

  // Main analysis orchestration
  useEffect(() => {
    const allLegs = journeys.flatMap(j => j.legs).filter(l => l.from && l.to);
    if (allLegs.length === 0) return;

    gen.current += 1;
    const myGen = gen.current;
    let alive = true;

    setState(prev => ({ ...prev, loading: true, analyses: [] }));

    (async () => {
      const real = await fetchReal();
      if (!alive || gen.current !== myGen) return;
      setState(prev => ({ ...prev, loading: false }));

      // Run legs in parallel with small stagger
      await Promise.all(
        allLegs.map(async (leg, i) => {
          await new Promise(r => setTimeout(r, i * 100));
          if (!alive || gen.current !== myGen) return;
          // Use the ref so we always send the freshest sim disruptions
          await runAnalysis(leg, real, simRef.current, myGen);
        })
      );
    })();

    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeys, fetchReal, runAnalysis, runTick]);

  const getLegAnalysis = (legId: string) =>
    state.analyses.find(a => a.legId === legId);

  const criticalAlerts = state.analyses.filter(
    a => !a.loading && a.result.affected &&
      (a.result.severity === "critical" || a.result.severity === "high")
  );

  return { ...state, getLegAnalysis, criticalAlerts };
}
