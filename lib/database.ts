import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CacheStatsResult } from './types';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'cache.db');

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    // Ensure the data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  // Cache tables for API responses
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);

    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      country TEXT DEFAULT 'US',
      results_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query);
    CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at);

    CREATE TABLE IF NOT EXISTS title_cache (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      data TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_title_cache_source ON title_cache(source);
    CREATE INDEX IF NOT EXISTS idx_title_cache_expires ON title_cache(expires_at);

    -- New table for streaming offers
    CREATE TABLE IF NOT EXISTS streaming_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_id TEXT NOT NULL,
      country TEXT NOT NULL,
      provider TEXT NOT NULL,
      monetization_type TEXT NOT NULL,
      presentation_type TEXT,
      price REAL,
      currency TEXT,
      url TEXT,
      quality TEXT,
      data TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(title_id, country, provider, monetization_type)
    );

    CREATE INDEX IF NOT EXISTS idx_streaming_offers_title ON streaming_offers(title_id);
    CREATE INDEX IF NOT EXISTS idx_streaming_offers_country ON streaming_offers(country);
    CREATE INDEX IF NOT EXISTS idx_streaming_offers_expires ON streaming_offers(expires_at);

    -- New table for ratings cache
    CREATE TABLE IF NOT EXISTS ratings_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imdb_id TEXT,
      tmdb_id TEXT,
      simkl_id TEXT,
      source TEXT NOT NULL,
      rating REAL,
      vote_count INTEGER,
      data TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(imdb_id, source)
    );

    CREATE INDEX IF NOT EXISTS idx_ratings_imdb ON ratings_cache(imdb_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_tmdb ON ratings_cache(tmdb_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_expires ON ratings_cache(expires_at);

    -- New table for enriched title metadata
    CREATE TABLE IF NOT EXISTS title_metadata (
      id TEXT PRIMARY KEY,
      imdb_id TEXT,
      tmdb_id TEXT,
      simkl_id TEXT,
      title TEXT NOT NULL,
      original_title TEXT,
      media_type TEXT,
      release_year INTEGER,
      runtime INTEGER,
      genres TEXT,
      countries TEXT,
      cast TEXT,
      crew TEXT,
      keywords TEXT,
      data TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_metadata_imdb ON title_metadata(imdb_id);
    CREATE INDEX IF NOT EXISTS idx_metadata_tmdb ON title_metadata(tmdb_id);
    CREATE INDEX IF NOT EXISTS idx_metadata_type ON title_metadata(media_type);
    CREATE INDEX IF NOT EXISTS idx_metadata_expires ON title_metadata(expires_at);

    -- Cache statistics table
    CREATE TABLE IF NOT EXISTS cache_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_type TEXT NOT NULL,
      hits INTEGER DEFAULT 0,
      misses INTEGER DEFAULT 0,
      size_bytes INTEGER DEFAULT 0,
      last_accessed INTEGER DEFAULT (unixepoch()),
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_cache_stats_type ON cache_stats(cache_type);
  `);
}

// Cache utilities
export interface CacheEntry {
  key: string;
  value: unknown;
  expiresAt: number;
}

export function getCachedData<T>(key: string): T | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare('SELECT value FROM api_cache WHERE key = ? AND expires_at > ?');
  const row = stmt.get(key, now) as { value: string } | undefined;

  if (row) {
    try {
      return JSON.parse(row.value);
    } catch (e) {
      console.error('Error parsing cached data:', e);
    }
  }

  return null;
}

export function setCachedData(key: string, value: unknown, ttlSeconds: number = 3600): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSeconds;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO api_cache (key, value, expires_at) 
    VALUES (?, ?, ?)
  `);

  stmt.run(key, JSON.stringify(value), expiresAt);
}

export function clearExpiredCache(): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare('DELETE FROM api_cache WHERE expires_at <= ?');
  stmt.run(now);
}

