import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Cache for 60s

export async function GET() {
  try {
    console.log("[/api/disruptions] Triggering NLP disruption pipeline...");
    const result = await runPipeline();
    
    return NextResponse.json({
      disruptions: result.events,
      metadata: {
        total_fetched: result.total_fetched,
        relevant_count: result.relevant_count,
        deduplicated_count: result.deduplicated_count,
        timestamp: result.timestamp
      }
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/disruptions] Pipeline error:", msg);
    return NextResponse.json({ disruptions: [], error: msg }, { status: 500 });
  }
}
