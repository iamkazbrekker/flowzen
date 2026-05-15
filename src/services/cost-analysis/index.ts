/**
 * FlowZen Cost-Analysis Orchestrator
 * Runs the full multi-agent pipeline: Route Fetch → Pricing → Disruption → AI Recommendation
 */

import {
  AgentContext,
  CargoRequest,
  CostAnalysisResult,
} from "./types";
import { routeFetchAgent } from "./agents/route-fetch-agent";
import { pricingAgent } from "./agents/pricing-agent";
import { disruptionAgent } from "./agents/disruption-agent";
import { recommendationAgent } from "./agents/recommendation-agent";

// ─── ORCHESTRATOR ─────────────────────────────────────────────────────────────

export async function runCostAnalysis(
  request: CargoRequest
): Promise<CostAnalysisResult> {
  const pipelineStart = Date.now();

  // Initialize shared agent context
  let ctx: AgentContext = {
    request,
    logs: [],
    errors: [],
  };

  console.log(`\n${"═".repeat(70)}`);
  console.log(`  FlowZen Cost Analysis Pipeline`);
  console.log(`  ${request.source} → ${request.destination}`);
  console.log(`  Cargo: ${request.cargo_weight_kg}kg ${request.cargo_type}`);
  console.log(`${"═".repeat(70)}\n`);

  // Stage 1: Route Fetch Agent
  ctx = await routeFetchAgent(ctx);

  // Stage 2: Pricing Agent (requires route_data)
  if (ctx.route_data) {
    ctx = await pricingAgent(ctx);
  }

  // Stage 3: Disruption Agent (requires mode_estimates)
  if (ctx.mode_estimates) {
    ctx = await disruptionAgent(ctx);
  }

  // Stage 4: AI Recommendation Agent (requires all prior data)
  ctx = await recommendationAgent(ctx);

  const durationMs = Date.now() - pipelineStart;

  // Print pipeline summary
  console.log(`\n${"─".repeat(70)}`);
  console.log("  Pipeline Logs:");
  ctx.logs.forEach((log) => console.log(`    ${log}`));
  if (ctx.errors.length > 0) {
    console.log("  Errors:");
    ctx.errors.forEach((err) => console.error(`    ❌ ${err}`));
  }
  console.log(`\n  Total pipeline duration: ${durationMs}ms`);
  console.log(`${"─".repeat(70)}\n`);

  // Build final result
  return {
    request,
    route_data: ctx.route_data!,
    mode_estimates: ctx.mode_estimates ?? [],
    disruption_impacts: ctx.disruption_impacts ?? [],
    ai_recommendation: ctx.ai_recommendation!,
    exchange_rate: ctx.exchange_rate,
    timestamp: new Date().toISOString(),
    pipeline_duration_ms: durationMs,
  };
}

// Re-export types for convenience
export type { CargoRequest, CostAnalysisResult } from "./types";
