import { NextResponse } from 'next/server';
import { fetchLogisticsNews, fetchFromLogisticsAccounts } from '@/lib/twitter';

export interface SocialMediaPost {
  id: string;
  platform: 'twitter';
  text: string;
  created_at: string;
  author: string;
  engagement: number;
  url: string;
  media_url?: string;
  hashtags?: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
}

/**
 * GET /api/social-feed
 * Fetch social media posts from Twitter
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform'); // 'twitter', 'instagram', or 'all'
    const limit = parseInt(searchParams.get('limit') || '50');
    const disruptionOnly = searchParams.get('disruption') === 'true';

    let allPosts: SocialMediaPost[] = [];

    // Fetch from Twitter
    if (platform === 'twitter' || platform === 'all' || !platform) {
      console.log('Fetching from Twitter...');

      const [twitterSearch, twitterAccounts] = await Promise.all([
        fetchLogisticsNews(30).catch(() => []),
        fetchFromLogisticsAccounts().catch(() => []),
      ]);

      const twitterPosts: SocialMediaPost[] = [
        ...twitterSearch,
        ...twitterAccounts,
      ].map(post => ({
        id: post.id,
        platform: 'twitter' as const,
        text: post.text,
        created_at: post.created_at,
        author: post.author_username || 'Unknown',
        engagement: post.likes + post.retweets * 2 + post.replies,
        url: post.url,
        hashtags: post.hashtags,
      }));

      allPosts.push(...twitterPosts);
    }

    // Remove duplicates by ID
    const uniquePosts = Array.from(
      new Map(allPosts.map(post => [post.id, post])).values()
    );

    // Sort by engagement and recency
    const sortedPosts = uniquePosts
      .sort((a, b) => {
        const timeScore =
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        const engagementScore = b.engagement - a.engagement;
        return timeScore * 0.3 + engagementScore * 0.7;
      })
      .slice(0, limit);

    // Calculate severity scores (simple heuristic)
    const postsWithSeverity = sortedPosts.map(post => {
      const severity = calculateSeverity(post.text, post.engagement);
      return { ...post, severity };
    });

    return NextResponse.json({
      success: true,
      posts: postsWithSeverity,
      count: postsWithSeverity.length,
      platforms: {
        twitter: postsWithSeverity.filter(p => p.platform === 'twitter').length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching social media:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch social media posts',
        posts: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/social-feed/analyze
 * Analyze a specific social media post with Claude
 */
export async function POST(request: Request) {
  try {
    const { posts } = await request.json();

    if (!posts || !Array.isArray(posts)) {
      return NextResponse.json(
        { error: 'Invalid request: posts array required' },
        { status: 400 }
      );
    }

    // This will be connected to your existing /api/ingest route
    return NextResponse.json({
      success: true,
      message: 'Posts queued for analysis',
      count: posts.length,
    });
  } catch (error: any) {
    console.error('Error analyzing posts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze posts' },
      { status: 500 }
    );
  }
}

/**
 * Calculate severity based on keywords and engagement
 */
function calculateSeverity(
  text: string,
  engagement: number
): 'low' | 'medium' | 'high' | 'critical' {
  const lowerText = text.toLowerCase();

  // Critical keywords
  const criticalKeywords = [
    'shut down',
    'closed indefinitely',
    'major accident',
    'explosion',
    'fire',
    'complete closure',
    'emergency',
  ];

  // High severity keywords
  const highKeywords = [
    'strike',
    'blockage',
    'severe delay',
    'congestion crisis',
    'port closure',
    'typhoon',
    'hurricane',
  ];

  // Medium severity keywords
  const mediumKeywords = [
    'delay',
    'disruption',
    'congestion',
    'weather',
    'maintenance',
  ];

  // Check keywords
  if (criticalKeywords.some(k => lowerText.includes(k))) {
    return 'critical';
  }

  if (highKeywords.some(k => lowerText.includes(k))) {
    return engagement > 1000 ? 'critical' : 'high';
  }

  if (mediumKeywords.some(k => lowerText.includes(k))) {
    return engagement > 500 ? 'high' : 'medium';
  }

  return 'low';
}