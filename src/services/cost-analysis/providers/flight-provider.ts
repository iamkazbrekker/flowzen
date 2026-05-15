/**
 * Flight Provider
 * Estimates air freight pricing using industry formulas
 * Hackathon-friendly: uses estimation when no live API is available
 */

import { GeoPoint } from "../types";
import { haversineKm } from "./distance-provider";

// ─── AIR FREIGHT RATE TIERS ──────────────────────────────────────────────────

interface AirRate {
  maxKg: number;
  ratePerKgKm: number;
  fuelSurchargePercent: number;
  securityFee: number;
}

const AIR_RATE_TIERS: AirRate[] = [
  { maxKg: 100,   ratePerKgKm: 0.0045, fuelSurchargePercent: 0.18, securityFee: 120 },
  { maxKg: 500,   ratePerKgKm: 0.0038, fuelSurchargePercent: 0.15, securityFee: 200 },
  { maxKg: 2000,  ratePerKgKm: 0.0028, fuelSurchargePercent: 0.12, securityFee: 350 },
  { maxKg: 10000, ratePerKgKm: 0.0020, fuelSurchargePercent: 0.10, securityFee: 500 },
  { maxKg: Infinity, ratePerKgKm: 0.0015, fuelSurchargePercent: 0.08, securityFee: 800 },
];

function getAirRate(weightKg: number): AirRate {
  return AIR_RATE_TIERS.find((t) => weightKg <= t.maxKg) ?? AIR_RATE_TIERS[AIR_RATE_TIERS.length - 1];
}

// ─── ESTIMATE AIR FREIGHT COST ───────────────────────────────────────────────

export interface AirFreightEstimate {
  base_cost: number;
  fuel_surcharge: number;
  security_fee: number;
  total_cost: number;
  transit_hours: number;
  distance_km: number;
}

export function estimateAirFreight(
  source: GeoPoint,
  destination: GeoPoint,
  weightKg: number
): AirFreightEstimate {
  const distKm = Math.round(haversineKm(source, destination) * 1.05); // air distance factor
  const rate = getAirRate(weightKg);

  const baseCost = distKm * weightKg * rate.ratePerKgKm;
  const fuelSurcharge = baseCost * rate.fuelSurchargePercent;
  const totalCost = baseCost + fuelSurcharge + rate.securityFee;

  // Air speed ~850 km/h cruise, plus 6-12h for handling/customs
  const flightHours = distKm / 850;
  const handlingHours = weightKg > 2000 ? 12 : 8;
  const transitHours = Math.round((flightHours + handlingHours) * 10) / 10;

  return {
    base_cost: Math.round(baseCost),
    fuel_surcharge: Math.round(fuelSurcharge),
    security_fee: rate.securityFee,
    total_cost: Math.round(totalCost),
    transit_hours: transitHours,
    distance_km: distKm,
  };
}
