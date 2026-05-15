/**
 * Pricing Utility — Configurable rate tables & estimation formulas
 * All rates are modular and can be adjusted per-region or cargo type
 */

import { TransportMode } from "../types";

// ─── RATE TABLES ──────────────────────────────────────────────────────────────

interface ModeRates {
  base_per_km: number;            // USD per km per 1000kg
  weight_factor: number;          // multiplier per 1000kg
  min_charge_usd: number;         // floor charge
  base_transit_days_per_1000km: number;
  co2_per_km_per_ton: number;     // kg CO2
  reliability_base: number;       // 0–1
  efficiency_base: number;        // 0–1
}

export const RATE_TABLE: Record<TransportMode, ModeRates> = {
  air: {
    base_per_km: 0.45,
    weight_factor: 0.90,
    min_charge_usd: 2500,
    base_transit_days_per_1000km: 0.15,
    co2_per_km_per_ton: 0.60,
    reliability_base: 0.92,
    efficiency_base: 0.95,
  },
  sea: {
    base_per_km: 0.03,
    weight_factor: 0.02,
    min_charge_usd: 800,
    base_transit_days_per_1000km: 1.8,
    co2_per_km_per_ton: 0.015,
    reliability_base: 0.78,
    efficiency_base: 0.70,
  },
  rail: {
    base_per_km: 0.06,
    weight_factor: 0.04,
    min_charge_usd: 600,
    base_transit_days_per_1000km: 0.8,
    co2_per_km_per_ton: 0.025,
    reliability_base: 0.85,
    efficiency_base: 0.80,
  },
  road: {
    base_per_km: 0.12,
    weight_factor: 0.08,
    min_charge_usd: 300,
    base_transit_days_per_1000km: 0.6,
    co2_per_km_per_ton: 0.10,
    reliability_base: 0.88,
    efficiency_base: 0.85,
  },
};

// ─── CARGO TYPE SURCHARGES ────────────────────────────────────────────────────

const CARGO_SURCHARGES: Record<string, number> = {
  electronics: 1.25,
  hazardous: 1.60,
  perishable: 1.45,
  fragile: 1.30,
  automotive: 1.15,
  pharmaceuticals: 1.50,
  textiles: 1.00,
  machinery: 1.10,
  chemicals: 1.40,
  general: 1.00,
};

export function getCargoSurcharge(cargoType: string): number {
  const key = cargoType.toLowerCase().trim();
  return CARGO_SURCHARGES[key] ?? 1.05; // default slight surcharge
}

// ─── ESTIMATION FUNCTIONS ─────────────────────────────────────────────────────

export function estimateCost(
  mode: TransportMode,
  distanceKm: number,
  weightKg: number,
  cargoType: string
): number {
  const rates = RATE_TABLE[mode];
  const weightTons = weightKg / 1000;
  const surcharge = getCargoSurcharge(cargoType);

  const baseCost =
    distanceKm * rates.base_per_km +
    weightTons * rates.weight_factor * distanceKm * 0.01;

  return Math.max(Math.round(baseCost * surcharge), rates.min_charge_usd);
}

export function estimateTransitDays(
  mode: TransportMode,
  distanceKm: number
): number {
  const rates = RATE_TABLE[mode];
  const raw = (distanceKm / 1000) * rates.base_transit_days_per_1000km;
  // Add loading/unloading buffer
  const buffer = mode === "sea" ? 3 : mode === "air" ? 1 : 2;
  return Math.round((raw + buffer) * 10) / 10;
}

export function estimateCO2(
  mode: TransportMode,
  distanceKm: number,
  weightKg: number
): number {
  const rates = RATE_TABLE[mode];
  const weightTons = weightKg / 1000;
  return Math.round(distanceKm * rates.co2_per_km_per_ton * weightTons * 10) / 10;
}
