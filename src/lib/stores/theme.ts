import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

function initial(): Theme {
	if (!browser) return 'dark';
	const saved = localStorage.getItem('unshackle.theme');
	if (saved === 'light' || saved === 'dark') return saved;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable<Theme>(initial());

if (browser) {
	theme.subscribe((t) => {
		localStorage.setItem('unshackle.theme', t);
		document.documentElement.classList.toggle('dark', t === 'dark');
	});
}

export function toggleTheme() {
	theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
}
