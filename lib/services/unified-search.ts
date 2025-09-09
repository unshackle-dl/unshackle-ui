import { UnifiedSearchResult, UnifiedSearchResponse, SearchConfiguration } from '@/lib/types';
import { justWatchService } from './justwatch';
import { simklService } from './simkl';
import { logSearch } from '@/lib/database';

export class UnifiedSearchService {
  async search(
    query: string,
    configuration?: Partial<SearchConfiguration>
  ): Promise<UnifiedSearchResponse> {
    const config: SearchConfiguration = {
      enabledSources: ['JustWatch'], // Only use JustWatch for search results
      country: process.env.DEFAULT_COUNTRY || 'US',
      maxResultsPerSource: parseInt(process.env.MAX_RESULTS_PER_SOURCE || '20'),
      deduplicateResults: process.env.ENABLE_DEDUPLICATION === 'true',
      mediaTypeFilter: process.env.DEFAULT_SEARCH_TYPE || 'all',
      ...configuration,
    };

    const response: UnifiedSearchResponse = {
      results: [],
      totalResults: 0,
      resultsBySource: {
        JustWatch: 0,
        Tmdb: 0,
        Simkl: 0,
      },
      errors: {
        JustWatch: '',
        Tmdb: '',
        Simkl: '',
      },
    };

    if (!query?.trim()) {
      return response;
    }

    console.log(
      `Starting unified search for: "${query}" with sources: ${config.enabledSources.join(', ')}`
    );

    // Execute JustWatch search only
    if (config.enabledSources.includes('JustWatch')) {
      await this.searchJustWatch(query, config, response);
    }

    // Deduplicate JustWatch results by title and year
    if (response.results.length > 1) {
      response.results = this.deduplicateJustWatchResults(response.results);
    }

    // Sort results by rating, vote count, and popularity
    // Since we only have JustWatch results, sort by quality metrics
    response.results = response.results.sort((a, b) => {
      // Sort by rating if available
      const aRating = a.rating || 0;
      const bRating = b.rating || 0;
      if (Math.abs(aRating - bRating) > 0.5) return bRating - aRating;

      // Then by vote count
      const aVotes = a.voteCount || 0;
      const bVotes = b.voteCount || 0;
      if (aVotes !== bVotes) return bVotes - aVotes;

      // Finally by release year (newer first)
      const aYear = a.releaseYear || 0;
      const bYear = b.releaseYear || 0;
      return bYear - aYear;
    });

    response.totalResults = response.results.length;

    // Log the search
    logSearch(query, config.country!, response.totalResults);

    console.log(
      `Unified search completed. Total: ${response.totalResults}, By source:`,
      response.resultsBySource
    );

    return response;
  }

  private async searchJustWatch(
    query: string,
    config: SearchConfiguration,
    response: UnifiedSearchResponse
  ): Promise<void> {
    try {
      const justWatchResults = await justWatchService.searchTitles(query, config.country);

      if (justWatchResults?.data?.popularTitles?.edges) {
        const results = justWatchResults.data.popularTitles.edges
          .slice(0, config.maxResultsPerSource)
          .map(edge => this.mapJustWatchToUnified(edge.node))
          .filter(result => this.matchesMediaTypeFilter(result, config.mediaTypeFilter));

        response.results.push(...results);
        response.resultsBySource['JustWatch'] = results.length;
      } else {
        response.resultsBySource['JustWatch'] = 0;
      }
    } catch (error) {
      console.error('JustWatch search error:', error);
      response.errors['JustWatch'] = error instanceof Error ? error.message : 'Unknown error';
      response.resultsBySource['JustWatch'] = 0;
    }
  }

