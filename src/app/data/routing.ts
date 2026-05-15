/**
 * FlowZen Multi-Modal Routing Engine
 * Modes: sea | rail | road | air
 * Algorithm: Multi-objective Dijkstra + Monte Carlo disruption simulation
 */

export type TransportMode = "sea" | "rail" | "road" | "air";

// ─── MODE PROFILES ────────────────────────────────────────────────────────────
export const MODE_PROFILES: Record<TransportMode, {
  speedKmh: number;
  costPerKmPerTEU: number;  // USD
  co2PerKmPerTEU: number;   // kg CO2
  color: string;
  label: string;
  dashArray?: string;
}> = {
  sea:  { speedKmh: 28,   costPerKmPerTEU: 0.04,  co2PerKmPerTEU: 0.015, color: "#60a5fa", label: "Maritime",  dashArray: undefined },
  rail: { speedKmh: 80,   costPerKmPerTEU: 0.08,  co2PerKmPerTEU: 0.006, color: "#00ff88", label: "Rail",      dashArray: "8, 4" },
  road: { speedKmh: 60,   costPerKmPerTEU: 0.12,  co2PerKmPerTEU: 0.10,  color: "#f59e0b", label: "Road",      dashArray: "4, 4" },
  air:  { speedKmh: 850,  costPerKmPerTEU: 4.50,  co2PerKmPerTEU: 0.60,  color: "#e879f9", label: "Air Cargo", dashArray: "2, 6" },
};

// ─── PORTS / HUBS ─────────────────────────────────────────────────────────────
export interface Port {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "seaport" | "airport" | "railhub" | "icd" | "canal";
  modes: TransportMode[];
}

export const PORTS: Record<string, Port> = {
  SHA: { id:"SHA", name:"Shanghai",        lat:31.23,  lng:121.47, type:"seaport",  modes:["sea","air","rail"] },
  RTM: { id:"RTM", name:"Rotterdam",       lat:51.92,  lng:4.48,   type:"seaport",  modes:["sea","rail","road"] },
  SIN: { id:"SIN", name:"Singapore",       lat:1.26,   lng:103.82, type:"seaport",  modes:["sea","air"] },
  SUE: { id:"SUE", name:"Suez Canal",      lat:30.58,  lng:32.33,  type:"canal",    modes:["sea"] },
  MUN: { id:"MUN", name:"Mundra",          lat:22.84,  lng:69.72,  type:"seaport",  modes:["sea","rail","road"] },
  LAX: { id:"LAX", name:"Los Angeles",     lat:33.74,  lng:-118.27,type:"seaport",  modes:["sea","air","rail"] },
  YOK: { id:"YOK", name:"Yokohama",        lat:35.45,  lng:139.64, type:"seaport",  modes:["sea","rail"] },
  CPT: { id:"CPT", name:"Cape Town",       lat:-33.91, lng:18.42,  type:"seaport",  modes:["sea"] },
  DEL: { id:"DEL", name:"Delhi ICD",       lat:28.63,  lng:77.21,  type:"icd",      modes:["rail","road","air"] },
  BLR: { id:"BLR", name:"Bengaluru",       lat:12.97,  lng:77.59,  type:"icd",      modes:["rail","road","air"] },
  HAM: { id:"HAM", name:"Hamburg",         lat:53.55,  lng:10.00,  type:"seaport",  modes:["sea","rail","road"] },
  DXB: { id:"DXB", name:"Dubai",           lat:24.98,  lng:55.06,  type:"seaport",  modes:["sea","air","road"] },
  COL: { id:"COL", name:"Colombo",         lat:6.93,   lng:79.85,  type:"seaport",  modes:["sea"] },
  HON: { id:"HON", name:"Honolulu",        lat:21.31,  lng:-157.86,type:"airport",  modes:["sea","air"] },
  ADE: { id:"ADE", name:"Aden",            lat:12.78,  lng:45.03,  type:"seaport",  modes:["sea"] },
  GIB: { id:"GIB", name:"Gibraltar",      lat:36.14,  lng:-5.35,  type:"seaport",  modes:["sea"] },
  MAD: { id:"MAD", name:"Madrid",          lat:40.42,  lng:-3.70,  type:"railhub",  modes:["rail","road"] },
  IST: { id:"IST", name:"Istanbul",        lat:41.01,  lng:28.97,  type:"railhub",  modes:["rail","road","sea"] },
  CHN: { id:"CHN", name:"Chennai",         lat:13.08,  lng:80.27,  type:"seaport",  modes:["sea","rail","road"] },
};

