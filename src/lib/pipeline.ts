// Ported from FlowzenModel/pipeline.ts
// Orchestrates: ingest → NLP → deduplicate

import { ingestNews } from "./ingest";
import { DisruptionEvent, PipelineResult } from "./types";

/** Deduplicates by event_type + location cluster, keeping highest severity */
function deduplicateEvents(events: DisruptionEvent[]): DisruptionEvent[] {
  const uniqueEvents = new Map<string, DisruptionEvent>();

  const severityMap: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  console.log(`[Dedup] Received ${events.length} events to deduplicate`);

  for (const event of events) {
    // Events already passed Stage 1 relevance classification.
    // If the 70b model set is_disruption=false, force it to true and log a warning.
    if (!event.is_disruption) {
      console.warn(`[Dedup] ⚠ Event "${event.title}" had is_disruption=false despite passing relevance check — forcing to true`);
      event.is_disruption = true;
    }

    const locationKey = (event.location ?? "unknown").toLowerCase().trim();
    const typeKey = (event.event_type ?? "unknown").toLowerCase().trim();
    const clusterKey = `${typeKey}::${locationKey}`;

    if (uniqueEvents.has(clusterKey)) {
      const existing = uniqueEvents.get(clusterKey)!;
      console.log(`[Dedup] Merging duplicate cluster: "${clusterKey}"`);

      // Keep highest severity
      if ((severityMap[event.severity] ?? 0) > (severityMap[existing.severity] ?? 0)) {
        existing.severity = event.severity;
      }

      // Merge summaries without duplication
      if (event.summary && !existing.summary.includes(event.summary)) {
        existing.summary += ` | Additional report: ${event.summary}`;
      }

      // Merge trade routes
      for (const route of event.affected_trade_routes ?? []) {
        if (!existing.affected_trade_routes.includes(route)) {
          existing.affected_trade_routes.push(route);
        }
      }
    } else {
      uniqueEvents.set(clusterKey, { ...event });
    }
  }

  console.log(`[Dedup] Output: ${uniqueEvents.size} unique events`);
  return Array.from(uniqueEvents.values());
}

export async function runPipeline(): Promise<PipelineResult> {
  const { events: rawEvents, totalFetched } = await ingestNews();
  const deduplicated = deduplicateEvents(rawEvents);

  console.log(`[Pipeline] Successfully extracted ${deduplicated.length} disruptions in memory.`);

  return {
    events: deduplicated,
    total_fetched: totalFetched,
    relevant_count: rawEvents.length,
    deduplicated_count: deduplicated.length,
    timestamp: new Date().toISOString(),
  };
}
