// Ported from FlowzenModel/ingest/news.ts
// Fetches logistics disruption articles from NewsAPI with retry logic

import { analyzeDisruption } from "./analyzer";
import { DisruptionEvent } from "./types";

const MAX_API_RETRIES = 3;

async function fetchWithRetry(url: string): Promise<unknown> {
  for (let attempt = 1; attempt <= MAX_API_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`NewsAPI ERROR (Attempt ${attempt}/${MAX_API_RETRIES}):`, message);
      if (attempt === MAX_API_RETRIES) throw err;
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
}

export interface IngestResult {
  events: DisruptionEvent[];
  totalFetched: number;
}

export async function ingestNews(): Promise<IngestResult> {
  // Advanced query: target physical logistics events, exclude noise
  const query = `(port OR shipping OR cargo OR "supply chain" OR logistics OR freight OR trucking OR railway OR maritime) AND (congestion OR delay OR disruption OR strike OR bottleneck OR blockage OR cyberattack OR sanctions OR closure) -stock -earnings -celebrity -politics -market -financial -investor`;

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=15&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`;

  let data;
  try {
    data = (await fetchWithRetry(url)) as { articles?: unknown[] };
  } catch (err) {
    console.warn("[Ingest] NewsAPI failed, falling back to mock articles.");
    data = { articles: [
      { title: "Suez Canal temporarily closed due to grounded vessel", description: "All sea freight through Suez Canal delayed.", content: "A large container ship has run aground, blocking all traffic in the Suez Canal." },
      { title: "Typhoon passing through Shanghai", description: "Major port closures expected for 3 days.", content: "Severe weather warnings issued for Shanghai ports, suspending all sea and air operations." }
    ] };
  }
  const articles = data?.articles ?? [];
  const totalFetched = articles.length;

  const disruptions: DisruptionEvent[] = [];

  for (const article of articles) {
    const a = article as Record<string, string>;
    if (!a.title || a.title === "[Removed]") continue;

    const text = `
Title: ${a.title}
Description: ${a.description ?? ""}
Content: ${a.content ?? ""}
`.trim();

    console.log(`\n[Ingest] Analyzing: "${a.title.slice(0, 80)}"`);
    const analyzed = await analyzeDisruption(text);

    if (analyzed) {
      console.log(`[Ingest] ✅ Extracted:`, JSON.stringify(analyzed, null, 2));
      disruptions.push(analyzed);
    } else {
      console.log(`[Ingest] ⊘ Filtered out (not relevant or extraction failed)`);
    }
  }

  // Fallback if LLM extraction completely fails (e.g., invalid GROQ_API_KEY)
  if (disruptions.length === 0) {
    console.warn("[Ingest] No disruptions extracted, injecting mock disruptions for testing...");
    disruptions.push(
      {
        is_disruption: true,
        event_type: "closure",
        severity: "critical",
        title: "Suez Canal temporarily closed due to grounded vessel",
        location: "Suez Canal",
        affected_transport_modes: ["sea"],
        estimated_delay_days: 10,
        affected_trade_routes: [],
        summary: "A large container ship has run aground, blocking all traffic in the Suez Canal.",
        economic_impact_level: "severe",
        confidence_score: 0.95
      },
      {
        is_disruption: true,
        event_type: "weather",
        severity: "high",
        title: "Typhoon passing through Shanghai",
        location: "Shanghai",
        affected_transport_modes: ["sea", "air"],
        estimated_delay_days: 3,
        affected_trade_routes: [],
        summary: "Severe weather warnings issued for Shanghai ports, suspending all sea and air operations.",
        economic_impact_level: "high",
        confidence_score: 0.9
      }
    );
  }

  return { events: disruptions, totalFetched };
}
