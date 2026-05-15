export type Severity = "critical" | "high" | "medium";

export interface Disruption {
  id: string;
  title: string;
  location: string;
  severity: Severity;
  affectedRoutes: string[];
  rippleCost: string;
  timestamp: string;
  source: string;
  lat: number;
  lng: number;
  description: string;
}

export interface Shipment {
  id: string;
  origin: string;
  destination: string;
  cargo: string;
  status: "on-time" | "delayed" | "rerouted" | "critical";
  eta: string;
  carrier: string;
  lat: number;
  lng: number;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}

export interface RerouteOption {
  id: string;
  name: string;
  cost: string;
  costDelta: string;
  co2: string;
  co2Delta: string;
  time: string;
  timeDelta: string;
  risk: "low" | "medium" | "high";
  via: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export const disruptions: Disruption[] = [
  {
    id: "D-001",
    title: "Suez Canal Vessel Grounding",
    location: "Suez Canal, Egypt",
    severity: "critical",
    affectedRoutes: ["Asia-Europe", "Mundra-Hamburg", "Shanghai-Rotterdam"],
    rippleCost: "$4.2B/day",
    timestamp: "14m ago",
    source: "MarineTraffic + Reuters",
    lat: 30.5,
    lng: 32.3,
    description: "Large container vessel Ever Titan has run aground at Km 151, blocking northbound traffic. Port congestion at Suez expected 72h+.",
  },
  {
    id: "D-002",
    title: "Port Strike — Rotterdam",
    location: "Rotterdam, Netherlands",
    severity: "high",
    affectedRoutes: ["Trans-Atlantic", "Asia-Europe"],
    rippleCost: "$820M/day",
    timestamp: "1h ago",
    source: "FNV Union + NOS",
    lat: 51.9,
    lng: 4.4,
    description: "Dockworkers union FNV declared indefinite strike action. Terminal operations reduced to 20% capacity. 140 vessels affected.",
  },
  {
    id: "D-003",
    title: "Typhoon Khanun — South China Sea",
    location: "South China Sea",
    severity: "critical",
    affectedRoutes: ["Trans-Pacific", "Intra-Asia", "Shanghai-LA"],
    rippleCost: "$1.1B/day",
    timestamp: "32m ago",
    source: "JMA + NHK Weather",
    lat: 22.0,
    lng: 121.5,
    description: "Category 4 typhoon with 210 km/h gusts. Taiwan Strait and Philippine Sea closure expected for 5 days. 67 vessels diverted.",
  },
  {
    id: "D-004",
    title: "Rail Blockage — Trans-Siberian",
    location: "Novosibirsk, Russia",
    severity: "medium",
    affectedRoutes: ["China-Europe Rail", "Yiwu-Madrid"],
    rippleCost: "$240M/day",
    timestamp: "3h ago",
    source: "RZD Rail API",
    lat: 55.0,
    lng: 82.9,
    description: "Infrastructure maintenance and freight prioritization causing 48h delays on Trans-Siberian corridor. 32 trains held.",
  },
  {
    id: "D-005",
    title: "Mundra Port Congestion",
    location: "Mundra, India",
    severity: "high",
    affectedRoutes: ["Mundra-Hamburg", "India-Gulf"],
    rippleCost: "$380M/day",
    timestamp: "47m ago",
    source: "APSEZ + Lloyd's",
    lat: 22.8,
    lng: 69.7,
    description: "Berth utilization at 98%. Average vessel wait time 6.2 days. 22 container ships at anchor. Customs clearance delayed.",
  },
];

export const shipments: Shipment[] = [
  {
    id: "SHP-7741",
    origin: "Shanghai",
    destination: "Rotterdam",
    cargo: "Electronics — 847 TEU",
    status: "critical",
    eta: "Delayed +14 days",
    carrier: "COSCO",
    lat: 30.5,
    lng: 32.3,
    originLat: 31.2,
    originLng: 121.5,
    destLat: 51.9,
    destLng: 4.4,
  },
  {
    id: "SHP-7742",
    origin: "Mundra",
    destination: "Hamburg",
    cargo: "Textiles — 312 TEU",
    status: "delayed",
    eta: "Delayed +6 days",
    carrier: "Hapag-Lloyd",
    lat: 22.8,
    lng: 69.7,
    originLat: 22.8,
    originLng: 69.7,
    destLat: 53.5,
    destLng: 10.0,
  },
  {
    id: "SHP-7743",
    origin: "Los Angeles",
    destination: "Yokohama",
    cargo: "Machinery — 560 TEU",
    status: "on-time",
    eta: "On schedule",
    carrier: "ONE",
    lat: 35.0,
    lng: -160.0,
    originLat: 33.7,
    originLng: -118.2,
    destLat: 35.4,
    destLng: 139.6,
  },
  {
    id: "SHP-7744",
    origin: "Singapore",
    destination: "Felixstowe",
    cargo: "Auto Parts — 920 TEU",
    status: "rerouted",
    eta: "Rerouted +3 days",
    carrier: "MSC",
    lat: 1.3,
    lng: 80.0,
    originLat: 1.3,
    originLng: 103.8,
    destLat: 51.9,
    destLng: 1.3,
  },
  {
    id: "SHP-7745",
    origin: "Busan",
    destination: "Long Beach",
    cargo: "Consumer Goods — 1200 TEU",
    status: "on-time",
    eta: "On schedule",
    carrier: "HMM",
    lat: 30.0,
    lng: -140.0,
    originLat: 35.1,
    originLng: 129.0,
    destLat: 33.8,
    destLng: -118.2,
  },
];

export const rerouteOptions: RerouteOption[] = [
  {
    id: "R-001",
    name: "Cape of Good Hope",
    cost: "$2.1M",
    costDelta: "+$340K",
    co2: "847t",
    co2Delta: "+124t",
    time: "34 days",
    timeDelta: "+9 days",
    risk: "low",
    via: "Cape Town → West Africa",
    score: 87,
  },
  {
    id: "R-002",
    name: "Trans-Caspian Rail",
    cost: "$1.8M",
    costDelta: "+$40K",
    co2: "312t",
    co2Delta: "-411t",
    time: "26 days",
    timeDelta: "+1 day",
    risk: "medium",
    via: "Baku → Tbilisi → Poti",
    score: 74,
  },
  {
    id: "R-003",
    name: "Air Freight (Priority)",
    cost: "$8.4M",
    costDelta: "+$6.7M",
    co2: "2,100t",
    co2Delta: "+1,377t",
    time: "2 days",
    timeDelta: "-23 days",
    risk: "low",
    via: "Dubai Hub → Frankfurt",
    score: 42,
  },
];

export const chatHistory: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    content: "FlowZen AI online. I have full context on your 5 active shipments and 5 live disruption events. Ask me anything.",
    timestamp: "15:10",
  },
];

