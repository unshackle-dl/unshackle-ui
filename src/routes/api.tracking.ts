import { createFileRoute } from '@tanstack/react-router';
import type { SeedCode, TrackKind, TrackPreset } from '$lib/tracking/types';
import { TRACK_KINDS } from '$lib/tracking/types';
import {
	createTrack,
	getItems,
	getTrack,
	listTracks,
	markTrackCodesDownloaded,
	setTrackRetry,
	stampChecked
} from '../server/db';
import { buildAutoDownloadRequest } from '../server/auto-download';
import { config } from '../server/config';
import { fail, readJson, str } from '../server/http';
import { callerKey } from '../server/owner';
import { startPoller } from '../server/poller';
import { download, upstreamMessage } from '../server/upstream';
import { isReleaseDay, isReleaseTime, isTimeZone } from '$lib/tracking/schedule';

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
				const remote = str(payload.remote);
				const releaseDay = body.release_day == null ? 4 : Number(body.release_day);
				const releaseTime = str(body.release_time) ?? '22:00';
				const timeZone = str(body.time_zone) ?? 'UTC';
				if (!service || !titleId)
					return fail(400, 'payload must carry a non-empty service and title_id.');
				if (!isReleaseDay(releaseDay))
					return fail(400, 'release_day must be a weekday from 0 (Sunday) to 6 (Saturday).');
				if (!isReleaseTime(releaseTime)) return fail(400, 'release_time must use HH:mm format.');
				if (!isTimeZone(timeZone)) return fail(400, 'time_zone must be a valid IANA time zone.');

				if (body.preset != null && (typeof body.preset !== 'object' || Array.isArray(body.preset)))
					return fail(400, 'preset must be a JSON object.');

				const codes = seedCodes(body.codes);
				if (!codes) return fail(400, 'codes must be an array of strings or {code, title} objects.');

				const track = createTrack({
					kind,
					label: str(body.label) ?? titleId,
					payload: { service, title_id: titleId, remote: remote ?? undefined },
					preset: (body.preset ?? {}) as TrackPreset,
					codes,
					baseline: body.baseline === true,
					owner: callerKey(request),
					releaseDay,
					releaseTime,
					timeZone
				});
				const items = getItems(track.id);
				const initialNewCodes = items
					.filter((item) => item.seen_at === null)
					.map((item) => item.code);
				if (track.kind === 'series' && initialNewCodes.length) {
					const attemptedAt = new Date().toISOString();
					setTrackRetry(track.id, true, 0, initialNewCodes);
					stampChecked(track.id, attemptedAt, null);
					if (config.apiUrlConfigured) {
						try {
							await download(buildAutoDownloadRequest(track, initialNewCodes));
							markTrackCodesDownloaded(track.id, initialNewCodes);
							setTrackRetry(track.id, false, 0, []);
							stampChecked(track.id, new Date().toISOString(), null);
						} catch (error) {
							const message = upstreamMessage(error);
							setTrackRetry(track.id, true, 1, initialNewCodes);
							stampChecked(track.id, new Date().toISOString(), message);
							console.warn(`[tracking] immediate download failed for ${track.id}: ${message}`);
						}
					} else {
						stampChecked(
							track.id,
							new Date().toISOString(),
							'Automatic download is pending: configure the tracking API URL.'
						);
					}
				}
				// Idempotent; adding the first track starts polling without a server restart.
				startPoller();
				const refreshedTrack = getTrack(track.id, callerKey(request)) ?? track;
				return Response.json(
					{
						track: {
							...refreshedTrack,
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
