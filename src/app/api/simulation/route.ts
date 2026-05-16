import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";
import type { DisruptionEvent } from "@/lib/types";

export const runtime = "nodejs";

export interface SimulationRequest {
  description: string; // free-text description of the disruption
  severity?: "low" | "medium" | "high" | "critical";
}

export interface SimulationResponse {
  event: DisruptionEvent;
}

const SYSTEM_PROMPT = `You are a logistics disruption intelligence analyst. Convert free-text disruption descriptions into structured JSON.

Output ONLY a single valid JSON object (no markdown, no explanation) matching this schema exactly:
{
  "is_disruption": true,
  "event_type": "<string: e.g. port_closure, weather_event, strike, conflict, geopolitical, infrastructure_failure>",
  "severity": "<low|medium|high|critical>",
  "title": "<concise title under 80 chars>",
  "summary": "<1-2 sentence summary>",
  "location": "<primary geographic location>",
  "affected_transport_modes": ["<sea|rail|road|air>"],
  "affected_trade_routes": ["<route names if known>"],
  "estimated_delay_days": <integer>,
  "economic_impact_level": "<low|moderate|high|severe>",
  "confidence_score": <0.0–1.0>
}

If severity is provided by the caller, use it. Otherwise infer from context.
Be precise and realistic. Match the tone of real logistics intelligence reports.`;

export async function POST(req: NextRequest) {
  try {
    const body: SimulationRequest = await req.json();
    const { description, severity } = body;

    if (!description || description.trim().length < 5) {
      return NextResponse.json({ error: "Description too short" }, { status: 400 });
    }

    const userPrompt = severity
      ? `Convert this disruption to JSON (severity must be "${severity}"): ${description}`
      : `Convert this disruption to JSON: ${description}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 512,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    // Extract JSON from the response (handle potential wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response", raw }, { status: 500 });
    }

    const event = JSON.parse(jsonMatch[0]) as DisruptionEvent;
    // Ensure is_disruption is true
    event.is_disruption = true;

    return NextResponse.json({ event } satisfies SimulationResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
