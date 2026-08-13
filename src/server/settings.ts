// Web-editable server settings: raw override strings in the tracking db's meta table,
// merged over env by src/server/config.ts. Absent row = use the env value.
import type { TrackingSettings } from '$lib/tracking/types';
import {
	applyOverrides,
	config,
	SETTING_ENV,
	settingSources,
	type Overrides,
	type SettingKey,
	type SettingSource
} from './config';
import { getDb } from './db';
import { restartPoller } from './poller';

const KEYS = Object.keys(SETTING_ENV) as SettingKey[];
const metaKey = (k: SettingKey) => `cfg.${k}`;

/** Push the stored overrides into the live config. Called at boot, after getDb(). */
export function loadSettings(): void {
	const db = getDb();
	const stmt = db.prepare('SELECT v FROM meta WHERE k = ?');
	const next: Overrides = {};
	for (const key of KEYS) {
		const row = stmt.get(metaKey(key)) as { v: string } | undefined;
		if (row && row.v !== '') next[key] = row.v;
	}
	applyOverrides(next);
}

/**
 * Env-sourced URLs are redacted to their host: the API URL and a webhook URL can both
 * carry credentials, and a value the web never wrote should not be echoed to it. A
 * web-sourced value came from the browser in the first place, so it goes back whole.
 */
function showUrl(full: string, source: SettingSource): string {
	if (source === 'web' || full === '') return full;
	try {
		return new URL(full).host;
	} catch {
		return full;
	}
}

export function settingsView(): Omit<TrackingSettings, 'poller'> {
	const src = settingSources();
	return {
		api_url: { value: showUrl(config.apiUrl, src.apiUrl), source: src.apiUrl },
		api_key: { set: config.apiKey !== '', source: src.apiKey },
		interval_ms: { value: config.intervalMs, source: src.intervalMs },
		stagger_ms: { value: config.staggerMs, source: src.staggerMs },
		webhook_url: { value: showUrl(config.webhookUrl, src.webhookUrl), source: src.webhookUrl },
		db_path: config.dbPath
	};
}

// Below one minute a sweep can outlive its own interval; the env path has no floor
// because whoever sets env vars can read this code.
const MIN_INTERVAL_MS = 60_000;

export type UpdateResult = { ok: true } | { ok: false; error: string };

/**
 * Values are set as given; null or '' clears the override so the env value applies
 * again. Only the keys present in the patch are touched.
 */
export function updateSettings(patch: Record<string, unknown>): UpdateResult {
	const writes = new Map<SettingKey, string | null>();
	for (const [k, v] of Object.entries(patch)) {
		if (!(KEYS as string[]).includes(k)) return { ok: false, error: `Unknown setting: ${k}` };
		const key = k as SettingKey;
		if (v == null || v === '') {
			writes.set(key, null);
			continue;
		}
		let s = String(v).trim();
		if (key === 'apiUrl' || key === 'webhookUrl') {
			try {
				new URL(s);
			} catch {
				return { ok: false, error: `${k} is not a valid URL` };
			}
			s = s.replace(/\/+$/, '');
		}
		if (key === 'intervalMs' || key === 'staggerMs') {
			const n = Number(s);
			if (!Number.isFinite(n) || n <= 0)
				return { ok: false, error: `${k} must be a positive number of milliseconds` };
			if (key === 'intervalMs' && n < MIN_INTERVAL_MS)
				return { ok: false, error: 'intervalMs must be at least 60000 (one minute)' };
		}
		writes.set(key, s);
	}

	const db = getDb();
	const del = db.prepare('DELETE FROM meta WHERE k = ?');
	const put = db.prepare(
		'INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'
	);
	for (const [key, value] of writes)
		value === null ? del.run(metaKey(key)) : put.run(metaKey(key), value);

	loadSettings();
	restartPoller();
	return { ok: true };
}
