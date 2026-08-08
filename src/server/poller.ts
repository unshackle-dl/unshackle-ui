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
import { activeTrackCount } from './db';
import { runScan } from './scan';

declare global {
	var __unshacklePoller: ReturnType<typeof setInterval> | undefined;
}

/**
 * Idempotent. Called at boot from src/server.ts, and again when a track is created: the
 * boot call is a no-op on an empty database, and without the second call the first track
 * anyone adds would not be polled until the next restart.
 */
export function startPoller(): void {
	if (globalThis.__unshacklePoller) return;
	if (!config.apiUrlFromEnv) {
		console.log('[poller] inert: UNSHACKLE_API_URL is not set.');
		return;
	}
	if (activeTrackCount() === 0) return;

	globalThis.__unshacklePoller = setInterval(() => {
		// runScan resolves as soon as the sweep is under way; its `done` never rejects.
		// The catch is for the guard itself failing (an unreadable database, say).
		runScan({ trigger: 'poll' }).catch((e) => console.error('[poller] scan failed to start:', e));
	}, config.intervalMs);
	console.log(`[poller] checking tracked titles every ${Math.round(config.intervalMs / 1000)}s`);
}

/**
 * What the status route reports. `inert` is the case worth surfacing: the server will
 * never check anything on its own, so every "last checked" on the Tracking page only
 * moves when somebody clicks.
 */
export function pollerMode(): PollerMode {
	if (!config.apiUrlFromEnv) return 'inert';
	return globalThis.__unshacklePoller ? 'running' : 'idle';
}
