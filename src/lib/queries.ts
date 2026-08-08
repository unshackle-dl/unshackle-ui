import { queryOptions } from '@tanstack/react-query';
import { browser } from './store';
import { api } from './api/client';
import { tracking } from './tracking/client';

// Both are read from more than one page, and neither changes during a session, so the
// long staleTime keeps a page switch from refetching them.

export const servicesQuery = queryOptions({
	queryKey: ['services'],
	queryFn: async () => (await api.services()).sort((a, b) => a.tag.localeCompare(b.tag)),
	staleTime: 5 * 60_000
});

export const profilesQuery = queryOptions({
	queryKey: ['profiles'],
	queryFn: () => api.profiles(),
	staleTime: 5 * 60_000
});

// The tracked list. Read by the sidebar badge on every page, so it is cached briefly, but
// not for minutes: a background poll can add unseen episodes at any moment.
export const tracksQuery = queryOptions({
	queryKey: ['tracking'],
	queryFn: () => tracking.list(),
	staleTime: 30_000
});

// Mounted app-wide (sidebar badge and stale banner), so it is the one tracking request a
// page load always makes. `enabled: browser` because __root renders on the server, and a
// fetch of a relative path there has no origin to resolve against.
export const statusQuery = queryOptions({
	queryKey: ['tracking', 'status'],
	queryFn: () => tracking.status(),
	enabled: browser,
	staleTime: 15_000
});

// Prefixed with the list's key on purpose: invalidating ['tracking'] refreshes both.
export const trackQuery = (id: string) =>
	queryOptions({
		queryKey: ['tracking', id],
		queryFn: () => tracking.get(id)
	});
