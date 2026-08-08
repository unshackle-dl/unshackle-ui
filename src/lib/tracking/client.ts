// Browser client for the UI's OWN tracking routes.
//
// Same-origin on purpose: /api/tracking* is served by this app's Node process, not by
// unshackle-live, so there is no base URL and no X-Secret-Key. Deliberately NOT routed
// through $lib/api/client, which prefixes getSettings().apiUrl and would send these
// requests to the external API instead.
import type { SeedCode, TrackItem, TrackPreset, TrackRecord, TrackSummary } from './types';

export class TrackingError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
		this.name = 'TrackingError';
	}
}

/** Turn a thrown value into a user-facing string, matching api/client's errorMessage. */
export function trackingErrorMessage(e: unknown): string {
	return e instanceof TrackingError ? e.message : String(e);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(path, {
			...init,
			headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
		});
	} catch {
		throw new TrackingError(0, 'Cannot reach this app’s server. Is it still running?');
	}

	if (!res.ok) {
		let message = `${res.status} ${res.statusText}`;
		try {
			const body = await res.json();
			message = body?.error || body?.message || message;
		} catch {
			/* non-JSON error body */
		}
		throw new TrackingError(res.status, message);
	}

	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

const post = <T>(path: string, body: unknown): Promise<T> =>
	request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

const id = (v: string) => encodeURIComponent(v);

export interface TrackDetail {
	track: TrackRecord;
	items: TrackItem[];
}

export interface AddTrackInput {
	label: string;
	payload: { service: string; title_id: string };
	preset: TrackPreset;
	codes: SeedCode[];
	/** true stamps the seeded codes as already seen, so only later arrivals are "new". */
	baseline: boolean;
}

export const tracking = {
	list: () => request<{ tracks: TrackSummary[] }>('/api/tracking').then((r) => r.tracks),

	get: (trackId: string) => request<TrackDetail>(`/api/tracking/${id(trackId)}`),

	// Only series exist today; the route rejects the other kinds.
	add: (input: AddTrackInput) =>
		post<{ track: TrackSummary }>('/api/tracking', { kind: 'series', ...input }).then(
			(r) => r.track
		),

	patch: (trackId: string, patch: { label?: string; preset?: TrackPreset; state?: string }) =>
		request<{ track: TrackRecord }>(`/api/tracking/${id(trackId)}`, {
			method: 'PATCH',
			body: JSON.stringify(patch)
		}).then((r) => r.track),

	remove: (trackId: string) => request<void>(`/api/tracking/${id(trackId)}`, { method: 'DELETE' }),

	/** `codes` omitted clears every unseen item on the track. */
	seen: (trackId: string, codes?: string[]) =>
		post<{ marked: number }>(`/api/tracking/${id(trackId)}/seen`, codes ? { codes } : {}).then(
			(r) => r.marked
		),

	seenAll: () => post<{ marked: number }>('/api/tracking/seen', {}).then((r) => r.marked),

	/** `trackId` omitted sweeps everything active. Returns as soon as the sweep is under way. */
	check: (trackId?: string) =>
		post<{ scan_id?: number; started?: boolean; running_since?: string }>(
			'/api/tracking/check',
			trackId ? { id: trackId } : {}
		)
};
