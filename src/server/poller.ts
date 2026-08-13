// The background check loop.
//
// It has to be started from src/server.ts: a module-level interval in a route file does
// not start until that route is first requested, so an idle server would silently never
// poll. The globalThis guard is not optional either, because dev HMR re-evaluates modules
// on every save and leaves the previous interval running, so each save would add another
// poller hammering unshackle-live.
//
// `npm run dev` does not evaluate src/server.ts until the first HTTP request, so an idle
// dev server is no evidence that the poller is or is not running.
import type { PollerMode } from '$lib/tracking/types';
import { config } from './config';
import { activeTrackCount, dueTargets } from './db';
import { runScan } from './scan';

// The tick is fixed and cheap (one sqlite read); which titles get checked is decided per
// tick from each track's own interval, so a changed interval needs no restart.
const TICK_MS = 60_000;

declare global {
	var __unshacklePoller: ReturnType<typeof setInterval> | undefined;
	var __unshacklePollerInertLogged: boolean | undefined;
}

/**
 * Idempotent. Called at boot from src/server.ts, and again when a track is created: the
 * boot call is a no-op on an empty database, and without the second call the first track
 * anyone adds would not be polled until the next restart.
 */
export function startPoller(): void {
	if (globalThis.__unshacklePoller) return;
	if (!config.apiUrlConfigured) {
		// Repeats on every HMR reload otherwise; the UI status route surfaces `inert` anyway.
		if (!globalThis.__unshacklePollerInertLogged) {
			globalThis.__unshacklePollerInertLogged = true;
			console.log(
				'[poller] inert: no API URL configured. Set UNSHACKLE_API_URL or add one on the Tracking page.'
			);
		}
		return;
	}
	if (activeTrackCount() === 0) return;

	globalThis.__unshacklePoller = setInterval(() => {
		try {
			// Checked here rather than inside runScan so a tick with nothing due writes no
			// scan row.
			if (dueTargets().length === 0) return;
		} catch (e) {
			console.error('[poller] due check failed:', e);
			return;
		}
		// runScan resolves as soon as the sweep is under way; its `done` never rejects.
		runScan({ trigger: 'poll', dueOnly: true }).catch((e) =>
			console.error('[poller] scan failed to start:', e)
		);
	}, TICK_MS);
	console.log(
		`[poller] running: due titles checked every minute, default interval ${Math.round(config.intervalMs / 1000)}s`
	);
}

/**
 * What the status route reports. `inert` is the case worth surfacing: the server will
 * never check anything on its own, so every "last checked" on the Tracking page only
 * moves when somebody clicks.
 */
export function pollerMode(): PollerMode {
	if (!config.apiUrlConfigured) return 'inert';
	return globalThis.__unshacklePoller ? 'running' : 'idle';
}

/**
 * Settings changed: a new interval only applies by rebuilding the setInterval, and a
 * first-time API URL flips the poller from inert to running.
 */
export function restartPoller(): void {
	if (globalThis.__unshacklePoller) {
		clearInterval(globalThis.__unshacklePoller);
		globalThis.__unshacklePoller = undefined;
	}
	startPoller();
}
