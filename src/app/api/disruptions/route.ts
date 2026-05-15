import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runPipeline();
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    console.error("[/api/disruptions] Pipeline failed:", message);
    return NextResponse.json(
      { error: "Pipeline failed", details: message },
      { status: 500 }
    );
  }
}
