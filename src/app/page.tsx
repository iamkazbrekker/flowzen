"use client";

import { useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  Settings,
  X,
  CloudLightning,
  Anchor,
  Brain,
  Send,
  Plus,
  Minus,
  Globe,
  Layers,
  Target,
  AlertTriangle,
  TrendingUp,
  Clock,
  DollarSign,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import dynamic from 'next/dynamic';
import TextScramble from './components/TextScramble';
import type { DisplayRoute, RouteResult } from './data/routing';
import { MODE_PROFILES, compareStrategies } from './data/routing';

const Map = dynamic(() => import('./components/Map'), { ssr: false });
import CargoAnalysis from './components/CargoAnalysis';

// --- Constants & Types ---


interface Message {
  role: 'ai' | 'user';
  text: string;
}

export default function App() {
  const [showPanels, setShowPanels] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<DisplayRoute | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [showCargoAnalysis, setShowCargoAnalysis] = useState(false);
  const [transitSpeed, setTransitSpeed] = useState(70);
  const [costCeiling, setCostCeiling] = useState(40);
  const [messages] = useState<Message[]>([
    { role: 'ai', text: "Analyzing Suez congestion. I recommend diverting Tier 1 cargo via Cape Route. ETA penalty: +9 days. OpEx increase: +14%. Shall I formalize the reroute?" }
  ]);

  const handleRouteClick = (route: DisplayRoute, result: RouteResult) => {
    setSelectedRoute(route);
    setRouteResult(result);
    setShowPanels(true);
  };

  const togglePanels = () => setShowPanels(p => !p);

  return (
    <div className="h-screen w-full flex flex-row bg-background selection:bg-primary selection:text-background font-sans overflow-hidden">


      {/* --- MAIN EXPLORER --- */}
      <section className="flex-1 flex flex-col min-w-0 relative">
        {/* --- TOP HEADER --- */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 z-50 bg-background/50 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            <h1 className="font-serif italic text-2xl text-white">Flowzen</h1>
          </div>

          <div className="flex-1 max-w-lg px-12 hidden lg:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-white transition-colors" />
              <input
                type="text"
                placeholder="Search Infrastructure..."
                className="w-full bg-transparent border-b border-white/10 py-2 pl-10 pr-4 text-xs font-mono focus:border-white outline-none transition-all placeholder:text-white/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex -space-x-2">
              {["JD", "AS", "+3"].map((tag, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-surface-bright border border-background flex items-center justify-center text-[10px] text-white/60">
                  {tag}
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowCargoAnalysis(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-bold uppercase tracking-wider hover:bg-blue-600/20 transition-all"
              >
                <Brain className="w-4 h-4" />
                AI Analysis
              </button>
              <Bell className="w-5 h-5 text-white/40 hover:text-white transition-colors cursor-pointer" />
              <div
                className="h-8 w-8 rounded-full bg-surface-bright border border-white/5 overflow-hidden cursor-pointer hover:border-white/20 transition-all"
                onClick={togglePanels}
              >
              </div>
            </div>
          </div>
        </header>

        {/* --- MAP INTERFACE --- */}
        <main className="flex-1 relative bg-surface-container-lowest overflow-hidden">
          <div className="scanline" />

          <div className="absolute inset-0">
            <Map onRouteClick={handleRouteClick} />
            <div className="absolute inset-0 map-gradient-overlay pointer-events-none" />
          </div>

          {/* Floating UI: System Feed */}
          <div className="absolute bottom-10 left-10 z-10 flex flex-col gap-6">
            <div className="bg-surface-dim/80 backdrop-blur-xl border border-white/5 p-6 rounded-3xl w-72">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-bold">System Feed</h3>
                <div className="w-2 h-2 rounded-full bg-emerald-500 glow-led" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[9px] text-white/20 uppercase tracking-widest mb-0.5">Latency</div>
                  <div className="font-mono text-xs text-white">12MS</div>
                </div>
                <div>
                  <div className="text-[9px] text-white/20 uppercase tracking-widest mb-0.5">Uptime</div>
                  <div className="font-mono text-xs text-white">99.9%</div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all">
                <Plus className="w-4 h-4" />
              </button>
              <button className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all">
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </section>

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

      {/* --- SLIDE PANELS --- */}
      <AnimatePresence>
        {showPanels && (
          <>
            {/* Left Panel: Metrics */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              className="fixed left-0 top-20 bottom-12 w-[400px] bg-surface-dim/95 backdrop-blur-2xl border-r border-t border-white/5 z-[9999] p-6 flex flex-col gap-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">
                    <TextScramble text="Route Intelligence" />
                  </span>
                  <h2 className="text-xl font-serif text-white leading-tight">
                    <TextScramble text={selectedRoute?.label ?? "Select a Route"} delay={200} />
                  </h2>
                </div>
                <button onClick={() => setShowPanels(false)} className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin">

                {/* Hop path */}
                {routeResult && (
                  <section>
                    <h3 className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-bold mb-3">Computed Path</h3>
                    <div className="flex flex-wrap gap-1">
                      {routeResult.path.map((p, i) => (
                        <span key={`${p}-${i}`} className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/80">{p}</span>
                          {i < routeResult.path.length - 1 && <span className="text-white/20 text-[9px]">→</span>}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* Segment breakdown */}
                {routeResult && routeResult.segments.length > 0 && (
                  <section>
                    <h3 className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-bold mb-3">Segment Breakdown</h3>
                    <div className="flex flex-col gap-2">
                      {routeResult.segments.map((seg, i) => {
                        const p = MODE_PROFILES[seg.mode];
                        return (
                          <div key={i} className="p-3 rounded-lg bg-surface border border-white/5 flex gap-3 items-start">
                            <div style={{ width:3, borderRadius:2, background: seg.disrupted ? '#ff4444' : p.color, flexShrink:0, alignSelf:'stretch' }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-mono" style={{ color: seg.disrupted ? '#ff4444' : p.color }}>{p.label.toUpperCase()}{seg.disrupted ? ' ⚠' : ''}</span>
                                <span className="text-[9px] font-mono text-white/40">{seg.from} → {seg.to}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <div className="text-[8px] text-white/30 uppercase">Dist</div>
                                  <div className="text-[10px] font-mono text-white/70">{seg.distanceKm.toLocaleString()}km</div>
                                </div>
                                <div>
                                  <div className="text-[8px] text-white/30 uppercase">Time</div>
                                  <div className="text-[10px] font-mono text-white/70">{seg.durationHr > 24 ? `${(seg.durationHr/24).toFixed(1)}d` : `${seg.durationHr}h`}</div>
                                </div>
                                <div>
                                  <div className="text-[8px] text-white/30 uppercase">CO₂</div>
                                  <div className="text-[10px] font-mono text-white/70">{seg.co2Kg}kg</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Summary metrics */}
                {routeResult && (
                  <section className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-surface border border-white/5">
                      <div className="flex items-center gap-1.5 mb-1"><DollarSign className="w-3 h-3 text-white/30" /><p className="text-[8px] uppercase tracking-widest text-white/30">Total Cost</p></div>
                      <div className="text-lg font-serif">${routeResult.totalCostUSD.toLocaleString()}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface border border-white/5">
                      <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3 h-3 text-white/30" /><p className="text-[8px] uppercase tracking-widest text-white/30">Duration</p></div>
                      <div className="text-lg font-serif">{(routeResult.totalDurationHr / 24).toFixed(1)}d</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface border border-white/5">
                      <div className="flex items-center gap-1.5 mb-1"><Activity className="w-3 h-3 text-white/30" /><p className="text-[8px] uppercase tracking-widest text-white/30">Risk</p></div>
                      <div className={`text-lg font-serif ${routeResult.riskScore > 0.2 ? 'text-red-400' : 'text-emerald-400'}`}>{(routeResult.riskScore * 100).toFixed(0)}%</div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface border border-white/5">
                      <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-3 h-3 text-white/30" /><p className="text-[8px] uppercase tracking-widest text-white/30">CO₂</p></div>
                      <div className="text-lg font-serif">{routeResult.totalCo2Kg.toLocaleString()}kg</div>
                    </div>
                  </section>
                )}

                {/* Monte Carlo */}
                {routeResult && (
                  <section>
                    <h3 className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-bold mb-3">Monte Carlo — {routeResult.monteCarlo.simulations.toLocaleString()} runs</h3>
                    <div className="p-3 rounded-xl bg-surface border border-white/5 flex flex-col gap-2">
                      {[
                        { label: "P50 Cost",   val: `$${routeResult.monteCarlo.p50Cost.toLocaleString()}`, danger: false },
                        { label: "P95 Cost",   val: `$${routeResult.monteCarlo.p95Cost.toLocaleString()}`, danger: true },
                        { label: "P50 Duration", val: `${(routeResult.monteCarlo.p50Duration/24).toFixed(1)}d`, danger: false },
                        { label: "P95 Duration", val: `${(routeResult.monteCarlo.p95Duration/24).toFixed(1)}d`, danger: true },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between text-[10px]">
                          <span className="text-white/40 uppercase tracking-wider">{row.label}</span>
                          <span className={`font-mono ${row.danger ? 'text-red-400' : 'text-white'}`}>{row.val}</span>
                        </div>
                      ))}
                      <div className="mt-1">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-white/40 uppercase tracking-wider">Delay Probability</span>
                          <span className={`font-mono ${routeResult.monteCarlo.delayProbability > 30 ? 'text-red-400' : 'text-emerald-400'}`}>{routeResult.monteCarlo.delayProbability}%</span>
                        </div>
                        <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width:0 }} animate={{ width:`${routeResult.monteCarlo.delayProbability}%` }} transition={{ duration:1 }}
                            className={`h-full ${routeResult.monteCarlo.delayProbability > 30 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Strategy compare */}
                {selectedRoute && routeResult && (
                  <section>
                    <h3 className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-bold mb-3">Strategy Comparison</h3>
                    <div className="flex flex-col gap-2">
                      {compareStrategies(selectedRoute.from, selectedRoute.to).slice(0, 4).map(({ strategy, result }) => (
                        <div key={strategy} className="p-3 rounded-lg bg-surface border border-white/5">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-mono text-white/60">{strategy}</span>
                            <div className="flex gap-2">
                              {result.modes.map(m => (
                                <span key={m} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background:`${MODE_PROFILES[m].color}22`, color:MODE_PROFILES[m].color, border:`1px solid ${MODE_PROFILES[m].color}44` }}>{MODE_PROFILES[m].label}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-4 text-[9px]">
                            <span className="text-white/50">${result.totalCostUSD.toLocaleString()}</span>
                            <span className="text-white/50">{(result.totalDurationHr/24).toFixed(1)}d</span>
                            <span className="text-white/50">{result.totalCo2Kg.toLocaleString()}kg CO₂</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Disruption warning */}
                {selectedRoute?.disrupted && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-300 font-medium">Active Disruption</p>
                      <p className="text-[10px] text-red-400/60 mt-1">Route passes disrupted segments. Alternate strategies recommended.</p>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!routeResult && (
                  <div className="flex flex-col gap-3">
                    <div className="p-4 rounded-xl bg-surface border border-white/5 flex gap-3">
                      <CloudLightning className="w-4 h-4 text-red-400 shrink-0" />
                      <div><p className="text-xs text-white/80 font-medium">Houthi Activity</p><p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">Red Sea lanes degraded</p></div>
                    </div>
                    <div className="p-4 rounded-xl bg-surface border border-white/5 flex gap-3">
                      <Globe className="w-4 h-4 text-white/40 shrink-0" />
                      <div><p className="text-xs text-white/80 font-medium">Click any route on the map</p><p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">to load multi-modal analytics</p></div>
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>

            {/* Right Panel: Advisor */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="fixed right-0 top-20 w-[400px] bg-surface-dim/95 backdrop-blur-2xl border-l border-t border-white/5 z-[9999] p-6 flex flex-col gap-6 h-full"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">
                    <TextScramble text="Command Suite" />
                  </span>
                  <h2 className="text-3xl font-serif text-white">
                    <TextScramble text="Strategic Advisor" delay={200} />
                  </h2>
                </div>
                <Brain className="w-6 h-6 text-white/20" />
              </div>

              <div className="flex-1 flex flex-col gap-10 overflow-hidden">
                <section className="flex flex-col gap-6">
                  <h3 className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-bold">What-If Simulation</h3>
                  <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                        <span>Transit Speed</span>
                        <span className="text-white">{(transitSpeed / 3).toFixed(1)} Knots</span>
                      </div>
                      <input
                        type="range"
                        value={transitSpeed}
                        onChange={(e) => setTransitSpeed(parseInt(e.target.value))}
                        className="w-full accent-white bg-white/10 h-px appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                        <span>Cost Ceiling</span>
                        <span className="text-white">${(costCeiling / 10).toFixed(1)}M</span>
                      </div>
                      <input
                        type="range"
                        value={costCeiling}
                        onChange={(e) => setCostCeiling(parseInt(e.target.value))}
                        className="w-full accent-white bg-white/10 h-px appearance-none cursor-pointer"
                      />
                    </div>
                    <button className="w-full py-4 rounded-xl border border-white/10 text-[11px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                      Optimize Route
                    </button>
                  </div>
                </section>

                <section className="flex-1 flex flex-col min-h-0 bg-surface/50 border border-white/5 rounded-3xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Neural Core v6</span>
                    </div>
                    <span className="text-[8px] text-white/20 uppercase tracking-[0.3em]">Encrypted</span>
                  </div>

                  <div className="flex-1 p-6 space-y-6 overflow-y-auto scrollbar-thin">
                    {messages.map((m, i) => (
                      <div key={i} className="flex flex-col gap-2 max-w-[85%]">
                        <span className="text-[9px] text-white/20 uppercase tracking-widest">
                          {m.role === 'ai' ? 'Neural Core' : 'Commander'}
                        </span>
                        <div className={`p-4 text-xs leading-relaxed rounded-2xl ${m.role === 'ai' ? 'bg-white/5 text-white/80 italic' : 'bg-surface-bright text-white'}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-6 border-t border-white/5 bg-surface-container-low">
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full bg-surface-container-lowest border border-white/10 rounded-xl px-4 py-3 text-xs placeholder:text-white/10 focus:border-white focus:outline-none transition-colors"
                        placeholder="Instruct advisor..."
                      />
                      <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:text-white transition-colors text-white/20">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-0 left-20 right-0 h-12 px-10 border-t border-white/5 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-white/20 z-[70] bg-background">
        <div className="flex gap-6">
          <span>Obsidian v4.2.0</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
            <span>Nodes Sync: Active</span>
          </div>
        </div>
        <div className="flex gap-6">
          <span>Security Protocol 7</span>
          <span className="text-white/40">© 2026 Obsidian Logistix</span>
        </div>
      </footer>
    </div>
  );
}