export function logSearch(query: string, country: string, resultsCount: number): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO search_history (query, country, results_count) 
    VALUES (?, ?, ?)
  `);

  stmt.run(query, country, resultsCount);
}

// New utility functions for enhanced caching

export interface StreamingOffer {
  titleId: string;
  country: string;
  provider: string;
  monetizationType: string;
  presentationType?: string;
  price?: number;
  currency?: string;
  url?: string;
  quality?: string;
  data: unknown;
}

export function getCachedOffers(titleId: string, country?: string): StreamingOffer[] | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  let query = 'SELECT * FROM streaming_offers WHERE title_id = ? AND expires_at > ?';
  const params: (string | number)[] = [titleId, now];

  if (country) {
    query += ' AND country = ?';
    params.push(country);
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as Array<{
    title_id: string;
    country: string;
    provider: string;
    monetization_type: string;
    presentation_type: string;
    price: number;
    currency: string;
    url: string;
    quality: string;
    data: string;
  }>;

  if (rows.length > 0) {
    updateCacheStats('streaming_offers', true);
    return rows.map(row => ({
      titleId: row.title_id,
      country: row.country,
      provider: row.provider,
      monetizationType: row.monetization_type,
      presentationType: row.presentation_type,
      price: row.price,
      currency: row.currency,
      url: row.url,
      quality: row.quality,
      data: JSON.parse(row.data),
    }));
  }

  updateCacheStats('streaming_offers', false);
  return null;
}

export function setCachedOffers(offers: StreamingOffer[], ttlSeconds: number = 21600): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSeconds;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO streaming_offers 
    (title_id, country, provider, monetization_type, presentation_type, price, currency, url, quality, data, expires_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((offers: StreamingOffer[]) => {
    for (const offer of offers) {
      try {
        stmt.run(
          offer.titleId,
          offer.country,
          offer.provider,
          offer.monetizationType,
          offer.presentationType,
          offer.price,
          offer.currency,
          offer.url,
          offer.quality,
          JSON.stringify(offer.data),
          expiresAt
        );
      } catch (error) {
        console.error('Error inserting offer:', error, offer);
      }
    }
  });

  try {
    transaction(offers);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] Successfully cached ${offers.length} offers to database`);
    }
  } catch (error) {
    console.error('Transaction error caching offers:', error);
  }
}

export interface CachedRating {
  imdbId?: string;
  tmdbId?: string;
  simklId?: string;
  source: string;
  rating?: number;
  voteCount?: number;
  data: unknown;
}

export function getCachedRatings(imdbId?: string, tmdbId?: string): CachedRating[] | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  let query = 'SELECT * FROM ratings_cache WHERE expires_at > ?';
  const params: (string | number)[] = [now];

  if (imdbId) {
    query += ' AND imdb_id = ?';
    params.push(imdbId);
  } else if (tmdbId) {
    query += ' AND tmdb_id = ?';
    params.push(tmdbId);
  } else {
    return null;
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as Array<{
    imdb_id: string;
    tmdb_id: string;
    simkl_id: string;
    source: string;
    rating: number;
    vote_count: number;
    data: string;
  }>;

  if (rows.length > 0) {
    updateCacheStats('ratings', true);
    return rows.map(row => ({
      imdbId: row.imdb_id,
      tmdbId: row.tmdb_id,
      simklId: row.simkl_id,
      source: row.source,
      rating: row.rating,
      voteCount: row.vote_count,
      data: JSON.parse(row.data),
    }));
  }

  updateCacheStats('ratings', false);
  return null;
}

export function setCachedRatings(rating: CachedRating, ttlSeconds: number = 86400): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSeconds;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ratings_cache 
    (imdb_id, tmdb_id, simkl_id, source, rating, vote_count, data, expires_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    rating.imdbId,
    rating.tmdbId,
    rating.simklId,
    rating.source,
    rating.rating,
    rating.voteCount,
    JSON.stringify(rating.data),
    expiresAt
  );
}

export interface TitleMetadata {
  id: string;
  imdbId?: string;
  tmdbId?: string;
  simklId?: string;
  title: string;
  originalTitle?: string;
  mediaType?: string;
  releaseYear?: number;
  runtime?: number;
  genres?: string[];
  countries?: string[];
  cast?: unknown[];
  crew?: unknown[];
  keywords?: string[];
  data: unknown;
}

export function getCachedMetadata(id: string): TitleMetadata | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare('SELECT * FROM title_metadata WHERE id = ? AND expires_at > ?');
  const row = stmt.get(id, now) as
    | {
        id: string;
        imdb_id: string;
        tmdb_id: string;
        simkl_id: string;
        title: string;
        original_title: string;
        media_type: string;
        release_year: number;
        runtime: number;
        genres: string;
        countries: string;
        cast: string;
        crew: string;
        keywords: string;
        data: string;
      }
    | undefined;

  if (row) {
    updateCacheStats('metadata', true);
    return {
      id: row.id,
      imdbId: row.imdb_id,
      tmdbId: row.tmdb_id,
      simklId: row.simkl_id,
      title: row.title,
      originalTitle: row.original_title,
      mediaType: row.media_type,
      releaseYear: row.release_year,
      runtime: row.runtime,
      genres: row.genres ? JSON.parse(row.genres) : undefined,
      countries: row.countries ? JSON.parse(row.countries) : undefined,
      cast: row.cast ? JSON.parse(row.cast) : undefined,
      crew: row.crew ? JSON.parse(row.crew) : undefined,
      keywords: row.keywords ? JSON.parse(row.keywords) : undefined,
      data: JSON.parse(row.data),
    };
  }

  updateCacheStats('metadata', false);
  return null;
}