export const hubs = {
  SHANGHAI: { id: "SHA", name: "Shanghai", lat: 31.2, lng: 121.5 },
  ROTTERDAM: { id: "RTM", name: "Rotterdam", lat: 51.9, lng: 4.4 },
  SINGAPORE: { id: "SIN", name: "Singapore", lat: 1.3, lng: 103.8 },
  SUEZ: { id: "SUE", name: "Suez", lat: 30.5, lng: 32.3 },
  MUNDRA: { id: "MUN", name: "Mundra", lat: 22.8, lng: 69.7 },
  LOS_ANGELES: { id: "LAX", name: "Los Angeles", lat: 33.7, lng: -118.2 },
  YOKOHAMA: { id: "YOK", name: "Yokohama", lat: 35.4, lng: 139.6 },
  CAPE_TOWN: { id: "CPT", name: "Cape Town", lat: -33.9, lng: 18.4 },
  DELHI: { id: "DEL", name: "Delhi", lat: 28.6, lng: 77.2 },
  BENGALURU: { id: "BLR", name: "Bengaluru", lat: 13.0, lng: 77.6 },
  HAMBURG: { id: "HAM", name: "Hamburg", lat: 53.5, lng: 10.0 },
};

export const connections = [
  { from: "SHA", to: "SIN", distance: 4500 },
  { from: "SIN", to: "MUN", distance: 4000 },
  { from: "MUN", to: "SUE", distance: 3500 },
  { from: "SUE", to: "RTM", distance: 5000 },
  { from: "SIN", to: "CPT", distance: 9000 },
  { from: "CPT", to: "RTM", distance: 10000 },
  { from: "SHA", to: "YOK", distance: 2000 },
  { from: "YOK", to: "LAX", distance: 8000 },
  { from: "DEL", to: "BLR", distance: 2000 },
  { from: "DEL", to: "MUN", distance: 1000 },
  { from: "BLR", to: "SIN", distance: 3000 },
  { from: "RTM", to: "HAM", distance: 400 },
];

