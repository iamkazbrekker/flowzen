/**
 * Distance Provider
 * Geocodes locations and computes distances using haversine + mode-specific multipliers
 * Uses OpenStreetMap Nominatim for geocoding (free, no API key)
 */

import { GeoPoint, DistanceResult } from "../types";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const MAX_RETRIES = 2;

// ─── GEOCODING ────────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string): Promise<unknown> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FlowZen/1.0 (logistics-intelligence)" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[DistanceProvider] Geocode attempt ${attempt} failed:`, msg);
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

export async function geocode(locationName: string): Promise<GeoPoint> {
  const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(locationName)}&format=json&limit=1`;
  const data = (await fetchWithRetry(url)) as Array<{ lat: string; lon: string; display_name: string }>;

  if (!data || data.length === 0) {
    // Fallback: use well-known logistics hubs
    const fallback = KNOWN_HUBS[locationName.toLowerCase()];
    if (fallback) return fallback;
    throw new Error(`Could not geocode: "${locationName}"`);
  }

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    name: data[0].display_name.split(",").slice(0, 2).join(",").trim(),
  };
}

// ─── KNOWN LOGISTICS HUBS (fallback) ─────────────────────────────────────────

const KNOWN_HUBS: Record<string, GeoPoint> = {
  mumbai: { lat: 19.076, lng: 72.8777, name: "Mumbai, India" },
  shanghai: { lat: 31.2304, lng: 121.4737, name: "Shanghai, China" },
  rotterdam: { lat: 51.9225, lng: 4.4792, name: "Rotterdam, Netherlands" },
  singapore: { lat: 1.3521, lng: 103.8198, name: "Singapore" },
  "los angeles": { lat: 33.7490, lng: -118.2437, name: "Los Angeles, USA" },
  dubai: { lat: 25.2048, lng: 55.2708, name: "Dubai, UAE" },
  hamburg: { lat: 53.5511, lng: 9.9937, name: "Hamburg, Germany" },
  yokohama: { lat: 35.4437, lng: 139.6380, name: "Yokohama, Japan" },
  "cape town": { lat: -33.9249, lng: 18.4241, name: "Cape Town, South Africa" },
  delhi: { lat: 28.6139, lng: 77.2090, name: "Delhi, India" },
  chennai: { lat: 13.0827, lng: 80.2707, name: "Chennai, India" },
  bengaluru: { lat: 12.9716, lng: 77.5946, name: "Bengaluru, India" },
  london: { lat: 51.5074, lng: -0.1278, name: "London, UK" },
  "new york": { lat: 40.7128, lng: -74.0060, name: "New York, USA" },
  tokyo: { lat: 35.6762, lng: 139.6503, name: "Tokyo, Japan" },
  "hong kong": { lat: 22.3193, lng: 114.1694, name: "Hong Kong" },
  busan: { lat: 35.1796, lng: 129.0756, name: "Busan, South Korea" },
  antwerp: { lat: 51.2194, lng: 4.4025, name: "Antwerp, Belgium" },
  felixstowe: { lat: 51.9615, lng: 1.3510, name: "Felixstowe, UK" },
  mundra: { lat: 22.8394, lng: 69.7250, name: "Mundra, India" },
};

// ─── HAVERSINE ────────────────────────────────────────────────────────────────

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ─── DISTANCE COMPUTATION ────────────────────────────────────────────────────

// Mode-specific multipliers over straight-line distance
const MODE_DISTANCE_FACTOR: Record<string, number> = {
  air: 1.05,    // near-direct
  sea: 1.40,    // follows shipping lanes, longer path
  rail: 1.30,   // follows rail corridors
  road: 1.25,   // highway network
};

export function computeDistances(source: GeoPoint, destination: GeoPoint): DistanceResult {
  const straight = haversineKm(source, destination);
  return {
    straight_line_km: Math.round(straight),
    air_km: Math.round(straight * MODE_DISTANCE_FACTOR.air),
    sea_km: Math.round(straight * MODE_DISTANCE_FACTOR.sea),
    rail_km: Math.round(straight * MODE_DISTANCE_FACTOR.rail),
    road_km: Math.round(straight * MODE_DISTANCE_FACTOR.road),
  };
}

// ─── MODE AVAILABILITY HEURISTIC ──────────────────────────────────────────────

export function determineAvailableModes(
  distanceKm: number
): Array<"air" | "sea" | "rail" | "road"> {
  const modes: Array<"air" | "sea" | "rail" | "road"> = ["air"]; // air always available

  if (distanceKm > 200) modes.push("sea");    // sea for 200km+
  if (distanceKm > 100) modes.push("rail");   // rail for 100km+
  modes.push("road");                          // road always available

  return modes;
}
