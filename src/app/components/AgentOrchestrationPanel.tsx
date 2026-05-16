"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BotMessageSquare, GitFork, DollarSign,
  CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, ArrowRight, RefreshCw,
} from "lucide-react";
import type { LegAnalysis } from "@/hooks/useDisruptionAgent";
import type { Journey } from "./JourneyBuilder";
import type { DisruptionEvent } from "@/lib/types";
import type { AgentStep, AgentName } from "../api/agent/orchestrate/route";
import { useOrchestrator } from "@/hooks/useOrchestrator";
import TextScramble from "./TextScramble";

// ── Agent visual config ────────────────────────────────────────────────────────
const AGENT_META: Record<AgentName, { label: string; color: string; icon: React.FC<{ style?: React.CSSProperties }> }> = {
  planner:   { label: "Planner",     color: "#818cf8", icon: ({ style }) => <BotMessageSquare style={style} /> },
  reroute:   { label: "Reroute",     color: "#f97316", icon: ({ style }) => <GitFork          style={style} /> },
  cargo:     { label: "Cost Agent",  color: "#2dd4bf", icon: ({ style }) => <DollarSign       style={style} /> },
  evaluator: { label: "Evaluator",   color: "#a855f7", icon: ({ style }) => <BotMessageSquare style={style} /> },
};

interface Props {
  journey: Journey;
  analyses: LegAnalysis[];
  simDisruptions: DisruptionEvent[];
}

function StatusDot({ status }: { status: AgentStep["status"] }) {
  const colors: Record<AgentStep["status"], string> = {
    pending: "#ffffff22", running: "#fbbf24", done: "#4ade80", failed: "#f87171",
  };
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7, borderRadius: "50%",
      background: colors[status],
      boxShadow: status === "running" ? `0 0 8px ${colors[status]}` : undefined,
      animation: status === "running" ? "fzPulse 1.5s ease-in-out infinite" : undefined,
      flexShrink: 0,
    }} />
  );
}

