/**
 * Route Fetch Agent
 * Responsibility: Geocode source/destination, compute distances, determine available modes
 * This is the first agent in the pipeline
 */

import { AgentContext } from "../types";
import {
  geocode,
  computeDistances,
  determineAvailableModes,
} from "../providers/distance-provider";

export async function routeFetchAgent(ctx: AgentContext): Promise<AgentContext> {
  const start = Date.now();
  ctx.logs.push("[RouteFetchAgent] Starting geocoding and distance computation...");

  try {
    // 1. Geocode both locations
    const [source, destination] = await Promise.all([
      geocode(ctx.request.source),
      geocode(ctx.request.destination),
    ]);

    ctx.logs.push(
      `[RouteFetchAgent] Geocoded: ${source.name} (${source.lat}, ${source.lng}) → ${destination.name} (${destination.lat}, ${destination.lng})`
    );

    // 2. Compute distances
    const distances = computeDistances(source, destination);
    ctx.logs.push(
      `[RouteFetchAgent] Distances: straight=${distances.straight_line_km}km, air=${distances.air_km}km, sea=${distances.sea_km}km, rail=${distances.rail_km}km, road=${distances.road_km}km`
    );

    // 3. Determine available modes
    const availableModes = determineAvailableModes(distances.straight_line_km);
    ctx.logs.push(
      `[RouteFetchAgent] Available modes: ${availableModes.join(", ")}`
    );

    ctx.route_data = {
      source,
      destination,
      distances,
      available_modes: availableModes,
    };

    ctx.logs.push(
      `[RouteFetchAgent] Completed in ${Date.now() - start}ms`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.errors.push(`[RouteFetchAgent] FAILED: ${msg}`);
    ctx.logs.push(`[RouteFetchAgent] ERROR: ${msg}`);
  }

  return ctx;
}