// ─── HAVERSINE DISTANCE ────────────────────────────────────────────────────────
export function haversineKm(a: [number,number], b: [number,number]): number {
  const R = 6371;
  const dLat = (b[0]-a[0]) * Math.PI/180;
  const dLng = (b[1]-a[1]) * Math.PI/180;
  const s = Math.sin(dLat/2)**2 +
            Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}

function laneDistance(wps: [number,number][]): number {
  let d = 0;
  for (let i = 1; i < wps.length; i++) d += haversineKm(wps[i-1], wps[i]);
  return d;
}

// ─── LANES ────────────────────────────────────────────────────────────────────
export interface Lane {
  id: string;
  from: string;
  to: string;
  mode: TransportMode;
  waypoints: [number,number][];
  disrupted?: boolean;
  disruption?: string;
  baseRisk: number;
}

export const LANES: Lane[] = [
  // ── SEA: South China Sea & Pacific ──
  { id:"SHA-SIN-sea", from:"SHA", to:"SIN", mode:"sea", baseRisk:0.12,
    waypoints:[[31.23,121.47],[29.5,122.3],[25.0,121.5],[22.0,114.5],[18.0,111.5],[12.0,109.0],[7.0,106.5],[3.5,105.5],[1.26,103.82]] },
  { id:"SHA-YOK-sea", from:"SHA", to:"YOK", mode:"sea", baseRisk:0.08,
    waypoints:[[31.23,121.47],[31.5,124.0],[32.5,127.0],[33.5,131.0],[34.5,135.5],[35.45,139.64]] },
  { id:"YOK-HON-sea", from:"YOK", to:"HON", mode:"sea", baseRisk:0.10,
    waypoints:[[35.45,139.64],[37.0,150.0],[40.0,165.0],[42.0,178.0],[40.0,-175.0],[35.0,-165.0],[29.0,-160.0],[24.0,-158.5],[21.31,-157.86]] },
  { id:"HON-LAX-sea", from:"HON", to:"LAX", mode:"sea", baseRisk:0.08,
    waypoints:[[21.31,-157.86],[24.0,-152.0],[27.0,-143.0],[30.0,-133.0],[32.5,-124.0],[33.74,-118.27]] },

  // ── SEA: Indian Ocean & Arabian Sea ──
  { id:"SIN-DXB-sea", from:"SIN", to:"DXB", mode:"sea", baseRisk:0.12,
    waypoints:[[1.26,103.82],[2.5,101.5],[4.5,99.5],[6.5,95.0],[8.0,85.0],[11.0,72.0],[16.5,62.0],[20.0,58.0],[22.5,56.5],[24.0,56.0],[24.98,55.06]] },
  { id:"MUN-DXB-sea", from:"MUN", to:"DXB", mode:"sea", baseRisk:0.08,
    waypoints:[[22.84,69.72],[22.5,66.0],[23.0,61.0],[23.5,57.0],[24.0,55.8],[24.98,55.06]] },
  { id:"CHN-COL-sea", from:"CHN", to:"COL", mode:"sea", baseRisk:0.07,
    waypoints:[[13.08,80.27],[10.5,80.0],[8.5,79.5],[6.93,79.85]] },
  { id:"COL-SIN-sea", from:"COL", to:"SIN", mode:"sea", baseRisk:0.08,
    waypoints:[[6.93,79.85],[5.0,85.0],[3.5,91.0],[2.5,97.5],[1.8,101.5],[1.26,103.82]] },

  // ── SEA: Red Sea & Suez (disrupted) ──
  { id:"DXB-ADE-sea", from:"DXB", to:"ADE", mode:"sea", baseRisk:0.28,
    disrupted:true, disruption:"Houthi attacks — Bab-el-Mandeb",
    waypoints:[[24.98,55.06],[24.5,56.5],[23.0,59.5],[20.5,60.0],[16.0,53.5],[13.5,49.0],[12.78,45.03]] },
  { id:"ADE-SUE-sea", from:"ADE", to:"SUE", mode:"sea", baseRisk:0.30,
    disrupted:true, disruption:"Red Sea conflict zone",
    waypoints:[[12.78,45.03],[13.5,43.2],[15.0,42.0],[18.0,39.5],[22.0,37.2],[25.5,34.5],[27.5,34.0],[29.0,32.8],[30.58,32.33]] },

  // ── SEA: Mediterranean & Atlantic ──
  { id:"SUE-GIB-sea", from:"SUE", to:"GIB", mode:"sea", baseRisk:0.08,
    waypoints:[[30.58,32.33],[31.5,30.5],[33.0,27.0],[34.5,23.0],[35.2,18.0],[36.0,13.0],[36.5,8.0],[37.0,3.0],[36.5,-1.5],[36.14,-5.35]] },
  { id:"GIB-RTM-sea", from:"GIB", to:"RTM", mode:"sea", baseRisk:0.07,
    waypoints:[[36.14,-5.35],[38.0,-9.5],[41.0,-11.0],[44.0,-10.0],[47.0,-8.0],[49.5,-5.0],[50.5,-2.5],[51.0,-0.5],[51.4,2.0],[51.92,4.48]] },
  { id:"RTM-HAM-sea", from:"RTM", to:"HAM", mode:"sea", baseRisk:0.03,
    waypoints:[[51.92,4.48],[52.5,6.0],[53.0,7.5],[53.3,8.5],[53.55,10.0]] },

  // ── SEA: Cape of Good Hope ──
  { id:"SIN-CPT-sea", from:"SIN", to:"CPT", mode:"sea", baseRisk:0.08,
    waypoints:[[1.26,103.82],[-3.0,97.0],[-8.0,87.0],[-12.0,75.0],[-17.0,62.0],[-22.0,47.0],[-27.0,32.0],[-31.0,24.0],[-33.91,18.42]] },
  { id:"CPT-GIB-sea", from:"CPT", to:"GIB", mode:"sea", baseRisk:0.07,
    waypoints:[[-33.91,18.42],[-30.0,14.0],[-25.0,8.0],[-17.0,0.0],[-8.0,-5.0],[0.0,-10.0],[8.0,-15.0],[15.0,-18.0],[22.0,-17.0],[28.0,-13.0],[32.5,-10.0],[35.0,-7.0],[36.14,-5.35]] },

  // ── RAIL: India ──
  { id:"DEL-BLR-rail", from:"DEL", to:"BLR", mode:"rail", baseRisk:0.04,
    // Delhi → Agra → Gwalior → Jhansi → Bhopal → Itarsi → Nagpur → Kazipet → Hyderabad → Guntakal → Bengaluru
    waypoints:[[28.63,77.21],[27.18,78.01],[26.22,78.18],[25.45,78.57],[23.26,77.40],[22.61,77.75],[21.15,79.09],[18.43,79.13],[17.99,79.46],[17.39,78.47],[15.45,76.98],[12.97,77.59]] },
  { id:"MUN-DEL-rail", from:"MUN", to:"DEL", mode:"rail", baseRisk:0.05,
    // Mundra → Gandhidham → Ahmedabad → Vadodara → Ratlam → Kota → Mathura → Delhi
    waypoints:[[22.84,69.72],[23.08,70.13],[23.03,72.58],[22.30,73.20],[23.33,75.04],[25.18,75.85],[27.49,77.67],[28.63,77.21]] },
  { id:"CHN-BLR-rail", from:"CHN", to:"BLR", mode:"rail", baseRisk:0.06,
    waypoints:[[13.08,80.27],[13.0,79.5],[12.97,77.59]] },

  // ── RAIL: Belt & Road (China-Europe) ──
  { id:"SHA-IST-rail", from:"SHA", to:"IST", mode:"rail", baseRisk:0.15,
    // Shanghai → Xi'an → Lanzhou → Urumqi → Almaty → Tashkent → Ashgabat → Tehran → Ankara → Istanbul
    waypoints:[[31.23,121.47],[34.27,108.95],[36.06,103.83],[43.79,87.62],[43.25,76.95],[41.30,69.24],[37.95,58.38],[35.69,51.39],[39.93,32.87],[41.01,28.97]] },
  { id:"IST-RTM-rail", from:"IST", to:"RTM", mode:"rail", baseRisk:0.07,
    // Istanbul → Sofia → Belgrade → Budapest → Vienna → Frankfurt → Cologne → Rotterdam
    waypoints:[[41.01,28.97],[42.70,23.32],[44.80,20.46],[47.50,19.04],[48.21,16.37],[48.14,11.58],[50.11,8.68],[50.94,6.96],[51.92,4.48]] },
  { id:"IST-MAD-rail", from:"IST", to:"MAD", mode:"rail", baseRisk:0.08,
    // Istanbul → Thessaloniki → Rome → Marseille → Barcelona → Madrid
    waypoints:[[41.01,28.97],[40.63,22.94],[41.89,12.51],[43.30,5.37],[41.39,2.17],[40.42,-3.70]] },
  { id:"MAD-RTM-rail", from:"MAD", to:"RTM", mode:"rail", baseRisk:0.05,
    // Madrid → Pamplona → Montpellier → Lyon → Paris → Brussels → Rotterdam
    waypoints:[[40.42,-3.70],[42.82,-1.65],[43.61,3.88],[45.75,4.84],[48.86,2.35],[50.84,4.35],[51.92,4.48]] },

  // ── ROAD ──
  { id:"BLR-CHN-road", from:"BLR", to:"CHN", mode:"road", baseRisk:0.08,
    waypoints:[[12.97,77.59],[12.97,78.5],[13.08,80.27]] },
  { id:"DXB-IST-road", from:"DXB", to:"IST", mode:"road", baseRisk:0.18,
    // Dubai → Abu Dhabi → Dammam → Kuwait → Amman → Damascus → Ankara → Istanbul
    waypoints:[[24.98,55.06],[24.46,54.37],[26.43,50.10],[29.36,47.98],[31.95,35.93],[34.80,36.71],[39.93,32.87],[41.01,28.97]] },
  { id:"RTM-HAM-road", from:"RTM", to:"HAM", mode:"road", baseRisk:0.04,
    waypoints:[[51.92,4.48],[52.37,4.89],[52.87,5.99],[52.52,7.06],[53.07,8.80],[53.55,10.00]] },

  // ── AIR ──
  { id:"SHA-DXB-air", from:"SHA", to:"DXB", mode:"air", baseRisk:0.03,
    waypoints:[[31.23,121.47],[29.0,100.0],[26.0,80.0],[24.98,55.06]] },
  { id:"DXB-RTM-air", from:"DXB", to:"RTM", mode:"air", baseRisk:0.03,
    waypoints:[[24.98,55.06],[35.0,25.0],[44.0,12.0],[51.92,4.48]] },
  { id:"DEL-DXB-air", from:"DEL", to:"DXB", mode:"air", baseRisk:0.03,
    waypoints:[[28.63,77.21],[26.5,66.0],[24.98,55.06]] },
  { id:"SHA-LAX-air", from:"SHA", to:"LAX", mode:"air", baseRisk:0.03,
    waypoints:[[31.23,121.47],[40.0,155.0],[45.0,180.0],[40.0,-155.0],[33.74,-118.27]] },
  { id:"DEL-RTM-air", from:"DEL", to:"RTM", mode:"air", baseRisk:0.03,
    waypoints:[[28.63,77.21],[38.0,50.0],[45.0,25.0],[51.92,4.48]] },
];

