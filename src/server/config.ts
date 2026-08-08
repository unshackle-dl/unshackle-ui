// Server-side runtime configuration.
//
// Read from `process.env`, deliberately NOT `import.meta.env`: Vite inlines the latter
// at build time, so a built server would carry whatever the *build* machine had rather
// than what the deployment sets. The browser half of the app keeps its own settings in
// localStorage (src/lib/config.ts) and the two can legitimately disagree — the poller
// uses these values, the browser uses its own.

export interface ServerConfig {
	/** unshackle REST base URL, no trailing slash. */
	apiUrl: string;
	/**
	 * Whether `apiUrl` came from the environment rather than the built-in default. The
	 * poller stays inert when it did not: a deployment that never configured an upstream
	 * would otherwise hammer localhost:8786 forever and fill every record's last_error.
	 */
	apiUrlFromEnv: boolean;
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

function read(): ServerConfig {
	return {
		apiUrl: url('UNSHACKLE_API_URL', 'http://localhost:8786'),
		apiUrlFromEnv: (process.env.UNSHACKLE_API_URL ?? '').trim() !== '',
		apiKey: (process.env.UNSHACKLE_API_KEY ?? '').trim(),
		dbPath: (process.env.TRACKING_DB_PATH ?? '').trim() || './data/tracking.db',
		intervalMs: num('TRACKING_INTERVAL_MS', 6 * HOUR),
		staggerMs: num('TRACKING_STAGGER_MS', 30_000),
		webhookUrl: (process.env.TRACKING_WEBHOOK_URL ?? '').trim()
	};
}

export const config: Readonly<ServerConfig> = Object.freeze(read());

/** Host only — the key must never leave the server, and the URL can carry credentials. */
export function apiHost(): string {
	try {
		return new URL(config.apiUrl).host;
	} catch {
		return config.apiUrl;
	}
}
