"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Bell, Settings, Plus, Minus, Globe,
  X, Route, Trash2, ChevronRight, Layers,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { MapHandle } from "./components/Map";
import JourneyBuilder, { type Journey, type JourneyLeg } from "./components/JourneyBuilder";
import { useDisruptionAgent } from "../hooks/useDisruptionAgent";
import DisruptionAlertBanner from "./components/DisruptionAlertBanner";
import SimulationPanel from "./components/SimulationPanel";
import JourneyChatbot from "./components/JourneyChatbot";
import AgentOrchestrationPanel from "./components/AgentOrchestrationPanel";
import type { DisruptionEvent } from "../lib/types";

// Leaflet must load client-side only
const Map = dynamic(() => import("./components/Map"), { ssr: false });
import CargoAnalysis from './components/CargoAnalysis';
import TextScramble from './components/TextScramble';

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const mapRef = useRef<MapHandle>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [selectedLeg, setSelectedLeg] = useState<JourneyLeg | null>(null);
  const [showCargoAnalysis, setShowCargoAnalysis] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [simulatedDisruptions, setSimulatedDisruptions] = useState<DisruptionEvent[]>([]);
  const [dismissedLegAlerts, setDismissedLegAlerts] = useState<Set<string>>(new Set());

  const handleAddSim = useCallback((d: DisruptionEvent) => {
    setSimulatedDisruptions(prev => [...prev, d]);
  }, []);
  const handleRemoveSim = useCallback((idx: number) => {
    setSimulatedDisruptions(prev => prev.filter((_, i) => i !== idx));
  }, []);
  const handleClearSim = useCallback(() => setSimulatedDisruptions([]), []);

  // ── Disruption Agent ──────────────────────────────────────────────────────
  const {
    disruptions,
    analyses,
    loading: agentLoading,
    lastFetched,
    criticalAlerts,
    getLegAnalysis,
  } = useDisruptionAgent(journeys, simulatedDisruptions);

  const refreshAgent = useCallback(() => {
    setJourneys(prev => [...prev]);
  }, []);

  const handleAddJourney = useCallback((journey: Journey) => {
    setJourneys(prev => {
      const exists = prev.find(j => j.id === journey.id);
      if (exists) return prev.map(j => j.id === journey.id ? journey : j);
      return [...prev, journey];
    });
    setSelectedJourney(journey);
    setShowSidebar(true);
    // Don't setShowBuilder(true) here — the builder closes itself via onClose()
    setTimeout(() => mapRef.current?.focusJourney(journey), 400);
  }, []);

  const handleRemoveJourney = useCallback((id: string) => {
    setJourneys(prev => prev.filter(j => j.id !== id));
    setSelectedJourney(prev => {
      if (prev?.id === id) { setShowSidebar(false); setShowBuilder(false); return null; }
      return prev;
    });
  }, []);

  const handleLegClick = useCallback((journey: Journey, leg: JourneyLeg) => {
    setSelectedJourney(journey);
    setSelectedLeg(leg);
    setShowSidebar(true);
    setShowBuilder(true);
  }, []);

  const MODE_META: Record<string, { emoji: string; label: string; color: string; unit: string; speed: number }> = {
    sea: { emoji: "⚓", label: "Maritime", color: "#60a5fa", unit: "knots", speed: 15 },
    rail: { emoji: "🚂", label: "Rail", color: "#00ff88", unit: "km/h", speed: 120 },
    road: { emoji: "🚛", label: "Road", color: "#f59e0b", unit: "km/h", speed: 80 },
    air: { emoji: "✈", label: "Air Cargo", color: "#e879f9", unit: "km/h", speed: 850 },
  };

  // Simple haversine
  const dist = (a: [number, number], b: [number, number]) => {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toR, dLng = (b[1] - a[1]) * toR;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000000", overflow: "hidden", position: "relative", fontFamily: "'Inter', sans-serif" }}>

      {/* ── DISRUPTION BANNER ───────────────────────────────────────────────── */}
      <DisruptionAlertBanner
        criticalAlerts={criticalAlerts}
        loading={agentLoading}
        lastFetched={lastFetched}
        disruptionCount={disruptions.length}
        onRefresh={refreshAgent}
      />

      {/* ── TOP BAR ──────────────────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 500,
        display: "flex", alignItems: "center", padding: "0 20px", gap: 16,
        background: "rgba(10,10,10,0.88)", borderBottom: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(16px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", height: 100, position: "relative", width: 200 }}>
            {/* Assuming the user saves the image as public/logo.png */}
            <img
              src="/logo.png"
              alt="FLOWZEN Logo"
              style={{
                position: "absolute",
                height: 150,
                top: "50%",
                left: -10, // Adjust left alignment if the image has transparent padding
                transform: "translateY(-50%)",
                objectFit: "contain",
                // Use CSS filters to make the white background blend into the dark theme
                filter: "invert(1) hue-rotate(180deg) brightness(1.2)",
                mixBlendMode: "screen",
                pointerEvents: "none" // Prevent huge bounding box from stealing clicks
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Journey list chips */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", overflow: "hidden" }}>
          {journeys.map(j => (
            <button key={j.id}
              onClick={() => {
                setSelectedJourney(j);
                setShowSidebar(true);
                setShowBuilder(true);
                mapRef.current?.focusJourney(j);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 6px",
                background: selectedJourney?.id === j.id ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${selectedJourney?.id === j.id ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 20, cursor: "pointer", color: "#fff", fontSize: 10,
                transition: "all 0.15s",
              }}>
              <div style={{ display: "flex", gap: 2 }}>
                {j.legs.map((l, i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: l.color ?? "#60a5fa" }} />
                ))}
              </div>
              {j.name}
              <div onClick={e => { e.stopPropagation(); handleRemoveJourney(j.id); }}
                style={{ marginLeft: 2, color: "#ffffff44", lineHeight: 1 }}>
                <X style={{ width: 8, height: 8 }} />
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "6px 12px",
          }}>
            <Search style={{ width: 12, height: 12, color: "#ffffff44" }} />
            <span style={{ fontSize: 11, color: "#ffffff33" }}>Search…</span>
          </div>
          <Bell style={{ width: 16, height: 16, color: "#ffffff44", cursor: "pointer" }} />
          <Settings style={{ width: 16, height: 16, color: "#ffffff44", cursor: "pointer" }} />
        </div>
      </header>

      {/* ── MAP ──────────────────────────────────────────────────────────────── */}
      <main style={{ position: "absolute", inset: 0, top: 56 }}>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {/* Map fills full container */}
          <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
            <Map ref={mapRef} journeys={journeys} onLegClick={handleLegClick} analyses={analyses} />
          </div>

          {/* Scanline overlay */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10,
            background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)",
          }} />

          {/* ── MAP CONTROLS ───────────────────────────────────────────────── */}
          <div style={{
            position: "absolute", bottom: 24, left: 24, zIndex: 20,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            {/* New Journey Button */}
            <button
              onClick={() => { setSelectedJourney(null); setShowSidebar(false); setShowBuilder(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                background: "linear-gradient(135deg, #60a5fa, #818cf8)",
                border: "none", borderRadius: 14, cursor: "pointer", color: "#fff",
                fontSize: 13, fontWeight: 600, boxShadow: "0 4px 24px rgba(96,165,250,0.35)",
                transition: "all 0.2s",
              }}
              onMouseOver={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = "0 6px 32px rgba(96,165,250,0.5)"; }}
              onMouseOut={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(96,165,250,0.35)"; }}
            >
              <Route style={{ width: 16, height: 16 }} />
              New Journey
            </button>

            {/* Zoom controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <button onClick={() => mapRef.current?.resetView()}
                style={ctrlBtnStyle}
                title="Reset view">
                <Globe style={{ width: 14, height: 14 }} />
              </button>
              <button onClick={() => mapRef.current?.zoomIn()} style={{ ...ctrlBtnStyle, borderRadius: "0 0 0 0", borderBottom: "none" }}>
                <Plus style={{ width: 14, height: 14 }} />
              </button>
              <button onClick={() => mapRef.current?.zoomOut()} style={{ ...ctrlBtnStyle, borderRadius: "0 0 8px 8px" }}>
                <Minus style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>

          {/* Coordinates display */}
          <div style={{
            position: "absolute", bottom: 24, right: showSidebar ? 420 : 24,
            zIndex: 20, fontFamily: "monospace", fontSize: 9,
            color: "#ffffff22", letterSpacing: 1, transition: "right 0.3s",
          }}>
            FLOWZEN LOGISTICS PLATFORM v2.0 • OSRM ROUTING
          </div>
        </div>
      </main>

      {/* ── JOURNEY BUILDER PANEL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showBuilder && (
          <JourneyBuilder
            onClose={() => setShowBuilder(false)}
            onAdd={handleAddJourney}
            initialJourney={selectedJourney}
          />
        )}
      </AnimatePresence>

      {/* --- CARGO ANALYSIS MODAL --- */}
      <AnimatePresence>
        {showCargoAnalysis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-background/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-surface-dim border border-white/5 rounded-3xl shadow-2xl custom-scrollbar"
            >
              <button
                onClick={() => setShowCargoAnalysis(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors z-10"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
              <CargoAnalysis />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ROUTE INTELLIGENCE PANEL ───────────────────────────────────────── */}
      <AnimatePresence>
        {showSidebar && selectedJourney && (
          <motion.aside
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              position: "fixed", left: 0, top: 56, bottom: 0, width: 400,
              background: "rgba(15,15,15,0.97)", borderRight: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px)", zIndex: 400,
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, letterSpacing: 3, color: "#ffffff33", textTransform: "uppercase", marginBottom: 3 }}><TextScramble text="Route Intelligence" delay={100} /></div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{selectedJourney.name}</div>
              </div>
              <button onClick={() => { setShowSidebar(false); setSelectedLeg(null); }}
                style={{
                  width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", color: "#fff"
                }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {selectedJourney.legs.map((leg, idx) => {
                const legAnalysis = getLegAnalysis(leg.id);

                const activeMode = legAnalysis?.result?.rerouted && legAnalysis.result.alternativeMode ? legAnalysis.result.alternativeMode : leg.mode;
                const meta = MODE_META[activeMode] || MODE_META[leg.mode];
                const color = legAnalysis?.result?.rerouted ? meta.color : (leg.color ?? "#60a5fa");
                const isSelected = selectedLeg?.id === leg.id;
                const distKm = leg.from && leg.to ? dist([leg.from.lat, leg.from.lng], [leg.to.lat, leg.to.lng]) : 0;

                let durationHr = meta ? Math.round(distKm / meta.speed * 10) / 10 : 0;

                const sevColors: Record<string, string> = {
                  critical: "#f87171", high: "#fb923c", medium: "#fbbf24", low: "#818cf8", none: "#4ade80"
                };
                const alertColor = legAnalysis?.result?.severity ? sevColors[legAnalysis.result.severity] : undefined;
                const isAlertDismissed = dismissedLegAlerts.has(leg.id);

                return (
                  <div key={leg.id}
                    onClick={() => setSelectedLeg(isSelected ? null : leg)}
                    style={{
                      marginBottom: 12, background: isSelected ? `${color}0d` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isSelected ? `${color}33` : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 12, overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", padding: "10px 12px", gap: 10 }}>
                      <div style={{ width: 3, height: 36, background: color, borderRadius: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, color: legAnalysis?.result?.affected ? alertColor : color, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                          {meta.emoji} {legAnalysis?.result?.rerouted ? `Rerouted to ${meta.label}` : meta.label} · Leg {idx + 1}
                          {legAnalysis?.loading && (
                            <span style={{ fontSize: 7, color: "#ffffff33", letterSpacing: 1 }}>SCANNING…</span>
                          )}
                          {legAnalysis?.result?.affected && !legAnalysis.loading && !isAlertDismissed && (
                            <span style={{
                              fontSize: 7, padding: "1px 5px", borderRadius: 8, display: "flex", alignItems: "center", gap: 3,
                              background: `${alertColor}22`, border: `1px solid ${alertColor}44`,
                              color: alertColor, letterSpacing: 1
                            }}>
                              ⚠ {legAnalysis.result.severity?.toUpperCase()}
                              <button
                                onClick={(e) => { e.stopPropagation(); setDismissedLegAlerts(prev => new Set(prev).add(leg.id)); }}
                                style={{ background: "none", border: "none", color: alertColor, cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
                                title="Dismiss alert"
                              >
                                <X style={{ width: 8, height: 8, opacity: 0.8 }} />
                              </button>
                            </span>
                          )}
                          {legAnalysis?.result?.rerouted && (
                            <span style={{
                              fontSize: 7, padding: "1px 5px", borderRadius: 8,
                              background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)",
                              color: "#60a5fa", letterSpacing: 1
                            }}>↪ REROUTED</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#fff", fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {leg.from?.name ?? "—"} → {leg.to?.name ?? "—"}
                        </div>
                      </div>
                      <ChevronRight style={{
                        width: 12, height: 12, color: "#ffffff33",
                        transform: isSelected ? "rotate(90deg)" : "none", transition: "transform 0.2s"
                      }} />
                    </div>

                    <AnimatePresence>
                      {isSelected && leg.from && leg.to && (
                        <motion.div
                          initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                          style={{ overflow: "hidden" }}>
                          <div style={{ padding: "0 12px 12px 25px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                            {[
                              { label: "Distance", val: `~${distKm.toLocaleString()} km` },
                              { label: "Duration", val: durationHr > 24 ? `~${(durationHr / 24).toFixed(1)} days` : `~${durationHr} hrs` },
                              { label: "Speed", val: `${meta.speed} ${meta.unit}` },
                            ].map(item => (
                              <div key={item.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "8px 10px" }}>
                                <div style={{ fontSize: 7, color: "#ffffff33", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 11, color: "#fff", fontFamily: "monospace" }}>{item.val}</div>
                              </div>
                            ))}
                          </div>
                          {/* Coordinates */}
                          <div style={{ padding: "0 12px 12px 25px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {[
                              { label: "Origin", loc: leg.from },
                              { label: "Destination", loc: leg.to },
                            ].map(item => item.loc && (
                              <div key={item.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "8px 10px" }}>
                                <div style={{ fontSize: 7, color: "#ffffff33", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>{item.label}</div>
                                <div style={{ fontSize: 9, color: `${color}cc`, fontFamily: "monospace", marginBottom: 2 }}>{item.loc.name}</div>
                                <div style={{ fontSize: 8, color: "#ffffff33", fontFamily: "monospace" }}>
                                  {item.loc.lat.toFixed(3)}, {item.loc.lng.toFixed(3)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Total summary */}
              {selectedJourney.legs.every(l => l.from && l.to) && (
                <div style={{ marginTop: 8, padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 9, color: "#ffffff33", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}><TextScramble text="Journey Summary" delay={200} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {(() => {
                      let totalHrs = 0;
                      const totalKm = selectedJourney.legs.reduce((sum, l) => {
                        if (!l.from || !l.to) return sum;
                        const d = dist([l.from.lat, l.from.lng], [l.to.lat, l.to.lng]);
                        const analysis = getLegAnalysis(l.id);
                        const activeMode = analysis?.result?.rerouted && analysis.result.alternativeMode ? analysis.result.alternativeMode : l.mode;
                        totalHrs += d / (MODE_META[activeMode]?.speed ?? 60);
                        return sum + d;
                      }, 0);
                      return [
                        { label: "Total Distance", val: `${totalKm.toLocaleString()} km` },
                        { label: "Total Duration", val: totalHrs > 24 ? `${(totalHrs / 24).toFixed(1)} days` : `${totalHrs.toFixed(1)} hrs` },
                      ].map(item => (
                        <div key={item.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ fontSize: 7, color: "#ffffff33", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{item.label}</div>
                          <div style={{ fontSize: 14, color: "#fff", fontFamily: "monospace", fontWeight: 600 }}>{item.val}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
              {/* ── Simulation Panel ───────────────────────────────────── */}
              <SimulationPanel
                simDisruptions={simulatedDisruptions}
                onAdd={handleAddSim}
                onRemove={handleRemoveSim}
                onClear={handleClearSim}
              />

              {/* ── AI Chatbot ─────────────────────────────────────────── */}
              <div style={{ marginTop: 12 }}>
                <JourneyChatbot
                  journey={selectedJourney}
                  disruptions={disruptions}
                  simulatedDisruptions={simulatedDisruptions}
                  analyses={analyses.filter(a => !a.loading).map(a => ({ legId: a.legId, result: a.result }))}
                  legsMeta={selectedJourney.legs
                    .filter(l => l.from && l.to)
                    .map(l => {
                      const meta = MODE_META[l.mode];
                      const distKm = l.from && l.to ? dist([l.from.lat, l.from.lng], [l.to.lat, l.to.lng]) : 0;
                      return {
                        id: l.id,
                        fromName: l.from!.name,
                        toName: l.to!.name,
                        mode: l.mode,
                        distKm,
                        durationHr: meta ? Math.round(distKm / meta.speed * 10) / 10 : 0,
                      };
                    })
                  }
                />
              </div>

              {/* ── Multi-Agent Orchestrator ───────────────────────────── */}
              <AgentOrchestrationPanel
                journey={selectedJourney}
                analyses={analyses}
                simDisruptions={simulatedDisruptions}
              />
            </div>

            {/* Footer actions */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
              <button
                onClick={() => mapRef.current?.focusJourney(selectedJourney)}
                style={{
                  flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)", color: "#fff", cursor: "pointer", fontSize: 11,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                }}>
                <Layers style={{ width: 12, height: 12 }} />
                Focus on Map
              </button>
              <button
                onClick={() => handleRemoveJourney(selectedJourney.id)}
                style={{
                  padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,68,68,0.2)",
                  background: "rgba(255,68,68,0.06)", color: "#ff6666", cursor: "pointer", fontSize: 11,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                }}>
                <Trash2 style={{ width: 12, height: 12 }} />
                Remove
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared control button style ───────────────────────────────────────────────
const ctrlBtnStyle: React.CSSProperties = {
  width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(10,10,10,0.92)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, cursor: "pointer", color: "#fff", transition: "all 0.15s",
};
