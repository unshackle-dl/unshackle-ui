// The tracking store: node:sqlite, zero dependencies, schema applied on open.
//
// node:sqlite is experimental on Node 22 and prints an ExperimentalWarning on first use.
// That is expected; it needs no flag.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
	ScanRow,
	ScanTrigger,
	SeedCode,
	TrackItem,
	TrackKind,
	TrackPreset,
	TrackRecord,
	TrackState,
	TrackSummary
} from '$lib/tracking/types';
import { config } from './config';
import { owns } from './owner';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS track (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL,
  payload TEXT NOT NULL,            -- JSON, kind-specific
  preset  TEXT NOT NULL,            -- JSON, full param dict
  state TEXT NOT NULL DEFAULT 'active',
  added_at TEXT NOT NULL, last_checked TEXT, last_error TEXT,
  owner_key TEXT                    -- NULL = shared
);
CREATE TABLE IF NOT EXISTS track_item (
  track_id TEXT NOT NULL REFERENCES track(id) ON DELETE CASCADE,
  code TEXT NOT NULL, title TEXT, first_seen TEXT NOT NULL,
  seen_at TEXT,                     -- NULL = unseen / "new"
  seen_via TEXT,                    -- baseline | manual | download
  gone_at TEXT,                     -- code vanished from the listing; never DELETE
  PRIMARY KEY (track_id, code)
);
CREATE INDEX IF NOT EXISTS idx_item_unseen ON track_item(track_id) WHERE seen_at IS NULL;
CREATE TABLE IF NOT EXISTS scan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, finished_at TEXT,
  trigger TEXT NOT NULL,            -- poll | manual | stale-kick
  checked INTEGER DEFAULT 0, new_count INTEGER DEFAULT 0, error_count INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
`;

declare global {
	// Dev HMR re-evaluates this module on every save. Without a globalThis guard each
	// re-evaluation opens another handle to the same file.
	var __unshackleTrackingDb: DatabaseSync | undefined;
}

export function getDb(): DatabaseSync {
	if (globalThis.__unshackleTrackingDb) return globalThis.__unshackleTrackingDb;
	mkdirSync(dirname(config.dbPath), { recursive: true });
	const db = new DatabaseSync(config.dbPath);
	// WAL so a reading request never blocks behind the poller's writes.
	db.exec('PRAGMA journal_mode = WAL');
	db.exec('PRAGMA foreign_keys = ON');
	db.exec('PRAGMA busy_timeout = 5000');
	db.exec(SCHEMA);
	globalThis.__unshackleTrackingDb = db;
	return db;
}

const now = () => new Date().toISOString();

interface TrackRow {
	id: string;
	kind: string;
	label: string;
	payload: string;
	preset: string;
	state: string;
	added_at: string;
	last_checked: string | null;
	last_error: string | null;
	owner_key: string | null;
}

// The kind/payload pairing is enforced on insert, so the cast is safe on the way out.
function toRecord(row: TrackRow): TrackRecord {
	return {
		id: row.id,
		kind: row.kind as TrackKind,
		label: row.label,
		payload: JSON.parse(row.payload),
		preset: JSON.parse(row.preset) as TrackPreset,
		state: row.state as TrackState,
		added_at: row.added_at,
		last_checked: row.last_checked,
		last_error: row.last_error
	} as TrackRecord;
}

// node:sqlite types every column as SQLOutputValue, so a row cast is always a widening
// one. The schema above is the only thing that keeps these honest.
const rows = <T>(v: unknown): T[] => v as T[];

function rowFor(id: string, caller: string): TrackRow | null {
	const row = getDb().prepare('SELECT * FROM track WHERE id = ?').get(id) as TrackRow | undefined;
	// Same shape as the Python: a record you do not own is indistinguishable from one
	// that does not exist.
	if (!row || !owns(row.owner_key, caller)) return null;
	return row;
}

export function listTracks(caller: string): TrackSummary[] {
	const db = getDb();
	const counts = db
		.prepare(
			`SELECT track_id, COUNT(*) AS total, SUM(CASE WHEN seen_at IS NULL THEN 1 ELSE 0 END) AS unseen
			 FROM track_item GROUP BY track_id`
		)
		.all();
	const byId = new Map(
		rows<{ track_id: string; total: number; unseen: number }>(counts).map((c) => [c.track_id, c])
	);
	return rows<TrackRow>(db.prepare('SELECT * FROM track ORDER BY added_at DESC').all())
		.filter((r) => owns(r.owner_key, caller))
		.map((r) => ({
			...toRecord(r),
			total: byId.get(r.id)?.total ?? 0,
			unseen: byId.get(r.id)?.unseen ?? 0
		}));
}

export function getTrack(id: string, caller: string): TrackRecord | null {
	const row = rowFor(id, caller);
	return row ? toRecord(row) : null;
}

export function getItems(id: string): TrackItem[] {
	return getDb()
		.prepare(
			'SELECT code, title, first_seen, seen_at, seen_via, gone_at FROM track_item WHERE track_id = ? ORDER BY code'
		)
		.all(id)
		.map((r) => r as unknown as TrackItem);
}

export interface CreateTrackInput {
	kind: TrackKind;
	label: string;
	payload: unknown;
	preset: TrackPreset;
	codes: SeedCode[];
	/** true stamps every seeded code as already seen, so only later arrivals are "new". */
	baseline: boolean;
	owner: string;
}

export function createTrack(input: CreateTrackInput): TrackRecord {
	const db = getDb();
	const id = crypto.randomUUID();
	const at = now();
	db.exec('BEGIN');
	try {
		db.prepare(
			`INSERT INTO track (id, kind, label, payload, preset, state, added_at, owner_key)
			 VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
		).run(
			id,
			input.kind,
			input.label,
			JSON.stringify(input.payload),
			JSON.stringify(input.preset),
			at,
			input.owner
		);
		const insert = db.prepare(
			`INSERT OR IGNORE INTO track_item (track_id, code, title, first_seen, seen_at, seen_via)
			 VALUES (?, ?, ?, ?, ?, ?)`
		);
		for (const c of input.codes) {
			insert.run(
				id,
				c.code,
				c.title ?? null,
				at,
				input.baseline ? at : null,
				input.baseline ? 'baseline' : null
			);
		}
		db.exec('COMMIT');
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
	return getTrack(id, input.owner)!;
}

