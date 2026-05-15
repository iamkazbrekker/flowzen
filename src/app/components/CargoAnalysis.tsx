"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, 
  MapPin, 
  Truck, 
  Ship, 
  Plane, 
  Train, 
  AlertTriangle, 
  ChevronRight, 
  Info,
  Loader2,
  TrendingUp,
  Clock,
  ShieldCheck,
  Leaf
} from "lucide-react";

interface CostAnalysisResult {
  request: any;
  route_data: any;
  mode_estimates: any[];
  disruption_impacts: any[];
  ai_recommendation: {
    recommended_mode: string;
    estimated_cost_usd: number;
    estimated_delay_days: number;
    risk_level: string;
    reason: string;
    best_route: string;
    safest_route: string;
    fastest_route: string;
    cheapest_route: string;
    confidence: number;
  };
}

const MODE_ICONS: Record<string, any> = {
  air: Plane,
  sea: Ship,
  rail: Train,
  road: Truck,
};

const MODE_COLORS: Record<string, string> = {
  air: "#60a5fa", // Blue
  sea: "#2dd4bf", // Teal
  rail: "#a855f7", // Purple
  road: "#fbbf24", // Amber
};

export default function CargoAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CostAnalysisResult | null>(null);
  const [formData, setFormData] = useState({
    source: "Mumbai",
    destination: "Rotterdam",
    cargo_weight_kg: 5000,
    cargo_type: "electronics",
    priority: "standard"
  });

  const runAnalysis = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/cost-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Input Form Card */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Package className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Logistics Intelligence</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">
                Route Details
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    placeholder="Origin (e.g. Mumbai)"
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    placeholder="Destination (e.g. Rotterdam)"
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">
                Cargo Specifications
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="number"
                    value={formData.cargo_weight_kg}
                    onChange={(e) => setFormData({ ...formData, cargo_weight_kg: Number(e.target.value) })}
                    placeholder="Weight (kg)"
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
                <select
                  value={formData.cargo_type}
                  onChange={(e) => setFormData({ ...formData, cargo_type: e.target.value })}
                  className="bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
                >
                  <option value="electronics">Electronics</option>
                  <option value="perishable">Perishable</option>
                  <option value="hazardous">Hazardous</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reasoning with Llama 3...
                </>
              ) : (
                <>
                  Run AI Cost Analysis
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* AI Recommendation Banner */}
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <ShieldCheck className="w-24 h-24 text-blue-400" />
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 relative z-10">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                      AI Recommended
                    </span>
                    <span className="text-zinc-400 text-xs">
                      Confidence: {(result.ai_recommendation.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    {(() => {
                      const Icon = MODE_ICONS[result.ai_recommendation.recommended_mode];
                      return <Icon className="w-8 h-8 text-blue-400" />;
                    })()}
                    {result.ai_recommendation.recommended_mode.toUpperCase()} FREIGHT
                  </h3>
                  <p className="text-zinc-300 text-sm leading-relaxed max-w-2xl italic">
                    "{result.ai_recommendation.reason}"
                  </p>
                </div>

                <div className="flex gap-4 border-l border-white/10 pl-6">
                  <div className="text-center">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Cost</p>
                    <p className="text-2xl font-bold text-white">${result.ai_recommendation.estimated_cost_usd.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Transit</p>
                    <p className="text-2xl font-bold text-white">{result.ai_recommendation.estimated_delay_days} Days</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {result.mode_estimates.map((est) => {
                const Icon = MODE_ICONS[est.mode];
                const isRecommended = est.mode === result.ai_recommendation.recommended_mode;
                return (
                  <div 
                    key={est.mode}
                    className={`p-4 rounded-xl border transition-all ${
                      isRecommended 
                        ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/50' 
                        : 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 rounded-lg bg-zinc-800">
                        <Icon className="w-5 h-5 text-white" style={{ color: MODE_COLORS[est.mode] }} />
                      </div>
                      {est.risk_level !== 'low' && (
                        <div className="bg-amber-500/20 text-amber-500 p-1 rounded">
                          <AlertTriangle className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    
                    <h4 className="text-white font-semibold capitalize mb-1">{est.mode}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-zinc-500 text-[10px] uppercase">Cost</span>
                        <span className="text-white text-sm font-medium">${est.adjusted_cost_usd.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-zinc-500 text-[10px] uppercase">Time</span>
                        <span className="text-white text-sm font-medium">{est.adjusted_transit_days}d</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-zinc-500 text-[10px] uppercase">CO2</span>
                        <span className="text-emerald-500 text-[10px] font-medium">{est.co2_kg}kg</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase font-bold">
                        <span>Reliability</span>
                        <span className="text-zinc-300">{(est.reliability_score * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1 rounded-full mt-1.5 overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-1000" 
                          style={{ width: `${est.reliability_score * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Disruption Intel Section */}
            {result.disruption_impacts.filter(i => i.reasons.length > 0).length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4 text-amber-500">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Active Disruption Impact</h3>
                </div>
                <div className="space-y-3">
                  {result.disruption_impacts.map(impact => (
                    impact.reasons.map((reason: string, idx: number) => (
                      <div key={`${impact.mode}-${idx}`} className="flex gap-3 text-xs">
                        <span className="text-amber-500 font-bold uppercase w-12">{impact.mode}</span>
                        <p className="text-zinc-400 flex-1">{reason}</p>
                      </div>
                    ))
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
