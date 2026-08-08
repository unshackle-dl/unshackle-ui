import { browser, effect, useStore, writable } from '$lib/store';

export type Theme = 'light' | 'dark';

function initial(): Theme {
	if (!browser) return 'dark';
	const saved = localStorage.getItem('unshackle.theme');
	if (saved === 'light' || saved === 'dark') return saved;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable<Theme>(initial(), 'dark');

if (browser) {
	effect(theme, (t) => {
		localStorage.setItem('unshackle.theme', t);
		document.documentElement.classList.toggle('dark', t === 'dark');
	});
}

export function toggleTheme() {
	theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
}

export const useTheme = () => useStore(theme);