  private mapJustWatchToUnified(node: {
    id: string;
    objectType: string;
    content?: {
      title?: string;
      shortDescription?: string;
      originalReleaseYear?: number;
      originalReleaseDate?: string;
      posterUrl?: string;
      genres?: Array<{ shortName: string }>;
      externalIds?: {
        imdbId?: string;
        tmdbId?: string;
      };
      fullPath?: string;
      productionCountries?: string[];
      runtime?: number;
    };
  }): UnifiedSearchResult {
    // Convert relative poster URLs to full JustWatch CDN URLs
    let posterUrl = node.content?.posterUrl;
    if (posterUrl && posterUrl.startsWith('/')) {
      posterUrl = `https://images.justwatch.com${posterUrl}`;
    }

    return {
      id: node.id,
      source: 'JustWatch',
      title: node.content?.title || '',
      overview: node.content?.shortDescription,
      releaseYear: node.content?.originalReleaseYear,
      releaseDate: node.content?.originalReleaseDate,
      mediaType: node.objectType?.toLowerCase() === 'show' ? 'tv' : 'movie',
      posterUrl,
      genres: node.content?.genres?.map(g => g.shortName) || [],
      imdbId: node.content?.externalIds?.imdbId,
      tmdbId: node.content?.externalIds?.tmdbId,
      runtime: node.content?.runtime,
      justWatchUrl: node.content?.fullPath
        ? `https://justwatch.com${node.content.fullPath}`
        : undefined,
      countries: node.content?.productionCountries || [],
    };
  }

  private matchesMediaTypeFilter(result: UnifiedSearchResult, filter?: string): boolean {
    if (!filter || filter === 'all') return true;

    const mediaType = result.mediaType?.toLowerCase();
    const filterType = filter.toLowerCase();

    return (
      mediaType === filterType ||
      (filterType === 'tv' && mediaType === 'show') ||
      (filterType === 'show' && mediaType === 'tv')
    );
  }

  private deduplicateJustWatchResults(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
    if (results.length <= 1) return results;

    const groups = new Map<string, UnifiedSearchResult[]>();

    // Group results by normalized title and year
    results.forEach(result => {
      const normalizedTitle = result.title.toLowerCase().trim();
      const year = result.releaseYear || 0;
      const key = `${normalizedTitle}:${year}:${result.mediaType}`;

      const group = groups.get(key) || [];
      group.push(result);
      groups.set(key, group);
    });

    if (process.env.NODE_ENV === 'development') {
      const duplicateGroups = Array.from(groups.entries()).filter(([, group]) => group.length > 1);
      if (duplicateGroups.length > 0) {
        console.log(
          `[DEBUG] Found ${duplicateGroups.length} duplicate groups in JustWatch results:`
        );
        duplicateGroups.forEach(([key, group]) => {
          console.log(`  - "${key}": ${group.length} entries`);
          group.forEach((result, index) => {
            console.log(
              `    ${index + 1}. ID: ${result.id}, Genres: [${result.genres.join(', ')}]`
            );
          });
        });
      }
    }

    const deduped: UnifiedSearchResult[] = [];

    // For each group, merge all entries into one result
    groups.forEach(group => {
      if (group.length === 1) {
        deduped.push(group[0]);
      } else {
        // Merge multiple entries
        const merged = this.mergeJustWatchResults(group);
        deduped.push(merged);
      }
    });

    return deduped;
  }

