// Ported from FlowzenModel/pipeline.ts
// Orchestrates: ingest → NLP → deduplicate

import { ingestNews } from "./ingest";
import { DisruptionEvent, PipelineResult } from "./types";
import { supabase } from "./supabaseClient";

/** Deduplicates by event_type + location cluster, keeping highest severity */
function deduplicateEvents(events: DisruptionEvent[]): DisruptionEvent[] {
  const uniqueEvents = new Map<string, DisruptionEvent>();

  const severityMap: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  for (const event of events) {
    if (!event.is_disruption) continue;

    const locationKey = (event.location ?? "unknown").toLowerCase().trim();
    const typeKey = (event.event_type ?? "unknown").toLowerCase().trim();
    const clusterKey = `${typeKey}::${locationKey}`;

    if (uniqueEvents.has(clusterKey)) {
      const existing = uniqueEvents.get(clusterKey)!;

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

  return Array.from(uniqueEvents.values());
}

export async function runPipeline(): Promise<PipelineResult> {
  const { events: rawEvents, totalFetched } = await ingestNews();
  const deduplicated = deduplicateEvents(rawEvents);

  if (deduplicated.length > 0) {
    const { error } = await supabase.from('disruptions').insert(deduplicated);
    if (error) {
      console.error('Error inserting into Supabase:', error);
    } else {
      console.log(`Successfully stored ${deduplicated.length} disruptions in Supabase.`);
    }
  }

  return {
    events: deduplicated,
    total_fetched: totalFetched,
    relevant_count: rawEvents.length,
    deduplicated_count: deduplicated.length,
    timestamp: new Date().toISOString(),
  };
}
