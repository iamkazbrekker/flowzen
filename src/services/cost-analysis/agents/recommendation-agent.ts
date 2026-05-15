/**
 * Recommendation Agent
 * Responsibility: Use Groq + Llama 3 to reason over live data and recommend optimal logistics route
 * IMPORTANT: AI does NOT invent prices — it reasons on top of real data from previous agents
 */

import { AgentContext, AIRecommendation } from "../types";
import { groq } from "@/lib/groq";

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────

const RECOMMENDATION_SYSTEM_PROMPT = `You are FlowZen AI — an expert logistics route optimization analyst.

You will receive REAL-TIME data containing:
1. Cargo shipment details (source, destination, weight, type)
2. Multi-modal transport cost estimates (air, sea, rail, road) with REAL prices
3. Active logistics disruption intelligence from news analysis
4. Disruption-adjusted pricing and risk assessments

YOUR TASK:
Analyze ALL the provided data and recommend the optimal logistics strategy.

CRITICAL RULES:
- You must ONLY use the data provided. Do NOT invent or hallucinate prices, routes, or facts.
- Every number you cite must come from the input data.
- Your reasoning must reference specific data points (costs, delays, disruptions).
- Consider: cost efficiency, transit time, cargo safety, disruption risk, CO2 impact, and reliability.
- For "critical" priority cargo, favor speed and safety over cost.
- For "standard" priority, favor cost efficiency.

OUTPUT FORMAT — Return ONLY valid JSON matching this exact schema:
{
  "recommended_mode": "air" | "sea" | "rail" | "road",
  "estimated_cost_usd": number,
  "estimated_delay_days": number,
  "risk_level": "low" | "medium" | "high" | "critical",
  "reason": "2-3 sentence explanation citing specific data",
  "best_route": "air" | "sea" | "rail" | "road",
  "safest_route": "air" | "sea" | "rail" | "road",
  "fastest_route": "air" | "sea" | "rail" | "road",
  "cheapest_route": "air" | "sea" | "rail" | "road",
  "confidence": number (0.0 to 1.0)
}

Do NOT add any text outside the JSON object.`;

// ─── BUILD USER PROMPT ───────────────────────────────────────────────────────

function buildUserPrompt(ctx: AgentContext): string {
  const sections: string[] = [];

  // Cargo details
  sections.push(`## CARGO SHIPMENT
- Source: ${ctx.request.source}
- Destination: ${ctx.request.destination}
- Weight: ${ctx.request.cargo_weight_kg} kg
- Cargo Type: ${ctx.request.cargo_type}
- Priority: ${ctx.request.priority ?? "standard"}`);

  // Route data
  if (ctx.route_data) {
    sections.push(`## ROUTE DATA
- Straight-line distance: ${ctx.route_data.distances.straight_line_km} km
- Air distance: ${ctx.route_data.distances.air_km} km
- Sea distance: ${ctx.route_data.distances.sea_km} km
- Rail distance: ${ctx.route_data.distances.rail_km} km
- Road distance: ${ctx.route_data.distances.road_km} km`);
  }

  // Mode estimates
  if (ctx.mode_estimates && ctx.mode_estimates.length > 0) {
    const modeLines = ctx.mode_estimates.map((e) =>
      `- ${e.mode.toUpperCase()}: Cost=$${e.adjusted_cost_usd} (base=$${e.base_cost_usd}), Transit=${e.adjusted_transit_days}d (base=${e.transit_days}d), Reliability=${(e.reliability_score * 100).toFixed(0)}%, Risk=${e.risk_level}, CO2=${e.co2_kg}kg, Disruption×${e.disruption_multiplier.toFixed(2)}`
    );
    sections.push(`## TRANSPORT MODE ESTIMATES (REAL-TIME DATA)\n${modeLines.join("\n")}`);
  }

  // Active disruptions
  if (ctx.active_disruptions && ctx.active_disruptions.length > 0) {
    const disruptionLines = ctx.active_disruptions.slice(0, 10).map((d) =>
      `- [${d.severity.toUpperCase()}] ${d.event_type} at ${d.location}: ${d.summary.slice(0, 150)}`
    );
    sections.push(`## ACTIVE DISRUPTION INTELLIGENCE\n${disruptionLines.join("\n")}`);
  } else {
    sections.push("## ACTIVE DISRUPTION INTELLIGENCE\nNo active disruptions detected. All routes are clear.");
  }

  // Disruption impacts
  if (ctx.disruption_impacts) {
    const impactLines = ctx.disruption_impacts
      .filter((i) => i.reasons.length > 0)
      .map((i) =>
        `- ${i.mode.toUpperCase()}: cost×${i.cost_multiplier.toFixed(2)}, delay×${i.delay_multiplier.toFixed(2)}, risk=${i.risk_level} — ${i.reasons[0]}`
      );
    if (impactLines.length > 0) {
      sections.push(`## DISRUPTION IMPACT ON MODES\n${impactLines.join("\n")}`);
    }
  }

  sections.push("## TASK\nAnalyze all the above real-time data. Recommend the optimal logistics route. Return ONLY valid JSON.");

  return sections.join("\n\n");
}

