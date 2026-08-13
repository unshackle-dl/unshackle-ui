// Browser client for the UI's own JustWatch proxy routes (/api/browse/*). Same-origin
// like $lib/tracking/client, whose request helper (and error type) it reuses.
import { request } from '$lib/tracking/client';
import type { BrowseSearchResponse, PopularResponse, TitleDetailResponse } from './types';

export const browse = {
	popular: (country: string) =>
		request<PopularResponse>(`/api/browse/popular?country=${encodeURIComponent(country)}`),

	popularList: (type: 'movies' | 'tv', country: string) =>
		request<BrowseSearchResponse>(
			`/api/browse/popular/${type}?country=${encodeURIComponent(country)}`
		),

	search: (q: string, country: string) =>
		request<BrowseSearchResponse>(
			`/api/browse/search?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}`
		),

	title: (id: string, country: string) =>
		request<TitleDetailResponse>(
			`/api/browse/title/${encodeURIComponent(id)}?country=${encodeURIComponent(country)}`
		)
};
