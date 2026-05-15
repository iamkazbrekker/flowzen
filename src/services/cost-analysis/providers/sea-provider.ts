/**
 * Sea Freight Provider
 * Estimates ocean freight pricing using container-based formulas
 * Includes route-specific adjustments and fuel surcharges
 */

import { GeoPoint } from "../types";
import { haversineKm } from "./distance-provider";

// ─── CONTAINER RATES ──────────────────────────────────────────────────────────

interface ContainerRate {
  type: string;
  maxKg: number;
  baseFee: number;         // USD per container
  perKmRate: number;       // USD per km
  fuelSurchargePerKm: number;
}

const CONTAINER_RATES: ContainerRate[] = [
  { type: "LCL",  maxKg: 500,    baseFee: 400,  perKmRate: 0.012, fuelSurchargePerKm: 0.003 },
  { type: "20ft", maxKg: 21000,  baseFee: 1200, perKmRate: 0.025, fuelSurchargePerKm: 0.006 },
  { type: "40ft", maxKg: 28000,  baseFee: 2000, perKmRate: 0.035, fuelSurchargePerKm: 0.008 },
  { type: "40ft HC", maxKg: Infinity, baseFee: 2400, perKmRate: 0.040, fuelSurchargePerKm: 0.009 },
];

function selectContainer(weightKg: number): ContainerRate {
  return CONTAINER_RATES.find((c) => weightKg <= c.maxKg) ?? CONTAINER_RATES[CONTAINER_RATES.length - 1];
}

// ─── PORT FEES BY REGION ──────────────────────────────────────────────────────

const PORT_HANDLING_FEES: Record<string, number> = {
  asia: 350,
  europe: 450,
  "north america": 500,
  "south america": 380,
  africa: 300,
  "middle east": 400,
  oceania: 420,
  default: 380,
};

function getPortFee(locationName: string): number {
  const lower = locationName.toLowerCase();
  if (["india", "china", "japan", "korea", "singapore", "vietnam", "thailand", "mumbai", "shanghai", "yokohama", "busan", "chennai"].some((k) => lower.includes(k)))
    return PORT_HANDLING_FEES.asia;
  if (["rotterdam", "hamburg", "antwerp", "felixstowe", "london", "europe", "germany", "netherlands"].some((k) => lower.includes(k)))
    return PORT_HANDLING_FEES.europe;
  if (["los angeles", "new york", "usa", "america", "canada"].some((k) => lower.includes(k)))
    return PORT_HANDLING_FEES["north america"];
  if (["dubai", "uae", "oman", "saudi"].some((k) => lower.includes(k)))
    return PORT_HANDLING_FEES["middle east"];
  if (["cape town", "nigeria", "kenya", "africa"].some((k) => lower.includes(k)))
    return PORT_HANDLING_FEES.africa;
  return PORT_HANDLING_FEES.default;
}

// ─── ESTIMATE SEA FREIGHT ────────────────────────────────────────────────────

export interface SeaFreightEstimate {
  container_type: string;
  base_fee: number;
  distance_cost: number;
  fuel_surcharge: number;
  port_fees: number;
  total_cost: number;
  transit_days: number;
  distance_km: number;
}

export function estimateSeaFreight(
  source: GeoPoint,
  destination: GeoPoint,
  weightKg: number,
  sourceName: string,
  destName: string
): SeaFreightEstimate {
  const distKm = Math.round(haversineKm(source, destination) * 1.40); // sea route factor
  const container = selectContainer(weightKg);

  const distanceCost = distKm * container.perKmRate;
  const fuelSurcharge = distKm * container.fuelSurchargePerKm;
  const portFees = getPortFee(sourceName) + getPortFee(destName);
  const totalCost = container.baseFee + distanceCost + fuelSurcharge + portFees;

  // Average vessel speed ~28 km/h (15 knots), plus 3-5 days port handling
  const sailingDays = distKm / (28 * 24);
  const portDays = 4;
  const transitDays = Math.round((sailingDays + portDays) * 10) / 10;

  return {
    container_type: container.type,
    base_fee: container.baseFee,
    distance_cost: Math.round(distanceCost),
    fuel_surcharge: Math.round(fuelSurcharge),
    port_fees: portFees,
    total_cost: Math.round(totalCost),
    transit_days: transitDays,
    distance_km: distKm,
  };
}