// ─── FALLBACK RECOMMENDATION ─────────────────────────────────────────────────

function buildFallbackRecommendation(ctx: AgentContext): AIRecommendation {
  const estimates = ctx.mode_estimates ?? [];
  if (estimates.length === 0) {
    return {
      recommended_mode: "sea",
      estimated_cost_usd: 0,
      estimated_delay_days: 0,
      risk_level: "medium",
      reason: "Insufficient data for AI analysis. Defaulting to sea freight.",
      best_route: "sea",
      safest_route: "air",
      fastest_route: "air",
      cheapest_route: "sea",
      confidence: 0.3,
    };
  }

  // Simple heuristic fallback
  const sorted = [...estimates].sort((a, b) => {
    // Composite score: lower is better
    const scoreA = a.adjusted_cost_usd / 1000 + a.adjusted_transit_days * 2 + (a.risk_level === "high" || a.risk_level === "critical" ? 10 : 0);
    const scoreB = b.adjusted_cost_usd / 1000 + b.adjusted_transit_days * 2 + (b.risk_level === "high" || b.risk_level === "critical" ? 10 : 0);
    return scoreA - scoreB;
  });

  const cheapest = [...estimates].sort((a, b) => a.adjusted_cost_usd - b.adjusted_cost_usd)[0];
  const fastest = [...estimates].sort((a, b) => a.adjusted_transit_days - b.adjusted_transit_days)[0];
  const safest = [...estimates].sort((a, b) => b.reliability_score - a.reliability_score)[0];
  const best = sorted[0];

  return {
    recommended_mode: best.mode,
    estimated_cost_usd: best.adjusted_cost_usd,
    estimated_delay_days: best.adjusted_transit_days,
    risk_level: best.risk_level,
    reason: `Fallback analysis: ${best.mode} offers the best balance of cost ($${best.adjusted_cost_usd}), transit time (${best.adjusted_transit_days}d), and reliability (${(best.reliability_score * 100).toFixed(0)}%).`,
    best_route: best.mode,
    safest_route: safest.mode,
    fastest_route: fastest.mode,
    cheapest_route: cheapest.mode,
    confidence: 0.6,
  };
}

// ─── AGENT EXECUTION ──────────────────────────────────────────────────────────

const MAX_RETRIES = 2;

export async function recommendationAgent(ctx: AgentContext): Promise<AgentContext> {
  const start = Date.now();
  ctx.logs.push("[RecommendationAgent] Invoking Groq + Llama 3 for AI reasoning...");

  const userPrompt = buildUserPrompt(ctx);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        messages: [
          { role: "system", content: RECOMMENDATION_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) throw new Error("Empty response from Groq");

      const recommendation = JSON.parse(responseText) as AIRecommendation;

      // Validate critical fields
      if (!recommendation.recommended_mode || !recommendation.reason) {
        throw new Error("Invalid recommendation structure");
      }

      ctx.ai_recommendation = recommendation;
      ctx.logs.push(
        `[RecommendationAgent] AI recommends: ${recommendation.recommended_mode.toUpperCase()} — $${recommendation.estimated_cost_usd}, ${recommendation.estimated_delay_days}d, risk=${recommendation.risk_level}`
      );
      ctx.logs.push(`[RecommendationAgent] Reason: ${recommendation.reason}`);
      ctx.logs.push(`[RecommendationAgent] Completed in ${Date.now() - start}ms`);

      return ctx;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logs.push(`[RecommendationAgent] Attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`);
      if (attempt === MAX_RETRIES) {
        ctx.errors.push(`[RecommendationAgent] AI reasoning failed: ${msg}`);
        ctx.logs.push("[RecommendationAgent] Using fallback heuristic recommendation");
        ctx.ai_recommendation = buildFallbackRecommendation(ctx);
      } else {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  return ctx;
}