  private mergeJustWatchResults(results: UnifiedSearchResult[]): UnifiedSearchResult {
    if (results.length === 1) return results[0];

    // Start with the first result as base
    const merged: UnifiedSearchResult = { ...results[0] };

    // Store all IDs for potential future use
    const allIds = results.map(r => r.id);
    (merged as UnifiedSearchResult & { _duplicateIds?: string[] })._duplicateIds = allIds;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] Merging ${results.length} JustWatch results for "${merged.title}"`);
    }

    // Merge data from all results
    results.forEach((result, index) => {
      if (index === 0) return; // Skip first one as it's our base

      // Keep the best poster URL (prefer non-null, longer URLs)
      if (!merged.posterUrl && result.posterUrl) {
        merged.posterUrl = result.posterUrl;
      } else if (result.posterUrl && result.posterUrl.length > (merged.posterUrl?.length || 0)) {
        merged.posterUrl = result.posterUrl;
      }

      // Keep the best overview (prefer longer descriptions)
      if (!merged.overview && result.overview) {
        merged.overview = result.overview;
      } else if (result.overview && result.overview.length > (merged.overview?.length || 0)) {
        merged.overview = result.overview;
      }

      // Merge genres (combine unique genres)
      if (result.genres && result.genres.length > 0) {
        const allGenres = [...(merged.genres || []), ...result.genres];
        merged.genres = [...new Set(allGenres)];
      }

      // Keep the best external IDs
      if (!merged.imdbId && result.imdbId) merged.imdbId = result.imdbId;
      if (!merged.tmdbId && result.tmdbId) merged.tmdbId = result.tmdbId;
      if (!merged.simklId && result.simklId) merged.simklId = result.simklId;

      // Keep the best JustWatch URL (prefer non-null)
      if (!merged.justWatchUrl && result.justWatchUrl) {
        merged.justWatchUrl = result.justWatchUrl;
      }

      // Merge countries
      if (result.countries && result.countries.length > 0) {
        const allCountries = [...(merged.countries || []), ...result.countries];
        merged.countries = [...new Set(allCountries)];
      }

      // Keep the best runtime (prefer non-zero values)
      if (!merged.runtime && result.runtime) {
        merged.runtime = result.runtime;
      }

      // Keep the best release date
      if (!merged.releaseDate && result.releaseDate) {
        merged.releaseDate = result.releaseDate;
      }

      // Keep the best original title
      if (!merged.originalTitle && result.originalTitle) {
        merged.originalTitle = result.originalTitle;
      }
    });

    // Mark as merged for debugging
    (merged as UnifiedSearchResult & { _mergedFrom?: string })._mergedFrom =
      `${results.length} JustWatch entries`;

    return merged;
  }

  private selectBestResult(results: UnifiedSearchResult[]): UnifiedSearchResult {
    if (results.length === 1) return results[0];

    // Create a merged result that combines the best data from all sources
    const merged: UnifiedSearchResult = {
      id: '',
      source: 'JustWatch', // Default to JustWatch as primary source
      title: '',
      mediaType: '',
      genres: [],
    } as UnifiedSearchResult;

    // Source priority for different data types
    const sourceOrder = { JustWatch: 3, Tmdb: 2, Simkl: 1 };

    // Find the best source for each field
    let primaryResult = results[0];
    let bestSourceScore = 0;

    results.forEach(result => {
      const score = sourceOrder[result.source] || 0;
      if (score > bestSourceScore) {
        bestSourceScore = score;
        primaryResult = result;
      }
    });

    // Use primary result as base
    Object.assign(merged, primaryResult);

    // Merge complementary data from other sources
    results.forEach(result => {
      // Prefer JustWatch for streaming-related data
      if (result.source === 'JustWatch') {
        merged.id = result.id;
        merged.source = result.source;
        merged.justWatchUrl = result.justWatchUrl;
        merged.countries = result.countries;
        if (result.genres.length > 0) merged.genres = result.genres;
      }

      // Prefer TMDB for movie/TV metadata
      if (result.source === 'Tmdb') {
        if (!merged.overview && result.overview) merged.overview = result.overview;
        if (!merged.posterUrl && result.posterUrl) merged.posterUrl = result.posterUrl;
        if (!merged.rating && result.rating) {
          merged.rating = result.rating;
          merged.voteCount = result.voteCount;
        }
        if (!merged.releaseDate && result.releaseDate) merged.releaseDate = result.releaseDate;
        if (!merged.releaseYear && result.releaseYear) merged.releaseYear = result.releaseYear;
        if (!merged.originalTitle && result.originalTitle)
          merged.originalTitle = result.originalTitle;
        if (!merged.runtime && result.runtime) merged.runtime = result.runtime;
        // Always preserve TMDB ID
        merged.tmdbId = result.tmdbId;
      }

      // Merge external IDs from all sources
      if (result.imdbId && !merged.imdbId) merged.imdbId = result.imdbId;
      if (result.tmdbId && !merged.tmdbId) merged.tmdbId = result.tmdbId;
      if (result.simklId && !merged.simklId) merged.simklId = result.simklId;

      // Prefer highest rating if we don't have one
      if (result.rating && result.voteCount) {
        if (
          !merged.rating ||
          (result.voteCount > (merged.voteCount || 0) &&
            Math.abs(result.rating - merged.rating) < 1)
        ) {
          merged.rating = result.rating;
          merged.voteCount = result.voteCount;
        }
      }

      // Prefer better poster image (TMDB usually has better quality)
      if (result.posterUrl && (!merged.posterUrl || result.source === 'Tmdb')) {
        merged.posterUrl = result.posterUrl;
      }
    });

    // Mark as merged result for debugging
    (merged as UnifiedSearchResult & { _mergedFrom?: string })._mergedFrom = results
      .map(r => r.source)
      .join(', ');

    return merged;
  }

  private async enhanceWithSimklData(results: UnifiedSearchResult[]): Promise<void> {
    // Only enhance results that have IMDB or TMDB IDs
    const enhanceableResults = results.filter(result => result.imdbId || result.tmdbId);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] Enhancing ${enhanceableResults.length} results with SIMKL data`);
    }

    const enhancementPromises = enhanceableResults.map(async result => {
      try {
        let simklData = null;

        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[DEBUG] Enhancing "${result.title}" - IMDb: ${result.imdbId}, TMDB: ${result.tmdbId}`
          );
        }

        // Try IMDB ID first (most reliable)
        if (result.imdbId) {
          try {
            simklData = await simklService.searchById(result.imdbId, 'imdb');
            if (process.env.NODE_ENV === 'development' && simklData) {
              console.log(`[DEBUG] SIMKL enhancement via IMDb successful for "${result.title}"`);
            }
          } catch (error) {
            console.warn(`SIMKL search by IMDB ID failed for ${result.title}:`, error);
          }
        }

        // Fallback to TMDB ID if IMDB search failed
        if (!simklData && result.tmdbId) {
          try {
            simklData = await simklService.searchById(
              result.tmdbId,
              'tmdb',
              result.mediaType as 'movie' | 'tv'
            );
            if (process.env.NODE_ENV === 'development' && simklData) {
              console.log(`[DEBUG] SIMKL enhancement via TMDB successful for "${result.title}"`);
            }
          } catch (error) {
            console.warn(`SIMKL search by TMDB ID failed for ${result.title}:`, error);
          }
        }

        if (simklData && (simklData as any).ids) {
          // Add SIMKL IDs to the result
          if (!result.simklId && (simklData as any).ids.simkl) {
            result.simklId = (simklData as any).ids.simkl.toString();
          }

          // Fill in missing external IDs
          if (!result.imdbId && (simklData as any).ids.imdb) {
            result.imdbId = (simklData as any).ids.imdb;
          }

          if (!result.tmdbId && (simklData as any).ids.tmdb) {
            result.tmdbId = (simklData as any).ids.tmdb.toString();
          }

          // Add rating if we don't have one
          if (!result.rating && (simklData as any).rating) {
            result.rating = (simklData as any).rating;
          }

          // Add poster if we don't have one
          if (!result.posterUrl && (simklData as any).poster) {
            result.posterUrl = (simklData as any).poster;
          }

          // Add overview if we don't have one
          if (!result.overview && (simklData as any).overview) {
            result.overview = (simklData as any).overview;
          }

          // Add genres if we don't have them
          if (
            result.genres.length === 0 &&
            (simklData as any).genres &&
            (simklData as any).genres.length > 0
          ) {
            result.genres = (simklData as any).genres;
          }
        }
      } catch (error) {
        console.warn(`Failed to enhance ${result.title} with SIMKL data:`, error);
      }
    });

    await Promise.allSettled(enhancementPromises);
  }

  async enhanceWithRatings(results: UnifiedSearchResult[]): Promise<UnifiedSearchResult[]> {
    const enhancementPromises = results.map(async result => {
      if (!result.imdbId) return result;

      try {
        const ratings = await simklService.getRatingsByImdbId(result.imdbId);
        const bestRating = simklService.getBestRating(ratings);

        if (bestRating && !result.rating) {
          result.rating = bestRating.rating;
          result.voteCount = bestRating.votes;
        }
      } catch (error) {
        console.warn(`Failed to get ratings for ${result.title}:`, error);
      }

      return result;
    });

    return Promise.all(enhancementPromises);
  }
}

export const unifiedSearchService = new UnifiedSearchService();
