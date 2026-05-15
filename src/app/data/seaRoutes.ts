export const SEA_NODES: Record<string, [number, number]> = {
  // Europe
  "rotterdam_approach": [52.5, 3.5],
  "english_channel": [50.0, -2.0],
  "biscay": [45.0, -7.0],
  "gibraltar": [35.9, -5.5],
  "med_west": [38.0, 5.0],
  "med_central": [36.0, 15.0],
  "med_east": [33.0, 25.0],
  "suez_north": [31.2, 32.3],
  "suez_south": [29.9, 32.5],

  // Middle East / Indian Ocean
  "red_sea": [21.0, 38.0],
  "bab_el_mandeb": [12.5, 43.3],
  "gulf_of_aden": [12.0, 48.0],
  "arabian_sea": [15.0, 65.0],
  "india_west": [15.0, 70.0],
  "sri_lanka_south": [5.0, 80.0],
  "bay_of_bengal": [15.0, 90.0],

  // Asia / Pacific
  "malacca_north": [5.8, 97.0],
  "singapore": [1.2, 104.0],
  "south_china_sea": [12.0, 114.0],
  "taiwan_strait": [24.0, 119.0],
  "east_china_sea": [28.0, 125.0],
  "japan_coast": [35.0, 140.0],
  "pacific_north": [45.0, 170.0],
  "pacific_mid": [20.0, -160.0],
  "pacific_equator": [0.0, -140.0],
  
  // Americas
  "us_west_coast": [35.0, -125.0],
  "panama_pacific": [8.9, -79.5],
  "panama_atlantic": [9.3, -79.9],
  "caribbean": [15.0, -75.0],
  "gulf_of_mexico": [25.0, -90.0],
  "florida_strait": [24.0, -80.0],
  "us_east_coast": [35.0, -70.0],
  
  // Atlantic / Africa
  "atlantic_north": [40.0, -40.0],
  "atlantic_mid": [20.0, -40.0],
  "atlantic_south": [0.0, -25.0],
  "brazil_coast": [-20.0, -35.0],
  "argentina_coast": [-40.0, -55.0],
  "cape_horn": [-57.0, -67.0],
  "cape_of_good_hope": [-35.0, 20.0],
  "mozambique_channel": [-20.0, 40.0],
  "madagascar_east": [-20.0, 55.0],
  "indian_ocean_mid": [-10.0, 70.0],

  // Australia
  "australia_west": [-25.0, 110.0],
  "australia_south": [-40.0, 130.0],
  "australia_east": [-25.0, 155.0],
  "indonesia_south": [-10.0, 115.0]
};

