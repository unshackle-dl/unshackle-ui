import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { get, writable } from 'svelte/store';

export interface Settings {
	apiUrl: string;
	apiKey: string;
}

const KEY = 'unshackle.settings';

const defaults: Settings = {
	apiUrl: env.PUBLIC_UNSHACKLE_API_URL || 'http://localhost:8786',
	apiKey: env.PUBLIC_UNSHACKLE_API_KEY || ''
};

function load(): Settings {
	if (!browser) return defaults;
	try {
		return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
	} catch {
		return defaults;
	}
}

export const settings = writable<Settings>(load());

if (browser) {
	settings.subscribe((v) => localStorage.setItem(KEY, JSON.stringify(v)));
}

/** Non-reactive snapshot, used by the API client. */
export function getSettings(): Settings {
	return get(settings);
}
