/**
 * Disruption Agent
 * Responsibility: Fetch active disruptions from Supabase + NLP pipeline,
 * then adjust pricing estimates with disruption multipliers
 */

import { AgentContext } from "../types";
import { computeDisruptionImpacts, ActiveDisruption } from "../utils/disruption-impact";
import { runPipeline } from "@/lib/pipeline";

export async function disruptionAgent(ctx: AgentContext): Promise<AgentContext> {
  const start = Date.now();
  ctx.logs.push("[DisruptionAgent] Fetching active disruptions from NLP pipeline...");

  if (!ctx.route_data || !ctx.mode_estimates) {
    ctx.errors.push("[DisruptionAgent] Missing route_data or mode_estimates — skipping.");
    return ctx;
  }

  let disruptions: ActiveDisruption[] = [];

  // 1. Fetch recent disruptions using the NLP pipeline directly
  try {
    const pipelineResult = await runPipeline();
    if (pipelineResult && pipelineResult.events.length > 0) {
      disruptions = pipelineResult.events.map(event => ({
        ...event,
        created_at: new Date().toISOString()
      })) as ActiveDisruption[];
      ctx.logs.push(`[DisruptionAgent] Extracted ${disruptions.length} active disruptions directly from NLP pipeline`);
    } else {
      ctx.logs.push("[DisruptionAgent] No active disruptions detected by pipeline — route is clear");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.logs.push(`[DisruptionAgent] Pipeline fetch failed: ${msg} — continuing with no disruptions`);
  }

  // Store for AI reasoning
  ctx.active_disruptions = disruptions;

  // 2. Compute disruption impacts per mode
  const modes = ctx.mode_estimates.map((e) => e.mode);
  const impacts = computeDisruptionImpacts(
    disruptions,
    ctx.request.source,
    ctx.request.destination,
    modes
  );

  ctx.disruption_impacts = impacts;

  // 3. Apply adjustments to mode estimates
  for (const estimate of ctx.mode_estimates) {
    const impact = impacts.find((i) => i.mode === estimate.mode);
    if (!impact) continue;

    estimate.disruption_multiplier = impact.cost_multiplier;
    estimate.adjusted_cost_inr = Math.round(estimate.base_cost_inr * impact.cost_multiplier);
    estimate.adjusted_transit_days =
      Math.round(estimate.transit_days * impact.delay_multiplier * 10) / 10;
    estimate.reliability_score = Math.max(
      0,
      Math.round((estimate.reliability_score - impact.reliability_penalty) * 100) / 100
    );
    estimate.risk_level = impact.risk_level;
    estimate.notes.push(...impact.reasons);

    if (impact.cost_multiplier > 1.0) {
      ctx.logs.push(
        `[DisruptionAgent] ${estimate.mode.toUpperCase()} adjusted: cost ×${impact.cost_multiplier.toFixed(2)}, delay ×${impact.delay_multiplier.toFixed(2)}, risk=${impact.risk_level}`
      );
    }
  }

  ctx.logs.push(`[DisruptionAgent] Completed in ${Date.now() - start}ms`);
  return ctx;
}