export const SEA_EDGES: [string, string][] = [
  // Europe to Med
  ["rotterdam_approach", "english_channel"],
  ["english_channel", "biscay"],
  ["biscay", "gibraltar"],
  ["gibraltar", "med_west"],
  ["med_west", "med_central"],
  ["med_central", "med_east"],
  ["med_east", "suez_north"],
  ["suez_north", "suez_south"],

  // Middle East / India
  ["suez_south", "red_sea"],
  ["red_sea", "bab_el_mandeb"],
  ["bab_el_mandeb", "gulf_of_aden"],
  ["gulf_of_aden", "arabian_sea"],
  ["arabian_sea", "india_west"],
  ["arabian_sea", "sri_lanka_south"],
  ["india_west", "sri_lanka_south"],
  ["sri_lanka_south", "bay_of_bengal"],
  ["sri_lanka_south", "malacca_north"],
  ["bay_of_bengal", "malacca_north"],

  // Asia
  ["malacca_north", "singapore"],
  ["singapore", "south_china_sea"],
  ["south_china_sea", "taiwan_strait"],
  ["taiwan_strait", "east_china_sea"],
  ["east_china_sea", "japan_coast"],

  // Pacific
  ["japan_coast", "pacific_north"],
  ["pacific_north", "us_west_coast"],
  ["japan_coast", "pacific_mid"],
  ["pacific_mid", "us_west_coast"],
  ["pacific_mid", "panama_pacific"],
  ["us_west_coast", "panama_pacific"],
  ["pacific_equator", "panama_pacific"],

  // Americas
  ["panama_pacific", "panama_atlantic"],
  ["panama_atlantic", "caribbean"],
  ["caribbean", "florida_strait"],
  ["caribbean", "gulf_of_mexico"],
  ["florida_strait", "us_east_coast"],
  ["us_east_coast", "atlantic_north"],
  ["gulf_of_mexico", "florida_strait"],

  // Atlantic
  ["english_channel", "atlantic_north"],
  ["biscay", "atlantic_north"],
  ["gibraltar", "atlantic_mid"],
  ["atlantic_north", "atlantic_mid"],
  ["atlantic_mid", "atlantic_south"],
  ["atlantic_south", "brazil_coast"],
  ["brazil_coast", "argentina_coast"],
  ["argentina_coast", "cape_horn"],

  // Africa / Indian Ocean
  ["atlantic_south", "cape_of_good_hope"],
  ["cape_of_good_hope", "madagascar_east"],
  ["cape_of_good_hope", "mozambique_channel"],
  ["mozambique_channel", "arabian_sea"],
  ["madagascar_east", "sri_lanka_south"],
  ["madagascar_east", "indian_ocean_mid"],
  ["sri_lanka_south", "indian_ocean_mid"],

  // Australia
  ["indian_ocean_mid", "australia_west"],
  ["australia_west", "australia_south"],
  ["australia_south", "australia_east"],
  ["australia_east", "pacific_equator"],
  ["singapore", "indonesia_south"],
  ["indonesia_south", "australia_west"]
];

function getDistance(a: [number, number], b: [number, number]): number {
  const R = 6371; // km
  const toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR;
  const dLng = (b[1] - a[1]) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Map ports to their nearest sea node to enter the graph
function findNearestNode(pt: [number, number]): string {
  let minDist = Infinity;
  let best = "";
  for (const [id, coord] of Object.entries(SEA_NODES)) {
    const d = getDistance(pt, coord);
    if (d < minDist) {
      minDist = d;
      best = id;
    }
  }
  return best;
}

export function calculateSeaRoute(from: [number, number], to: [number, number]): [number, number][] {
  // If points are very close (< 800km), just draw a straight line
  if (getDistance(from, to) < 800) {
    return [from, to];
  }

  const startNode = findNearestNode(from);
  const endNode = findNearestNode(to);

  if (startNode === endNode) {
    return [from, SEA_NODES[startNode], to];
  }

  // A* pathfinding
  const graph: Record<string, string[]> = {};
  for (const id of Object.keys(SEA_NODES)) graph[id] = [];
  for (const [u, v] of SEA_EDGES) {
    graph[u].push(v);
    graph[v].push(u);
  }

  const openSet = new Set([startNode]);
  const cameFrom: Record<string, string> = {};
  
  const gScore: Record<string, number> = {};
  for (const id of Object.keys(SEA_NODES)) gScore[id] = Infinity;
  gScore[startNode] = 0;

  const fScore: Record<string, number> = {};
  for (const id of Object.keys(SEA_NODES)) fScore[id] = Infinity;
  fScore[startNode] = getDistance(SEA_NODES[startNode], SEA_NODES[endNode]);

  while (openSet.size > 0) {
    let current = "";
    let minF = Infinity;
    for (const id of Array.from(openSet)) {
      if (fScore[id] < minF) {
        minF = fScore[id];
        current = id;
      }
    }

    if (current === endNode) {
      // Reconstruct path
      const path = [current];
      while (cameFrom[current]) {
        current = cameFrom[current];
        path.unshift(current);
      }
      return [from, ...path.map(id => SEA_NODES[id]), to];
    }

    openSet.delete(current);

    for (const neighbor of graph[current]) {
      const tentativeG = gScore[current] + getDistance(SEA_NODES[current], SEA_NODES[neighbor]);
      if (tentativeG < gScore[neighbor]) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeG;
        fScore[neighbor] = tentativeG + getDistance(SEA_NODES[neighbor], SEA_NODES[endNode]);
        openSet.add(neighbor);
      }
    }
  }

  // Fallback to straight line if no path found
  return [from, to];
}
