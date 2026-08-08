import { createFileRoute } from '@tanstack/react-router';
import type { TrackPatch } from '../server/db';
import { deleteTrack, getItems, getTrack, updateTrack } from '../server/db';
import { fail, readJson, str } from '../server/http';
import { callerKey } from '../server/owner';

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
