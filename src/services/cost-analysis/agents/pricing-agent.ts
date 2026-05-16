import { AgentContext, ModeEstimate, TransportMode } from "../types";
import { scrapeLiveFares, getFallbackFares, ScrapedFare } from "../providers/scraping-provider";

export async function pricingAgent(ctx: AgentContext): Promise<AgentContext> {
  const start = Date.now();
  ctx.logs.push("[PricingAgent] Fetching live transportation fares via Playwright...");

  if (!ctx.route_data) {
    ctx.errors.push("[PricingAgent] No route_data available — skipping.");
    return ctx;
  }

  const { source, destination, distances, available_modes } = ctx.route_data;
  const { cargo_weight_kg } = ctx.request;
  const estimates: ModeEstimate[] = [];

  // 1. Get Live Exchange Rate (USD -> INR)
  let usdToInr = 83.5; 
  let apiUsed = "fallback";
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR");
    if (res.ok) {
      const data = await res.json();
      usdToInr = data.rates.INR;
      apiUsed = "Frankfurter API";
    }
  } catch (err) {
    ctx.logs.push("[PricingAgent] Currency API failed, using fallback rate.");
  }

  // 2. Run Live Scraping for all available modes
  // Note: For hackathon performance, we scrape primary modes and fallback for others
  let liveFares: ScrapedFare[] = [];
  try {
    liveFares = await scrapeLiveFares(source.name, destination.name, cargo_weight_kg);
    if (liveFares.length > 0) {
      ctx.logs.push(`[PricingAgent] Successfully scraped ${liveFares.length} live fares.`);
    }
  } catch (err) {
    ctx.logs.push(`[PricingAgent] Scraping failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Process each mode
  for (const mode of available_modes) {
    try {
      // Find live scraped fare or use fallback
      let fare = liveFares.find(f => f.mode === mode);
      
      if (!fare) {
        const dist = distances[`${mode}_km` as keyof typeof distances] as number ?? distances.straight_line_km;
        fare = getFallbackFares(mode, dist, cargo_weight_kg);
        ctx.logs.push(`[PricingAgent] Using market index for ${mode.toUpperCase()}`);
      } else {
        ctx.logs.push(`[PricingAgent] Using LIVE fare for ${mode.toUpperCase()} from ${fare.provider}`);
      }

      const costInr = Math.round(fare.price_usd * usdToInr);

      estimates.push({
        mode,
        base_cost_inr: costInr,
        adjusted_cost_inr: costInr,
        transit_days: fare.duration_days,
        adjusted_transit_days: fare.duration_days,
        reliability_score: fare.is_live ? 0.95 : 0.85,
        efficiency_score: 0.90,
        co2_kg: Math.round(fare.duration_days * 50), // Mock CO2 based on duration
        distance_km: distances[`${mode}_km` as keyof typeof distances] as number ?? distances.straight_line_km,
        disruption_multiplier: 1.0,
        risk_level: "low",
        available: true,
        is_live: fare.is_live,
        provider: fare.provider,
        notes: fare.is_live ? [`Live fare extracted from ${fare.provider}`] : ["Estimated via market index"],
      });

    } catch (err) {
      ctx.errors.push(`[PricingAgent] Error processing ${mode}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  ctx.mode_estimates = estimates;
  ctx.exchange_rate = { api_used: apiUsed, usd_to_inr: usdToInr };
  ctx.logs.push(`[PricingAgent] Completed in ${Date.now() - start}ms`);

  return ctx;
}
