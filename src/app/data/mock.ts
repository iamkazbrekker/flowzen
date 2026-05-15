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

export const corridors = [
  {
    id: "corridor-1",
    name: "Suez Canal Closure",
    points: [[31.2, 121.5], [22.3, 113.5], [12.0, 52.0], [30.5, 32.3]] as [number, number][],
    disrupted: true,
  },
  {
    id: "corridor-2",
    name: "Europe-Asia via Suez",
    points: [[51.9, 4.4], [38.0, 13.0], [30.5, 32.3], [22.3, 60.0], [1.3, 103.8], [31.2, 121.5]] as [number, number][],
    disrupted: true,
  },
  {
    id: "corridor-3",
    name: "Trans-Pacific",
    points: [[35.4, 139.6], [30.0, -140.0], [33.7, -118.2]] as [number, number][],
    disrupted: false,
  },
  {
    id: "corridor-4",
    name: "Cape Reroute",
    points: [[31.2, 121.5], [1.3, 103.8], [-20.0, 60.0], [-34.0, 18.5], [-20.0, -10.0], [51.9, 4.4]] as [number, number][],
    disrupted: false,
    candidate: true,
  },
];
