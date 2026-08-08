// The scan orchestrator. `runScan` is the ONLY way a check happens — the poller, the
// manual "check now" route and the later stale-kick all call this same function, and it
// knows nothing about which of them did. That is what keeps the trigger mechanism
// swappable: if the in-process interval ever has to become a separate process, one file
// changes rather than four.
//
// Concurrency is 1, on purpose. `POST /api/list-titles` on unshackle-live does a full
// auth handshake, loads a CDM and calls the service's live `get_titles()` for every
// request. Fanning out would be a self-inflicted denial of service, so tracks are walked
// one at a time with a stagger between them.
import type { ScanTrigger, TitlePayload, TrackRecord } from '$lib/tracking/types';
import { config } from './config';
import {
	activeTrackCount,
	beginScan,
	endScan,
	openScan,
	reapStaleScans,
	scanTargets,
	stampChecked
} from './db';
import { detectors } from './detect';
import { correlateHistory } from './history';
import { upstreamMessage } from './upstream';
import type { WebhookError, WebhookTrack } from './webhook';
import { notifyScan } from './webhook';

export interface ScanTotals {
	scan_id: number;
	checked: number;
	new_count: number;
	error_count: number;
}

export interface ScanHandle {
	/** false when a scan was already running — nothing new was started. */
	started: boolean;
	scan_id: number | null;
	running_since: string | null;
	/**
	 * Resolves when the sweep finishes. Callers who only want to kick one off (the route,
	 * the poller) ignore it; it never rejects, because per-track failures are recorded on
	 * the record and the scan row is always finalised.
	 */
	done: Promise<ScanTotals | null>;
}

declare global {
	// Layer one of the re-entrancy guard, and on globalThis for the same reason the db
	// handle is: dev HMR re-evaluates this module, and a module-local variable would let
	// the reloaded copy start a second concurrent sweep.
	var __unshackleScan: ScanHandle | undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * How long a scan row may stay open before it is presumed dead. A sweep is bounded by
 * one stagger per track plus however long the upstream calls take; the five minutes on
 * top is slack for the latter. Reaping matters because the cross-process guard is a row
 * with no `finished_at` — a process killed mid-sweep would otherwise wedge scanning for
 * the lifetime of the database.
 */
export function staleAfterMs(trackCount: number): number {
	return config.staggerMs * Math.max(trackCount, 1) + 5 * 60_000;
}

export async function runScan(opts: {
	trigger: ScanTrigger;
	trackId?: string;
}): Promise<ScanHandle> {
	// Layer 1, in-process: concurrent callers get a handle on the *same* sweep rather than
	// starting a second one. Three browser tabs firing "check now" at once cost one scan.
	const inflight = globalThis.__unshackleScan;
	if (inflight) return { ...inflight, started: false };

	reapStaleScans(staleAfterMs(activeTrackCount()));

	const at = new Date().toISOString();
	// Layer 2, cross-process: a conditional insert that only lands when no scan row is
	// open. Needed because layer 1 protects a single module instance and nothing more —
	// a second Node process on the same database would sail straight past it.
	const id = beginScan(opts.trigger, at);
	if (id === null) {
		const open = openScan();
		return {
			started: false,
			scan_id: open?.id ?? null,
			running_since: open?.started_at ?? null,
			done: Promise.resolve(null)
		};
	}

	const targets = scanTargets(opts.trackId);
	// sweep() runs to its first await synchronously, so there is no window in which the
	// handle is unset; the JS event loop does the rest of the mutual exclusion for us.
	const done = (async () => {
		try {
			return await sweep(id, opts.trigger, targets);
		} finally {
			if (globalThis.__unshackleScan?.scan_id === id) globalThis.__unshackleScan = undefined;
		}
	})();
	const handle: ScanHandle = { started: true, scan_id: id, running_since: at, done };
	globalThis.__unshackleScan = handle;
	return handle;
}

async function sweep(
	id: number,
	trigger: ScanTrigger,
	targets: TrackRecord[]
): Promise<ScanTotals> {
	let checked = 0;
	let new_count = 0;
	let error_count = 0;
	// Accumulated for the one summary webhook at the end of the cycle. Kept here rather
	// than re-read from sqlite afterwards: "what this cycle found" and "what is unseen
	// right now" are different questions, and only the first belongs in a notification.
	const found: WebhookTrack[] = [];
	const failed: WebhookError[] = [];
	try {
		// Before detecting, not after: an episode downloaded since the last sweep should
		// already read as seen by the time this scan's numbers are reported.
		try {
			await correlateHistory();
		} catch (e) {
			// A history failure must not cost us the detection pass.
			console.warn('[scan] history correlation failed:', upstreamMessage(e));
		}

		for (const [i, track] of targets.entries()) {
			if (i > 0) await sleep(config.staggerMs);
			try {
				const detect = detectors[track.kind];
				if (!detect) throw new Error(`Tracking a ${track.kind} is not implemented yet.`);
				const result = await detect(track);
				new_count += result.added.length;
				if (result.added.length) {
					// `search` tracks carry a query rather than a title, and have no detector
					// yet, so this cast only ever runs for the title-shaped kinds.
					const payload = track.payload as Partial<TitlePayload>;
					found.push({
						id: track.id,
						label: track.label,
						service: payload.service ?? '',
						title_id: payload.title_id ?? '',
						new_codes: result.added
					});
				}
				stampChecked(track.id, new Date().toISOString(), null);
			} catch (e) {
				// One dead service, one expired profile or one unsupported kind must never
				// abort the sweep — it is recorded on the record and the next track runs.
				error_count++;
				const message = upstreamMessage(e);
				failed.push({ id: track.id, label: track.label, error: message });
				stampChecked(track.id, new Date().toISOString(), message);
			}
			checked++;
		}
	} finally {
		// In a finally so that even an unforeseen throw releases the cross-process lock
		// rather than leaving it for the reaper.
		const finished_at = new Date().toISOString();
		endScan(id, { checked, new_count, error_count }, finished_at);
		// Once per cycle, after the row is closed so the summary describes a finished scan.
		// notifyScan neither throws nor blocks — it decides whether there is anything worth
		// sending and returns; sweep stays unaware of the target.
		notifyScan({
			source: 'unshackle-ui',
			scan_id: id,
			trigger,
			finished_at,
			new_count,
			tracks: found,
			errors: failed
		});
	}
	return { scan_id: id, checked, new_count, error_count };
}
