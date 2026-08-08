import { createFileRoute } from '@tanstack/react-router';
import { getTrack } from '../server/db';
import { fail, readJson, str } from '../server/http';
import { callerKey } from '../server/owner';
import { runScan } from '../server/scan';

export const Route = createFileRoute('/api/tracking/check')({
	server: {
		handlers: {
			// { id?: string, trigger?: 'manual' | 'stale-kick' }. Omit `id` to sweep
			// everything active. `trigger` only labels the scan row, so the log can tell a
			// button press apart from the banner firing on its own; anything else is
			// ignored rather than rejected, and `poll` stays reserved for the interval.
			//
			// Returns as soon as the sweep is under way rather than waiting for it: a full
			// sweep is deliberately staggered and can run for minutes.
			POST: async ({ request }) => {
				const body = (await readJson(request)) ?? {};

				let id: string | undefined;
				if (body.id != null) {
					id = str(body.id) ?? undefined;
					// Ownership is checked here, not in runScan: a sweep is the server acting
					// on its own behalf, but asking for one is a request like any other.
					if (!id || !getTrack(id, callerKey(request))) return fail(404, 'No such tracked title.');
				}

				const trigger = str(body.trigger) === 'stale-kick' ? 'stale-kick' : 'manual';
				const scan = await runScan({ trigger, trackId: id });
				return scan.started
					? Response.json({ scan_id: scan.scan_id, started: true }, { status: 202 })
					: Response.json({ started: false, running_since: scan.running_since });
			}
		}
	}
});
