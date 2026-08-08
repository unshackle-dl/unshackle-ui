import { useSyncExternalStore } from 'react';

// ponytail: settings live in module-level singletons with localStorage side effects,
// which useSyncExternalStore covers directly, so there is no state library here.

export interface Store<T> {
	get(): T;
	set(v: T): void;
	update(fn: (v: T) => T): void;
	/** Notifies on change only. useSyncExternalStore calls getSnapshot for the value. */
	subscribe(onChange: () => void): () => void;
	server: T;
}

/**
 * `server` is the value the prerendered shell was built with. These stores read
 * localStorage at module init, before hydration, so by the time React hydrates
 * getSnapshot already returns the saved value while the shell on screen still shows
 * the default. Feeding React the server value for the hydration pass alone keeps the
 * trees agreeing; the real value lands on the re-render straight after.
 */
export function writable<T>(initial: T, server: T = initial): Store<T> {
	let value = initial;
	const subs = new Set<() => void>();
	return {
		server,
		get: () => value,
		set(v) {
			if (Object.is(v, value)) return;
			value = v;
			for (const fn of subs) fn();
		},
		update(fn) {
			this.set(fn(value));
		},
		subscribe(onChange) {
			subs.add(onChange);
			return () => {
				subs.delete(onChange);
			};
		}
	};
}

/** Runs fn with the current value now, and again on every change. */
export function effect<T>(store: Store<T>, fn: (v: T) => void): void {
	fn(store.get());
	store.subscribe(() => fn(store.get()));
}

export function useStore<T>(store: Store<T>): T {
	return useSyncExternalStore(store.subscribe, store.get, () => store.server);
}

export const browser = typeof window !== 'undefined';
