// src/app/api/nlp-llama/route.ts
// Uses LLaMA to classify raw news text into structured disruption objects

import { groqClient, LLAMA_MODEL, DISRUPTION_NLP_PROMPT } from '@/lib/llama';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();

    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    if (!groqClient) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 });
    }

    const completion = await groqClient.chat.completions.create({
      model: LLAMA_MODEL,
      temperature: 0.1,
      max_tokens: 512,
      messages: [
        { role: 'system', content: DISRUPTION_NLP_PROMPT },
        { role: 'user',   content: `Classify this news item:\n\n${rawText}` },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? '';

    // Strip any accidental markdown fences
    const cleaned = text.replace(/```json|```/g, '').trim();

    let disruption;
    try {
      disruption = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'LLaMA returned non-JSON', raw: text },
        { status: 422 }
      );
    }

    return NextResponse.json({ disruption });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/nlp-llama] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}