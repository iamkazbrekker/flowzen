"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Plane, Ship, Train, Truck, X, Route, ChevronDown, Loader2 } from "lucide-react";
import type { LocationResult } from "../api/search-location/route";

// ─── Types ────────────────────────────────────────────────────────────────────
export type JourneyMode = "road" | "rail" | "sea" | "air";

export interface JourneyLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "port" | "airport";
  country?: string;
  iata?: string;
}

export interface JourneyLeg {
  id: string;
  from: JourneyLocation | null;
  to: JourneyLocation | null;
  mode: JourneyMode;
}

export interface Journey {
  id: string;
  name: string;
  legs: JourneyLeg[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LEG_COLORS = [
  "#60a5fa", // blue  - sea / default
  "#00ff88", // green - rail
  "#f59e0b", // amber - road
  "#e879f9", // purple - air
  "#f87171", // red
  "#34d399", // emerald
  "#fb923c", // orange
  "#a78bfa", // violet
];

const MODE_CONFIG: Record<JourneyMode, { label: string; icon: React.ElementType; hint: string }> = {
  sea:  { label: "Sea",  icon: Ship,  hint: "Search ports" },
  rail: { label: "Rail", icon: Train, hint: "Search cities/stations" },
  road: { label: "Road", icon: Truck, hint: "Search cities" },
  air:  { label: "Air",  icon: Plane, hint: "Search airports" },
};

// ─── Location Search Input ────────────────────────────────────────────────────
function LocationSearch({
  placeholder,
  value,
  mode,
  onChange,
}: {
  placeholder: string;
  value: JourneyLocation | null;
  mode: JourneyMode;
  onChange: (loc: JourneyLocation | null) => void;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const modeFilter = mode === "sea" ? "port" : mode === "air" ? "airport" : "all";
        const res = await fetch(`/api/search-location?q=${encodeURIComponent(q)}&mode=${modeFilter}`);
        const data: LocationResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 280);
  }, [mode]);

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8, padding: "6px 10px",
      }}>
        {loading
          ? <Loader2 style={{ width: 12, height: 12, color: "#ffffff44", flexShrink: 0, animation: "spin 1s linear infinite" }} />
          : <span style={{ fontSize: 10, color: "#ffffff33", flexShrink: 0 }}>
              {mode === "sea" ? "⚓" : mode === "air" ? "✈" : mode === "rail" ? "🚂" : "🚛"}
            </span>
        }
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); onChange(null); }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={e => {
            if (e.key === "Enter" && results.length > 0) {
              e.preventDefault();
              const r = results[0];
              onChange({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, type: r.type, country: r.country, iata: r.iata });
              setQuery(r.name);
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: value ? "#00ff88" : "#fff", 
            fontSize: 12, fontFamily: "monospace",
            textShadow: value ? "0 0 8px rgba(0,255,136,0.4)" : "none"
          }}
        />
        {value && (
          <button onClick={(e) => { e.stopPropagation(); onChange(null); setQuery(""); setResults([]); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#ffffff44", padding: 0 }}>
            <X style={{ width: 10, height: 10 }} />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999,
              background: "rgba(10,10,20,0.97)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, overflow: "hidden", maxHeight: 200, overflowY: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}>
            {results.map(r => (
              <button key={r.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, type: r.type, country: r.country, iata: r.iata });
                  setQuery(r.name);
                  setOpen(false);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                  background: "none", border: "none", cursor: "pointer", textAlign: "left",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  transition: "background 0.1s",
                }}
                onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                onMouseOut={e => (e.currentTarget.style.background = "none")}
              >
                <span style={{ fontSize: 9, color: r.type === "port" ? "#60a5fa" : "#e879f9", textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>
                  {r.type === "port" ? "PORT" : "AIRP"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#fff", fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.name}
                    {r.iata && <span style={{ color: "#ffffff44", marginLeft: 6 }}>[{r.iata}]</span>}
                  </div>
                  {r.country && <div style={{ fontSize: 9, color: "#ffffff44" }}>{r.country}</div>}
                </div>
                <span style={{ fontSize: 8, color: "#ffffff22", flexShrink: 0, fontFamily: "monospace" }}>
                  {r.lat.toFixed(1)}, {r.lng.toFixed(1)}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Journey Builder Panel ────────────────────────────────────────────────────
interface JourneyBuilderProps {
  onClose: () => void;
  onAdd: (journey: Journey) => void;
}

let legCounter = 0;

export default function JourneyBuilder({ onClose, onAdd }: JourneyBuilderProps) {
  const [journeyName, setJourneyName] = useState("New Journey");
  const [legs, setLegs] = useState<JourneyLeg[]>([
    { id: `leg-${++legCounter}`, from: null, to: null, mode: "sea" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLeg = () => {
    const last = legs[legs.length - 1];
    setLegs(prev => [...prev, {
      id: `leg-${++legCounter}`,
      from: last?.to ?? null, // auto-chain: from = previous leg's to
      to: null,
      mode: "road",
    }]);
  };

  const removeLeg = (id: string) => setLegs(prev => prev.filter(l => l.id !== id));

  const updateLeg = (id: string, patch: Partial<JourneyLeg>) => {
    setLegs(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  const handleSubmit = async () => {
    const valid = legs.every(l => l.from && l.to);
    if (!valid) { setError("All legs need an origin and destination."); return; }
    setError(null);
    setSubmitting(true);
    const journey: Journey = {
      id: `journey-${Date.now()}`,
      name: journeyName || "Unnamed Journey",
      legs: legs.map((l, i) => ({ ...l, color: LEG_COLORS[i % LEG_COLORS.length] })) as JourneyLeg[],
    };
    onAdd(journey);
    setSubmitting(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: 420, zIndex: 10000,
        background: "rgba(6,6,16,0.97)", borderLeft: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)", display: "flex", flexDirection: "column",
        fontFamily: "'Inter', monospace",
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#ffffff33", textTransform: "uppercase", marginBottom: 4 }}>
            Journey Builder
          </div>
          <input
            value={journeyName}
            onChange={e => setJourneyName(e.target.value)}
            style={{
              background: "none", border: "none", outline: "none", color: "#fff",
              fontSize: 18, fontWeight: 600, width: "100%",
            }}
          />
        </div>
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center", color: "#fff",
        }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Legs */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        <AnimatePresence>
          {legs.map((leg, idx) => {
            const color = LEG_COLORS[idx % LEG_COLORS.length];
            const ModeIcon = MODE_CONFIG[leg.mode].icon;
            return (
              <motion.div key={leg.id}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                style={{ marginBottom: 16, background: "rgba(255,255,255,0.02)", borderRadius: 12, overflow: "visible", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {/* Leg header */}
                <div style={{ display: "flex", alignItems: "center", padding: "10px 12px 8px", gap: 8 }}>
                  <div style={{ width: 3, height: 32, background: color, borderRadius: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: "#ffffff33", textTransform: "uppercase", letterSpacing: 2 }}>
                    Leg {idx + 1}
                  </span>
                  {/* Mode selector */}
                  <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                    {(Object.keys(MODE_CONFIG) as JourneyMode[]).map(m => {
                      const MI = MODE_CONFIG[m].icon;
                      const active = leg.mode === m;
                      return (
                        <button key={m} onClick={() => updateLeg(leg.id, { mode: m, from: null, to: null })}
                          title={MODE_CONFIG[m].label}
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
                            background: active ? `${color}22` : "rgba(255,255,255,0.03)", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: active ? color : "#ffffff44", transition: "all 0.15s",
                          }}>
                          <MI style={{ width: 12, height: 12 }} />
                        </button>
                      );
                    })}
                  </div>
                  {legs.length > 1 && (
                    <button onClick={() => removeLeg(leg.id)} style={{
                      width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.02)", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#ff4444",
                    }}>
                      <Trash2 style={{ width: 10, height: 10 }} />
                    </button>
                  )}
                </div>

                {/* From / To */}
                <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 8, color: "#ffffff33", textTransform: "uppercase", letterSpacing: 1, width: 20 }}>FROM</span>
                    <LocationSearch
                      placeholder={`Origin ${MODE_CONFIG[leg.mode].hint}`}
                      value={leg.from}
                      mode={leg.mode}
                      onChange={loc => updateLeg(leg.id, { from: loc })}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 8, color: "#ffffff33", textTransform: "uppercase", letterSpacing: 1, width: 20 }}>TO</span>
                    <LocationSearch
                      placeholder={`Destination ${MODE_CONFIG[leg.mode].hint}`}
                      value={leg.to}
                      mode={leg.mode}
                      onChange={loc => updateLeg(leg.id, { to: loc })}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <button onClick={addLeg} style={{
          width: "100%", padding: "10px", borderRadius: 10,
          border: "1px dashed rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)",
          color: "#ffffff55", cursor: "pointer", fontSize: 11, display: "flex",
          alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s",
        }}
          onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "#fff"; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#ffffff55"; }}
        >
          <Plus style={{ width: 12, height: 12 }} />
          Add another leg
        </button>
      </div>

      {/* Footer */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {error && (
          <div style={{ fontSize: 11, color: "#ff4444", marginBottom: 12, padding: "8px 12px", background: "rgba(255,68,68,0.08)", borderRadius: 6 }}>
            {error}
          </div>
        )}
        <button onClick={handleSubmit} disabled={submitting}
          style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "none",
            background: submitting ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #60a5fa, #818cf8)",
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: submitting ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s",
          }}>
          {submitting ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Route style={{ width: 14, height: 14 }} />}
          {submitting ? "Computing routes..." : "Plot Journey on Map"}
        </button>
      </div>
    </motion.div>
  );
}
