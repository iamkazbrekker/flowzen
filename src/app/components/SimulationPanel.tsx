"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap, Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  FlaskConical, AlertTriangle, CheckCircle2, X
} from "lucide-react";
import type { DisruptionEvent } from "@/lib/types";

// ─── Severity badge colours ───────────────────────────────────────────────────
const SEV_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: "rgba(220,38,38,0.15)",  border: "rgba(220,38,38,0.45)",  text: "#f87171" },
  high:     { bg: "rgba(234,88,12,0.15)",  border: "rgba(234,88,12,0.45)",  text: "#fb923c" },
  medium:   { bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.35)",  text: "#fbbf24" },
  low:      { bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.3)",  text: "#818cf8" },
};

const PRESET_DISRUPTIONS = [
  { label: "🌪️ Major Storm", description: "Category 5 hurricane disrupting all maritime routes in the Gulf of Mexico region causing severe port closures", severity: "critical" as const },
  { label: "⚡ Port Strike", description: "Dockers' union strike at major European container ports, affecting all sea freight through Rotterdam and Hamburg", severity: "high" as const },
  { label: "🚧 Rail Outage", description: "Landslide blocking the Trans-Siberian railway main corridor, delaying rail cargo for 5-7 days", severity: "high" as const },
  { label: "🌊 Suez Closure", description: "Suez Canal temporarily closed due to grounded vessel, rerouting ships around Cape of Good Hope adding 10+ days", severity: "critical" as const },
  { label: "📦 Customs Delay", description: "New customs inspection protocols at China ports causing 3-4 day processing delays for all export containers", severity: "medium" as const },
  { label: "✈️ Airspace Ban", description: "Airspace closure over Eastern Europe due to geopolitical tensions rerouting all cargo flights", severity: "high" as const },
];

interface Props {
  simDisruptions: DisruptionEvent[];
  onAdd: (d: DisruptionEvent) => void;
  onRemove: (idx: number) => void;
  onClear: () => void;
}

