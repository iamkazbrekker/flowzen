// Ported from FlowzenModel/ai/analyer.ts
// Two-stage NLP pipeline: relevance classification → structured extraction

import { groq } from "./groq";
import { RELEVANCE_CLASSIFICATION_PROMPT, DISRUPTION_EXTRACTION_PROMPT } from "./prompts";
import { ClassificationResult, DisruptionEvent } from "./types";

const MAX_RETRIES = 2;

async function executeGroqWithRetry<T>(
  model: string,
  systemPrompt: string,
  userText: string,
  temperature: number = 0.0
): Promise<T | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) throw new Error("Empty response from Groq");

      return JSON.parse(responseText) as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`NLP ERROR (Attempt ${attempt}/${MAX_RETRIES}):`, message);
      if (attempt === MAX_RETRIES) return null;
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
  return null;
}

/** Stage 1 — Fast 8b model: Is this article about a real logistics disruption? */
export async function classifyRelevance(
  text: string
): Promise<ClassificationResult | null> {
  return executeGroqWithRetry<ClassificationResult>(
    "llama-3.1-8b-instant",
    RELEVANCE_CLASSIFICATION_PROMPT,
    text,
    0.0
  );
}

/** Stage 2 — Powerful 70b model: Extract structured intelligence */
export async function extractDisruption(
  text: string
): Promise<DisruptionEvent | null> {
  return executeGroqWithRetry<DisruptionEvent>(
    "llama-3.3-70b-versatile",
    DISRUPTION_EXTRACTION_PROMPT,
    text,
    0.1
  );
}

/** Full two-stage pipeline for a single article */
export async function analyzeDisruption(
  text: string
): Promise<DisruptionEvent | null> {
  const classification = await classifyRelevance(text);
  if (!classification || !classification.is_relevant) return null;
  return extractDisruption(text);
}
