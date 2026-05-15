// src/app/api/nlp-llama/route.ts
// Uses LLaMA to classify raw news text into structured disruption objects
// Drop-in replacement for the Claude NLP in /api/ingest/route.ts

import { generateText } from 'ai';
import { groq, LLAMA_MODEL, DISRUPTION_NLP_PROMPT } from '@/lib/llama';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { rawText } = await req.json();

        if (!rawText || typeof rawText !== 'string') {
            return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
        }

        const { text } = await generateText({
            model: groq(LLAMA_MODEL),
            system: DISRUPTION_NLP_PROMPT,
            prompt: `Classify this news item:\n\n${rawText}`,
            temperature: 0.1,   // Very low — we want deterministic JSON
            maxOutputTokens: 512,
        });

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