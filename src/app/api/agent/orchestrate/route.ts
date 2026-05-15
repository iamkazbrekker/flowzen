/**
 * POST /api/agent/orchestrate
 *
 * Multi-agent orchestration loop:
 *   Planner ─► Reroute Agent ─► Cargo Cost Agent ─► Planner evaluates
 *              └── if cost too high, Planner fans out to next alternative ──┘
 *
 * Returns a full trace of every agent step so the UI can render it live.
 */

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { DisruptionEvent } from "@/lib/types";
import { startWorkflowTrace, startSpan, endSpan, endTrace, getTraceUrl } from "@/lib/omium";

export const runtime = "nodejs";
export const maxDuration = 90;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

// ── Shared types ──────────────────────────────────────────────────────────────
export interface LegInput {
  id: string;
  fromName: string;
  fromLat: number;
  fromLng: number;
  toName: string;
  toLat: number;
  toLng: number;
  mode: string;
  cargoWeightKg?: number;
  cargoType?: string;
}

export type AgentStatus = "pending" | "running" | "done" | "failed";
export type AgentName = "planner" | "reroute" | "cargo" | "evaluator";

export interface AgentStep {
  agent: AgentName;
  status: AgentStatus;
  iteration: number;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  reasoning: string;
  durationMs: number;
}

export interface OrchestrationResult {
  legId: string;
  solved: boolean;
  iterations: number;
  finalMode: string;
  finalCostUsd: number;
  finalTransitDays: number;
  finalRecommendation: string;
  steps: AgentStep[];
  traceUrl?: string | null;
}

