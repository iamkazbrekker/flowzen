"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X, ChevronDown, ChevronUp, Loader2, RefreshCw, ArrowRight, Zap } from "lucide-react";
import type { LegAnalysis } from "../../hooks/useDisruptionAgent";

const SEV_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  critical: { bg: "rgba(220,38,38,0.12)",  border: "rgba(220,38,38,0.4)",  text: "#f87171", glow: "0 0 20px rgba(220,38,38,0.3)" },
  high:     { bg: "rgba(234,88,12,0.12)",  border: "rgba(234,88,12,0.4)",  text: "#fb923c", glow: "0 0 20px rgba(234,88,12,0.3)" },
  medium:   { bg: "rgba(234,179,8,0.1)",   border: "rgba(234,179,8,0.3)",  text: "#fbbf24", glow: "none" },
  low:      { bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.25)", text: "#818cf8", glow: "none" },
  none:     { bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)",  text: "#4ade80", glow: "none" },
};

interface Props {
  criticalAlerts: LegAnalysis[];
  loading: boolean;
  lastFetched: string | null;
  disruptionCount: number;
  onRefresh: () => void;
}

export default function DisruptionAlertBanner({ criticalAlerts, loading, lastFetched, disruptionCount, onRefresh }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = criticalAlerts.filter(a => !dismissed.has(a.legId));
  if (!loading && visible.length === 0 && disruptionCount === 0) return null;

  const worstSev = visible.reduce((acc, a) => {
    const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
    return (order[a.result.severity] ?? 0) > (order[acc] ?? 0) ? a.result.severity : acc;
  }, "none");

  const colors = SEV_COLORS[worstSev] || SEV_COLORS.none;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        style={{
          position: "fixed", top: 56, left: 0, right: 0, zIndex: 600,
          background: colors.bg, borderBottom: `1px solid ${colors.border}`,
          boxShadow: colors.glow, backdropFilter: "blur(12px)",
          fontFamily: "'Inter', monospace",
        }}
      >
        {/* Main bar */}
        <div style={{ display: "flex", alignItems: "center", padding: "8px 20px", gap: 12 }}>
          {loading ? (
            <Loader2 style={{ width: 14, height: 14, color: colors.text, flexShrink: 0, animation: "spin 1s linear infinite" }} />
          ) : (
            <AlertTriangle style={{ width: 14, height: 14, color: colors.text, flexShrink: 0 }} />
          )}

          <span style={{ fontSize: 11, color: colors.text, fontWeight: 600, letterSpacing: 0.5, flexShrink: 0 }}>
            {loading
              ? "AGENT SCANNING ROUTES…"
              : visible.length > 0
              ? `${visible.length} DISRUPTED LEG${visible.length > 1 ? "S" : ""} DETECTED`
              : `${disruptionCount} ACTIVE GLOBAL DISRUPTION${disruptionCount !== 1 ? "S" : ""}`
            }
          </span>

          {!loading && visible.length > 0 && (
            <span style={{ fontSize: 9, color: "#ffffff33", letterSpacing: 1 }}>
              {visible.map(a => a.result.severity.toUpperCase()).join(" • ")}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {lastFetched && (
            <span style={{ fontSize: 8, color: "#ffffff22", letterSpacing: 1 }}>
              FETCHED {new Date(lastFetched).toLocaleTimeString()}
            </span>
          )}

          <button onClick={onRefresh} title="Refresh disruptions"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#ffffff33", display: "flex", alignItems: "center" }}>
            <RefreshCw style={{ width: 11, height: 11 }} />
          </button>

          {visible.length > 0 && (
            <button onClick={() => setExpanded(e => !e)}
              style={{ background: "none", border: "none", cursor: "pointer", color: colors.text, display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
              {expanded ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
              {expanded ? "Hide" : "View"} details
            </button>
          )}
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && visible.length > 0 && (
            <motion.div
              initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
              style={{ overflow: "hidden", borderTop: `1px solid ${colors.border}` }}
            >
              <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
                {visible.map(alert => {
                  const sev = SEV_COLORS[alert.result.severity] || SEV_COLORS.none;
                  return (
                    <div key={alert.legId}
                      style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "12px 14px", border: `1px solid ${sev.border}`, position: "relative" }}>
                      <button onClick={() => setDismissed(d => new Set([...d, alert.legId]))}
                        style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "#ffffff33" }}>
                        <X style={{ width: 10, height: 10 }} />
                      </button>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: sev.text, boxShadow: `0 0 6px ${sev.text}` }} />
                        <span style={{ fontSize: 9, color: sev.text, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
                          {alert.result.severity} severity
                        </span>
                        {alert.result.rerouted && (
                          <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 10, background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa" }}>
                            AUTO-REROUTED
                          </span>
                        )}
                      </div>

                      {/* Matched disruptions */}
                      <div style={{ fontSize: 10, color: "#ffffffcc", marginBottom: 8, lineHeight: 1.6 }}>
                        {alert.result.matchedDisruptions?.slice(0, 2).map((d, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                            <Zap style={{ width: 9, height: 9, color: sev.text, flexShrink: 0, marginTop: 2 }} />
                            <span><strong style={{ color: "#fff" }}>{d.title}</strong> — {d.location} · Est. {d.estimated_delay_days ?? "?"} day delay</span>
                          </div>
                        ))}
                      </div>

                      {/* Recommendation */}
                      <div style={{ fontSize: 10, color: "#ffffff88", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                        {alert.result.recommendation?.split("\n").slice(0, 3).join("\n")}
                      </div>

                      {alert.result.alternativeMode && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
                          <span style={{ color: "#ffffff44" }}>Switch to:</span>
                          <span style={{ color: "#60a5fa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                            {alert.result.alternativeMode}
                          </span>
                          <ArrowRight style={{ width: 10, height: 10, color: "#60a5fa" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
