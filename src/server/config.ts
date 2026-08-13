// Server-side runtime configuration.
//
// Read from `process.env`, deliberately NOT `import.meta.env`: Vite inlines the latter
// at build time, so a built server would carry whatever the *build* machine had rather
// than what the deployment sets. The browser half of the app keeps its own settings in
// localStorage (src/lib/config.ts) and the two can legitimately disagree. The poller
// uses these values, the browser uses its own.
//
// Every field except dbPath can also be overridden from the Tracking page. Overrides
// live in the tracking db's meta table (src/server/settings.ts) and win over env; dbPath
// stays env-only because the overrides are stored inside the file it names.

export interface ServerConfig {
	/** unshackle REST base URL, no trailing slash. */
	apiUrl: string;
	/**
	 * Whether `apiUrl` was configured at all (env or web) rather than left at the
	 * built-in default. The poller stays inert when it was not: a deployment that never
	 * configured an upstream would otherwise hammer localhost:8786 forever and fill
	 * every record's last_error.
	 */
	apiUrlConfigured: boolean;
	/** Sent as X-Secret-Key. Empty when the API runs with --no-key. */
	apiKey: string;
	dbPath: string;
	/** How often a full sweep of tracked records should run. */
	intervalMs: number;
	/** Gap between individual checks inside a sweep. list-titles is expensive upstream. */
	staggerMs: number;
	/** Outbound summary webhook. Empty disables it. */
	webhookUrl: string;
}

/** The web-editable subset, with the env var each one shadows. */
export const SETTING_ENV: Record<SettingKey, string> = {
	apiUrl: 'UNSHACKLE_API_URL',
	apiKey: 'UNSHACKLE_API_KEY',
	intervalMs: 'TRACKING_INTERVAL_MS',
	staggerMs: 'TRACKING_STAGGER_MS',
	webhookUrl: 'TRACKING_WEBHOOK_URL'
};
export type SettingKey = 'apiUrl' | 'apiKey' | 'intervalMs' | 'staggerMs' | 'webhookUrl';

/** Raw override strings as stored in the meta table. Absent key = fall back to env. */
export type Overrides = Partial<Record<SettingKey, string>>;

export type SettingSource = 'web' | 'env' | 'default';

const HOUR = 60 * 60 * 1000;

function num(key: string, fallback: number): number {
	const raw = process.env[key];
	if (raw == null || raw.trim() === '') return fallback;
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) {
		console.warn(`[config] ${key}=${raw} is not a positive number; using ${fallback}`);
		return fallback;
	}
	return n;
}

function url(key: string, fallback: string): string {
	const raw = (process.env[key] ?? '').trim() || fallback;
	// Fail at boot rather than on the first poll, where it would surface as a per-record
	// last_error and look like an upstream problem.
	try {
		new URL(raw);
	} catch {
		throw new Error(`[config] ${key}=${raw} is not a valid URL`);
	}
	return raw.replace(/\/+$/, '');
}

let overrides: Overrides = {};

// Overrides were validated when saved, but the db is writable by hand, so a bad stored
// value falls back to env rather than taking the server down.
function numOv(v: string | undefined, fallback: number): number {
	if (v === undefined) return fallback;
	const n = Number(v);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

function urlOv(v: string | undefined, fallback: string): string {
	if (v === undefined) return fallback;
	try {
		new URL(v);
	} catch {
		return fallback;
	}
	return v.replace(/\/+$/, '');
}

function merged(): ServerConfig {
	const envSet = (process.env.UNSHACKLE_API_URL ?? '').trim() !== '';
	return {
		apiUrl: urlOv(overrides.apiUrl, url('UNSHACKLE_API_URL', 'http://localhost:8786')),
		apiUrlConfigured: envSet || overrides.apiUrl !== undefined,
		apiKey: overrides.apiKey ?? (process.env.UNSHACKLE_API_KEY ?? '').trim(),
		dbPath: (process.env.TRACKING_DB_PATH ?? '').trim() || './data/tracking.db',
		intervalMs: numOv(overrides.intervalMs, num('TRACKING_INTERVAL_MS', 6 * HOUR)),
		staggerMs: numOv(overrides.staggerMs, num('TRACKING_STAGGER_MS', 30_000)),
		webhookUrl: urlOv(overrides.webhookUrl, (process.env.TRACKING_WEBHOOK_URL ?? '').trim())
	};
}

// Mutable on purpose: applyOverrides reassigns the fields in place so every module that
// imported `config` sees new values without a restart.
export const config: ServerConfig = merged();

export function applyOverrides(next: Overrides): void {
	overrides = next;
	Object.assign(config, merged());
}

/** Where each editable value currently comes from, for the settings UI. */
export function settingSources(): Record<SettingKey, SettingSource> {
	const out = {} as Record<SettingKey, SettingSource>;
	for (const key of Object.keys(SETTING_ENV) as SettingKey[]) {
		out[key] =
			overrides[key] !== undefined
				? 'web'
				: (process.env[SETTING_ENV[key]] ?? '').trim() !== ''
					? 'env'
					: 'default';
	}
	return out;
}

/** Host only: the key must never leave the server, and the URL can carry credentials. */
export function apiHost(): string {
	try {
		return new URL(config.apiUrl).host;
	} catch {
		return config.apiUrl;
	}
}
