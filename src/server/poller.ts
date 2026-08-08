// The background check loop.
//
// Three constraints, all learned rather than assumed:
//
// 1. It must be started from src/server.ts. A module-level interval in a route file does
//    not start until that route is first requested, so an idle server would silently
//    never poll.
// 2. The globalThis guard is not optional. Dev HMR re-evaluates modules on every save and
//    leaves the previous interval running — proven during the Phase 0 spike, where two
//    tickers ended up writing to sqlite from one pid. Without this, every file save adds
//    another poller hammering unshackle-live.
// 3. `npm run dev` does not evaluate src/server.ts until the first HTTP request, so an
//    idle dev server is no evidence that the poller is or is not running.
import { config } from './config';
import { activeTrackCount } from './db';
import { runScan } from './scan';

declare global {
	var __unshacklePoller: ReturnType<typeof setInterval> | undefined;
}

/**
 * Idempotent. Called at boot from src/server.ts, and again when a track is created — the
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
