import { createFileRoute } from '@tanstack/react-router';
import type { SeedCode, TrackKind, TrackPreset } from '$lib/tracking/types';
import { TRACK_KINDS } from '$lib/tracking/types';
import { createTrack, getItems, listTracks } from '../server/db';
import { fail, readJson, str } from '../server/http';
import { callerKey } from '../server/owner';
import { startPoller } from '../server/poller';

// Codes arrive from the title page, which already holds the episode list, so creating a
// track normally costs zero extra list-titles calls. Both shapes are accepted so a plain
// `["S01E01"]` works from curl.
function seedCodes(v: unknown): SeedCode[] | null {
	if (v == null) return [];
	if (!Array.isArray(v)) return null;
	const out: SeedCode[] = [];
	for (const raw of v) {
		if (typeof raw === 'string') {
			const code = str(raw);
			if (!code) return null;
			out.push({ code });
			continue;
		}
		if (!raw || typeof raw !== 'object') return null;
		const code = str((raw as Record<string, unknown>).code);
		if (!code) return null;
		out.push({ code, title: str((raw as Record<string, unknown>).title) });
	}
	return out;
}

export const Route = createFileRoute('/api/tracking')({
	server: {
		handlers: {
			GET: ({ request }) => Response.json({ tracks: listTracks(callerKey(request)) }),

			POST: async ({ request }) => {
				const body = await readJson(request);
				if (!body) return fail(400, 'Request body must be a JSON object.');

				const kind = str(body.kind) as TrackKind | null;
				if (!kind || !TRACK_KINDS.includes(kind))
					return fail(400, `Unknown tracking kind. Expected one of: ${TRACK_KINDS.join(', ')}.`);
				// Storage already accepts every kind; only the detector is missing, so this
				// guard is the single line that relaxes when movie/search tracking lands.
				if (kind !== 'series')
					return fail(
						400,
						`Tracking a ${kind} is not implemented yet. Only series tracking works today.`
					);

				const payload = (body.payload ?? {}) as Record<string, unknown>;
				const service = str(payload.service);
				const titleId = str(payload.title_id);
				if (!service || !titleId)
					return fail(400, 'payload must carry a non-empty service and title_id.');

				if (body.preset != null && (typeof body.preset !== 'object' || Array.isArray(body.preset)))
					return fail(400, 'preset must be a JSON object.');

				const codes = seedCodes(body.codes);
				if (!codes) return fail(400, 'codes must be an array of strings or {code, title} objects.');

				const track = createTrack({
					kind,
					label: str(body.label) ?? titleId,
					payload: { service, title_id: titleId },
					preset: (body.preset ?? {}) as TrackPreset,
					codes,
					baseline: body.baseline === true,
					owner: callerKey(request)
				});
				// The boot call is a no-op on an empty database, so the first track ever added
				// would otherwise not be polled until the next restart. Idempotent.
				startPoller();
				// Recounted from storage rather than from `codes`, which may repeat a code.
				const items = getItems(track.id);
				return Response.json(
					{
						track: {
							...track,
							total: items.length,
							unseen: items.filter((i) => i.seen_at == null).length
						}
					},
					{ status: 201 }
				);
			}
		}
	}
});
