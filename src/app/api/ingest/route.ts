import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const DISRUPTION_EXTRACTION_PROMPT = `You are an AI assistant analyzing social media posts for logistics disruptions.

Extract the following information from the post and return ONLY valid JSON:

{
  "event_type": "port_strike" | "weather" | "accident" | "congestion" | "closure" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "title": "Brief headline (max 80 chars)",
  "description": "Clear summary of the disruption",
  "location": "City, Country or Port name",
  "lat": latitude (number, null if unknown),
  "lon": longitude (number, null if unknown),
  "affected_modes": ["sea", "rail", "road", "air"] (array),
  "affected_routes": ["Route 1", "Route 2"] (array, be specific),
  "estimated_delay_days": integer (best estimate, 0 if unknown),
  "ripple_cost_usd": float (estimated economic impact, 0 if unknown),
  "shipments_at_risk": integer (estimated number, 0 if unknown),
  "is_verified": boolean (true if from official source, false for social media)
}

If the post does NOT describe a logistics disruption, return:
{
  "is_disruption": false,
  "reason": "Brief explanation"
}

Post to analyze:`;

/**
 * POST /api/ingest
 * Main disruption ingestion endpoint - processes social media posts with Claude
 */
export async function POST(request: Request) {
  try {
    const { posts, source } = await request.json();

    if (!posts || !Array.isArray(posts)) {
      return NextResponse.json(
        { error: 'Invalid request: posts array required' },
        { status: 400 }
      );
    }

    console.log(`Processing ${posts.length} posts from ${source || 'unknown'}...`);

    const disruptions = [];
    const skipped = [];
    const errors = [];

    // Process each post with Claude
    for (const post of posts) {
      try {
        console.log(`Analyzing post ${post.id}...`);

        if (!anthropic) {
          throw new Error('Anthropic API key is not configured');
        }

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          temperature: 0.3,
          messages: [
            {
              role: 'user',
              content: `${DISRUPTION_EXTRACTION_PROMPT}

Platform: ${post.platform}
Author: ${post.author}
Posted: ${post.created_at}
Engagement: ${post.engagement}
Text: ${post.text}
Hashtags: ${post.hashtags?.join(', ') || 'none'}`,
            },
          ],
        });

        const contentBlock = response.content[0];
        if (contentBlock.type !== 'text') {
          continue;
        }

        const cleanedText = contentBlock.text.replace(/```json|```/g, '').trim();
        const extracted = JSON.parse(cleanedText);

        // Skip if not a disruption
        if (extracted.is_disruption === false) {
          skipped.push({
            post_id: post.id,
            reason: extracted.reason,
          });
          continue;
        }

        // Add source metadata
        const disruption = {
          ...extracted,
          source: post.platform,
          source_url: post.url,
          raw_text: post.text,
          detected_at: new Date().toISOString(),
          is_active: true,
        };

        disruptions.push(disruption);
      } catch (error: any) {
        console.error(`Error processing post ${post.id}:`, error);
        errors.push({
          post_id: post.id,
          error: error.message,
        });
      }
    }

    // Insert disruptions into Supabase
    let insertedCount = 0;
    if (disruptions.length > 0) {
      if (!supabase) {
        throw new Error('Supabase is not configured');
      }

      const { data, error } = await supabase
        .from('disruptions')
        .insert(disruptions)
        .select();

      if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json(
          { error: 'Failed to save disruptions', details: error.message },
          { status: 500 }
        );
      }

      insertedCount = data?.length || 0;
      console.log(`✅ Inserted ${insertedCount} disruptions into database`);
    }

    return NextResponse.json({
      success: true,
      processed: posts.length,
      disruptions_detected: disruptions.length,
      disruptions_saved: insertedCount,
      skipped: skipped.length,
      errors: errors.length,
      details: {
        disruptions,
        skipped: skipped.slice(0, 5), // First 5 skipped
        errors: errors.slice(0, 5), // First 5 errors
      },
    });
  } catch (error: any) {
    console.error('Ingestion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process posts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ingest/manual
 * Manually trigger a demo disruption (for testing)
 */
export async function PUT(request: Request) {
  try {
    const { disruption } = await request.json();

    if (!supabase) {
      throw new Error('Supabase is not configured');
    }

    const { data, error } = await supabase
      .from('disruptions')
      .insert([disruption])
      .select();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create disruption', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      disruption: data[0],
    });
  } catch (error: any) {
    console.error('Manual insert error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create disruption' },
      { status: 500 }
    );
  }
}