// ─── ROUTE RESULT ─────────────────────────────────────────────────────────────
export interface SegmentResult {
  from: string;
  to: string;
  mode: TransportMode;
  distanceKm: number;
  durationHr: number;
  costUSD: number;
  co2Kg: number;
  disrupted: boolean;
}

export interface RouteResult {
  path: string[];
  segments: SegmentResult[];
  waypoints: [number,number][];
  totalDistanceKm: number;
  totalDurationHr: number;
  totalCostUSD: number;
  totalCo2Kg: number;
  riskScore: number;
  modes: TransportMode[];
  monteCarlo: MonteCarloResult;
}

export interface MonteCarloResult {
  p50Cost: number;
  p95Cost: number;
  p50Duration: number;
  p95Duration: number;
  delayProbability: number;
  simulations: number;
}

// ─── MULTI-OBJECTIVE SCORE ───────────────────────────────────────────────────
export interface OptWeights {
  cost: number;    // 0–1
  time: number;
  risk: number;
  co2: number;
}

const DEFAULT_WEIGHTS: OptWeights = { cost:0.35, time:0.35, risk:0.20, co2:0.10 };

function laneScore(lane: Lane, weights: OptWeights): number {
  const p = MODE_PROFILES[lane.mode];
  const distKm = laneDistance(lane.waypoints);
  const durationHr = distKm / p.speedKmh;
  const costUSD = distKm * p.costPerKmPerTEU;
  const co2Kg = distKm * p.co2PerKmPerTEU;
  const disruption = lane.disrupted ? 2.0 : 1.0;
  // Normalize into composite (scale each dimension)
  return disruption * (
    weights.cost * costUSD / 1000 +
    weights.time * durationHr / 24 +
    weights.risk * lane.baseRisk * 100 +
    weights.co2 * co2Kg / 100
  );
}

