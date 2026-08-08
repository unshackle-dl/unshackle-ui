import { browser, effect, useStore, writable } from '$lib/store';

export interface Settings {
	apiUrl: string;
	apiKey: string;
}

const KEY = 'unshackle.settings';

const defaults: Settings = {
	apiUrl: import.meta.env.PUBLIC_UNSHACKLE_API_URL || 'http://localhost:8786',
	apiKey: import.meta.env.PUBLIC_UNSHACKLE_API_KEY || ''
};

function load(): Settings {
	if (!browser) return defaults;
	try {
		return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
	} catch {
		return defaults;
	}
}

export const settings = writable<Settings>(load(), defaults);

if (browser) {
	effect(settings, (v) => localStorage.setItem(KEY, JSON.stringify(v)));
}

/** Non-reactive snapshot, used by the API client. */
export function getSettings(): Settings {
	return settings.get();
}

export const useSettings = () => useStore(settings);
