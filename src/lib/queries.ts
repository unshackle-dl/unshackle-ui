import { queryOptions } from '@tanstack/react-query';
import { api } from './api/client';

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
