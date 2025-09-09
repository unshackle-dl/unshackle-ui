import { NextRequest, NextResponse } from 'next/server';
import { clearCache, clearExpiredCache, getDatabase } from '@/lib/database';
import { cacheManager } from '@/lib/cache-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, cacheType, titleId, country } = body;

    switch (action) {
      case 'clear_all':
        // Clear all cache entries
        clearCache();
        return NextResponse.json({
          success: true,
          message: 'All cache entries cleared',
          action: 'clear_all',
        });

      case 'clear_type':
        // Clear specific cache type
        if (!cacheType) {
          return NextResponse.json(
            { error: 'Cache type is required for clear_type action' },
            { status: 400 }
          );
        }

        clearCache(cacheType);
        return NextResponse.json({
          success: true,
          message: `Cache type ${cacheType} cleared`,
          action: 'clear_type',
          cacheType,
        });

      case 'clear_expired':
        // Clear only expired entries
        clearExpiredCache();
        return NextResponse.json({
          success: true,
          message: 'Expired cache entries cleared',
          action: 'clear_expired',
        });

      case 'clear_title':
        // Clear cache for a specific title
        if (!titleId) {
          return NextResponse.json(
            { error: 'Title ID is required for clear_title action' },
            { status: 400 }
          );
        }

        const db = getDatabase();

        // Clear from various cache tables
        db.prepare('DELETE FROM api_cache WHERE key LIKE ?').run(`%${titleId}%`);
        db.prepare('DELETE FROM streaming_offers WHERE title_id = ?').run(titleId);
        db.prepare('DELETE FROM title_metadata WHERE id = ?').run(titleId);

        return NextResponse.json({
          success: true,
          message: `Cache for title ${titleId} cleared`,
          action: 'clear_title',
          titleId,
        });

      case 'clear_offers':
        // Clear streaming offers for a specific title and/or country
        const db2 = getDatabase();
        let query = 'DELETE FROM streaming_offers WHERE 1=1';
        const params: (string | number)[] = [];

        if (titleId) {
          query += ' AND title_id = ?';
          params.push(titleId);
        }

        if (country) {
          query += ' AND country = ?';
          params.push(country);
        }

        const stmt = db2.prepare(query);
        const result = stmt.run(...params);

        return NextResponse.json({
          success: true,
          message: `Cleared ${result.changes} offer entries`,
          action: 'clear_offers',
          titleId,
          country,
          deletedCount: result.changes,
        });

      case 'warm_cache':
        // Warm cache for popular titles
        if (!body.titleIds || !Array.isArray(body.titleIds)) {
          return NextResponse.json(
            { error: 'Title IDs array is required for warm_cache action' },
            { status: 400 }
          );
        }

        await cacheManager.warmCache(body.titleIds, country || 'US');

        return NextResponse.json({
          success: true,
          message: `Cache warming initiated for ${body.titleIds.length} titles`,
          action: 'warm_cache',
          titleCount: body.titleIds.length,
          country: country || 'US',
        });

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Valid actions: clear_all, clear_type, clear_expired, clear_title, clear_offers, warm_cache',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cache invalidation API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check cache status
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const titleId = searchParams.get('titleId');
    const country = searchParams.get('country');

    if (!titleId) {
      // Return general cache status
      const db = getDatabase();
      const status = db
        .prepare(
          `
        SELECT 
          (SELECT COUNT(*) FROM api_cache WHERE expires_at > unixepoch()) as active_api_cache,
          (SELECT COUNT(*) FROM streaming_offers WHERE expires_at > unixepoch()) as active_offers,
          (SELECT COUNT(*) FROM ratings_cache WHERE expires_at > unixepoch()) as active_ratings,
          (SELECT COUNT(*) FROM title_metadata WHERE expires_at > unixepoch()) as active_metadata,
          (SELECT COUNT(*) FROM api_cache WHERE expires_at <= unixepoch()) as expired_api_cache,
          (SELECT COUNT(*) FROM streaming_offers WHERE expires_at <= unixepoch()) as expired_offers,
          (SELECT COUNT(*) FROM ratings_cache WHERE expires_at <= unixepoch()) as expired_ratings,
          (SELECT COUNT(*) FROM title_metadata WHERE expires_at <= unixepoch()) as expired_metadata
      `
        )
        .get() as {
        active_api_cache: number;
        active_offers: number;
        active_ratings: number;
        active_metadata: number;
        expired_api_cache: number;
        expired_offers: number;
        expired_ratings: number;
        expired_metadata: number;
      };

      return NextResponse.json({
        active: {
          api_cache: status.active_api_cache,
          streaming_offers: status.active_offers,
          ratings: status.active_ratings,
          metadata: status.active_metadata,
          total:
            status.active_api_cache +
            status.active_offers +
            status.active_ratings +
            status.active_metadata,
        },
        expired: {
          api_cache: status.expired_api_cache,
          streaming_offers: status.expired_offers,
          ratings: status.expired_ratings,
          metadata: status.expired_metadata,
          total:
            status.expired_api_cache +
            status.expired_offers +
            status.expired_ratings +
            status.expired_metadata,
        },
      });
    }

    // Check cache status for specific title
    const db = getDatabase();

    let offerQuery =
      'SELECT COUNT(*) as count FROM streaming_offers WHERE title_id = ? AND expires_at > unixepoch()';
    const offerParams: (string | number)[] = [titleId];

    if (country) {
      offerQuery += ' AND country = ?';
      offerParams.push(country);
    }

    const offerCount = db.prepare(offerQuery).get(...offerParams) as { count: number };
    const metadataCount = db
      .prepare(
        'SELECT COUNT(*) as count FROM title_metadata WHERE id = ? AND expires_at > unixepoch()'
      )
      .get(titleId) as { count: number };
    const apiCacheCount = db
      .prepare(
        'SELECT COUNT(*) as count FROM api_cache WHERE key LIKE ? AND expires_at > unixepoch()'
      )
      .get(`%${titleId}%`) as { count: number };

    return NextResponse.json({
      titleId,
      country,
      cached: {
        offers: offerCount.count,
        metadata: metadataCount.count,
        api_responses: apiCacheCount.count,
      },
      isCached: offerCount.count > 0 || metadataCount.count > 0 || apiCacheCount.count > 0,
    });
  } catch (error) {
    console.error('Cache status API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
