import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import type { DisruptionEvent } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 60; // Cache for 60s

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("disruptions")
      .select("*")
      .eq("is_disruption", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Supabase fetch error:", error.message);
      return NextResponse.json({ disruptions: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      disruptions: (data ?? []) as DisruptionEvent[],
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ disruptions: [], error: msg }, { status: 500 });
  }
}
