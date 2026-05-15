"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapProps {
  onRouteClick: () => void;
}

export default function Map({ onRouteClick }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const onRouteClickRef = useRef(onRouteClick);

  useEffect(() => {
    onRouteClickRef.current = onRouteClick;
  }, [onRouteClick]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [30, 20],
      zoom: 3,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: false,
      attributionControl: false,
    });
    
    mapInstanceRef.current = map;

    // Use CartoDB Dark Matter tile layer for the aesthetic
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 10,
    }).addTo(map);

    // Add routes
    const routes = [
      {
        id: "route-1",
        name: "Shanghai Hub → Rotterdam Port",
        coords: [[31.23, 121.47], [51.92, 4.48]] as [number, number][],
      },
      {
        id: "route-2",
        name: "Singapore → Los Angeles",
        coords: [[1.35, 103.81], [34.05, -118.24]] as [number, number][],
      }
    ];

    routes.forEach(route => {
      // Draw polyline
      const polyline = L.polyline(route.coords, {
        color: "#FFFFFF",
        weight: 2,
        opacity: 0.6,
        dashArray: "6, 6"
      }).addTo(map);

      // Add markers
      route.coords.forEach((coord, index) => {
        const title = index === 0 ? route.name.split(" → ")[0] : route.name.split(" → ")[1];
        const markerHtml = `
          <div style="position:relative;width:12px;height:12px;cursor:pointer;" class="group">
            <div style="width:12px;height:12px;background:#fff;border-radius:50%;box-shadow:0 0 12px #fff; animation: pulse 2s infinite;"></div>
            <div style="position:absolute; top:-30px; left:50%; transform:translateX(-50%); background:rgba(8,8,8,0.9); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 8px; font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:#fff; white-space:nowrap; opacity:0; transition:opacity 0.2s;" class="group-hover:opacity-100">
              ${title}
            </div>
          </div>
        `;
        const icon = L.divIcon({ html: markerHtml, className: "", iconSize: [12, 12], iconAnchor: [6, 6] });
        const marker = L.marker(coord, { icon }).addTo(map);
        
        marker.on("click", () => {
          map.flyToBounds(polyline.getBounds(), { padding: [100, 100], duration: 1.5 });
          onRouteClickRef.current();
        });
      });

      polyline.on("click", () => {
        map.flyToBounds(polyline.getBounds(), { padding: [100, 100], duration: 1.5 });
        onRouteClickRef.current();
      });
      
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return <div ref={mapRef} className="w-full h-full" />;
}
