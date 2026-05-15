import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function POST(req: Request) {
  try {
    const { messages, shipments, disruption } = await req.json();

    const systemPrompt = `You are FlowZen's logistics co-pilot, powered by LLaMA 3.1 70B.
You help supply-chain managers respond to disruptions in real time.

CURRENT DISRUPTION:
${disruption ? JSON.stringify(disruption, null, 2) : 'No active disruption reported.'}

AFFECTED SHIPMENTS (up to 10):
${shipments?.length ? JSON.stringify(shipments, null, 2) : 'No shipment data available.'}

INSTRUCTIONS:
- Be concise (≤150 words unless asked for detail).
- Always reference specific shipment IDs when relevant.
- Suggest concrete reroute options with estimated cost/time trade-offs.
- Flag SLA risks and recommend mitigations.
- Use bullet points and structured formatting.
- If you don't have enough data, say so honestly.`;

    const result = streamText({
      model: groq('llama-3.1-70b-versatile'),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Planner API error:', error);

    // If Groq API key is missing, return a helpful mock response
    if (!process.env.GROQ_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'GROQ_API_KEY is not configured in .env',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
