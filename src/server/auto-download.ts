import { relayFields } from '$lib/api/relay';
import type { TrackRecord } from '$lib/tracking/types';

/** Build a unique batch from pending submissions and every item still marked new. */
export function autoDownloadCodes(
	pending: readonly string[],
	detected: readonly string[],
	unseen: readonly string[]
): string[] {
	return [...new Set([...pending, ...detected, ...unseen])];
}

export function buildAutoDownloadRequest(
	track: Extract<TrackRecord, { kind: 'series' }>,
	codes: string[]
): Record<string, unknown> {
	const preset = { ...track.preset };
	delete preset.tvdb_id;
	delete preset.tvdb_order;
	return {
		...preset,
		service: track.payload.service,
		title_id: track.payload.title_id,
		...relayFields(track.payload.remote),
		wanted: codes
	};
}
