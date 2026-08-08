import { getSettings } from '$lib/config';
import { browser } from '$lib/store';
import type {
	ClearFinishedResponse,
	ConfigResponse,
	DownloadJobRef,
	DownloadRequest,
	EnvCheckResponse,
	Health,
	HistoryResponse,
	Job,
	MaintenanceClearResponse,
	PriorityResponse,
	ProfilesResponse,
	RefreshServicesResponse,
	SearchResponse,
	Service,
	Title,
	Tracks
} from './types';

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

// Turn a thrown value into a user-facing string.
export function errorMessage(e: unknown): string {
	return e instanceof ApiError ? e.message : String(e);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	// The base URL and key come from Settings, which lives in localStorage. On the server
	// getSettings() can only see the build-time PUBLIC_UNSHACKLE_* defaults, so a loader
	// that runs during SSR talks to a different API than the user configured, usually
	// answering `unauthorized`. Any route that reaches this from a loader or beforeLoad
	// must therefore opt out of SSR with `ssr: false`, the way /title/$service/$id does.
	if (!browser)
		throw new ApiError(
			0,
			'The unshackle API is browser-only: its URL and key come from Settings. Mark this route `ssr: false`.'
		);

	const { apiUrl, apiKey } = getSettings();
	const base = apiUrl.replace(/\/+$/, '');
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...((init?.headers as Record<string, string>) ?? {})
	};
	if (apiKey) headers['X-Secret-Key'] = apiKey;

	let res: Response;
	try {
		res = await fetch(`${base}${path}`, { ...init, headers });
	} catch {
		throw new ApiError(0, `Cannot reach the API at ${base}. Check the base URL in Settings.`);
	}

	if (!res.ok) {
		let message = `${res.status} ${res.statusText}`;
		try {
			const body = await res.json();
			message = body?.error || body?.message || message;
		} catch {
			/* non-JSON error body */
		}
		throw new ApiError(res.status, message);
	}

	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
	return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export const api = {
	health: () => request<Health>('/api/health'),

	services: () => request<{ services: Service[] }>('/api/services').then((r) => r.services),

	search: (body: {
		service: string;
		query: string;
		profile?: string;
		proxy?: string;
		no_proxy?: boolean;
	}) => post<SearchResponse>('/api/search', body),

	// Any key beyond the transport ones below is forwarded to the service when it names one
	// of that service's cli options (DSNP `extras`, VIKI `is_movie`, …). Many services read
	// one in get_titles(), so omitting them makes the listed titles disagree with what a
	// download resolves. tvdb_id / tvdb_order ride along the same way.
	listTitles: (body: {
		service: string;
		title_id: string;
		profile?: string;
		proxy?: string;
		no_proxy?: boolean;
		[key: string]: unknown;
	}) => post<{ titles: Title[] }>('/api/list-titles', body).then((r) => r.titles),

	listTracks: (body: {
		service: string;
		title_id: string;
		wanted?: string;
		profile?: string;
		proxy?: string;
		no_proxy?: boolean;
		[key: string]: unknown;
	}) => post<Tracks>('/api/list-tracks', body),

	download: (body: DownloadRequest) => post<DownloadJobRef>('/api/download', body),

	jobs: (query?: {
		status?: string;
		service?: string;
		sort_by?: string;
		sort_order?: string;
		full?: boolean;
	}) => {
		const { full, ...rest } = query ?? {};
		const params = new URLSearchParams(
			Object.entries({ ...rest, ...(full ? { full: 'true' } : {}) }).filter(([, v]) => v) as [
				string,
				string
			][]
		).toString();
		return request<{ jobs: Job[] }>(`/api/download/jobs${params ? `?${params}` : ''}`).then(
			(r) => r.jobs
		);
	},

	job: (id: string) => request<Job>(`/api/download/jobs/${encodeURIComponent(id)}`),

	// Cancels queued/downloading jobs (200) or removes terminal ones (204).
	cancelJob: (id: string) =>
		request<void>(`/api/download/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }),

	retryJob: (id: string) =>
		post<DownloadJobRef>(`/api/download/jobs/${encodeURIComponent(id)}/retry`, undefined),

	prioritizeJob: (id: string) =>
		post<PriorityResponse>(`/api/download/jobs/${encodeURIComponent(id)}/priority`, undefined),

	clearFinishedJobs: () =>
		post<ClearFinishedResponse>('/api/download/jobs/clear-finished', undefined),

	profiles: () => request<ProfilesResponse>('/api/profiles').then((r) => r.profiles),

	config: () => request<ConfigResponse>('/api/config').then((r) => r.config),

	history: (query?: { limit?: number; service?: string }) => {
		const params = new URLSearchParams();
		if (query?.limit != null) params.set('limit', String(query.limit));
		if (query?.service) params.set('service', query.service);
		const qs = params.toString();
		return request<HistoryResponse>(`/api/history${qs ? `?${qs}` : ''}`);
	},

	deleteHistory: (id: string) =>
		request<void>(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' }),

	clearCache: () => post<MaintenanceClearResponse>('/api/maintenance/clear-cache', undefined),

	clearTemp: () => post<MaintenanceClearResponse>('/api/maintenance/clear-temp', undefined),

	refreshServices: () =>
		post<RefreshServicesResponse>('/api/maintenance/refresh-services', undefined),

	envCheck: () => request<EnvCheckResponse>('/api/env/check').then((r) => r.checks)
};
