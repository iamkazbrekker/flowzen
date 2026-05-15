// Shared types ported from FlowzenModel/types/index.ts

export interface ClassificationResult {
  is_relevant: boolean;
  reason: string;
}

export interface DisruptionEvent {
  is_disruption: boolean;
  event_type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  summary: string;
  location: string;
  affected_transport_modes: string[];
  affected_trade_routes: string[];
  estimated_delay_days: number;
  economic_impact_level: "low" | "moderate" | "high" | "severe";
  confidence_score: number;
}

export interface PipelineResult {
  events: DisruptionEvent[];
  total_fetched: number;
  relevant_count: number;
  deduplicated_count: number;
  timestamp: string;
}
