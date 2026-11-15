import { createFileRoute } from '@tanstack/react-router';
import type { TrackPatch } from '../server/db';
import { deleteTrack, getItems, getTrack, updateTrack } from '../server/db';
import { fail, readJson, str } from '../server/http';
import { callerKey } from '../server/owner';
import { isReleaseDay, isReleaseTime, isTimeZone } from '$lib/tracking/schedule';

const STATES = ['active', 'paused'] as const;

// A record owned by another key 404s rather than 403s, matching unshackle-live's job
// endpoints: not-yours and not-there look identical from outside.
const NOT_FOUND = 'No such tracked title.';

export const Route = createFileRoute('/api/tracking/$id')({
	server: {
		handlers: {
			GET: ({ request, params }) => {
				const track = getTrack(params.id, callerKey(request));
				if (!track) return fail(404, NOT_FOUND);
				return Response.json({ track, items: getItems(track.id) });
			},

			PATCH: async ({ request, params }) => {
				const body = await readJson(request);
				if (!body) return fail(400, 'Request body must be a JSON object.');

				const patch: TrackPatch = {};
				if (body.label !== undefined) {
					const label = str(body.label);
					if (!label) return fail(400, 'label must be a non-empty string.');
					patch.label = label;
				}
				if (body.preset !== undefined) {
					if (!body.preset || typeof body.preset !== 'object' || Array.isArray(body.preset))
						return fail(400, 'preset must be a JSON object.');
					// Replaced whole, not merged: dropping an option has to be expressible.
					patch.preset = body.preset as Record<string, unknown>;
				}
				if (body.state !== undefined) {
					const state = str(body.state);
					if (!state || !STATES.includes(state as (typeof STATES)[number]))
						return fail(400, `state must be one of: ${STATES.join(', ')}.`);
					patch.state = state as (typeof STATES)[number];
				}
				if (body.release_day !== undefined) {
					if (!isReleaseDay(body.release_day))
						return fail(400, 'release_day must be a weekday from 0 (Sunday) to 6 (Saturday).');
					patch.release_day = body.release_day;
				}
				if (body.release_time !== undefined) {
					const releaseTime = str(body.release_time);
					if (!releaseTime || !isReleaseTime(releaseTime))
						return fail(400, 'release_time must use HH:mm format.');
					patch.release_time = releaseTime;
				}
				if (body.time_zone !== undefined) {
					const timeZone = str(body.time_zone);
					if (!timeZone || !isTimeZone(timeZone))
						return fail(400, 'time_zone must be a valid IANA time zone.');
					patch.time_zone = timeZone;
				}
				const track = updateTrack(params.id, callerKey(request), patch);
				if (!track) return fail(404, NOT_FOUND);
				return Response.json({ track });
			},

			DELETE: ({ request, params }) => {
				if (!deleteTrack(params.id, callerKey(request))) return fail(404, NOT_FOUND);
				return new Response(null, { status: 204 });
			}
		}
	}
});
