import { createFileRoute } from '@tanstack/react-router';
import type { TrackingStatus } from '$lib/tracking/types';
import { apiHost, config } from '../server/config';
import {
	activeTrackCount,
	dueTargets,
	lastScan,
	lastSync,
	listTracks,
	openScan,
	reapStaleScans
} from '../server/db';
import { callerKey } from '../server/owner';
import { pollerMode } from '../server/poller';
import { staleAfterMs } from '../server/scan';

export const Route = createFileRoute('/api/tracking/status')({
	server: {
		handlers: {
			GET: ({ request }) => {
				// A write on a GET, deliberately. `running` comes from the open scan row, which
				// is also the cross-process lock: a process killed mid-sweep leaves it open, and
				// without reaping here the UI would report a scan running forever and the stale
				// banner would never appear. runScan reaps for the same reason.
				reapStaleScans(staleAfterMs(activeTrackCount()));

				const caller = callerKey(request);
				const tracks = listTracks(caller);
				const open = openScan();
				const last_sync = lastSync();
				const running = open !== null;

				// Overdue titles the server will not get to on its own. A running poller catches
				// anything due within a minute, and a sweep already under way makes the offer
				// pointless, so both suppress the banner. dueTargets honours per-title intervals,
				// so a deliberately slow title never reads as stale.
				const poller = pollerMode();
				const stale =
					tracks.length > 0 && !running && poller !== 'running' && dueTargets().length > 0;

				const status: TrackingStatus = {
					running,
					running_since: open?.started_at ?? null,
					last_sync,
					interval_ms: config.intervalMs,
					stale,
					tracks: tracks.length,
					unseen_total: tracks.reduce((n, t) => n + t.unseen, 0),
					poller,
					last_scan: lastScan(),
					// Host only. The key never leaves this process, and the configured URL can
					// itself carry credentials.
					api_url: apiHost()
				};
				return Response.json(status);
			}
		}
	}
});
