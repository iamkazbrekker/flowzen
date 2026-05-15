// Real-world corridor waypoints for rerouted routes
// Each entry: [lat, lng]

export type LatLng = [number, number];

// ── Sea lane nodes ────────────────────────────────────────────────────────────
export const SEA_CORRIDORS: LatLng[] = [
  [22.3,  114.2], // Hong Kong
  [1.35,  103.8], // Singapore
  [5.6,   80.0],  // Sri Lanka south tip
  [11.5,  43.1],  // Gulf of Aden
  [12.8,  43.5],  // Djibouti
  [27.9,  34.3],  // Red Sea mid
  [30.0,  32.5],  // Suez Canal entrance
  [31.2,  32.4],  // Port Said
  [35.8,  25.0],  // Crete / Eastern Med
  [37.0,  15.0],  // Sicily strait
  [38.0,  10.0],  // Tunis
  [36.1,  -5.4],  // Gibraltar
  [43.0,  -9.5],  // Bay of Biscay
  [48.5,  -4.5],  // Brittany coast
  [51.9,   4.5],  // Rotterdam
];

export const CAPE_ROUTE: LatLng[] = [
  [22.3,  114.2], // Hong Kong
  [1.35,  103.8], // Singapore
  [-8.0,   75.0], // Indian Ocean mid
  [-34.4,  18.5], // Cape of Good Hope
  [-33.9,  26.9], // Port Elizabeth
  [-28.0,   0.0], // South Atlantic
  [0.0,   -10.0], // Equatorial Atlantic
  [36.1,   -5.4], // Gibraltar
  [51.9,    4.5], // Rotterdam
];

// ── Rail corridor nodes ───────────────────────────────────────────────────────
export const TRANS_EURASIA_RAIL: LatLng[] = [
  [31.2,  121.5], // Shanghai
  [36.6,  117.0], // Jinan
  [39.9,  116.4], // Beijing
  [40.8,  111.7], // Hohhot
  [43.8,   87.6], // Urumqi
  [43.3,   76.9], // Almaty
  [51.2,   71.4], // Astana
  [55.0,   73.4], // Omsk
  [56.5,   84.9], // Novosibirsk (eastbound) or swap for westbound
  [55.8,   37.6], // Moscow
  [55.9,   23.3], // Vilnius
  [52.2,   21.0], // Warsaw
  [52.5,   13.4], // Berlin
  [51.9,    4.5], // Rotterdam
];

export const EUROPE_RAIL: LatLng[] = [
  [51.9,    4.5], // Rotterdam
  [51.2,    4.4], // Antwerp
  [50.8,    4.4], // Brussels
  [50.1,    8.7], // Frankfurt
  [48.1,   11.6], // Munich
  [47.5,   19.1], // Budapest
  [44.8,   20.5], // Belgrade
  [41.0,   28.9], // Istanbul
];

// ── Road corridor nodes ───────────────────────────────────────────────────────
export const EUROPE_ROAD: LatLng[] = [
  [51.9,   4.5],  // Rotterdam
  [52.4,   4.9],  // Amsterdam
  [52.5,  13.4],  // Berlin
  [52.2,  21.0],  // Warsaw
  [50.1,  14.4],  // Prague
  [48.2,  16.4],  // Vienna
  [47.5,  19.1],  // Budapest
  [45.8,  24.1],  // Bucharest region
];

export const SILKROAD_ROAD: LatLng[] = [
  [39.9,  116.4], // Beijing
  [36.1,  103.8], // Lanzhou
  [39.1,   88.3], // Hami
  [43.8,   87.6], // Urumqi
  [40.1,   67.8], // Samarkand
  [37.9,   58.4], // Ashgabat
  [35.7,   51.4], // Tehran
  [39.9,   32.9], // Ankara
  [41.0,   28.9], // Istanbul
  [44.8,   20.5], // Belgrade
  [48.2,   16.4], // Vienna
  [52.5,   13.4], // Berlin
  [51.9,    4.5], // Rotterdam
];

// ── Air hub chains ────────────────────────────────────────────────────────────
export const AIR_ASIA_EUROPE: LatLng[] = [
  [31.1,  121.8], // Shanghai PVG
  [37.5,  127.0], // Seoul ICN
  [35.7,  139.8], // Tokyo NRT
  [51.5,   -0.5], // London LHR (polar route)
  [48.4,    2.6], // Paris CDG
  [52.5,   13.4], // Berlin BER
  [51.9,    4.5], // Amsterdam AMS near Rotterdam
];