// ── Cost model ───────────────────────────────────────────────────────────────
const COST_PER_KG_PER_DAY: Record<string, number> = {
  sea:  0.08,
  rail: 0.22,
  road: 0.45,
  air:  1.80,
};
const TRANSIT_DAYS: Record<string, number> = {
  sea:  18,
  rail:  9,
  road:  5,
  air:   2,
};
const ALT_CHAIN: Record<string, string[]> = {
  sea:  ["rail", "road", "air"],
  rail: ["road", "sea",  "air"],
  road: ["rail", "sea",  "air"],
  air:  ["sea",  "rail", "road"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function estimateCost(mode: string, weightKg: number, days: number) {
  const rate = COST_PER_KG_PER_DAY[mode] ?? 0.3;
  return Math.round(rate * weightKg * days);
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    max_tokens: 400,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

// ── Sub-agent: Reroute ────────────────────────────────────────────────────────
async function runRerouteAgent(
  traceId: string | null,
  parentSpanId: string | null,
  leg: LegInput,
  disruptions: DisruptionEvent[],
  attemptMode: string,
  iteration: number
): Promise<AgentStep> {
  const t0 = Date.now();
  const input = { leg: `${leg.fromName}→${leg.toName}`, proposedMode: attemptMode, disruptions: disruptions.length };
  
  const spanId = traceId ? await startSpan(traceId, parentSpanId, "reroute_agent", input) : null;

  const reasoning = await callGroq(
    `You are a logistics rerouting specialist. Given a disrupted route leg and a proposed alternative transport mode, explain in 2 sentences why this alternative is or isn't appropriate. Be direct and specific.`,
    `Route: ${leg.fromName} → ${leg.toName}
Original mode: ${leg.mode}
Proposed alternative: ${attemptMode}
Disruptions: ${disruptions.map(d => `[${d.severity}] ${d.title}`).join("; ")}
Iteration: ${iteration}`
  );

  const output = { recommendedMode: attemptMode, reasoning };
  if (traceId && spanId) await endSpan(traceId, spanId, output);

  return {
    agent: "reroute",
    status: "done",
    iteration,
    input,
    output,
    reasoning,
    durationMs: Date.now() - t0,
  };
}

// ── Sub-agent: Cargo Cost ─────────────────────────────────────────────────────
async function runCargoAgent(
  traceId: string | null,
  parentSpanId: string | null,
  leg: LegInput,
  mode: string,
  disruptions: DisruptionEvent[],
  iteration: number,
  costThresholdUsd: number
): Promise<{ step: AgentStep; costUsd: number; transitDays: number; viable: boolean }> {
  const t0 = Date.now();
  const weightKg = leg.cargoWeightKg ?? 5000;
  const days = TRANSIT_DAYS[mode] ?? 10;
  const costUsd = estimateCost(mode, weightKg, days);
  const viable = costUsd <= costThresholdUsd;
  const input = { mode, weightKg, cargoType: leg.cargoType ?? "general", thresholdUsd: costThresholdUsd };

  const spanId = traceId ? await startSpan(traceId, parentSpanId, "cargo_cost_agent", input) : null;

  const reasoning = await callGroq(
    `You are a cargo cost analyst. Evaluate whether a shipping cost is acceptable for a logistics operation. Respond in 2 sentences.`,
    `Route: ${leg.fromName} → ${leg.toName}
Mode: ${mode}
Cargo: ${weightKg}kg of ${leg.cargoType ?? "general goods"}
Estimated cost: $${costUsd.toLocaleString()}
Cost threshold: $${costThresholdUsd.toLocaleString()}
Transit days: ${days}
Active disruptions: ${disruptions.map(d => d.title).join(", ")}
Is this viable? ${viable ? "YES" : "NO - exceeds threshold"}`
  );

  const output = { costUsd, transitDays: days, viable };
  if (traceId && spanId) await endSpan(traceId, spanId, output, viable ? "success" : "failed");

  return {
    step: {
      agent: "cargo",
      status: "done",
      iteration,
      input,
      output,
      reasoning,
      durationMs: Date.now() - t0,
    },
    costUsd,
    transitDays: days,
    viable,
  };
}

// ── Planner evaluation ────────────────────────────────────────────────────────
async function runPlannerEvaluation(
  traceId: string | null,
  parentSpanId: string | null,
  leg: LegInput,
  allSteps: AgentStep[],
  finalMode: string,
  costUsd: number,
  transitDays: number,
  solved: boolean,
  iterations: number
): Promise<AgentStep> {
  const t0 = Date.now();
  const input = { leg: `${leg.fromName}→${leg.toName}`, totalIterations: iterations };
  const spanId = traceId ? await startSpan(traceId, parentSpanId, "planner_evaluate", input) : null;

  const stepSummary = allSteps
    .map(s => `[${s.agent.toUpperCase()} iter=${s.iteration}] ${s.reasoning}`)
    .join("\n");

  const reasoning = await callGroq(
    `You are the master logistics planning agent. You coordinated a multi-agent rerouting workflow. Summarize the outcome and provide a final recommendation in 3-4 sentences.`,
    `Route: ${leg.fromName} → ${leg.toName}
Original mode: ${leg.mode}
Iterations run: ${iterations}
Final mode chosen: ${finalMode}
Final estimated cost: $${costUsd.toLocaleString()}
Final transit days: ${transitDays}
Solved within budget: ${solved}

Agent trace:
${stepSummary}`
  );

  const output = { finalMode, finalCostUsd: costUsd, finalTransitDays: transitDays, solved };
  if (traceId && spanId) await endSpan(traceId, spanId, output, solved ? "success" : "failed");

  return {
    agent: "planner",
    status: solved ? "done" : "failed",
    iteration: iterations,
    input,
    output,
    reasoning,
    durationMs: Date.now() - t0,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      leg: LegInput;
      disruptions: DisruptionEvent[];
      costThresholdUsd?: number;
      maxIterations?: number;
    };

    const { leg, disruptions } = body;
    const costThresholdUsd = body.costThresholdUsd ?? 50_000;
    const maxIterations    = Math.min(body.maxIterations ?? 4, 6);

    if (!leg || !disruptions) {
      return NextResponse.json({ error: "Missing leg or disruptions" }, { status: 400 });
    }

    const steps: AgentStep[] = [];
    const alternatives = ALT_CHAIN[leg.mode] ?? ["sea", "rail", "road"];
    let solved = false;
    let iteration = 0;
    let finalMode = leg.mode;
    let finalCost = 0;
    let finalDays = 0;

    // ── Start Omium Root Trace ────────────────────────────────────────────────
    const traceId = await startWorkflowTrace("planner_orchestration", {
      leg: `${leg.fromName}→${leg.toName}`,
      disruptions: disruptions.length,
      costThresholdUsd
    });
    const traceUrl = traceId ? getTraceUrl(traceId) : null;

    // ── Initial planner step ─────────────────────────────────────────────────
    const plannerFanoutSpanId = traceId ? await startSpan(traceId, null, "planner_fanout", { alternatives, costThreshold: costThresholdUsd }) : null;

    const plannerStart: AgentStep = {
      agent: "planner",
      status: "done",
      iteration: 0,
      input: {
        route: `${leg.fromName} → ${leg.toName}`,
        originalMode: leg.mode,
        disruptions: disruptions.map(d => d.title),
        alternatives,
        costThreshold: costThresholdUsd,
      },
      output: { plan: "Fan out to Reroute Agent then Cargo Cost Agent for each alternative" },
      reasoning: `Disruption detected on ${leg.mode} leg (${leg.fromName} → ${leg.toName}). Planning to evaluate ${alternatives.length} alternatives: ${alternatives.join(", ")}. Cost threshold: $${costThresholdUsd.toLocaleString()}.`,
      durationMs: 0,
    };
    steps.push(plannerStart);

    if (traceId && plannerFanoutSpanId) await endSpan(traceId, plannerFanoutSpanId, plannerStart.output!);

    // ── Iterative reroute → cost loop ─────────────────────────────────────────
    for (const altMode of alternatives) {
      if (iteration >= maxIterations) break;
      iteration++;

      // Reroute agent
      const rerouteStep = await runRerouteAgent(traceId, null, leg, disruptions, altMode, iteration);
      steps.push(rerouteStep);

      // Cargo cost agent
      const { step: cargoStep, costUsd, transitDays, viable } = await runCargoAgent(
        traceId, null, leg, altMode, disruptions, iteration, costThresholdUsd
      );
      steps.push(cargoStep);

      finalMode = altMode;
      finalCost = costUsd;
      finalDays = transitDays;

      if (viable) {
        solved = true;
        break;
      }
      
      // Not viable — planner logs and continues to next alternative
      const loopSpanId = traceId ? await startSpan(traceId, null, "planner_loop", { rejectedMode: altMode, costUsd }) : null;
      const loopStep: AgentStep = {
        agent: "planner",
        status: "running",
        iteration,
        input: { rejectedMode: altMode, costUsd, reason: "exceeds threshold" },
        output: { nextAction: `Try next alternative` },
        reasoning: `${altMode.toUpperCase()} cost ($${costUsd.toLocaleString()}) exceeds threshold ($${costThresholdUsd.toLocaleString()}). Escalating to next alternative.`,
        durationMs: 0,
      };
      steps.push(loopStep);
      if (traceId && loopSpanId) await endSpan(traceId, loopSpanId, loopStep.output!);
    }

    // ── Final planner evaluation ──────────────────────────────────────────────
    const finalPlannerStep = await runPlannerEvaluation(
      traceId, null, leg, steps, finalMode, finalCost, finalDays, solved, iteration
    );
    steps.push(finalPlannerStep);

    const result: OrchestrationResult = {
      legId: leg.id,
      solved,
      iterations: iteration,
      finalMode,
      finalCostUsd: finalCost,
      finalTransitDays: finalDays,
      finalRecommendation: finalPlannerStep.reasoning,
      steps,
      traceUrl,
    };

    if (traceId) {
      await endTrace(traceId, { solved, finalMode, finalCostUsd: finalCost }, solved ? "success" : "failed");
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Orchestration failed";
    console.error("[orchestrate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