// ─── GRAPH ────────────────────────────────────────────────────────────────────
function buildAdj(avoidModes?: TransportMode[], avoidDisrupted?: boolean) {
  const adj: Record<string, Lane[]> = {};
  for (const lane of LANES) {
    if (avoidModes?.includes(lane.mode)) continue;
    if (avoidDisrupted && lane.disrupted) continue;
    if (!adj[lane.from]) adj[lane.from] = [];
    if (!adj[lane.to]) adj[lane.to] = [];
    adj[lane.from].push(lane);
    adj[lane.to].push({ ...lane, id:lane.id+"_r", from:lane.to, to:lane.from,
      waypoints:[...lane.waypoints].reverse() as [number,number][] });
  }
  return adj;
}

// ─── DIJKSTRA ─────────────────────────────────────────────────────────────────
function dijkstra(
  startId: string,
  endId: string,
  adj: Record<string, Lane[]>,
  weights: OptWeights
): { path: string[]; usedLanes: Lane[] } | null {
  const allIds = new Set([...Object.keys(PORTS)]);
  const dist: Record<string, number> = {};
  const prev: Record<string, { from: string; lane: Lane } | null> = {};
  allIds.forEach(id => { dist[id] = Infinity; prev[id] = null; });
  dist[startId] = 0;
  const unvisited = new Set(allIds);

  while (unvisited.size > 0) {
    let u: string | null = null;
    unvisited.forEach(id => { if (u===null || dist[id]<dist[u!]) u=id; });
    if (!u || dist[u]===Infinity) break;
    if (u === endId) break;
    unvisited.delete(u);

    for (const lane of (adj[u]??[])) {
      if (!unvisited.has(lane.to)) continue;
      const alt = dist[u] + laneScore(lane, weights);
      if (alt < dist[lane.to]) {
        dist[lane.to] = alt;
        prev[lane.to] = { from: u, lane };
      }
    }
  }

  if (dist[endId] === Infinity) return null;

  const path: string[] = [];
  const usedLanes: Lane[] = [];
  let cur: string | null = endId;
  while (cur !== null) {
    path.unshift(cur);
    const p = prev[cur];
    if (p) usedLanes.unshift(p.lane);
    cur = p ? p.from : null;
  }
  return { path, usedLanes };
}

