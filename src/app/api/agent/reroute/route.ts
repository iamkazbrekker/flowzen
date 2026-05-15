import { NextRequest, NextResponse } from "next/server";
import type { DisruptionEvent } from "@/lib/types";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RerouteRequest {
  leg: {
    id: string;
    fromName: string;
    fromLat: number;
    fromLng: number;
    toName: string;
    toLat: number;
    toLng: number;
    mode: string;
  };
  disruptions: DisruptionEvent[];
}

export interface RerouteResult {
  legId: string;
  affected: boolean;
  matchedDisruptions: DisruptionEvent[];
  recommendation: string;
  alternativeMode?: string;
  severity: "none" | "low" | "medium" | "high" | "critical";
  avoidRegions?: string[];
  rerouted: boolean;
  confidence: number;
}

// ── Severity ordering ─────────────────────────────────────────────────────────
const SEV_ORDER: Record<string, number> = {
  low: 1, medium: 2, high: 3, critical: 4,
};

// ── Helper: does a disruption concern this leg? ───────────────────────────────
function disruptionAffectsLeg(
  d: DisruptionEvent,
  leg: RerouteRequest["leg"]
): boolean {
  const mode = leg.mode.toLowerCase();
  const route = `${leg.fromName} to ${leg.toName}`.toLowerCase();

  // Mode match
  const modeHit =
    !d.affected_transport_modes?.length ||
    d.affected_transport_modes.some((m) => mode.includes(m.toLowerCase()) || m.toLowerCase().includes(mode));

  // Location / route keyword match — tokenise disruption location and route names
  const locationTokens = [d.location, ...(d.affected_trade_routes ?? [])]
    .join(" ")
    .toLowerCase()
    .split(/[\s,/\-–]+/)
    .filter((t) => t.length > 3);

  const routeTokens = `${leg.fromName} ${leg.toName}`.toLowerCase().split(/\s+/);

  const locationHit = locationTokens.some(
    (lt) =>
      routeTokens.some((rt) => rt.includes(lt) || lt.includes(rt)) ||
      route.includes(lt)
  );

  // Mode + location match, OR high/critical severity on the same transport mode
  // (a major high-severity event on the same mode type should always flag the leg)
  return modeHit && (locationHit || d.severity === "critical" || d.severity === "high");
}

// ── Alternative mode recommendation ──────────────────────────────────────────
function recommendAlternative(
  mode: string,
  severity: string
): string | undefined {
  if (severity === "low" || severity === "medium") return undefined;
  const alternatives: Record<string, string> = {
    sea: "rail",
    rail: "road",
    road: "rail",
    air: "sea",
  };
  return alternatives[mode.toLowerCase()];
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body: RerouteRequest = await req.json();
  const { leg, disruptions } = body;

  if (!leg || !disruptions) {
    return NextResponse.json({ error: "Missing leg or disruptions" }, { status: 400 });
  }

  // Filter disruptions that affect this leg
  const matched = disruptions.filter((d) => disruptionAffectsLeg(d, leg));

  if (matched.length === 0) {
    return NextResponse.json({
      legId: leg.id,
      affected: false,
      matchedDisruptions: [],
      recommendation: "Route is clear. No active disruptions detected for this leg.",
      rerouted: false,
      severity: "none",
      confidence: 1.0,
    } satisfies RerouteResult);
  }

  // Determine worst severity
  const worstSeverity = matched.reduce<string>((acc, d) => {
    return (SEV_ORDER[d.severity] ?? 0) > (SEV_ORDER[acc] ?? 0) ? d.severity : acc;
  }, "low");

  // Build a human-readable disruption summary
  const disruptionSummary = matched
    .map((d, i) => `${i + 1}. [${d.severity.toUpperCase()}] ${d.title}: ${d.summary} (Est. delay: ${d.estimated_delay_days ?? "unknown"} days)`)
    .join("\n");

  // Generate recommendation text
  const altMode = recommendAlternative(leg.mode, worstSeverity);
  let recommendation = "";

  if (worstSeverity === "critical" || worstSeverity === "high") {
    recommendation = altMode
      ? `⚠️ REROUTE RECOMMENDED: ${matched.length} active disruption(s) severely impact this ${leg.mode} corridor.\n\n${disruptionSummary}\n\nSuggested action: Switch to ${altMode.toUpperCase()} transport for this leg to avoid estimated delays of up to ${Math.max(...matched.map((d) => d.estimated_delay_days ?? 0))} days.`
      : `🚨 CRITICAL DISRUPTION: ${matched.length} disruption(s) affect this route. Consider delaying shipment or sourcing alternative suppliers.\n\n${disruptionSummary}`;
  } else if (worstSeverity === "medium") {
    recommendation = `⚡ MONITOR CLOSELY: ${matched.length} disruption(s) may cause delays on this leg.\n\n${disruptionSummary}\n\nCurrent route is passable but expect delays.`;
  } else {
    recommendation = `ℹ️ MINOR DISRUPTION: Low-severity event detected near this corridor.\n\n${disruptionSummary}\n\nNo rerouting needed at this time.`;
  }

  // Collect avoid regions from disruption locations
  const avoidRegions = [...new Set(matched.map((d) => d.location).filter(Boolean))];

  return NextResponse.json({
    legId: leg.id,
    affected: true,
    matchedDisruptions: matched,
    recommendation,
    alternativeMode: altMode,
    severity: worstSeverity as RerouteResult["severity"],
    avoidRegions,
    rerouted: (worstSeverity === "high" || worstSeverity === "critical") && !!altMode,
    confidence: Math.max(...matched.map((d) => d.confidence_score ?? 0.7)),
  } satisfies RerouteResult);
}