function StepCard({ step, index }: { step: AgentStep; index: number }) {
  const [open, setOpen] = useState(false);
  const meta = AGENT_META[step.agent];
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        background: `${meta.color}0d`, border: `1px solid ${meta.color}30`,
        borderRadius: 9, overflow: "hidden", marginBottom: 5,
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "7px 10px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <Icon style={{ width: 12, height: 12, color: meta.color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, flex: 1, letterSpacing: 0.4 }}>
          {meta.label}
          <span style={{ color: "#ffffff33", fontWeight: 400, marginLeft: 5 }}>iter {step.iteration}</span>
        </span>
        <StatusDot status={step.status} />
        {open
          ? <ChevronUp  style={{ width: 10, height: 10, color: "#ffffff33" }} />
          : <ChevronDown style={{ width: 10, height: 10, color: "#ffffff33" }} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 10px 10px", fontSize: 10 }}>
              <div style={{
                color: "#ffffffcc", lineHeight: 1.6, padding: "8px 10px",
                background: "rgba(255,255,255,0.03)", borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.06)", marginBottom: 6,
              }}>
                {step.reasoning}
              </div>
              {step.output && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {Object.entries(step.output).map(([k, v]) => (
                    <span key={k} style={{
                      fontSize: 9, padding: "2px 7px", borderRadius: 6,
                      background: `${meta.color}1a`, border: `1px solid ${meta.color}30`,
                      color: "#ffffffbb",
                    }}>
                      <span style={{ color: meta.color }}>{k}:</span> {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export default function AgentOrchestrationPanel({ journey, analyses, simDisruptions }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [costLimit] = useState(50_000);

  const { running, results, steps, error, rerun } = useOrchestrator(
    [journey],
    analyses,
    simDisruptions,
    costLimit
  );

  const affectedCount = analyses.filter(a => !a.loading && a.result?.affected).length;
  const totalSolved   = results.filter(r => r.solved).length;
  const totalFailed   = results.filter(r => !r.solved).length;
  const totalCost     = results.reduce((s, r) => s + r.finalCostUsd, 0);
  const hasResults    = results.length > 0;
  const anyLoading    = analyses.some(a => a.loading);

  // Auto-expand when orchestration produces results
  // (but only if there's something to show)
  if (hasResults && !expanded && !running) {
    // Use a read-without-side-effect approach - don't call setExpanded in render
  }

  return (
    <div style={{
      marginTop: 12,
      border: `1px solid ${running ? "rgba(129,140,248,0.45)" : "rgba(129,140,248,0.18)"}`,
      borderRadius: 12, overflow: "hidden",
      transition: "border-color 0.3s",
      boxShadow: running ? "0 0 16px rgba(129,140,248,0.12)" : undefined,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "11px 14px",
          background: expanded ? "rgba(129,140,248,0.09)" : "rgba(255,255,255,0.02)",
          border: "none", cursor: "pointer", transition: "background 0.2s",
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}
      >
        <BotMessageSquare style={{ width: 14, height: 14, color: "#818cf8", flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#a5b4fc", letterSpacing: 0.5 }}>
            <TextScramble text="Multi-Agent Orchestrator" delay={200} />
          </div>
          <div style={{ fontSize: 9, color: "#ffffff44" }}>
            Auto-fires on every disruption · Planner → Reroute → Cost
          </div>
        </div>

        {/* Live status */}
        {(running || anyLoading) && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#818cf8" }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#818cf8",
              animation: "fzPulse 1.2s ease-in-out infinite", display: "inline-block",
            }} />
            {anyLoading ? "Analysing…" : "Orchestrating…"}
          </span>
        )}

        {hasResults && !running && (
          <span style={{
            fontSize: 9, padding: "2px 7px", borderRadius: 10,
            background: totalFailed === 0 ? "rgba(74,222,128,0.15)" : "rgba(251,191,36,0.15)",
            border: `1px solid ${totalFailed === 0 ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.3)"}`,
            color: totalFailed === 0 ? "#4ade80" : "#fbbf24",
          }}>
            {totalSolved}/{results.length} solved
          </span>
        )}

        {affectedCount > 0 && !running && !hasResults && (
          <span style={{
            fontSize: 9, padding: "2px 7px", borderRadius: 10,
            background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)",
            color: "#fb923c",
          }}>
            {affectedCount} disrupted
          </span>
        )}

        {expanded
          ? <ChevronUp  style={{ width: 12, height: 12, color: "#ffffff33" }} />
          : <ChevronDown style={{ width: 12, height: 12, color: "#ffffff33" }} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "14px 14px 16px" }}>

              {/* Idle — no disruptions */}
              {affectedCount === 0 && !hasResults && !running && (
                <div style={{
                  textAlign: "center", padding: "20px 16px",
                  border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 10,
                  color: "#ffffff33", fontSize: 10, lineHeight: 1.8,
                }}>
                  <AlertTriangle style={{ width: 16, height: 16, margin: "0 auto 8px", display: "block", opacity: 0.35 }} />
                  Waiting for disruptions.<br />
                  Orchestration will fire automatically.
                </div>
              )}

              {/* Waiting for analyses to settle */}
              {anyLoading && affectedCount === 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                  borderRadius: 9, background: "rgba(129,140,248,0.06)",
                  border: "1px solid rgba(129,140,248,0.15)",
                }}>
                  <Loader2 style={{ width: 12, height: 12, color: "#818cf8", animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 10, color: "#818cf8" }}>Analysing legs for disruptions…</span>
                </div>
              )}

              {/* Running spinner */}
              {running && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                    borderRadius: 9, background: "rgba(129,140,248,0.08)",
                    border: "1px solid rgba(129,140,248,0.2)", marginBottom: 8,
                  }}>
                    <Loader2 style={{ width: 12, height: 12, color: "#818cf8", animation: "spin 1s linear infinite" }} />
                    <span style={{ fontSize: 10, color: "#818cf8", flex: 1 }}>
                      Agents running for {results.length + 1} of {affectedCount} disrupted leg{affectedCount !== 1 ? "s" : ""}…
                    </span>
                  </div>
                  {/* Flow diagram */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    {(["planner", "reroute", "cargo", "planner"] as AgentName[]).map((name, i) => {
                      const meta = AGENT_META[name];
                      const Icon = meta.icon;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                            padding: "5px 8px", borderRadius: 8,
                            background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
                            animation: "fzPulse 2s ease-in-out infinite",
                            animationDelay: `${i * 0.3}s`,
                          }}>
                            <Icon style={{ width: 10, height: 10, color: meta.color }} />
                            <span style={{ fontSize: 7, color: meta.color }}>
                              {i === 3 ? "Evaluate" : meta.label}
                            </span>
                          </div>
                          {i < 3 && <ArrowRight style={{ width: 9, height: 9, color: "#ffffff22" }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  marginBottom: 10, padding: "8px 10px", borderRadius: 8, fontSize: 10,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171", display: "flex", gap: 6, alignItems: "center",
                }}>
                  <XCircle style={{ width: 11, height: 11, flexShrink: 0 }} />
                  {error}
                </div>
              )}

              {/* Result cards */}
              <AnimatePresence>
                {results.map((r, i) => (
                  <motion.div
                    key={r.legId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    style={{
                      marginBottom: 10, padding: "10px 12px", borderRadius: 10,
                      background: r.solved ? "rgba(74,222,128,0.06)" : "rgba(251,191,36,0.06)",
                      border: `1px solid ${r.solved ? "rgba(74,222,128,0.25)" : "rgba(251,191,36,0.25)"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      {r.solved
                        ? <CheckCircle2 style={{ width: 12, height: 12, color: "#4ade80" }} />
                        : <AlertTriangle style={{ width: 12, height: 12, color: "#fbbf24" }} />}
                      <span style={{ fontSize: 10, fontWeight: 700, color: r.solved ? "#4ade80" : "#fbbf24", flex: 1 }}>
                        {r.solved ? "Viable solution found" : "No viable solution in budget"}
                      </span>
                      <span style={{ fontSize: 9, color: "#ffffff33" }}>{r.iterations} iter</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      {[
                        ["Mode",    r.finalMode.toUpperCase()],
                        ["Cost",    `$${r.finalCostUsd.toLocaleString()}`],
                        ["Transit", `${r.finalTransitDays}d`],
                      ].map(([k, v]) => (
                        <span key={k} style={{
                          fontSize: 9, padding: "2px 7px", borderRadius: 6,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                          color: "#ffffffbb",
                        }}>
                          <span style={{ color: "#ffffff44" }}>{k}: </span>{v}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: 9, color: "#ffffffaa", lineHeight: 1.6, margin: 0 }}>
                      {r.finalRecommendation}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Total cost */}
              {hasResults && results.length > 1 && (
                <div style={{
                  marginBottom: 12, padding: "8px 12px", borderRadius: 8,
                  background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.2)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 9, color: "#818cf8", textTransform: "uppercase", letterSpacing: 1 }}>
                    Total Journey Cost Est.
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#a5b4fc" }}>
                    ${totalCost.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Re-run button */}
              {(hasResults || error) && !running && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button
                    onClick={rerun}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                      border: "1px solid rgba(129,140,248,0.25)", cursor: "pointer",
                      background: "rgba(129,140,248,0.08)", color: "#818cf8", transition: "all 0.2s",
                    }}
                  >
                    <RefreshCw style={{ width: 11, height: 11 }} />
                    Re-run
                  </button>
                  
                  {results.find(r => r.traceUrl)?.traceUrl && (
                    <a
                      href={results.find(r => r.traceUrl)!.traceUrl!}
                      target="_blank" rel="noreferrer"
                      style={{
                        flex: 2, display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                        border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
                        background: "rgba(255,255,255,0.05)", color: "#ffffffcc", textDecoration: "none",
                        transition: "all 0.2s",
                      }}
                    >
                      🔗 View Live Trace in Omium
                    </a>
                  )}
                </div>
              )}

              {/* Agent step trace */}
              {steps.length > 0 && (
                <div>
                  <div style={{ fontSize: 8, color: "#ffffff2a", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                    <TextScramble text={`Agent Trace (${steps.length} steps)`} delay={150} />
                  </div>
                  {steps.map((step, i) => (
                    <StepCard key={`${step.agent}-${step.iteration}-${i}`} step={step} index={i} />
                  ))}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
