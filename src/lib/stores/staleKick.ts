// Whether the user has waved away the stale-rescan banner.
//
// Persisted rather than component state: the banner lives in the root layout and would
// otherwise reappear on every navigation, which is the definition of a nag. What is
// stored is the `last_sync` the dismissal applied to, not a bare flag — once a sweep
// actually completes, last_sync moves and the dismissal no longer matches, so the banner
// re-arms for the next time the server goes stale instead of being silenced forever.
import { browser, effect, useStore, writable } from '$lib/store';

const KEY = 'unshackle.tracking.staleDismissed';

/** Stand-in token for a server that has never swept, so `null` is still dismissible. */
const NEVER = 'never';

/** The dismissal token for a given `last_sync`. */
export const syncToken = (lastSync: string | null): string => lastSync ?? NEVER;

export const staleDismissed = writable<string | null>(
	browser ? localStorage.getItem(KEY) : null,
	null
);

if (browser) {
	effect(staleDismissed, (v) => {
		if (v === null) localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, v);
	});
}

export const useStaleDismissed = () => useStore(staleDismissed);

/** `token` comes from syncToken(status.last_sync). */
export const dismissStale = (token: string) => staleDismissed.set(token);
