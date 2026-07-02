import { api } from './api/client';

let cache: Promise<Record<string, string[]>> | null = null;

// Fetch /api/profiles once per page load; null signals failure (callers fall back to free text).
export function getProfiles(): Promise<Record<string, string[]> | null> {
	cache ??= api.profiles();
	return cache.catch(() => {
		cache = null;
		return null;
	});
}
