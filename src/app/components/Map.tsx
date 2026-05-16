"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Journey, JourneyLeg, JourneyMode } from "./JourneyBuilder";
import { calculateSeaRoute } from "../data/seaRoutes";
import { getReroutedWaypoints } from "../data/routeWaypoints";
import type { LegAnalysis } from "../../hooks/useDisruptionAgent";

export interface MapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  focusJourney: (journey: Journey) => void;
}

interface MapProps {
  journeys: Journey[];
  onLegClick?: (journey: Journey, leg: JourneyLeg) => void;
  analyses?: LegAnalysis[];
}

// ── Severity → visual overrides ───────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#818cf8",
};
const SEV_DASH: Record<string, string> = {
  critical: "6, 4",
  high: "8, 5",
  medium: "10, 6",
  low: "12, 8",
};

function makeDisruptionIcon(severity: string, rerouted: boolean) {
  const bg = SEV_COLOR[severity] ?? "#f97316";
  const label = rerouted ? "REROUTED" : `!! ${severity.toUpperCase()}`;
  return L.divIcon({
    html: `<div style="
      background:rgba(0,0,0,0.9);border:1px solid ${bg};
      color:${bg};font-size:7px;font-family:monospace;letter-spacing:1px;
      padding:2px 7px;border-radius:10px;white-space:nowrap;pointer-events:none;
      box-shadow:0 0 10px ${bg}55;
      animation:fzPulse 2s ease-in-out infinite;
    ">${label}</div>`,
    className: "", iconSize: [0, 0], iconAnchor: [0, 0],
  });
}

// ── Geodesic great-circle (for air routes) ────────────────────────────────────
function geodesicPoints(from: [number, number], to: [number, number], steps = 48): [number, number][] {
  const R2D = 180 / Math.PI, D2R = Math.PI / 180;
  const lat1 = from[0] * D2R, lon1 = from[1] * D2R;
  const lat2 = to[0] * D2R, lon2 = to[1] * D2R;
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ));
  if (d < 0.001) return [from, to];
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([Math.atan2(z, Math.sqrt(x ** 2 + y ** 2)) * R2D, Math.atan2(y, x) * R2D]);
  }
  return pts;
}

// ── OSRM routing ─────────────────────────────────────────────────────────────
async function fetchOSRM(
  from: [number, number], to: [number, number],
  profile: "driving" | "walking" = "driving"
): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${from[1]},${from[0]};${to[1]},${to[0]}?geometries=geojson&overview=full`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
  } catch { return null; }
}

// ── Sea routing: graph-based A* pathfinding ─────────────────────────────────
// Function removed, imported `calculateSeaRoute` instead.

// ── Get waypoints for a leg ───────────────────────────────────────────────────
async function getLegWaypoints(leg: JourneyLeg): Promise<[number, number][]> {
  if (!leg.from || !leg.to) return [];
  const from: [number, number] = [leg.from.lat, leg.from.lng];
  const to: [number, number] = [leg.to.lat, leg.to.lng];
  switch (leg.mode) {
    case "air":
      return geodesicPoints(from, to, 48);
    case "road": {
      const pts = await fetchOSRM(from, to, "driving");
      return pts ?? [from, to];
    }
    case "rail": {
      // Try OSRM first; fall back to geodesic arc (looks far better than a straight line)
      const pts = await fetchOSRM(from, to, "driving");
      return pts ?? geodesicPoints(from, to, 32);
    }
    case "sea":
      return calculateSeaRoute(from, to);
    default:
      return [from, to];
  }
}

// ── Mode visual config ────────────────────────────────────────────────────────
const MODE_STYLE: Record<JourneyMode, { weight: number; dashArray?: string; opacity: number }> = {
  sea: { weight: 2.5, opacity: 0.85, dashArray: undefined },
  rail: { weight: 2, opacity: 0.85, dashArray: "8, 4" },
  road: { weight: 2.5, opacity: 0.9, dashArray: undefined },
  air: { weight: 1.5, opacity: 0.75, dashArray: "3, 7" },
};

const MODE_LABELS: Record<JourneyMode, string> = {
  sea: "⚓ SEA", rail: "🚂 RAIL", road: "🚛 ROAD", air: "✈ AIR",
};

// ── Hub icon ─────────────────────────────────────────────────────────────────
function makeHubIcon(color: string, pulse = false) {
  return L.divIcon({
    html: `<div style="width:10px;height:10px;background:${color};border-radius:50%;
      box-shadow:0 0 10px ${color};${pulse ? `animation:fzPulse 2s ease-in-out infinite` : ""}">
    </div>`,
    className: "", iconSize: [10, 10], iconAnchor: [5, 5],
  });
}

function makeLabelIcon(text: string, color: string) {
  return L.divIcon({
    html: `<div style="background:rgba(0,0,0,0.88);border:1px solid ${color}44;
      color:${color};font-size:8px;font-family:monospace;letter-spacing:0.5px;
      padding:2px 6px;border-radius:3px;white-space:nowrap;pointer-events:none;
      transform:translate(8px,-12px);">${text}</div>`,
    className: "", iconSize: [0, 0], iconAnchor: [0, 0],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