export function setCachedMetadata(metadata: TitleMetadata, ttlSeconds: number = 604800): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSeconds;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO title_metadata 
    (id, imdb_id, tmdb_id, simkl_id, title, original_title, media_type, release_year, runtime, 
     genres, countries, cast, crew, keywords, data, expires_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    metadata.id,
    metadata.imdbId,
    metadata.tmdbId,
    metadata.simklId,
    metadata.title,
    metadata.originalTitle,
    metadata.mediaType,
    metadata.releaseYear,
    metadata.runtime,
    metadata.genres ? JSON.stringify(metadata.genres) : null,
    metadata.countries ? JSON.stringify(metadata.countries) : null,
    metadata.cast ? JSON.stringify(metadata.cast) : null,
    metadata.crew ? JSON.stringify(metadata.crew) : null,
    metadata.keywords ? JSON.stringify(metadata.keywords) : null,
    JSON.stringify(metadata.data),
    expiresAt
  );
}

function updateCacheStats(cacheType: string, hit: boolean): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Check if stats entry exists
  const checkStmt = db.prepare('SELECT id FROM cache_stats WHERE cache_type = ?');
  const existing = checkStmt.get(cacheType) as { id: number } | undefined;

  if (existing) {
    const updateStmt = db.prepare(`
      UPDATE cache_stats 
      SET ${hit ? 'hits = hits + 1' : 'misses = misses + 1'}, 
          last_accessed = ?
      WHERE cache_type = ?
    `);
    updateStmt.run(now, cacheType);
  } else {
    const insertStmt = db.prepare(`
      INSERT INTO cache_stats (cache_type, hits, misses, last_accessed)
      VALUES (?, ?, ?, ?)
    `);
    insertStmt.run(cacheType, hit ? 1 : 0, hit ? 0 : 1, now);
  }
}

export function getCacheStats(): CacheStatsResult {
  const db = getDatabase();

  const stmt = db.prepare('SELECT * FROM cache_stats ORDER BY cache_type');
  const stats = stmt.all();

  // Also get size information
  const sizeStmt = db.prepare(`
    SELECT 
      'api_cache' as cache_type, COUNT(*) as entries, SUM(LENGTH(value)) as size_bytes 
    FROM api_cache WHERE expires_at > unixepoch()
    UNION ALL
    SELECT 
      'streaming_offers' as cache_type, COUNT(*) as entries, SUM(LENGTH(data)) as size_bytes 
    FROM streaming_offers WHERE expires_at > unixepoch()
    UNION ALL
    SELECT 
      'ratings_cache' as cache_type, COUNT(*) as entries, SUM(LENGTH(data)) as size_bytes 
    FROM ratings_cache WHERE expires_at > unixepoch()
    UNION ALL
    SELECT 
      'title_metadata' as cache_type, COUNT(*) as entries, SUM(LENGTH(data)) as size_bytes 
    FROM title_metadata WHERE expires_at > unixepoch()
  `);

  const sizes = sizeStmt.all() as Array<{
    cache_type: string;
    entries: number;
    size_bytes: number;
  }>;

  // Combine stats with size information
  const result: CacheStatsResult = {};
  (
    stats as Array<{
      cache_type: string;
      hits: number;
      misses: number;
      last_accessed: number;
    }>
  ).forEach(stat => {
    const sizeInfo = sizes.find(s => s.cache_type === stat.cache_type) || {
      entries: 0,
      size_bytes: 0,
    };
    result[stat.cache_type] = {
      total_entries: sizeInfo.entries,
      active_entries: sizeInfo.entries,
      expired_entries: 0,
      hit_rate: stat.hits > 0 ? (stat.hits / (stat.hits + stat.misses)) * 100 : 0,
    };
  });
  return result;
}

export function clearCache(cacheType?: string): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  if (cacheType) {
    switch (cacheType) {
      case 'api_cache':
        db.prepare('DELETE FROM api_cache').run();
        break;
      case 'streaming_offers':
        db.prepare('DELETE FROM streaming_offers').run();
        break;
      case 'ratings_cache':
        db.prepare('DELETE FROM ratings_cache').run();
        break;
      case 'title_metadata':
        db.prepare('DELETE FROM title_metadata').run();
        break;
      default:
        throw new Error(`Unknown cache type: ${cacheType}`);
    }
  } else {
    // Clear all expired entries
    db.prepare('DELETE FROM api_cache WHERE expires_at <= ?').run(now);
    db.prepare('DELETE FROM streaming_offers WHERE expires_at <= ?').run(now);
    db.prepare('DELETE FROM ratings_cache WHERE expires_at <= ?').run(now);
    db.prepare('DELETE FROM title_metadata WHERE expires_at <= ?').run(now);
  }
}
