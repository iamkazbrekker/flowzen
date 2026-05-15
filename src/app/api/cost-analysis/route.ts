/**
 * API Route: POST /api/cost-analysis
 * Runs the multi-agent cost analysis pipeline
 *
 * Body: { source, destination, cargo_weight_kg, cargo_type, priority? }
 * Response: CostAnalysisResult
 */

import { NextRequest, NextResponse } from "next/server";
import { runCostAnalysis, CargoRequest } from "@/services/cost-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow up to 60s for full pipeline

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const source = searchParams.get('source');
    const destination = searchParams.get('destination');
    const weightStr = searchParams.get('weight');
    const typeStr = searchParams.get('type');

    if (!source || !destination || !weightStr || !typeStr) {
      return NextResponse.json(
        {
          error: "Missing required query parameters",
          usage: "Visit /api/cost-analysis?source=Mumbai&destination=Rotterdam&weight=5000&type=electronics",
          required: ["source", "destination", "weight", "type"],
        },
        { status: 400 }
      );
    }

    const cargo_weight_kg = Number(weightStr);
    const cargo_type = typeStr;

    if (isNaN(cargo_weight_kg) || cargo_weight_kg <= 0) {
      return NextResponse.json(
        { error: "weight must be a positive number" },
        { status: 400 }
      );
    }

    const rawPriority = searchParams.get('priority');
    const validPriorities = ["standard", "express", "critical"] as const;
    const priority = validPriorities.includes(rawPriority as any) 
      ? (rawPriority as "standard" | "express" | "critical") 
      : "standard";

    const request: CargoRequest = {
      source: String(source).trim(),
      destination: String(destination).trim(),
      cargo_weight_kg,
      cargo_type: String(cargo_type).trim(),
      priority,
    };

    console.log("[/api/cost-analysis] Starting pipeline (GET):", request);

    const result = await runCostAnalysis(request);

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    console.error("[/api/cost-analysis] Pipeline failed:", message);
    return NextResponse.json(
      { error: "Cost analysis pipeline failed", details: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const { source, destination, cargo_weight_kg, cargo_type } = body;
    if (!source || !destination || !cargo_weight_kg || !cargo_type) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["source", "destination", "cargo_weight_kg", "cargo_type"],
        },
        { status: 400 }
      );
    }

    if (typeof cargo_weight_kg !== "number" || cargo_weight_kg <= 0) {
      return NextResponse.json(
        { error: "cargo_weight_kg must be a positive number" },
        { status: 400 }
      );
    }

    const request: CargoRequest = {
      source: String(source).trim(),
      destination: String(destination).trim(),
      cargo_weight_kg: Number(cargo_weight_kg),
      cargo_type: String(cargo_type).trim(),
      priority: body.priority ?? "standard",
    };

    console.log("[/api/cost-analysis] Starting pipeline:", request);

    const result = await runCostAnalysis(request);

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    console.error("[/api/cost-analysis] Pipeline failed:", message);
    return NextResponse.json(
      { error: "Cost analysis pipeline failed", details: message },
      { status: 500 }
    );
  }
}
