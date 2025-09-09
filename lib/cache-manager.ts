import {
  getCachedData,
  setCachedData,
  getCachedOffers,
  setCachedOffers,
  getCachedRatings,
  setCachedRatings,
  getCachedMetadata,
  setCachedMetadata,
  getCacheStats,
  clearCache,
  clearExpiredCache,
  StreamingOffer,
  CachedRating,
  TitleMetadata,
} from './database';

export interface CacheConfig {
  searchTTL?: number;
  detailsTTL?: number;
  offersTTL?: number;
  ratingsTTL?: number;
  metadataTTL?: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  searchTTL: parseInt(process.env.CACHE_TTL_SEARCH || '3600'),
  detailsTTL: parseInt(process.env.CACHE_TTL_DETAILS || '7200'),
  offersTTL: parseInt(process.env.CACHE_TTL_OFFERS || '21600'),
  ratingsTTL: parseInt(process.env.CACHE_TTL_RATINGS || '86400'),
  metadataTTL: parseInt(process.env.CACHE_TTL_METADATA || '604800'),
};

export class CacheManager {
  private config: CacheConfig;

  constructor(config?: CacheConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // API Response Caching
  async getApiResponse<T>(key: string): Promise<T | null> {
    return getCachedData<T>(key);
  }

  async setApiResponse<T>(key: string, data: T, ttl?: number): Promise<void> {
    setCachedData(key, data, ttl || this.config.searchTTL);
  }

  // Streaming Offers Caching
  async getStreamingOffers(titleId: string, country?: string): Promise<StreamingOffer[] | null> {
    return getCachedOffers(titleId, country);
  }

  async setStreamingOffers(offers: StreamingOffer[]): Promise<void> {
    if (offers.length === 0) return;

    // Group offers by title and country for batch insertion
    const groupedOffers = new Map<string, StreamingOffer[]>();

    offers.forEach(offer => {
      const key = `${offer.titleId}-${offer.country}`;
      if (!groupedOffers.has(key)) {
        groupedOffers.set(key, []);
      }
      groupedOffers.get(key)!.push(offer);
    });

    // Process each group
    for (const [, groupOffers] of groupedOffers) {
      // Deduplicate offers within the group
      const uniqueOffers = this.deduplicateOffers(groupOffers);
      setCachedOffers(uniqueOffers, this.config.offersTTL);
    }
  }

  private deduplicateOffers(offers: StreamingOffer[]): StreamingOffer[] {
    const seen = new Set<string>();
    return offers.filter(offer => {
      const key = `${offer.provider}-${offer.monetizationType}-${offer.presentationType}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Ratings Caching
  async getRatings(imdbId?: string, tmdbId?: string): Promise<CachedRating[] | null> {
    return getCachedRatings(imdbId, tmdbId);
  }

  async setRating(rating: CachedRating): Promise<void> {
    setCachedRatings(rating, this.config.ratingsTTL);
  }

  // Title Metadata Caching
  async getTitleMetadata(id: string): Promise<TitleMetadata | null> {
    return getCachedMetadata(id);
  }

  async setTitleMetadata(metadata: TitleMetadata): Promise<void> {
    setCachedMetadata(metadata, this.config.metadataTTL);
  }

  // Cache Management
  async getStats() {
    return getCacheStats();
  }

  async invalidate(cacheType?: string): Promise<void> {
    clearCache(cacheType);
  }

  async cleanup(): Promise<void> {
    clearExpiredCache();
  }

  // Cache Warming
  async warmCache(titleIds: string[], country: string = 'US'): Promise<void> {
    // This would be called by a background job to pre-fetch popular content
    console.log(`Warming cache for ${titleIds.length} titles in ${country}`);

    // Implementation would fetch data from APIs and cache it
    // This is a placeholder for the actual implementation
    for (const titleId of titleIds) {
      // Check if already cached
      const cached = await this.getStreamingOffers(titleId, country);
      if (!cached) {
        // Fetch from API and cache
        console.log(`Would fetch and cache data for ${titleId}`);
      }
    }
  }

  // Cache Headers
  generateCacheHeaders(ttl: number, etag?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Cache-Control': `public, max-age=${ttl}`,
      'X-Cache-TTL': ttl.toString(),
    };

    if (etag) {
      headers['ETag'] = etag;
    }

    const expires = new Date(Date.now() + ttl * 1000);
    headers['Expires'] = expires.toUTCString();

    return headers;
  }

  // ETag generation
  generateETag(data: unknown): string {
    // Simple hash function for ETag generation
    let hash = 0;
    const str = JSON.stringify(data);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // Check if cache is stale
  isCacheStale(timestamp: number, ttl: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return timestamp + ttl < now;
  }

  // Transform offer data for caching
  transformOfferForCache(
    offer: {
      videoTechnology?: string | string[];
      package?: {
        clearName?: string;
        technicalName?: string;
      };
      monetizationType?: string;
      retailPriceValue?: number;
      currency?: string;
      presentationType?: string;
      standardWebURL?: string;
      [key: string]: unknown;
    },
    titleId: string,
    country: string
  ): StreamingOffer {
    // Handle arrays for quality field
    let quality = null;
    if (offer.videoTechnology) {
      if (Array.isArray(offer.videoTechnology)) {
        // Filter out empty strings and join with comma
        quality = offer.videoTechnology.filter((v: string) => v).join(',') || null;
      } else {
        quality = offer.videoTechnology;
      }
    }

    return {
      titleId,
      country,
      provider: offer.package?.clearName || offer.package?.technicalName || 'Unknown',
      monetizationType: offer.monetizationType || 'Unknown',
      presentationType: offer.presentationType || 'Unknown',
      price: offer.retailPriceValue,
      currency: offer.currency,
      url: offer.standardWebURL,
      quality: quality || undefined,
      data: offer,
    };
  }

  // Batch operations
  async batchGetOffers(
    titleIds: string[],
    country: string
  ): Promise<Map<string, StreamingOffer[]>> {
    const results = new Map<string, StreamingOffer[]>();

    for (const titleId of titleIds) {
      const offers = await this.getStreamingOffers(titleId, country);
      if (offers) {
        results.set(titleId, offers);
      }
    }

    return results;
  }

  async batchGetRatings(imdbIds: string[]): Promise<Map<string, CachedRating[]>> {
    const results = new Map<string, CachedRating[]>();

    for (const imdbId of imdbIds) {
      const ratings = await this.getRatings(imdbId);
      if (ratings) {
        results.set(imdbId, ratings);
      }
    }

    return results;
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Export types for convenience
export type { StreamingOffer, CachedRating, TitleMetadata } from './database';