export const corridors = [
  {
    id: "corridor-1",
    name: "Suez Canal Closure",
    points: [
      [hubs.SHANGHAI.lat, hubs.SHANGHAI.lng],
      [hubs.SINGAPORE.lat, hubs.SINGAPORE.lng],
      [hubs.MUNDRA.lat, hubs.MUNDRA.lng],
      [hubs.SUEZ.lat, hubs.SUEZ.lng],
    ] as [number, number][],
    disrupted: true,
  },
  {
    id: "corridor-2",
    name: "Europe-Asia via Suez",
    points: [
      [hubs.ROTTERDAM.lat, hubs.ROTTERDAM.lng],
      [hubs.SUEZ.lat, hubs.SUEZ.lng],
      [hubs.MUNDRA.lat, hubs.MUNDRA.lng],
      [hubs.SINGAPORE.lat, hubs.SINGAPORE.lng],
      [hubs.SHANGHAI.lat, hubs.SHANGHAI.lng],
    ] as [number, number][],
    disrupted: true,
  },
  {
    id: "corridor-3",
    name: "Trans-Pacific",
    points: [
      [hubs.YOKOHAMA.lat, hubs.YOKOHAMA.lng],
      [30.0, -140.0],
      [hubs.LOS_ANGELES.lat, hubs.LOS_ANGELES.lng],
    ] as [number, number][],
    disrupted: false,
  },
  {
    id: "corridor-4",
    name: "Cape Reroute",
    points: [
      [hubs.SHANGHAI.lat, hubs.SHANGHAI.lng],
      [hubs.SINGAPORE.lat, hubs.SINGAPORE.lng],
      [hubs.CAPE_TOWN.lat, hubs.CAPE_TOWN.lng],
      [hubs.ROTTERDAM.lat, hubs.ROTTERDAM.lng],
    ] as [number, number][],
    disrupted: false,
    candidate: true,
  },
  {
    id: "corridor-5",
    name: "India Inland Route",
    points: [
      [hubs.DELHI.lat, hubs.DELHI.lng],
      [hubs.BENGALURU.lat, hubs.BENGALURU.lng],
    ] as [number, number][],
    disrupted: false,
  }
];

// Simple Dijkstra Implementation for Routing
export function findRoute(startId: string, endId: string) {
  const hubList = Object.values(hubs);
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const nodes = new Set(hubList.map(h => h.id));

  hubList.forEach(hub => {
    distances[hub.id] = Infinity;
    previous[hub.id] = null;
  });

  distances[startId] = 0;

  while (nodes.size > 0) {
    let closestNode: string | null = null;
    nodes.forEach(node => {
      if (closestNode === null || distances[node] < distances[closestNode]) {
        closestNode = node;
      }
    });

    if (closestNode === null || distances[closestNode] === Infinity) break;
    if (closestNode === endId) break;

    nodes.delete(closestNode);

    const neighbors = connections.filter(c => c.from === closestNode || c.to === closestNode);
    neighbors.forEach(connection => {
      const neighbor = connection.from === closestNode ? connection.to : connection.from;
      if (!nodes.has(neighbor)) return;

      const alt = distances[closestNode!] + connection.distance;
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = closestNode;
      }
    });
  }

  const path: string[] = [];
  let u: string | null = endId;
  while (u !== null) {
    path.unshift(u);
    u = previous[u];
  }

  return path.map(id => {
    const hub = Object.values(hubs).find(h => h.id === id);
    return hub ? [hub.lat, hub.lng] as [number, number] : null;
  }).filter(p => p !== null) as [number, number][];
}

