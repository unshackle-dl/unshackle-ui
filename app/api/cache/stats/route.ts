import { NextRequest, NextResponse } from 'next/server';
import { getCacheStats, getDatabase } from '@/lib/database';
import { DatabaseStatsResult } from '@/lib/types';

export async function GET() {
  try {
    const stats = getCacheStats();

    // Get additional database info
    const db = getDatabase();
    const dbInfo = db
      .prepare(
        `
      SELECT 
        (SELECT COUNT(*) FROM api_cache) as total_api_cache_entries,
        (SELECT COUNT(*) FROM streaming_offers) as total_streaming_offers,
        (SELECT COUNT(*) FROM ratings_cache) as total_ratings,
        (SELECT COUNT(*) FROM title_metadata) as total_metadata,
        (SELECT COUNT(*) FROM search_history) as total_searches,
        (SELECT COUNT(*) FROM api_cache WHERE expires_at > unixepoch()) as active_api_cache,
        (SELECT COUNT(*) FROM streaming_offers WHERE expires_at > unixepoch()) as active_offers,
        (SELECT COUNT(*) FROM ratings_cache WHERE expires_at > unixepoch()) as active_ratings,
        (SELECT COUNT(*) FROM title_metadata WHERE expires_at > unixepoch()) as active_metadata
    `
      )
      .get() as DatabaseStatsResult;

    // Get recent search history
    const recentSearches = db
      .prepare(
        `
      SELECT query, country, results_count, created_at 
      FROM search_history 
      ORDER BY created_at DESC 
      LIMIT 10
    `
      )
      .all() as Array<{
      query: string;
      country: string;
      results_count: number;
      created_at: number;
    }>;

    // Calculate cache effectiveness
    const totalCacheEntries =
      dbInfo.active_api_cache +
      dbInfo.active_offers +
      dbInfo.active_ratings +
      dbInfo.active_metadata;

    const response = {
      summary: {
        total_entries: totalCacheEntries,
        total_all_time:
          dbInfo.total_api_cache_entries +
          dbInfo.total_streaming_offers +
          dbInfo.total_ratings +
          dbInfo.total_metadata,
        total_searches: dbInfo.total_searches,
      },
      cache_types: stats,
      database_stats: {
        api_cache: {
          total: dbInfo.total_api_cache_entries,
          active: dbInfo.active_api_cache,
          expired: dbInfo.total_api_cache_entries - dbInfo.active_api_cache,
        },
        streaming_offers: {
          total: dbInfo.total_streaming_offers,
          active: dbInfo.active_offers,
          expired: dbInfo.total_streaming_offers - dbInfo.active_offers,
        },
        ratings: {
          total: dbInfo.total_ratings,
          active: dbInfo.active_ratings,
          expired: dbInfo.total_ratings - dbInfo.active_ratings,
        },
        metadata: {
          total: dbInfo.total_metadata,
          active: dbInfo.active_metadata,
          expired: dbInfo.total_metadata - dbInfo.active_metadata,
        },
      },
      recent_searches: recentSearches.map(search => ({
        ...search,
        timestamp: new Date(search.created_at * 1000).toISOString(),
      })),
      cache_config: {
        search_ttl: process.env.CACHE_TTL_SEARCH || '3600',
        details_ttl: process.env.CACHE_TTL_DETAILS || '7200',
        offers_ttl: process.env.CACHE_TTL_OFFERS || '21600',
        ratings_ttl: process.env.CACHE_TTL_RATINGS || '86400',
        metadata_ttl: process.env.CACHE_TTL_METADATA || '604800',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Cache stats API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Endpoint to get cache stats for a specific type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cacheType } = body;

    if (!cacheType) {
      return NextResponse.json({ error: 'Cache type is required' }, { status: 400 });
    }

    const db = getDatabase();
    let detailedStats: any = {};

    switch (cacheType) {
      case 'streaming_offers':
        const offerStats = db
          .prepare(
            `
          SELECT 
            country,
            COUNT(DISTINCT title_id) as unique_titles,
            COUNT(*) as total_offers,
            COUNT(DISTINCT provider) as unique_providers,
            AVG(price) as avg_price,
            MIN(created_at) as oldest_entry,
            MAX(created_at) as newest_entry
          FROM streaming_offers
          WHERE expires_at > unixepoch()
          GROUP BY country
          ORDER BY total_offers DESC
        `
          )
          .all();

        detailedStats = {
          type: 'streaming_offers',
          by_country: offerStats,
          providers: db
            .prepare(
              `
            SELECT provider, COUNT(*) as offer_count 
            FROM streaming_offers 
            WHERE expires_at > unixepoch()
            GROUP BY provider 
            ORDER BY offer_count DESC
            LIMIT 20
          `
            )
            .all(),
        };
        break;

      case 'ratings':
        const ratingStats = db
          .prepare(
            `
          SELECT 
            source,
            COUNT(*) as total_ratings,
            AVG(rating) as avg_rating,
            MIN(rating) as min_rating,
            MAX(rating) as max_rating
          FROM ratings_cache
          WHERE expires_at > unixepoch()
          GROUP BY source
        `
          )
          .all();

        detailedStats = {
          type: 'ratings',
          by_source: ratingStats,
        };
        break;

      case 'metadata':
        const metadataStats = db
          .prepare(
            `
          SELECT 
            media_type,
            COUNT(*) as total_titles,
            AVG(runtime) as avg_runtime,
            MIN(release_year) as oldest_year,
            MAX(release_year) as newest_year
          FROM title_metadata
          WHERE expires_at > unixepoch()
          GROUP BY media_type
        `
          )
          .all();

        detailedStats = {
          type: 'metadata',
          by_media_type: metadataStats,
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid cache type' }, { status: 400 });
    }

    return NextResponse.json(detailedStats);
  } catch (error) {
    console.error('Cache detailed stats API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
