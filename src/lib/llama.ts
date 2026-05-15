import { createGroq } from '@ai-sdk/groq';
import Groq from 'groq-sdk';

// ── AI SDK provider (for streaming via Vercel AI SDK) ──
export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// ── Model identifier ──
export const LLAMA_MODEL = 'llama-3.1-70b-versatile';

// ── System prompt for NLP disruption extraction ──
export const DISRUPTION_NLP_PROMPT = `You are a logistics-disruption classifier.
Given a raw news snippet, return ONLY valid JSON matching this schema:

{
  "is_disruption": true,
  "event_type": "port_strike" | "weather" | "accident" | "congestion" | "closure" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "title": "Brief headline (max 80 chars)",
  "description": "One-sentence summary",
  "location": "City, Country or Port name",
  "affected_modes": ["sea","rail","road","air"],
  "estimated_delay_days": integer
}

If the text is NOT about a logistics disruption return:
{ "is_disruption": false, "reason": "Brief explanation" }

Return ONLY the JSON object — no markdown fences, no commentary.`;

// ── Direct Groq SDK client (for non-streaming calls) ──
const groqClient = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

export interface LlamaResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Send a prompt to LLaMA 3.1 70B via Groq and get a completion
 */
export async function queryLlama(
  prompt: string,
  systemPrompt?: string
): Promise<LlamaResponse> {
  if (!groqClient) {
    console.warn('GROQ_API_KEY is not configured');
    return {
      content: 'Groq API key is not configured. Please add GROQ_API_KEY to your .env file.',
    };
  }

  try {
    const completion = await groqClient.chat.completions.create({
      model: LLAMA_MODEL,
      messages: [
        ...(systemPrompt
          ? [{ role: 'system' as const, content: systemPrompt }]
          : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      usage: completion.usage
        ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error: any) {
    console.error('Groq/LLaMA error:', error.message || error);
    throw error;
  }
}

/**
 * Analyze a logistics disruption using LLaMA
 */
export async function analyzeDisruption(disruptionText: string): Promise<string> {
  const response = await queryLlama(disruptionText, DISRUPTION_NLP_PROMPT);
  return response.content;
}
