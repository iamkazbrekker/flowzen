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
  // ── SEA ──
  { id:"SHA-SIN-sea", from:"SHA", to:"SIN", mode:"sea", baseRisk:0.12,
    waypoints:[[31.23,121.47],[27,121],[22.3,114.2],[13,109],[1.26,103.82]] },
  { id:"SIN-DXB-sea", from:"SIN", to:"DXB", mode:"sea", baseRisk:0.12,
    waypoints:[[1.26,103.82],[5.5,95],[8,80],[10,65],[24.98,55.06]] },
  { id:"DXB-ADE-sea", from:"DXB", to:"ADE", mode:"sea", baseRisk:0.28,
    disrupted:true, disruption:"Houthi attacks — Bab-el-Mandeb",
    waypoints:[[24.98,55.06],[18,48],[12.78,45.03]] },
  { id:"ADE-SUE-sea", from:"ADE", to:"SUE", mode:"sea", baseRisk:0.30,
    disrupted:true, disruption:"Red Sea conflict zone",
    waypoints:[[12.78,45.03],[20,38.5],[27,34.5],[30.58,32.33]] },
  { id:"SUE-GIB-sea", from:"SUE", to:"GIB", mode:"sea", baseRisk:0.08,
    waypoints:[[30.58,32.33],[35,27],[37,15],[36.14,-5.35]] },
  { id:"GIB-RTM-sea", from:"GIB", to:"RTM", mode:"sea", baseRisk:0.07,
    waypoints:[[36.14,-5.35],[44,-8],[48,-5],[51.92,4.48]] },
  { id:"RTM-HAM-sea", from:"RTM", to:"HAM", mode:"sea", baseRisk:0.03,
    waypoints:[[51.92,4.48],[53.5,7.5],[53.55,10.0]] },
  { id:"SIN-CPT-sea", from:"SIN", to:"CPT", mode:"sea", baseRisk:0.08,
    waypoints:[[1.26,103.82],[-5,90],[-15,70],[-25,40],[-33.91,18.42]] },
  { id:"CPT-GIB-sea", from:"CPT", to:"GIB", mode:"sea", baseRisk:0.07,
    waypoints:[[-33.91,18.42],[-20,5],[0,-10],[20,-20],[40,-15],[36.14,-5.35]] },
  { id:"SHA-YOK-sea", from:"SHA", to:"YOK", mode:"sea", baseRisk:0.08,
    waypoints:[[31.23,121.47],[33,128],[35.45,139.64]] },
  { id:"YOK-HON-sea", from:"YOK", to:"HON", mode:"sea", baseRisk:0.10,
    waypoints:[[35.45,139.64],[33,160],[26,-175],[21.31,-157.86]] },
  { id:"HON-LAX-sea", from:"HON", to:"LAX", mode:"sea", baseRisk:0.08,
    waypoints:[[21.31,-157.86],[26,-145],[30,-130],[33.74,-118.27]] },
  { id:"MUN-DXB-sea", from:"MUN", to:"DXB", mode:"sea", baseRisk:0.08,
    waypoints:[[22.84,69.72],[24,60],[24.98,55.06]] },
  { id:"COL-SIN-sea", from:"COL", to:"SIN", mode:"sea", baseRisk:0.08,
    waypoints:[[6.93,79.85],[5,90],[1.26,103.82]] },
  { id:"CHN-COL-sea", from:"CHN", to:"COL", mode:"sea", baseRisk:0.07,
    waypoints:[[13.08,80.27],[10,79],[6.93,79.85]] },

  // ── RAIL ──
  { id:"DEL-BLR-rail", from:"DEL", to:"BLR", mode:"rail", baseRisk:0.04,
    waypoints:[[28.63,77.21],[25.4,81.9],[21.1,79.1],[18.5,73.9],[12.97,77.59]] },
  { id:"MUN-DEL-rail", from:"MUN", to:"DEL", mode:"rail", baseRisk:0.05,
    waypoints:[[22.84,69.72],[23.5,72.5],[26.9,75.8],[28.63,77.21]] },
  { id:"SHA-IST-rail", from:"SHA", to:"IST", mode:"rail", baseRisk:0.15,
    waypoints:[[31.23,121.47],[40,90],[45,65],[41.01,28.97]] },
  { id:"IST-MAD-rail", from:"IST", to:"MAD", mode:"rail", baseRisk:0.08,
    waypoints:[[41.01,28.97],[42,20],[43,5],[40.42,-3.70]] },
  { id:"MAD-RTM-rail", from:"MAD", to:"RTM", mode:"rail", baseRisk:0.05,
    waypoints:[[40.42,-3.70],[44,0],[48,2],[51.92,4.48]] },
  { id:"IST-RTM-rail", from:"IST", to:"RTM", mode:"rail", baseRisk:0.07,
    waypoints:[[41.01,28.97],[44,15],[48,8],[51.92,4.48]] },
  { id:"CHN-BLR-rail", from:"CHN", to:"BLR", mode:"rail", baseRisk:0.06,
    waypoints:[[13.08,80.27],[13,79.5],[12.97,77.59]] },

  // ── ROAD ──
  { id:"BLR-CHN-road", from:"BLR", to:"CHN", mode:"road", baseRisk:0.08,
    waypoints:[[12.97,77.59],[12.5,78.5],[13.08,80.27]] },
  { id:"DXB-IST-road", from:"DXB", to:"IST", mode:"road", baseRisk:0.18,
    waypoints:[[24.98,55.06],[30,48],[36,36],[41.01,28.97]] },
  { id:"RTM-HAM-road", from:"RTM", to:"HAM", mode:"road", baseRisk:0.04,
    waypoints:[[51.92,4.48],[52.5,7],[53.55,10.0]] },

  // ── AIR ──
  { id:"SHA-DXB-air", from:"SHA", to:"DXB", mode:"air", baseRisk:0.03,
    waypoints:[[31.23,121.47],[28,90],[24.98,55.06]] },
  { id:"DXB-RTM-air", from:"DXB", to:"RTM", mode:"air", baseRisk:0.03,
    waypoints:[[24.98,55.06],[40,25],[51.92,4.48]] },
  { id:"DEL-DXB-air", from:"DEL", to:"DXB", mode:"air", baseRisk:0.03,
    waypoints:[[28.63,77.21],[26,66],[24.98,55.06]] },
  { id:"SHA-LAX-air", from:"SHA", to:"LAX", mode:"air", baseRisk:0.03,
    waypoints:[[31.23,121.47],[45,160],[33.74,-118.27]] },
  { id:"DEL-RTM-air", from:"DEL", to:"RTM", mode:"air", baseRisk:0.03,
    waypoints:[[28.63,77.21],[38,45],[51.92,4.48]] },
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
    const p: { from: string; lane: Lane } | null = prev[cur];
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
