import { NextRequest, NextResponse } from "next/server";
import { runCostAnalysis, CargoRequest } from "@/services/cost-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow up to 60s for full pipeline

/**
 * Shared handler for both GET and POST requests
 */
async function handleAnalysis(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let body: any = {};
    
    // Attempt to parse body for POST/PUT
    if (req.method !== "GET") {
      try {
        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          body = await req.json();
        } else {
          // Handle form data or other formats if needed
          const formData = await req.formData();
          formData.forEach((value, key) => {
            body[key] = value;
          });
        }
      } catch (e) {
        // Fallback to query params
      }
    }

    // Extract with fallback logic and case-insensitivity
    const getParam = (name: string) => body[name] || searchParams.get(name);
    
    const source = getParam("source");
    const destination = getParam("destination");
    const weightRaw = getParam("cargo_weight_kg") || getParam("weight") || getParam("cargo_weight");
    const cargoType = getParam("cargo_type") || getParam("type") || getParam("cargo");
    const priority = getParam("priority") || "standard";

    // --- DEMO MODE ---
    // If NO parameters are provided, run a default "Mumbai -> Rotterdam" demo
    // This ensures that visiting the URL in a browser returns a "WOW" result instead of an error.
    if (!source && !destination && !weightRaw) {
      console.log("[/api/cost-analysis] No params provided. Running DEMO mode: Mumbai -> Rotterdam");
      const demoRequest: CargoRequest = {
        source: "Mumbai",
        destination: "Rotterdam",
        cargo_weight_kg: 5000,
        cargo_type: "electronics",
        priority: "standard",
      };
      const result = await runCostAnalysis(demoRequest);
      return NextResponse.json({
        info: "This is a DEMO result because no parameters were provided. Add ?source=... to customize.",
        ...result
      }, { status: 200 });
    }

    if (!source || !destination || !weightRaw || !cargoType) {
      return NextResponse.json(
        {
          error: "Missing required parameters",
          required: ["source", "destination", "weight", "type"],
          example: `${req.nextUrl.origin}${req.nextUrl.pathname}?source=Mumbai&destination=Rotterdam&weight=5000&type=electronics`
        },
        { status: 400 }
      );
    }

    const request: CargoRequest = {
      source: String(source).trim(),
      destination: String(destination).trim(),
      cargo_weight_kg: Number(weightRaw),
      cargo_type: String(cargoType).trim(),
      priority: priority as any,
    };

    if (isNaN(request.cargo_weight_kg) || request.cargo_weight_kg <= 0) {
      return NextResponse.json({ error: "weight must be a positive number" }, { status: 400 });
    }

    console.log(`[/api/cost-analysis] Starting ${req.method} pipeline:`, request);

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

export async function GET(req: NextRequest) {
  return handleAnalysis(req);
}

export async function POST(req: NextRequest) {
  return handleAnalysis(req);
}
