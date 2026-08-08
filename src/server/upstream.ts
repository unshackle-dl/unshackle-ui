// The server's own unshackle REST client.
//
// A deliberate duplication of src/lib/api/client.ts, NOT a refactor of it: that module
// resolves its base URL through $lib/config → $lib/store, which is React and localStorage,
// and pulling it in here would drag both into the server bundle. Genuinely different
// config source (process.env, see ./config), genuinely different module. The response
// *types* are shared, because those are the same wire format.
//
// Only what the poller needs lives here — list-titles for detection, history for the
// download→seen correlation. Resist growing it into a second full client.
import type { HistoryResponse, Title } from '$lib/api/types';
import { config } from './config';

export class UpstreamError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
		this.name = 'UpstreamError';
	}
}

/**
 * Turn a thrown value into a string fit for a record's `last_error`. The message alone,
 * without the "Error: " prefix String() adds — this text is shown to the user as-is.
 */
export function upstreamMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...((init?.headers as Record<string, string>) ?? {})
	};
	if (config.apiKey) headers['X-Secret-Key'] = config.apiKey;

	let res: Response;
	try {
		res = await fetch(`${config.apiUrl}${path}`, { ...init, headers });
	} catch {
		// Mirrors the browser client's status-0 case, but points at the env var rather
		// than the Settings page — the server never reads the browser's settings.
		throw new UpstreamError(
			0,
			`Cannot reach the API at ${config.apiUrl}. Check UNSHACKLE_API_URL.`
		);
	}

	if (!res.ok) {
		let message = `${res.status} ${res.statusText}`;
		try {
			const body = await res.json();
			message = body?.error || body?.message || message;
		} catch {
			/* non-JSON error body */
		}
		throw new UpstreamError(res.status, message);
	}

	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

/**
 * Live episode listing. `/api/list-titles` calls `get_titles()` straight through with no
 * cache layer, so every call is fresh — `no_cache` is a no-op on this path and is not sent.
 *
 * Any key beyond service/title_id is forwarded to the service when it names one of that
 * service's cli options; see src/lib/tracking/preset.ts for which preset keys get here.
 */
export function listTitles(body: {
	service: string;
	title_id: string;
	[key: string]: unknown;
}): Promise<Title[]> {
	return request<{ titles: Title[] }>('/api/list-titles', {
		method: 'POST',
		body: JSON.stringify(body)
	}).then((r) => r.titles);
}

/** Completed downloads, used to auto-clear "new" once an episode has actually landed. */
export function history(query?: { limit?: number; service?: string }): Promise<HistoryResponse> {
	const params = new URLSearchParams();
	if (query?.limit != null) params.set('limit', String(query.limit));
	if (query?.service) params.set('service', query.service);
	const qs = params.toString();
	return request<HistoryResponse>(`/api/history${qs ? `?${qs}` : ''}`);
}