// ─── MONTE CARLO ──────────────────────────────────────────────────────────────
function monteCarlo(
  baseCost: number,
  baseDur: number,
  avgRisk: number,
  n = 1000
): MonteCarloResult {
  const costs: number[] = [];
  const durs: number[] = [];
  let delays = 0;

  for (let i = 0; i < n; i++) {
    let c = baseCost, d = baseDur;
    if (Math.random() < avgRisk) {
      const f = 1 + Math.random() * 0.8 + 0.2;
      c *= f; d *= (1 + Math.random() * 0.5);
      delays++;
    }
    costs.push(c); durs.push(d);
  }
  costs.sort((a,b)=>a-b); durs.sort((a,b)=>a-b);
  return {
    p50Cost: Math.round(costs[Math.floor(n*0.5)]),
    p95Cost: Math.round(costs[Math.floor(n*0.95)]),
    p50Duration: Math.round(durs[Math.floor(n*0.5)]*10)/10,
    p95Duration: Math.round(durs[Math.floor(n*0.95)]*10)/10,
    delayProbability: Math.round(delays/n*100),
    simulations: n,
  };
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export interface FindRouteOptions {
  weights?: OptWeights;
  avoidModes?: TransportMode[];
  avoidDisrupted?: boolean;
}

export function findRoute(
  startId: string,
  endId: string,
  opts: FindRouteOptions = {}
): RouteResult | null {
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const adj = buildAdj(opts.avoidModes, opts.avoidDisrupted);
  const result = dijkstra(startId, endId, adj, weights);
  if (!result) return null;

  const allWps: [number,number][] = [];
  const segments: SegmentResult[] = [];
  let totalCost = 0, totalTime = 0, totalCo2 = 0, totalDist = 0, riskSum = 0;
  const modes = new Set<TransportMode>();

  result.usedLanes.forEach(lane => {
    const p = MODE_PROFILES[lane.mode];
    const dist = laneDistance(lane.waypoints);
    const dur = dist / p.speedKmh;
    const cost = dist * p.costPerKmPerTEU;
    const co2 = dist * p.co2PerKmPerTEU;
    totalDist += dist; totalTime += dur;
    totalCost += cost; totalCo2 += co2;
    riskSum += lane.baseRisk;
    modes.add(lane.mode);
    segments.push({ from:lane.from, to:lane.to, mode:lane.mode,
      distanceKm:Math.round(dist), durationHr:Math.round(dur*10)/10,
      costUSD:Math.round(cost), co2Kg:Math.round(co2),
      disrupted:!!lane.disrupted });
    // Deduplicate first wp with last wp of previous
    const wps = lane.waypoints as [number,number][];
    allWps.push(...(allWps.length>0 ? wps.slice(1) : wps));
  });

  const avgRisk = segments.length > 0 ? riskSum / segments.length : 0;

  return {
    path: result.path,
    segments,
    waypoints: allWps,
    totalDistanceKm: Math.round(totalDist),
    totalDurationHr: Math.round(totalTime * 10) / 10,
    totalCostUSD: Math.round(totalCost),
    totalCo2Kg: Math.round(totalCo2),
    riskScore: Math.round(avgRisk * 100) / 100,
    modes: [...modes],
    monteCarlo: monteCarlo(totalCost, totalTime, avgRisk),
  };
}

// ─── COMPARE ALL MODE STRATEGIES ─────────────────────────────────────────────
export interface ModeStrategy {
  label: string;
  avoidModes?: TransportMode[];
  avoidDisrupted?: boolean;
  weights?: OptWeights;
}

export const STRATEGIES: ModeStrategy[] = [
  { label: "Cheapest (Sea priority)",  weights:{ cost:0.6, time:0.2, risk:0.1, co2:0.1 } },
  { label: "Fastest (Air allowed)",    weights:{ cost:0.1, time:0.7, risk:0.1, co2:0.1 } },
  { label: "Safest (avoid disrupted)", avoidDisrupted:true, weights:{ cost:0.2, time:0.2, risk:0.5, co2:0.1 } },
  { label: "Greenest (low CO₂)",       avoidModes:["air"],  weights:{ cost:0.2, time:0.2, risk:0.2, co2:0.4 } },
  { label: "Balanced",                 weights:{ cost:0.35, time:0.35, risk:0.2, co2:0.1 } },
];

export function compareStrategies(from: string, to: string) {
  return STRATEGIES.map(s => ({
    strategy: s.label,
    result: findRoute(from, to, {
      weights: s.weights,
      avoidModes: s.avoidModes,
      avoidDisrupted: s.avoidDisrupted,
    }),
  })).filter(r => r.result !== null) as { strategy: string; result: RouteResult }[];
}

// ─── DISPLAY ROUTES (pre-computed for map) ────────────────────────────────────
export interface DisplayRoute {
  id: string;
  label: string;
  from: string;
  to: string;
  mode: TransportMode;
  color: string;
  width: number;
  dashArray?: string;
  disrupted: boolean;
  waypoints: [number,number][];
  result: RouteResult;
}

const PREDEFINED: { id:string; from:string; to:string; label:string; opts: FindRouteOptions }[] = [
  { id:"sha-rtm",    from:"SHA", to:"RTM", label:"Shanghai → Rotterdam",         opts:{ avoidDisrupted:false } },
  { id:"sha-rtm-s",  from:"SHA", to:"RTM", label:"Shanghai → Rotterdam (Safe)",  opts:{ avoidDisrupted:true } },
  { id:"yok-lax",    from:"YOK", to:"LAX", label:"Yokohama → Los Angeles",        opts:{} },
  { id:"del-blr",    from:"DEL", to:"BLR", label:"Delhi → Bengaluru",             opts:{ weights:{ cost:0.4, time:0.4, risk:0.1, co2:0.1 } } },
  { id:"sha-lax-air",from:"SHA", to:"LAX", label:"Shanghai → LA (Air+Sea)",       opts:{ weights:{ cost:0.1, time:0.8, risk:0.05, co2:0.05 } } },
  { id:"mun-rtm",    from:"MUN", to:"RTM", label:"Mundra → Rotterdam",            opts:{} },
];

export function buildDisplayRoutes(): DisplayRoute[] {
  const out: DisplayRoute[] = [];
  for (const def of PREDEFINED) {
    const r = findRoute(def.from, def.to, def.opts);
    if (!r || r.waypoints.length < 2) continue;
    // Dominant mode = first segment mode
    const dominantMode = r.segments[0]?.mode ?? "sea";
    const profile = MODE_PROFILES[dominantMode];
    // Safe route gets amber override
    const color = def.id.endsWith("-s") ? "#f59e0b"
                : def.id.includes("air") ? MODE_PROFILES["air"].color
                : profile.color;
    out.push({
      id: def.id,
      label: def.label,
      from: def.from, to: def.to,
      mode: dominantMode,
      color,
      width: def.id.endsWith("-s") ? 2 : 2.5,
      dashArray: def.id.endsWith("-s") ? "10, 8" : profile.dashArray,
      disrupted: r.segments.some(s => s.disrupted),
      waypoints: r.waypoints,
      result: r,
    });
  }
  return out;
}
