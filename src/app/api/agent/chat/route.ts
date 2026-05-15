import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";
import type { DisruptionEvent } from "@/lib/types";
import type { RerouteResult } from "../reroute/route";

export const runtime = "nodejs";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  journey: {
    name: string;
    legs: Array<{
      id: string;
      fromName: string;
      toName: string;
      mode: string;
      distKm: number;
      durationHr: number;
    }>;
  };
  disruptions: DisruptionEvent[];
  analyses: Array<{ legId: string; result: RerouteResult }>;
  simulatedDisruptions: DisruptionEvent[];
}

function buildSystemPrompt(req: ChatRequest): string {
  const { journey, disruptions, analyses, simulatedDisruptions } = req;

  const legsDesc = journey.legs
    .map((l, i) => {
      const analysis = analyses.find(a => a.legId === l.id);
      const sev = analysis?.result?.severity ?? "unknown";
      const affected = analysis?.result?.affected ? "⚠ AFFECTED" : "✓ CLEAR";
      const rerouted = analysis?.result?.rerouted ? " [REROUTED]" : "";
      return `  Leg ${i + 1}: ${l.fromName} → ${l.toName} via ${l.mode.toUpperCase()} | ~${l.distKm} km | ~${l.durationHr > 24 ? `${(l.durationHr / 24).toFixed(1)} days` : `${l.durationHr.toFixed(1)} hrs`} | Status: ${affected} (${sev})${rerouted}`;
    })
    .join("\n");

  const realDisruptionsDesc = disruptions.length > 0
    ? disruptions
        .slice(0, 10)
        .map(d => `  - [${d.severity.toUpperCase()}] ${d.title} @ ${d.location}: ${d.summary} (Est. delay: ${d.estimated_delay_days ?? "?"} days)`)
        .join("\n")
    : "  None currently.";

  const simDesc = simulatedDisruptions.length > 0
    ? simulatedDisruptions
        .map(d => `  - [SIMULATED][${d.severity.toUpperCase()}] ${d.title} @ ${d.location}: ${d.summary}`)
        .join("\n")
    : "  None.";

  const affectedLegsDesc = analyses
    .filter(a => a.result.affected)
    .map(a => {
      const leg = journey.legs.find(l => l.id === a.legId);
      return `  - ${leg?.fromName ?? "?"} → ${leg?.toName ?? "?"}: ${a.result.recommendation?.split("\n")[0] ?? ""}`;
    })
    .join("\n") || "  No legs currently affected.";

  return `You are FLOWZEN AI, an intelligent logistics co-pilot embedded inside the FlowZen logistics platform.

Your role is to assist users with:
- Journey and route intelligence
- Real-time disruption analysis
- Delay estimates and risk assessment
- Re-routing recommendations
- Simulation interpretation

## Current Journey: "${journey.name}"
Legs:
${legsDesc}

## Real-Time Active Disruptions (${disruptions.length} total):
${realDisruptionsDesc}

## Simulated Disruptions (user-injected for testing):
${simDesc}

## Agent Analysis — Affected Legs:
${affectedLegsDesc}

## Instructions:
- Be concise and precise. Use logistics/shipping terminology.
- Reference specific legs, locations, and disruptions by name.
- Always give actionable recommendations when discussing problems.
- Use ⚠, ✓, ↪ emoji sparingly for emphasis.
- If a user asks about something outside the current journey context, still help.
- Keep responses under 200 words unless the user explicitly asks for detail.`;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { messages } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(body);

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.5,
      max_tokens: 512,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "I couldn't generate a response.";
    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