export default function SimulationPanel({ simDisruptions, onAdd, onRemove, onClear }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("high");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const processDisruption = async (desc: string, sev: typeof severity) => {
    if (!desc.trim() || processing) return;
    setProcessing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc, severity: sev }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      onAdd(data.event as DisruptionEvent);
      setSuccessMsg(`✓ Disruption injected: ${(data.event as DisruptionEvent).title}`);
      setDescription("");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process disruption");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
          background: expanded ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.02)",
          border: "none", cursor: "pointer", transition: "background 0.2s",
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}
      >
        <FlaskConical style={{ width: 14, height: 14, color: "#a78bfa", flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#c4b5fd", letterSpacing: 0.5 }}>
            Run Simulation
          </div>
          <div style={{ fontSize: 9, color: "#ffffff44", letterSpacing: 0.5 }}>
            Inject custom disruptions into the rerouting agent
          </div>
        </div>
        {simDisruptions.length > 0 && (
          <span style={{
            fontSize: 9, padding: "2px 7px", borderRadius: 10,
            background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.4)",
            color: "#a78bfa", fontWeight: 700,
          }}>
            {simDisruptions.length} active
          </span>
        )}
        {expanded
          ? <ChevronUp style={{ width: 12, height: 12, color: "#ffffff44" }} />
          : <ChevronDown style={{ width: 12, height: 12, color: "#ffffff44" }} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "14px 14px 16px" }}>
              {/* Presets */}
              <div style={{ fontSize: 8, color: "#ffffff33", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                Quick Presets
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                {PRESET_DISRUPTIONS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => processDisruption(p.description, p.severity)}
                    disabled={processing}
                    style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 10, cursor: processing ? "wait" : "pointer",
                      border: `1px solid ${SEV_COLORS[p.severity].border}`,
                      background: SEV_COLORS[p.severity].bg, color: SEV_COLORS[p.severity].text,
                      transition: "opacity 0.15s", opacity: processing ? 0.6 : 1,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div style={{ fontSize: 8, color: "#ffffff33", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
                Custom Disruption
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe a disruption scenario… e.g. 'Typhoon blocking sea routes near Shanghai, major port closures expected for 1 week'"
                rows={3}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 11, resize: "none",
                  fontFamily: "inherit", outline: "none", lineHeight: 1.5, boxSizing: "border-box",
                }}
              />

              {/* Severity selector */}
              <div style={{ display: "flex", gap: 5, marginTop: 8, alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "#ffffff33", textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>
                  Severity:
                </span>
                {(["low","medium","high","critical"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    style={{
                      padding: "3px 8px", borderRadius: 6, fontSize: 9, cursor: "pointer",
                      border: `1px solid ${severity === s ? SEV_COLORS[s].border : "rgba(255,255,255,0.08)"}`,
                      background: severity === s ? SEV_COLORS[s].bg : "transparent",
                      color: severity === s ? SEV_COLORS[s].text : "#ffffff44",
                      fontWeight: severity === s ? 700 : 400, transition: "all 0.15s",
                      textTransform: "uppercase", letterSpacing: 0.5,
                    }}
                  >
                    {s}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => processDisruption(description, severity)}
                  disabled={processing || !description.trim()}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8,
                    background: processing || !description.trim()
                      ? "rgba(255,255,255,0.05)"
                      : "linear-gradient(135deg, #7c3aed, #a855f7)",
                    border: "none", cursor: processing || !description.trim() ? "not-allowed" : "pointer",
                    color: processing || !description.trim() ? "#ffffff44" : "#fff",
                    fontSize: 11, fontWeight: 600, transition: "all 0.2s",
                  }}
                >
                  {processing
                    ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                    : <Zap style={{ width: 12, height: 12 }} />}
                  {processing ? "Processing…" : "Inject"}
                </button>
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ marginTop: 8, padding: "7px 10px", borderRadius: 7, background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.3)", fontSize: 10, color: "#f87171", display: "flex", gap: 6, alignItems: "center" }}>
                    <AlertTriangle style={{ width: 10, height: 10, flexShrink: 0 }} />
                    {error}
                  </motion.div>
                )}
                {successMsg && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ marginTop: 8, padding: "7px 10px", borderRadius: 7, background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.25)", fontSize: 10, color: "#4ade80", display: "flex", gap: 6, alignItems: "center" }}>
                    <CheckCircle2 style={{ width: 10, height: 10, flexShrink: 0 }} />
                    {successMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active simulated disruptions */}
              {simDisruptions.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 8, color: "#ffffff33", textTransform: "uppercase", letterSpacing: 2, flex: 1 }}>
                      Active Simulations ({simDisruptions.length})
                    </span>
                    <button onClick={onClear} style={{ fontSize: 9, color: "#ff6666", background: "none", border: "none", cursor: "pointer" }}>
                      Clear all
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <AnimatePresence>
                      {simDisruptions.map((d, idx) => {
                        const sc = SEV_COLORS[d.severity] ?? SEV_COLORS.medium;
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                            style={{
                              background: sc.bg, border: `1px solid ${sc.border}`,
                              borderRadius: 8, padding: "8px 10px", position: "relative",
                            }}
                          >
                            <button
                              onClick={() => onRemove(idx)}
                              style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", color: "#ffffff33" }}
                            >
                              <X style={{ width: 9, height: 9 }} />
                            </button>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                              <span style={{ fontSize: 8, color: sc.text, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
                                {d.severity}
                              </span>
                              <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa" }}>
                                SIMULATED
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: "#fff", fontWeight: 600, marginBottom: 2, paddingRight: 20 }}>{d.title}</div>
                            <div style={{ fontSize: 9, color: "#ffffff66" }}>{d.location} · {d.affected_transport_modes.join(", ")} · Est. {d.estimated_delay_days}d delay</div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