export const AIR_EUROPE_AMERICA: LatLng[] = [
  [52.2,   21.0], // Warsaw WAW
  [50.0,    8.6], // Frankfurt FRA
  [51.5,   -0.5], // London LHR
  [64.1,  -21.9], // Reykjavik (polar crossing)
  [53.3,  -6.25], // Dublin
  [41.9,  -87.9], // Chicago ORD
];

export const AIR_PACIFIC: LatLng[] = [
  [31.1,  121.8], // Shanghai PVG
  [21.3, -157.9], // Honolulu HNL
  [37.6, -122.4], // San Francisco SFO
  [41.9,  -87.9], // Chicago ORD
];

// ── Snap waypoints to a known corridor ───────────────────────────────────────
// Returns the closest matching corridor subset between two points
function dist2(a: LatLng, b: LatLng) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

function closestIdx(corridor: LatLng[], pt: LatLng): number {
  let best = 0, bestD = Infinity;
  corridor.forEach((c, i) => { const d = dist2(c, pt); if (d < bestD) { bestD = d; best = i; } });
  return best;
}

export function sliceCorridor(corridor: LatLng[], from: LatLng, to: LatLng): LatLng[] {
  const fi = closestIdx(corridor, from);
  const ti = closestIdx(corridor, to);
  const [lo, hi] = fi < ti ? [fi, ti] : [ti, fi];
  const slice = corridor.slice(lo, hi + 1);
  return fi > ti ? slice.reverse() : slice;
}

// Geodesic helper
function geodesicPoints(from: LatLng, to: LatLng, steps = 32): LatLng[] {
  const R2D = 180 / Math.PI, D2R = Math.PI / 180;
  const la1 = from[0] * D2R, lo1 = from[1] * D2R;
  const la2 = to[0] * D2R, lo2 = to[1] * D2R;
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2
  ));
  if (d < 0.001) return [from, to];
  const pts: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
    const z = A * Math.sin(la1) + B * Math.sin(la2);
    pts.push([Math.atan2(z, Math.sqrt(x ** 2 + y ** 2)) * R2D, Math.atan2(y, x) * R2D]);
  }
  return pts;
}

// ── Public API ─────────────────────────────────────────────────────────────────
export async function getReroutedWaypoints(
  mode: string,
  from: LatLng,
  to: LatLng
): Promise<LatLng[]> {
  // Pick the best corridor
  const isEuropeAmerica = to[1] < -40 || from[1] < -40;
  const isPacific       = (from[1] > 100 && to[1] < -100) || (to[1] > 100 && from[1] < -100);
  const isCapeRoute     = mode === "sea" && Math.abs(from[1] - to[1]) > 80;

  let corridor: LatLng[];
  switch (mode) {
    case "sea":
      corridor = isCapeRoute ? CAPE_ROUTE : SEA_CORRIDORS;
      break;
    case "rail":
      corridor = Math.abs(from[1] - to[1]) > 40 ? TRANS_EURASIA_RAIL : EUROPE_RAIL;
      break;
    case "road":
      corridor = Math.abs(from[1] - to[1]) > 40 ? SILKROAD_ROAD : EUROPE_ROAD;
      break;
    case "air":
      if (isPacific)       corridor = AIR_PACIFIC;
      else if (isEuropeAmerica) corridor = AIR_EUROPE_AMERICA;
      else                 corridor = AIR_ASIA_EUROPE;
      break;
    default:
      return geodesicPoints(from, to, 24);
  }

  const slice = sliceCorridor(corridor, from, to);

  // Prepend actual origin and append actual destination for precision
  const full: LatLng[] = [from, ...slice, to];

  // For air, smooth with geodesic interpolation between each waypoint pair
  if (mode === "air") {
    const smooth: LatLng[] = [];
    for (let i = 0; i < full.length - 1; i++) {
      smooth.push(...geodesicPoints(full[i], full[i + 1], 8).slice(0, -1));
    }
    smooth.push(full[full.length - 1]);
    return smooth;
  }

  // For road, try OSRM between waypoints for extra realism
  if (mode === "road") {
    try {
      const [f, t] = [from, to];
      const url = `https://router.project-osrm.org/route/v1/driving/${f[1]},${f[0]};${t[1]},${t[0]}?geometries=geojson&overview=full`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data.code === "Ok" && data.routes?.[0]) {
          return data.routes[0].geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng] as LatLng
          );
        }
      }
    } catch { /* fallthrough to corridor */ }
  }

  return full;
}
