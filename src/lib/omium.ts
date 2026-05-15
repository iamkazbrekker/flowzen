/**
 * src/lib/omium.ts
 * Omium REST API wrapper for FlowZen multi-agent tracing.
 *
 * No native TS SDK exists — we call the REST API directly.
 * Docs: https://docs.omium.ai
 */

const API_BASE  = process.env.OMIUM_API_URL || "https://api.omium.ai";
const API_KEY   = process.env.OMIUM_API_KEY || "";

const ENABLED = !!API_KEY;

type SpanStatus = "running" | "success" | "failed";

async function post(path: string, body: unknown): Promise<Record<string, unknown> | null> {
  if (!ENABLED) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[omium] POST ${path} → ${res.status}`);
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    // Never crash the agent because tracing failed
    console.warn("[omium] Tracing error (non-fatal):", (err as Error).message);
    return null;
  }
}

async function patch(path: string, body: unknown): Promise<void> {
  if (!ENABLED) return;
  try {
    await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* non-fatal */ }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Start a root workflow trace. Returns traceId. */
export async function startWorkflowTrace(
  name: string,
  input: Record<string, unknown>
): Promise<string | null> {
  const workflowId = process.env.OMIUM_WORKFLOW_ID || "00000000-0000-0000-0000-000000000000";
  const res = await post(`/api/v1/executions`, {
    name,
    input,
    workflow_id: workflowId,
    agent_id: "flowzen-orchestrator",
    metadata: {
      service: "flowzen",
    },
  });
  // Return traceId combined with tenantId so we can construct the correct dashboard URL
  return res?.id ? `${res.id}|${res.tenant_id}` : `trace_${Date.now()}`;
}

// Span endpoints are deprecated/blocked in Omium's REST API.
// We keep these functions to avoid breaking the application, but they do not make HTTP requests.
export async function startSpan(
  traceId: string,
  parentSpanId: string | null,
  name: string,
  input: Record<string, unknown>
): Promise<string | null> {
  return `span_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

export async function endSpan(
  traceId: string,
  spanId: string,
  output: Record<string, unknown>,
  status: "success" | "failed" = "success"
): Promise<void> {
  // no-op
}

/** Mark the root trace as complete. */
export async function endTrace(
  traceId: string,
  output: Record<string, unknown>,
  status: SpanStatus = "success"
): Promise<void> {
  // Omium automatically closes the execution or we can try a PATCH if supported.
  // For safety, we avoid the PATCH /api/v1/executions/:id call to avoid 405 Method Not Allowed.
}

/** Returns the Omium dashboard URL for a trace. */
export function getTraceUrl(traceId: string): string {
  if (traceId.includes("|")) {
    const [id, tenantId] = traceId.split("|");
    // Omium dashboard uses /w/:tenantId/executions/:id
    return `https://app.omium.ai/w/${tenantId}/executions/${id}`;
  }
  return `https://app.omium.ai/executions/${traceId}`;
}

/** Whether Omium tracing is configured. */
export function isTracingEnabled(): boolean {
  return ENABLED;
}
