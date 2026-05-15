/**
 * FlowZen Cost-Analysis & Route Optimization — Type Definitions
 * Multi-agent architecture types for logistics decision intelligence
 */

// ─── INPUT ────────────────────────────────────────────────────────────────────

export type TransportMode = "air" | "sea" | "rail" | "road";

export interface CargoRequest {
  id?: string;
  source: string;
  destination: string;
  cargo_weight_kg: number;
  cargo_type: string;
  priority?: "standard" | "express" | "critical";
  created_at?: string;
}

// ─── GEOCODING / DISTANCE ─────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lng: number;
  name: string;
}

export interface DistanceResult {
  straight_line_km: number;
  road_km?: number;
  sea_km?: number;
  air_km?: number;
  rail_km?: number;
}

// ─── PRICING ──────────────────────────────────────────────────────────────────

export interface ModeEstimate {
  mode: TransportMode;
  base_cost_inr: number;
  adjusted_cost_inr: number;
  transit_days: number;
  adjusted_transit_days: number;
  reliability_score: number;   // 0–1
  efficiency_score: number;    // 0–1
  co2_kg: number;
  distance_km: number;
  disruption_multiplier: number;
  risk_level: "low" | "medium" | "high" | "critical";
  available: boolean;
  notes: string[];
}

// ─── DISRUPTION IMPACT ────────────────────────────────────────────────────────

export interface DisruptionImpact {
  mode: TransportMode;
  cost_multiplier: number;     // 1.0 = no impact, 1.5 = +50%
  delay_multiplier: number;
  reliability_penalty: number; // subtracted from score
  risk_level: "low" | "medium" | "high" | "critical";
  reasons: string[];
}

// ─── ROUTE FETCH ──────────────────────────────────────────────────────────────

export interface RouteData {
  source: GeoPoint;
  destination: GeoPoint;
  distances: DistanceResult;
  available_modes: TransportMode[];
}

// ─── AI RECOMMENDATION ───────────────────────────────────────────────────────

export interface AIRecommendation {
  recommended_mode: TransportMode;
  estimated_cost_inr: number;
  estimated_delay_days: number;
  risk_level: "low" | "medium" | "high" | "critical";
  reason: string;
  best_route: TransportMode;
  safest_route: TransportMode;
  fastest_route: TransportMode;
  cheapest_route: TransportMode;
  confidence: number;
}

// ─── FINAL OUTPUT ─────────────────────────────────────────────────────────────

export interface CostAnalysisResult {
  request: CargoRequest;
  route_data: RouteData;
  mode_estimates: ModeEstimate[];
  disruption_impacts: DisruptionImpact[];
  ai_recommendation: AIRecommendation;
  exchange_rate?: {
    api_used: string;
    usd_to_inr: number;
  };
  timestamp: string;
  pipeline_duration_ms: number;
}

// ─── AGENT CONTEXT (shared state passed between agents) ───────────────────────

export interface AgentContext {
  request: CargoRequest;
  route_data?: RouteData;
  mode_estimates?: ModeEstimate[];
  disruption_impacts?: DisruptionImpact[];
  active_disruptions?: Array<{
    event_type: string;
    severity: string;
    location: string;
    summary: string;
    affected_transport_modes: string[];
    estimated_delay_days: number;
  }>;
  ai_recommendation?: AIRecommendation;
  exchange_rate?: {
    api_used: string;
    usd_to_inr: number;
  };
  logs: string[];
  errors: string[];
}
