/**
 * Pricing Agent
 * Responsibility: Generate cost/time/CO2 estimates for each available transport mode
 * Uses specialized providers for air/sea and generic formulas for rail/road
 */

import { AgentContext, ModeEstimate, TransportMode } from "../types";
import { estimateAirFreight } from "../providers/flight-provider";
import { estimateSeaFreight } from "../providers/sea-provider";
import {
  estimateCost,
  estimateTransitDays,
  estimateCO2,
  RATE_TABLE,
} from "../utils/pricing";

export async function pricingAgent(ctx: AgentContext): Promise<AgentContext> {
  const start = Date.now();
  ctx.logs.push("[PricingAgent] Computing multi-modal pricing estimates...");

  if (!ctx.route_data) {
    ctx.errors.push("[PricingAgent] No route_data available — skipping.");
    return ctx;
  }

  const { source, destination, distances, available_modes } = ctx.route_data;
  const { cargo_weight_kg, cargo_type } = ctx.request;
  const estimates: ModeEstimate[] = [];

  for (const mode of available_modes) {
    try {
      let baseCost: number;
      let transitDays: number;
      let co2Kg: number;
      let distanceKm: number;
      const notes: string[] = [];

      switch (mode) {
        case "air": {
          const airEst = estimateAirFreight(source, destination, cargo_weight_kg);
          baseCost = airEst.total_cost;
          transitDays = Math.round((airEst.transit_hours / 24) * 10) / 10;
          distanceKm = airEst.distance_km;
          co2Kg = estimateCO2("air", distanceKm, cargo_weight_kg);
          notes.push(`Container: air cargo, fuel surcharge: $${airEst.fuel_surcharge}`);
          break;
        }
        case "sea": {
          const seaEst = estimateSeaFreight(
            source, destination, cargo_weight_kg,
            ctx.request.source, ctx.request.destination
          );
          baseCost = seaEst.total_cost;
          transitDays = seaEst.transit_days;
          distanceKm = seaEst.distance_km;
          co2Kg = estimateCO2("sea", distanceKm, cargo_weight_kg);
          notes.push(`Container: ${seaEst.container_type}, port fees: $${seaEst.port_fees}`);
          break;
        }
        default: {
          // Rail / Road — use generic formulas
          distanceKm = distances[`${mode}_km` as keyof typeof distances] as number ?? distances.straight_line_km;
          baseCost = estimateCost(mode, distanceKm, cargo_weight_kg, cargo_type);
          transitDays = estimateTransitDays(mode, distanceKm);
          co2Kg = estimateCO2(mode, distanceKm, cargo_weight_kg);
          break;
        }
      }

      const rates = RATE_TABLE[mode];

      estimates.push({
        mode,
        base_cost_usd: baseCost,
        adjusted_cost_usd: baseCost, // will be adjusted by disruption agent
        transit_days: transitDays,
        adjusted_transit_days: transitDays,
        reliability_score: rates.reliability_base,
        efficiency_score: rates.efficiency_base,
        co2_kg: co2Kg,
        distance_km: distanceKm,
        disruption_multiplier: 1.0,
        risk_level: "low",
        available: true,
        notes,
      });

      ctx.logs.push(
        `[PricingAgent] ${mode.toUpperCase()}: $${baseCost} | ${transitDays}d | ${distanceKm}km | CO2: ${co2Kg}kg`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.errors.push(`[PricingAgent] Error estimating ${mode}: ${msg}`);
    }
  }

  ctx.mode_estimates = estimates;
  ctx.logs.push(`[PricingAgent] Completed ${estimates.length} estimates in ${Date.now() - start}ms`);

  return ctx;
}
