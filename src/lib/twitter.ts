import { TwitterApi } from 'twitter-api-v2';

// Initialize Twitter client
let twitterClient: TwitterApi | null = null;

if (process.env.TWITTER_BEARER_TOKEN) {
  twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
} else if (process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET) {
  twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
  });
}

const readOnlyClient = twitterClient?.readOnly;

export interface TwitterPost {
  id: string;
  text: string;
  created_at: string;
  author_username?: string;
  author_name?: string;
  likes: number;
  retweets: number;
  replies: number;
  source: 'twitter';
  url: string;
  hashtags?: string[];
  mentions?: string[];
  location?: string;
}

/**
 * Fetch logistics-related tweets with disruption keywords
 */
export async function fetchLogisticsNews(maxResults: number = 20): Promise<TwitterPost[]> {
  try {
    if (!readOnlyClient) {
      console.warn('Twitter API is not configured. Returning mock data.');
      return getMockTwitterData();
    }

    // Search query targeting logistics disruptions
    const query = `(
      (port OR shipping OR logistics OR "supply chain" OR freight OR cargo OR container OR vessel OR terminal OR warehouse)
      AND
      (disruption OR delay OR strike OR closure OR congestion OR blocked OR "shut down" OR accident OR fire OR weather OR typhoon OR hurricane OR earthquake)
    ) -is:retweet lang:en`;

    const tweets = await readOnlyClient.v2.search(query, {
      max_results: maxResults,
      'tweet.fields': ['created_at', 'public_metrics', 'geo', 'entities', 'author_id'],
      'user.fields': ['username', 'name'],
      expansions: ['author_id'],
    });

    // Map users for quick lookup
    const users = new Map(
      tweets.includes?.users?.map(user => [user.id, user]) || []
    );

    return tweets.data.data?.map(tweet => {
      const author = users.get(tweet.author_id!);
      const hashtags = tweet.entities?.hashtags?.map(h => h.tag) || [];
      const mentions = tweet.entities?.mentions?.map(m => m.username) || [];

      return {
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at || new Date().toISOString(),
        author_username: author?.username,
        author_name: author?.name,
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        replies: tweet.public_metrics?.reply_count || 0,
        source: 'twitter' as const,
        url: `https://twitter.com/${author?.username}/status/${tweet.id}`,
        hashtags,
        mentions,
      };
    }) || [];
  } catch (error: any) {
    console.error('Twitter API Error:', error.message || error);
    console.warn('Falling back to mock data due to API error.');
    return getMockTwitterData();
  }
}

/**
 * Fetch tweets from specific logistics companies/ports
 */
export async function fetchFromLogisticsAccounts(): Promise<TwitterPost[]> {
  if (!readOnlyClient) {
    console.warn('Twitter API is not configured');
    return [];
  }

  const accounts = [
    'Maersk',
    'MSC_Cargo',
    'CMACGMGroup',
    'HapagLloydAG',
    'portofsavannah',
    'portofrotterdam',
    'PortofLA',
    'PortofLongBeach',
    'SingaporePort',
    'SuezCanal',
  ];

  try {
    const allTweets: TwitterPost[] = [];

    for (const account of accounts) {
      const userTimeline = await readOnlyClient.v2.userTimeline(
        await getUserId(account),
        {
          max_results: 5,
          'tweet.fields': ['created_at', 'public_metrics'],
        }
      );

      const tweets = userTimeline.data.data?.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at || new Date().toISOString(),
        author_username: account,
        author_name: account,
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        replies: tweet.public_metrics?.reply_count || 0,
        source: 'twitter' as const,
        url: `https://twitter.com/${account}/status/${tweet.id}`,
      })) || [];

      allTweets.push(...tweets);
    }

    return allTweets;
  } catch (error: any) {
    console.error('Error fetching from logistics accounts:', error.message || error);
    return [];
  }
}

/**
 * Helper to get user ID from username
 */
async function getUserId(username: string): Promise<string> {
  if (!readOnlyClient) throw new Error('Twitter API is not configured');
  const user = await readOnlyClient.v2.userByUsername(username);
  return user.data.id;
}

// Helper to provide mock data for testing when .env is empty
function getMockTwitterData(): TwitterPost[] {
  return [
    {
      id: 'mock_1',
      text: 'BREAKING: Major delays at the Port of Long Beach due to unexpected strike action. Vessels are piling up. #logistics #supplychain',
      created_at: new Date().toISOString(),
      author_username: 'logistics_news',
      author_name: 'Logistics News',
      likes: 1450,
      retweets: 500,
      replies: 120,
      source: 'twitter',
      url: 'https://twitter.com/logistics_news/status/mock_1',
      hashtags: ['logistics', 'supplychain'],
    },
    {
      id: 'mock_2',
      text: 'Suez Canal traffic flowing normally again after brief disruption this morning. Backlog clearing. #shipping',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      author_username: 'maritime_update',
      author_name: 'Maritime Update',
      likes: 320,
      retweets: 45,
      replies: 12,
      source: 'twitter',
      url: 'https://twitter.com/maritime_update/status/mock_2',
      hashtags: ['shipping'],
    }
  ];
}

/**
 * Stream real-time tweets (for continuous monitoring)
 */
export async function startTwitterStream(
  callback: (tweet: TwitterPost) => void
): Promise<void> {
  if (!readOnlyClient) {
    console.warn('Twitter API is not configured');
    return;
  }

  try {
    const rules = await readOnlyClient.v2.streamRules();
    
    // Delete existing rules
    if (rules.data?.length) {
      await readOnlyClient.v2.updateStreamRules({
        delete: { ids: rules.data.map(rule => rule.id) },
      });
    }

    // Add new rules
    await readOnlyClient.v2.updateStreamRules({
      add: [
        {
          value: '(port OR shipping OR logistics) (disruption OR delay OR strike) -is:retweet lang:en',
          tag: 'logistics-disruption',
        },
      ],
    });

    // Start streaming
    const stream = await readOnlyClient.v2.searchStream({
      'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
      expansions: ['author_id'],
    });

    stream.on('data', (tweet) => {
      callback({
        id: tweet.data.id,
        text: tweet.data.text,
        created_at: tweet.data.created_at || new Date().toISOString(),
        likes: tweet.data.public_metrics?.like_count || 0,
        retweets: tweet.data.public_metrics?.retweet_count || 0,
        replies: tweet.data.public_metrics?.reply_count || 0,
        source: 'twitter',
        url: `https://twitter.com/i/web/status/${tweet.data.id}`,
      });
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
    });
  } catch (error) {
    console.error('Error starting Twitter stream:', error);
  }
}