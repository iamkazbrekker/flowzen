import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Cache parsed CSV data in module scope (survives hot-reload in dev)
let portsCache: LocationResult[] | null = null;
let airportsCache: LocationResult[] | null = null;

export interface LocationResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "port" | "airport";
  country?: string;
  iata?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function loadPorts(): LocationResult[] {
  if (portsCache) return portsCache;
  const filePath = path.join(process.cwd(), "public", "ports.csv");
  const text = fs.readFileSync(filePath, "utf-8");
  const lines = text.split("\n").filter(Boolean);
  const results: LocationResult[] = [];
  // Skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parseCSVLine(lines[i]);
      // Columns: 0=WorldPortIndex, 1=Region, 2=MainPortName, 3=AltName, 4=LOCODE, 5=CountryCode, ...
      // Last two cols: Latitude, Longitude
      const name = cols[2]?.replace(/"/g, "").trim();
      const country = cols[5]?.replace(/"/g, "").trim();
      const latStr = cols[cols.length - 2];
      const lngStr = cols[cols.length - 1];
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!name || isNaN(lat) || isNaN(lng)) continue;
      results.push({ id: `port-${i}`, name, lat, lng, type: "port", country });
    } catch { /* skip bad lines */ }
  }
  portsCache = results;
  return results;
}

function loadAirports(): LocationResult[] {
  if (airportsCache) return airportsCache;
  const filePath = path.join(process.cwd(), "public", "airports.csv");
  const text = fs.readFileSync(filePath, "utf-8");
  const lines = text.split("\n").filter(Boolean);
  const results: LocationResult[] = [];
  // Header: id,ident,type,name,latitude_deg,longitude_deg,...,iata_code,...
  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parseCSVLine(lines[i]);
      const type = cols[2]?.replace(/"/g, "").trim();
      // Only include large and medium airports for cleaner results
      if (type !== "large_airport" && type !== "medium_airport") continue;
      const name = cols[3]?.replace(/"/g, "").trim();
      const lat = parseFloat(cols[4]);
      const lng = parseFloat(cols[5]);
      const iata = cols[13]?.replace(/"/g, "").trim() || undefined;
      const country = cols[8]?.replace(/"/g, "").trim();
      if (!name || isNaN(lat) || isNaN(lng)) continue;
      results.push({ id: `airport-${i}`, name, lat, lng, type: "airport", country, iata });
    } catch { /* skip bad lines */ }
  }
  airportsCache = results;
  return results;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.toLowerCase().trim() ?? "";
  const modeParam = searchParams.get("mode") ?? "all"; // "port" | "airport" | "all"

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  let results: LocationResult[] = [];

  if (modeParam !== "airport") {
    const ports = loadPorts();
    const matched = ports
      .filter(p => p.name.toLowerCase().includes(q) || (p.country?.toLowerCase().includes(q)))
      .slice(0, 15);
    results.push(...matched);
  }

  if (modeParam !== "port") {
    const airports = loadAirports();
    const matched = airports
      .filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.iata?.toLowerCase() === q) ||
        (a.country?.toLowerCase().includes(q))
      )
      .slice(0, 15);
    results.push(...matched);
  }

  // Sort by relevance: exact starts-with first
  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts;
  });

  return NextResponse.json(results.slice(0, 20));
}