const Map = forwardRef<MapHandle, MapProps>(({ journeys, onLegClick, analyses = [] }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const journeyLayerGroup = useRef<L.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapInstance.current?.zoomIn(),
    zoomOut: () => mapInstance.current?.zoomOut(),
    resetView: () => mapInstance.current?.setView([25, 45], 2),
    focusJourney: (journey: Journey) => {
      const pts: L.LatLng[] = [];
      journey.legs.forEach(l => {
        if (l.from) pts.push(L.latLng(l.from.lat, l.from.lng));
        if (l.to) pts.push(L.latLng(l.to.lat, l.to.lng));
      });
      if (pts.length > 0) {
        mapInstance.current?.flyToBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 8, duration: 1.5 });
      }
    },
  }));

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    if (!document.getElementById("fz-map-css")) {
      const s = document.createElement("style");
      s.id = "fz-map-css";
      s.textContent = `
        .leaflet-container { background:#050508 !important; }
        @keyframes fzPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.7)} }
        @keyframes fzDash { to { stroke-dashoffset: -30; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fz-leg { cursor: pointer; }
        .fz-disrupted path { animation: fzDash 1s linear infinite !important; }
        .fz-rerouted path { filter: drop-shadow(0 0 4px currentColor); }
      `;
      document.head.appendChild(s);
    }
    const map = L.map(mapRef.current, {
      center: [25, 45], zoom: 3, minZoom: 1, maxZoom: 18,
      zoomControl: false, attributionControl: false,
    });
    mapInstance.current = map;
    journeyLayerGroup.current = L.layerGroup().addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 18 }).addTo(map);
    setReady(true);
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Re-render journeys when they change OR when analyses update
  useEffect(() => {
    if (!journeyLayerGroup.current) return;
    journeyLayerGroup.current.clearLayers();
    if (journeys.length === 0) return;

    journeys.forEach(journey => {
      journey.legs.forEach((leg, legIdx) => {
        if (!leg.from || !leg.to) return;

        const legAnalysis = analyses.find(a => a.legId === leg.id);
        const isLoading = legAnalysis?.loading ?? false;
        const result = legAnalysis?.result;
        const affected = result?.affected && !isLoading;
        const severity = result?.severity ?? "none";
        const rerouted = result?.rerouted ?? false;

        // Pick display colour
        const baseColor = leg.color ?? "#60a5fa";
        const lineColor = affected ? (SEV_COLOR[severity] ?? baseColor) : baseColor;
        const style = MODE_STYLE[leg.mode];
        const dashArray = affected ? (SEV_DASH[severity] ?? style.dashArray) : style.dashArray;
        const lineWeight = affected ? style.weight + 1 : style.weight;
        const lineOpacity = affected ? 0.95 : style.opacity;
        const className = affected ? "fz-leg fz-disrupted" : "fz-leg";

        // Initial placeholder line
        const placeholder = L.polyline(
          [[leg.from.lat, leg.from.lng], [leg.to.lat, leg.to.lng]],
          { color: lineColor, weight: lineWeight, opacity: 0.3, dashArray, className }
        );
        journeyLayerGroup.current!.addLayer(placeholder);

        // Hub markers — pulse red if disrupted
        const fromM = L.marker([leg.from.lat, leg.from.lng], { icon: makeHubIcon(lineColor, legIdx === 0 || affected) });
        const toM = L.marker([leg.to.lat, leg.to.lng], { icon: makeHubIcon(lineColor, affected) });
        const fromL = L.marker([leg.from.lat, leg.from.lng], { icon: makeLabelIcon(leg.from.name, lineColor) });
        const toL = L.marker([leg.to.lat, leg.to.lng], { icon: makeLabelIcon(leg.to.name, lineColor) });
        journeyLayerGroup.current!.addLayer(fromM);
        journeyLayerGroup.current!.addLayer(toM);
        journeyLayerGroup.current!.addLayer(fromL);
        journeyLayerGroup.current!.addLayer(toL);

        // Mode label at midpoint
        const midLat = (leg.from.lat + leg.to.lat) / 2;
        const midLng = (leg.from.lng + leg.to.lng) / 2;
        const midLabel = L.marker([midLat, midLng], {
          icon: L.divIcon({
            html: `<div style="background:rgba(0,0,0,0.88);border:1px solid ${lineColor}55;
              color:${lineColor};font-size:7px;font-family:monospace;letter-spacing:1.5px;
              padding:2px 7px;border-radius:10px;white-space:nowrap;pointer-events:none;">
              ${MODE_LABELS[leg.mode]}</div>`,
            className: "", iconSize: [0, 0], iconAnchor: [0, 0],
          }),
        });
        journeyLayerGroup.current!.addLayer(midLabel);

        // Disruption badge — slightly offset from midpoint
        if (affected) {
          const badgeLat = midLat + 1.5;
          const badgeLng = midLng + 1.5;
          const badge = L.marker([badgeLat, badgeLng], {
            icon: makeDisruptionIcon(severity, rerouted),
            zIndexOffset: 1000,
          });
          journeyLayerGroup.current!.addLayer(badge);
        }

        // Async: fetch real routing geometry and optionally rerouted path
        getLegWaypoints(leg).then(async pts => {
          if (!journeyLayerGroup.current) return;
          journeyLayerGroup.current.removeLayer(placeholder);

          const altMode = result?.alternativeMode;

          if (rerouted && altMode) {
            // 1. Grey ghost — original disrupted route
            const ghost = L.polyline(pts, {
              color: "#6b7280",
              weight: 2,
              opacity: 0.35,
              dashArray: "6, 6",
              className: "fz-leg",
            });
            journeyLayerGroup.current!.addLayer(ghost);

            // 2. Rich rerouted path via corridor waypoints
            const from: [number, number] = [leg.from!.lat, leg.from!.lng];
            const to: [number, number] = [leg.to!.lat, leg.to!.lng];
            const reroutePts = await getReroutedWaypoints(altMode, from, to);
            if (!journeyLayerGroup.current) return;

            const altColor = altMode === "air" ? "#a78bfa"
              : altMode === "sea" ? "#2dd4bf"
                : altMode === "rail" ? "#fbbf24"
                  : "#34d399"; // road

            const altStyle = MODE_STYLE[altMode as keyof typeof MODE_STYLE] ?? { weight: 2.5, opacity: 0.9 };

            // Outer glow line
            const glowPoly = L.polyline(reroutePts, {
              color: altColor, weight: altStyle.weight + 4,
              opacity: 0.15, dashArray: undefined, className: "fz-leg",
            });
            journeyLayerGroup.current!.addLayer(glowPoly);

            // Main rerouted line
            const reroutePoly = L.polyline(reroutePts, {
              color: altColor, weight: altStyle.weight + 1,
              opacity: 0.92,
              dashArray: altStyle.dashArray,
              className: "fz-leg fz-rerouted",
            });
            reroutePoly.on("mouseover", () => reroutePoly.setStyle({ opacity: 1, weight: altStyle.weight + 3 }));
            reroutePoly.on("mouseout", () => reroutePoly.setStyle({ opacity: 0.92, weight: altStyle.weight + 1 }));
            reroutePoly.on("click", e => {
              L.DomEvent.stopPropagation(e);
              onLegClick?.(journey, leg);
              mapInstance.current?.flyToBounds(reroutePoly.getBounds(), { padding: [80, 80], maxZoom: 8, duration: 1.2 });
            });
            journeyLayerGroup.current!.addLayer(reroutePoly);

            // Node dots along the rerouted path (every ~4th point)
            const step = Math.max(1, Math.floor(reroutePts.length / 12));
            reroutePts.forEach((pt, i) => {
              if (i === 0 || i === reroutePts.length - 1 || i % step !== 0) return;
              const dot = L.circleMarker(pt as L.LatLngExpression, {
                radius: 2.5, color: altColor, fillColor: altColor,
                fillOpacity: 0.9, weight: 1, opacity: 0.7,
              });
              journeyLayerGroup.current?.addLayer(dot);
            });

            // "REROUTED →" mode label at midpoint of new route
            const midPt = reroutePts[Math.floor(reroutePts.length / 2)];
            if (midPt) {
              const rerouteLabel = L.marker(midPt as L.LatLngExpression, {
                icon: L.divIcon({
                  html: `<div style="background:rgba(0,0,0,0.92);border:1px solid ${altColor}88;
                    color:${altColor};font-size:7px;font-family:monospace;letter-spacing:1px;
                    padding:2px 8px;border-radius:10px;white-space:nowrap;pointer-events:none;
                    box-shadow:0 0 8px ${altColor}55;">
                    REROUTED: ${altMode.toUpperCase()}
                  </div>`,
                  className: "", iconSize: [0, 0], iconAnchor: [0, 0],
                }),
                zIndexOffset: 900,
              });
              journeyLayerGroup.current!.addLayer(rerouteLabel);
            }

          } else {
            // Normal (non-rerouted) route line
            const poly = L.polyline(pts, {
              color: lineColor, weight: lineWeight,
              opacity: lineOpacity, dashArray, className,
            });
            poly.on("mouseover", () => poly.setStyle({ opacity: 1, weight: lineWeight + 1.5 }));
            poly.on("mouseout", () => poly.setStyle({ opacity: lineOpacity, weight: lineWeight }));
            poly.on("click", e => {
              L.DomEvent.stopPropagation(e);
              onLegClick?.(journey, leg);
              if (pts.length > 1)
                mapInstance.current?.flyToBounds(poly.getBounds(), { padding: [80, 80], maxZoom: 10, duration: 1.2 });
            });
            journeyLayerGroup.current!.addLayer(poly);
          }
        });
      });
    });
  }, [journeys, onLegClick, analyses]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* Empty state */}
      {ready && journeys.length === 0 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", pointerEvents: "none",
          zIndex: 10,
        }}>
          <div style={{
            textAlign: "center", padding: "32px", background: "rgba(5,5,20,0.75)",
            borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(16px)"
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>MAP</div>

            <div style={{ marginBottom: 12, letterSpacing: 2, color: "#ffffff44", textTransform: "uppercase", fontSize: 9 }}>
              Transport Modes
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 20 }}>
              {(Object.entries(MODE_LABELS) as [JourneyMode, string][]).map(([mode, label]) => {
                const style = MODE_STYLE[mode];
                return (
                  <div key={mode} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 24, height: 2,
                      background: mode === 'sea' ? '#60a5fa' : mode === 'rail' ? '#fbbf24' : mode === 'road' ? '#34d399' : '#a78bfa',
                      borderTop: style.dashArray ? `2px dashed rgba(255,255,255,0.5)` : 'none',
                      opacity: 0.8
                    }} />
                    <span style={{ color: "#ffffffaa", fontSize: 10, fontFamily: "monospace" }}>{label}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#ffffff55", letterSpacing: 2, textTransform: "uppercase" }}>
              No routes plotted
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#ffffff22", marginTop: 8 }}>
              Click "New Journey" to begin
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {ready && journeys.length > 0 && (
        <div style={{
          position: "absolute", bottom: 16, right: 16,
          background: "rgba(5,5,8,0.92)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8, padding: "10px 14px", fontFamily: "monospace",
          fontSize: 9, color: "#fff", backdropFilter: "blur(12px)",
          zIndex: 1000, pointerEvents: "none", minWidth: 170,
        }}>
          <div style={{ marginBottom: 8, letterSpacing: 2, color: "#ffffff44", textTransform: "uppercase", fontSize: 8 }}>
            Active Journeys ({journeys.length})
          </div>
          {journeys.map(j => (
            <div key={j.id} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: "#ffffffbb", marginBottom: 3 }}>{j.name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {j.legs.map((leg, i) => (
                  <span key={leg.id} style={{
                    fontSize: 7, padding: "1px 5px", borderRadius: 3,
                    background: `${leg.color ?? "#60a5fa"}22`,
                    border: `1px solid ${leg.color ?? "#60a5fa"}44`,
                    color: leg.color ?? "#60a5fa", letterSpacing: 0.5,
                  }}>
                    {MODE_LABELS[leg.mode]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

Map.displayName = "Map";
export default Map;
