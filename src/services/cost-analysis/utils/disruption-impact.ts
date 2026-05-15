/**
 * Disruption Impact Utility
 * Maps active disruption events from the NLP pipeline onto transport mode multipliers
 */

import { TransportMode, DisruptionImpact } from "../types";

// ─── SEVERITY → MULTIPLIER MAPPING ───────────────────────────────────────────

const SEVERITY_COST_MAP: Record<string, number> = {
  low: 1.05,
  medium: 1.20,
  high: 1.50,
  critical: 2.00,
};

const SEVERITY_DELAY_MAP: Record<string, number> = {
  low: 1.10,
  medium: 1.35,
  high: 1.80,
  critical: 2.50,
};

const SEVERITY_RELIABILITY_PENALTY: Record<string, number> = {
  low: 0.03,
  medium: 0.10,
  high: 0.25,
  critical: 0.45,
};

const SEVERITY_RISK: Record<string, "low" | "medium" | "high" | "critical"> = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

// ─── MODE KEYWORD MATCHING ───────────────────────────────────────────────────

const MODE_KEYWORDS: Record<TransportMode, string[]> = {
  sea: ["shipping", "maritime", "port", "canal", "sea", "vessel", "container", "freight"],
  air: ["air_freight", "airport", "air", "aviation", "cargo_flight"],
  rail: ["railway", "rail", "train", "railroad"],
  road: ["trucking", "road", "highway", "truck", "logistics_road"],
};

function disruptionAffectsMode(
  mode: TransportMode,
  affectedModes: string[],
  eventType: string
): boolean {
  const keywords = MODE_KEYWORDS[mode];
  // Check affected_transport_modes from the disruption event
  const modesToCheck = Array.isArray(affectedModes) ? affectedModes : [];
  for (const affected of modesToCheck) {
    const lower = affected.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) return true;
  }
  // Also check event_type
  const eventLower = eventType.toLowerCase();
  if (keywords.some((k) => eventLower.includes(k))) return true;

  return false;
}

// ─── LOCATION RELEVANCE ──────────────────────────────────────────────────────

function isLocationRelevant(
  disruptionLocation: string,
  source: string,
  destination: string
): boolean {
  const loc = disruptionLocation.toLowerCase();
  const src = source.toLowerCase();
  const dst = destination.toLowerCase();

  // Direct mention
  if (loc.includes(src) || loc.includes(dst)) return true;
  if (src.includes(loc) || dst.includes(loc)) return true;

  // Major trade chokepoints always relevant for sea
  const globalChokepoints = [
    "suez", "panama", "strait of hormuz", "malacca", "bab-el-mandeb",
    "red sea", "south china sea", "english channel", "cape of good hope",
  ];
  if (globalChokepoints.some((c) => loc.includes(c))) return true;

  return false;
}

// ─── COMPUTE DISRUPTION IMPACT ────────────────────────────────────────────────

export interface ActiveDisruption {
  event_type: string;
  severity: string;
  location: string;
  summary: string;
  affected_transport_modes: string[];
  estimated_delay_days: number;
}

export function computeDisruptionImpacts(
  disruptions: ActiveDisruption[],
  source: string,
  destination: string,
  modes: TransportMode[]
): DisruptionImpact[] {
  const impacts: DisruptionImpact[] = modes.map((mode) => ({
    mode,
    cost_multiplier: 1.0,
    delay_multiplier: 1.0,
    reliability_penalty: 0,
    risk_level: "low" as const,
    reasons: [],
  }));

  for (const disruption of disruptions) {
    const relevant = isLocationRelevant(disruption.location, source, destination);
    if (!relevant) continue;

    for (const impact of impacts) {
      const affects = disruptionAffectsMode(
        impact.mode,
        disruption.affected_transport_modes,
        disruption.event_type
      );
      if (!affects) continue;

      const sev = disruption.severity.toLowerCase();
      impact.cost_multiplier *= SEVERITY_COST_MAP[sev] ?? 1.0;
      impact.delay_multiplier *= SEVERITY_DELAY_MAP[sev] ?? 1.0;
      impact.reliability_penalty += SEVERITY_RELIABILITY_PENALTY[sev] ?? 0;
      impact.reasons.push(
        `${disruption.event_type} at ${disruption.location} (${sev}): ${disruption.summary.slice(0, 120)}`
      );

      // Upgrade risk level
      const newRisk = SEVERITY_RISK[sev] ?? "low";
      const riskOrder = ["low", "medium", "high", "critical"];
      if (riskOrder.indexOf(newRisk) > riskOrder.indexOf(impact.risk_level)) {
        impact.risk_level = newRisk;
      }
    }
  }

  return impacts;
}
