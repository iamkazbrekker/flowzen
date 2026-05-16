import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export async function POST(req: Request) {
  try {
    const { messages, shipments, disruption } = await req.json();

    const systemPrompt = `You are FlowZen's logistics co-pilot, powered by LLaMA 3.3 70B.
You help supply-chain managers respond to disruptions in real time.

CURRENT DISRUPTION:
${disruption ? JSON.stringify(disruption, null, 2) : "No active disruption reported."}

AFFECTED SHIPMENTS (up to 10):
${shipments?.length ? JSON.stringify(shipments, null, 2) : "No shipment data available."}

INSTRUCTIONS:
- Be concise (≤150 words unless asked for detail).
- Always reference specific shipment IDs when relevant.
- Suggest concrete reroute options with estimated cost/time trade-offs.
- Flag SLA risks and recommend mitigations.
- Use bullet points and structured formatting.
- If you don't have enough data, say so honestly.`;

    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...(messages ?? []).map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    // Stream the response as plain text chunks
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: unknown) {
    console.error("Planner API error:", error);

    if (!process.env.GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY is not configured in .env" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
