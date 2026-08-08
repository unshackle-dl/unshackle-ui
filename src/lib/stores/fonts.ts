import { browser, effect, useStore, writable } from '$lib/store';

export interface Font {
	name: string;
	stack: string; // CSS font-family value applied to --font-sans / --font-mono
}

export const SANS_FONTS: Font[] = [
	{ name: 'DM Sans', stack: "'DM Sans', ui-sans-serif, system-ui, sans-serif" },
	{ name: 'Inter', stack: "'Inter', ui-sans-serif, system-ui, sans-serif" },
	{ name: 'IBM Plex Sans', stack: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif" }
];

export const MONO_FONTS: Font[] = [
	{ name: 'Geist Mono', stack: "'Geist Mono', ui-monospace, monospace" },
	{ name: 'JetBrains Mono', stack: "'JetBrains Mono', ui-monospace, monospace" },
	{ name: 'IBM Plex Mono', stack: "'IBM Plex Mono', ui-monospace, monospace" }
];

function initial(key: string, fallback: string): string {
	if (!browser) return fallback;
	return localStorage.getItem(key) || fallback;
}

export const sansFont = writable<string>(initial('unshackle.font.sans', 'DM Sans'), 'DM Sans');
export const monoFont = writable<string>(
	initial('unshackle.font.mono', 'Geist Mono'),
	'Geist Mono'
);

if (browser) {
	effect(sansFont, (name) => {
		localStorage.setItem('unshackle.font.sans', name);
		const f = SANS_FONTS.find((x) => x.name === name) ?? SANS_FONTS[0];
		document.documentElement.style.setProperty('--font-sans', f.stack);
	});

	effect(monoFont, (name) => {
		localStorage.setItem('unshackle.font.mono', name);
		const f = MONO_FONTS.find((x) => x.name === name) ?? MONO_FONTS[0];
		document.documentElement.style.setProperty('--font-mono', f.stack);
	});
}

export const useSansFont = () => useStore(sansFont);
export const useMonoFont = () => useStore(monoFont);
