"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  buildDisplayRoutes,
  compareStrategies,
  LANES,
  PORTS,
  MODE_PROFILES,
  type DisplayRoute,
  type RouteResult,
} from "../data/routing";

interface MapProps {
  onRouteClick: (route: DisplayRoute, result: RouteResult) => void;
}

function makePortIcon(modes: string[], disrupted = false) {
  const c = disrupted ? "#ff4444" : "#ffffff44";
  return L.divIcon({
    html: `<div style="width:7px;height:7px;background:${c};border:1px solid ${disrupted?"#ff4444":"#ffffff66"};border-radius:50%;"></div>`,
    className: "",
    iconSize: [7, 7],
    iconAnchor: [3, 3],
  });
}

function makeHubLabel(name: string, color: string) {
  return L.divIcon({
    html: `<div style="color:${color};font-family:monospace;font-size:8px;font-weight:700;
      white-space:nowrap;background:rgba(0,0,0,0.8);border:1px solid ${color}55;
      border-radius:3px;padding:1px 5px;transform:translate(8px,-10px);">${name}</div>`,
    className: "",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function Map({ onRouteClick }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const callbackRef = useRef(onRouteClick);
  const [ready, setReady] = useState(false);

  useEffect(() => { callbackRef.current = onRouteClick; }, [onRouteClick]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Inject styles once
    if (!document.getElementById("fz-map-css")) {
      const s = document.createElement("style");
      s.id = "fz-map-css";
      s.textContent = `
        .leaflet-container { background:#050508 !important; }
        @keyframes fzPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }
        .fz-route { cursor:pointer; }
      `;
      document.head.appendChild(s);
    }

    const map = L.map(mapRef.current, {
      center: [25, 60],
      zoom: 3,
      minZoom: 2,
      maxZoom: 14,
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 14,
    }).addTo(map);

    // ── Draw disrupted lane overlays ──
    LANES.filter(l => l.disrupted).forEach(lane => {
      const poly = L.polyline(lane.waypoints, {
        color: "#ff4444",
        weight: 4,
        opacity: 0.35,
        dashArray: "4, 8",
        className: "fz-route",
      }).addTo(map);

      const mid = lane.waypoints[Math.floor(lane.waypoints.length / 2)];
      L.marker(mid, {
        icon: L.divIcon({
          html: `<div style="background:rgba(255,68,68,0.12);border:1px solid #ff4444;
            color:#ff4444;font-size:8px;font-family:monospace;padding:2px 6px;
            border-radius:3px;white-space:nowrap;pointer-events:none;">
            ⚠ ${lane.disruption ?? "DISRUPTED"}</div>`,
          className: "",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      }).addTo(map);
    });

    // ── Draw computed display routes ──
    const displayRoutes = buildDisplayRoutes();

    displayRoutes.forEach(route => {
      if (route.waypoints.length < 2) return;

      const poly = L.polyline(route.waypoints, {
        color: route.color,
        weight: route.width,
        opacity: 0.75,
        dashArray: route.dashArray,
        className: "fz-route",
      }).addTo(map);

      // Start / end markers
      const fromPort = PORTS[route.from];
      const toPort   = PORTS[route.to];
      if (fromPort) {
        const mc = L.marker([fromPort.lat, fromPort.lng], {
          icon: L.divIcon({
            html: `<div style="width:9px;height:9px;background:${route.color};border-radius:50%;
              box-shadow:0 0 8px ${route.color};animation:fzPulse 2s ease-in-out infinite;"></div>`,
            className: "",
            iconSize: [9, 9],
            iconAnchor: [4, 4],
          }),
        }).addTo(map);
        L.marker([fromPort.lat, fromPort.lng], { icon: makeHubLabel(fromPort.name, route.color) }).addTo(map);
        mc.on("click", () => {
          map.flyToBounds(poly.getBounds(), { padding:[80,80], duration:1.2 });
          callbackRef.current(route, route.result);
        });
      }
      if (toPort && toPort.id !== fromPort?.id) {
        L.marker([toPort.lat, toPort.lng], {
          icon: L.divIcon({
            html: `<div style="width:9px;height:9px;background:${route.color};border-radius:50%;
              box-shadow:0 0 8px ${route.color};"></div>`,
            className: "",
            iconSize: [9, 9],
            iconAnchor: [4, 4],
          }),
        }).addTo(map);
        L.marker([toPort.lat, toPort.lng], { icon: makeHubLabel(toPort.name, route.color) }).addTo(map);
      }

      // Hover
      poly.on("mouseover", () => poly.setStyle({ opacity:1, weight: route.width + 1.5 }));
      poly.on("mouseout",  () => poly.setStyle({ opacity:0.75, weight: route.width }));

      // Click → zoom + open panel
      poly.on("click", () => {
        map.flyToBounds(poly.getBounds(), { padding:[80,80], duration:1.2 });
        callbackRef.current(route, route.result);
      });

      // Mode badge in the middle of each route
      if (route.waypoints.length > 1) {
        const mid = route.waypoints[Math.floor(route.waypoints.length / 2)];
        const profile = MODE_PROFILES[route.mode];
        L.marker(mid, {
          icon: L.divIcon({
            html: `<div style="background:rgba(0,0,0,0.8);border:1px solid ${route.color}55;
              color:${route.color};font-size:7px;font-family:monospace;letter-spacing:1px;
              padding:2px 6px;border-radius:10px;white-space:nowrap;pointer-events:none;">
              ${profile.label.toUpperCase()}</div>`,
            className: "",
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        }).addTo(map);
      }
    });

    // ── All port dots ──
    Object.values(PORTS).forEach(port => {
      if (port.type === "canal") return;
      L.marker([port.lat, port.lng], { icon: makePortIcon(port.modes) }).addTo(map);
    });

    setReady(true);

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  return (
    <div style={{ position:"relative", width:"100%", height:"100%" }}>
      <div ref={mapRef} style={{ width:"100%", height:"100%" }} />

      {ready && (
        <div style={{
          position:"absolute", bottom:16, right:16,
          background:"rgba(5,5,8,0.88)", border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:8, padding:"10px 14px", fontFamily:"monospace",
          fontSize:9, color:"#fff", backdropFilter:"blur(10px)",
          zIndex:1000, pointerEvents:"none", minWidth:170,
        }}>
          <div style={{ marginBottom:7, letterSpacing:2, color:"#ffffff44", textTransform:"uppercase" }}>
            Transport Modes
          </div>
          {(Object.entries(MODE_PROFILES) as [string, typeof MODE_PROFILES[keyof typeof MODE_PROFILES]][]).map(([mode, p]) => (
            <div key={mode} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4 }}>
              <div style={{ width:22, height:2,
                background: p.dashArray ? "transparent" : p.color,
                borderRadius:1, borderTop: p.dashArray ? `2px dashed ${p.color}` : undefined }} />
              <span style={{ color:"#ffffffaa" }}>{p.label}</span>
            </div>
          ))}
          <div style={{ borderTop:"1px solid #ffffff11", marginTop:6, paddingTop:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
              <div style={{ width:22, height:2, background:"#ff444466",
                borderTop:"2px dashed #ff4444" }} />
              <span style={{ color:"#ff4444aa" }}>Disrupted</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
