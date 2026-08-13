// Shared tracking shapes. Imported by BOTH the server (src/server/*) and the browser, so
// this module stays pure: types plus one const array, no imports, no runtime behaviour.

/**
 * Full param dict captured from the title page: coerced advanced options plus the
 * service's own cli options. Values are already request-shaped (numbers, arrays, bools)
 * rather than form strings. See src/lib/tracking/preset.ts for the conversion both ways.
 */
export type TrackPreset = Record<string, unknown>;

export type TrackKind = 'series' | 'movie' | 'search';

/** Kinds storage accepts. Only 'series' has a detector; the routes reject the rest. */
export const TRACK_KINDS: readonly TrackKind[] = ['series', 'movie', 'search'];

export type TrackState = 'active' | 'paused';

/** A title on a service: what `POST /api/list-titles` needs to re-list it. */
export interface TitlePayload {
	service: string;
	title_id: string;
}

/** A saved search on a service, for the later search-tracking kind. */
export interface SearchPayload {
	service: string;
	query: string;
}

export interface TrackEnvelope {
	id: string;
	label: string;
	state: TrackState;
	preset: TrackPreset;
	added_at: string;
	last_checked: string | null;
	last_error: string | null;
	/** Per-title check interval override; null uses the server-wide interval. */
	interval_ms: number | null;
}

/**
 * The discriminated union. `kind` + `payload` is the extension point: movie and search
 * tracking need a detector and a relaxed route guard, but no schema migration.
 */
export type TrackRecord =
	| (TrackEnvelope & { kind: 'series'; payload: TitlePayload })
	| (TrackEnvelope & { kind: 'movie'; payload: TitlePayload })
	| (TrackEnvelope & { kind: 'search'; payload: SearchPayload });

/** One detected episode code. Rows are never deleted, only stamped `gone_at`. */
export interface TrackItem {
	code: string;
	title: string | null;
	first_seen: string;
	/** null = unseen, i.e. "new". */
	seen_at: string | null;
	seen_via: 'baseline' | 'manual' | 'download' | null;
	/** Set when the code vanished from a listing, so its return is not "new" again. */
	gone_at: string | null;
}

/** List-shaped record: the envelope plus the counts the sidebar badge needs. */
export type TrackSummary = TrackRecord & { unseen: number; total: number };

/** What asked for a sweep. Recorded on the scan row; `runScan` behaves the same for all three. */
export type ScanTrigger = 'poll' | 'manual' | 'stale-kick';

/** A code offered by the caller when a track is created (Phase 3 seeds these). */
export interface SeedCode {
	code: string;
	title?: string | null;
}

/** One row of the `scan` table, as reported by GET /api/tracking/status. */
export interface ScanRow {
	id: number;
	started_at: string;
	/** null while the scan is still running. */
	finished_at: string | null;
	trigger: ScanTrigger;
	checked: number;
	new_count: number;
	error_count: number;
}

/**
 * What the poller is doing. `inert` means no API URL was configured (env or web), so the
 * server deliberately never polls; `idle` means it is configured but has nothing to
 * check yet.
 */
export type PollerMode = 'running' | 'idle' | 'inert';

/** Where an editable server setting's current value comes from. Web beats env beats default. */
export type SettingSource = 'web' | 'env' | 'default';

export interface SettingField<T = string> {
	value: T;
	source: SettingSource;
}

/**
 * GET/PUT /api/tracking/settings. URL values sourced from env are redacted to their
 * host, and the API key is never echoed, only whether one is set.
 */
export interface TrackingSettings {
	api_url: SettingField;
	api_key: { set: boolean; source: SettingSource };
	interval_ms: SettingField<number>;
	stagger_ms: SettingField<number>;
	webhook_url: SettingField;
	/** Env-only: the overrides above are stored inside this file. */
	db_path: string;
	poller: PollerMode;
}

/** GET /api/tracking/status. Drives the sidebar badge, the stale-kick banner and Settings. */
export interface TrackingStatus {
	running: boolean;
	running_since: string | null;
	/** When the last scan finished, or null if none ever has. */
	last_sync: string | null;
	interval_ms: number;
	/** Nothing has swept in an interval, so the browser should offer to kick one off. */
	stale: boolean;
	tracks: number;
	unseen_total: number;
	poller: PollerMode;
	last_scan: ScanRow | null;
	/**
	 * The HOST the server polls, never the full URL and never the key. It exists so the
	 * browser can notice that its own Settings point somewhere else.
	 */
	api_url: string;
}