export interface TrackPatch {
	label?: string;
	preset?: TrackPreset;
	state?: TrackState;
}

export function updateTrack(id: string, caller: string, patch: TrackPatch): TrackRecord | null {
	if (!rowFor(id, caller)) return null;
	const sets: string[] = [];
	const args: (string | null)[] = [];
	if (patch.label !== undefined) (sets.push('label = ?'), args.push(patch.label));
	if (patch.preset !== undefined)
		(sets.push('preset = ?'), args.push(JSON.stringify(patch.preset)));
	if (patch.state !== undefined) (sets.push('state = ?'), args.push(patch.state));
	if (sets.length)
		getDb()
			.prepare(`UPDATE track SET ${sets.join(', ')} WHERE id = ?`)
			.run(...args, id);
	return getTrack(id, caller);
}

export function deleteTrack(id: string, caller: string): boolean {
	if (!rowFor(id, caller)) return false;
	// track_item goes with it via ON DELETE CASCADE (foreign_keys is ON).
	getDb().prepare('DELETE FROM track WHERE id = ?').run(id);
	return true;
}

/** Stamp items seen. `codes` omitted marks every unseen item on the track. Returns the count. */
export function markSeen(
	id: string,
	caller: string,
	codes: string[] | undefined,
	via: 'manual' | 'download' = 'manual'
): number | null {
	if (!rowFor(id, caller)) return null;
	const db = getDb();
	const at = now();
	if (!codes) {
		return Number(
			db
				.prepare(
					'UPDATE track_item SET seen_at = ?, seen_via = ? WHERE track_id = ? AND seen_at IS NULL'
				)
				.run(at, via, id).changes
		);
	}
	const stmt = db.prepare(
		'UPDATE track_item SET seen_at = ?, seen_via = ? WHERE track_id = ? AND code = ? AND seen_at IS NULL'
	);
	let n = 0;
	db.exec('BEGIN');
	try {
		for (const code of codes) n += Number(stmt.run(at, via, id, code).changes);
		db.exec('COMMIT');
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
	return n;
}

// Detection and scanning. None of the below takes a caller: a sweep is the server acting
// on its own behalf, not a request. Ownership is enforced at the route that *asks* for a
// scan, not here.

function tx<T>(fn: () => T): T {
	const db = getDb();
	db.exec('BEGIN');
	try {
		const out = fn();
		db.exec('COMMIT');
		return out;
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
}

/** Everything the code-set diff needs to know about a stored code. */
export interface ItemState {
	code: string;
	seen_at: string | null;
	gone_at: string | null;
}

export function itemStates(trackId: string): ItemState[] {
	return rows<ItemState>(
		getDb().prepare('SELECT code, seen_at, gone_at FROM track_item WHERE track_id = ?').all(trackId)
	);
}

/** The three mutations a detection run can make. Rows are never removed. */
export interface DetectionChanges {
	/** Codes never seen on this track before. Inserted unseen. */
	added: { code: string; title: string | null }[];
	/** Codes that were marked gone and are listed again. Clears `gone_at` only. */
	returned: string[];
	/** Codes that stopped being listed. Stamps `gone_at`. */
	vanished: string[];
}

export function applyDetection(trackId: string, changes: DetectionChanges, at: string): void {
	const db = getDb();
	// seen_at is left NULL: a newly detected episode is "new" by definition. Baselining
	// only ever happens at create time.
	const add = db.prepare(
		'INSERT OR IGNORE INTO track_item (track_id, code, title, first_seen) VALUES (?, ?, ?, ?)'
	);
	// Deliberately does NOT touch seen_at: an episode that vanished and came back is the
	// same episode, and re-flagging it as new would nag about something already watched.
	const back = db.prepare('UPDATE track_item SET gone_at = NULL WHERE track_id = ? AND code = ?');
	// `gone_at IS NULL` keeps the first disappearance date rather than refreshing it.
	const gone = db.prepare(
		'UPDATE track_item SET gone_at = ? WHERE track_id = ? AND code = ? AND gone_at IS NULL'
	);
	tx(() => {
		for (const a of changes.added) add.run(trackId, a.code, a.title, at);
		for (const c of changes.returned) back.run(trackId, c);
		for (const c of changes.vanished) gone.run(at, trackId, c);
	});
}

/**
 * Stamp codes seen because a download of them completed. `at` is the job's completion
 * time, not now, so the tracking page reads as history rather than as "just noticed".
 */
export function markDownloaded(trackId: string, codes: string[], at: string): number {
	const stmt = getDb().prepare(
		"UPDATE track_item SET seen_at = ?, seen_via = 'download' WHERE track_id = ? AND code = ? AND seen_at IS NULL"
	);
	return tx(() => {
		let n = 0;
		for (const code of codes) n += Number(stmt.run(at, trackId, code).changes);
		return n;
	});
}

/** A track with unseen codes, flattened for the history correlation. */
export interface UnseenTarget {
	id: string;
	service: string;
	title_id: string;
	codes: string[];
}

export function unseenTargets(): UnseenTarget[] {
	const found = rows<{ id: string; payload: string; code: string }>(
		getDb()
			.prepare(
				`SELECT t.id AS id, t.payload AS payload, i.code AS code
				 FROM track t JOIN track_item i ON i.track_id = t.id
				 WHERE i.seen_at IS NULL AND t.kind IN ('series', 'movie')`
			)
			.all()
	);
	const byTrack = new Map<string, UnseenTarget>();
	for (const row of found) {
		let target = byTrack.get(row.id);
		if (!target) {
			const payload = JSON.parse(row.payload) as { service?: string; title_id?: string };
			if (!payload.service || !payload.title_id) continue;
			target = { id: row.id, service: payload.service, title_id: payload.title_id, codes: [] };
			byTrack.set(row.id, target);
		}
		target.codes.push(row.code);
	}
	return [...byTrack.values()];
}

/**
 * What a sweep should check, longest-unchecked first so a sweep interrupted halfway
 * resumes where it left off. A `trackId` bypasses the state filter: an explicit
 * "check this one" is a user action, and refusing it on a paused record is surprising.
 */
export function scanTargets(trackId?: string): TrackRecord[] {
	const db = getDb();
	const found = trackId
		? rows<TrackRow>(db.prepare('SELECT * FROM track WHERE id = ?').all(trackId))
		: rows<TrackRow>(
				db
					.prepare(
						`SELECT * FROM track WHERE state = 'active'
						 ORDER BY last_checked ASC NULLS FIRST, added_at ASC`
					)
					.all()
			);
	return found.map(toRecord);
}

export function activeTrackCount(): number {
	const row = getDb().prepare("SELECT COUNT(*) AS n FROM track WHERE state = 'active'").get() as {
		n: number;
	};
	return Number(row.n);
}

/**
 * Record the outcome of one track's check. `last_checked` moves even on failure,
 * otherwise the NULLS-FIRST ordering would put the same broken record at the head of
 * every sweep forever and starve the rest.
 */
export function stampChecked(id: string, at: string, error: string | null): void {
	getDb()
		.prepare('UPDATE track SET last_checked = ?, last_error = ? WHERE id = ?')
		.run(at, error, id);
}

export interface OpenScan {
	id: number;
	started_at: string;
}

/** The scan row currently holding the lock, if any. */
export function openScan(): OpenScan | null {
	const row = getDb()
		.prepare('SELECT id, started_at FROM scan WHERE finished_at IS NULL ORDER BY id LIMIT 1')
		.get() as OpenScan | undefined;
	return row ? { id: Number(row.id), started_at: row.started_at } : null;
}

/**
 * The cross-process half of the re-entrancy guard: a conditional insert that only lands
 * when no scan row is open. Returns the new scan id, or null when another process (or
 * another module instance after an HMR reload) already holds it. One statement, so
 * sqlite's own write lock makes it atomic.
 */
export function beginScan(trigger: ScanTrigger, at: string): number | null {
	const res = getDb()
		.prepare(
			`INSERT INTO scan (started_at, trigger)
			 SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM scan WHERE finished_at IS NULL)`
		)
		.run(at, trigger);
	return Number(res.changes) ? Number(res.lastInsertRowid) : null;
}

/** The most recent scan row, running or finished. Reported by the status route. */
export function lastScan(): ScanRow | null {
	const row = getDb().prepare('SELECT * FROM scan ORDER BY id DESC LIMIT 1').get() as
		Record<string, unknown> | undefined;
	if (!row) return null;
	return {
		id: Number(row.id),
		started_at: String(row.started_at),
		finished_at: row.finished_at == null ? null : String(row.finished_at),
		trigger: String(row.trigger) as ScanTrigger,
		checked: Number(row.checked ?? 0),
		new_count: Number(row.new_count ?? 0),
		error_count: Number(row.error_count ?? 0)
	};
}

/**
 * When a sweep last completed. MAX rather than "the newest row's finished_at", because
 * the newest row may still be open, and a running scan must not read as a fresh sync.
 */
export function lastSync(): string | null {
	const row = getDb().prepare('SELECT MAX(finished_at) AS at FROM scan').get() as
		{ at: string | null } | undefined;
	return row?.at ?? null;
}

export function endScan(
	id: number,
	totals: { checked: number; new_count: number; error_count: number },
	at: string
): void {
	getDb()
		.prepare(
			'UPDATE scan SET finished_at = ?, checked = ?, new_count = ?, error_count = ? WHERE id = ?'
		)
		.run(at, totals.checked, totals.new_count, totals.error_count, id);
}

/**
 * Finalise scan rows left open by a crashed or killed process. Without this the
 * conditional insert above would refuse every future scan for the lifetime of the
 * database. Returns how many were reaped.
 */
export function reapStaleScans(olderThanMs: number, at = now()): number {
	const cutoff = new Date(Date.parse(at) - olderThanMs).toISOString();
	return Number(
		getDb()
			.prepare('UPDATE scan SET finished_at = ? WHERE finished_at IS NULL AND started_at < ?')
			.run(at, cutoff).changes
	);
}

/** Mark every unseen item on every track this caller owns. Returns the count. */
export function markAllSeen(caller: string): number {
	const db = getDb();
	const ids = rows<TrackRow>(db.prepare('SELECT id, owner_key FROM track').all())
		.filter((r) => owns(r.owner_key, caller))
		.map((r) => r.id);
	if (!ids.length) return 0;
	const at = now();
	const stmt = db.prepare(
		'UPDATE track_item SET seen_at = ?, seen_via = ? WHERE track_id = ? AND seen_at IS NULL'
	);
	let n = 0;
	db.exec('BEGIN');
	try {
		for (const id of ids) n += Number(stmt.run(at, 'manual', id).changes);
		db.exec('COMMIT');
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
	return n;
}
