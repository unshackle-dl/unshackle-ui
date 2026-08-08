import { browser, effect, useStore, writable } from '$lib/store';

// Each accent is the 50..950 Tailwind scale, applied to --accent-* at runtime.
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export interface Accent {
	name: string;
	scale: string[]; // 11 values, light -> dark
}

export const ACCENTS: Accent[] = [
	{
		name: 'blue',
		scale: [
			'#eff6ff',
			'#dbeafe',
			'#bfdbfe',
			'#93c5fd',
			'#60a5fa',
			'#3b82f6',
			'#2563eb',
			'#1d4ed8',
			'#1e40af',
			'#1e3a8a',
			'#172554'
		]
	},
	{
		name: 'emerald',
		scale: [
			'#ecfdf5',
			'#d1fae5',
			'#a7f3d0',
			'#6ee7b7',
			'#34d399',
			'#10b981',
			'#059669',
			'#047857',
			'#065f46',
			'#064e3b',
			'#022c22'
		]
	},
	{
		name: 'violet',
		scale: [
			'#f5f3ff',
			'#ede9fe',
			'#ddd6fe',
			'#c4b5fd',
			'#a78bfa',
			'#8b5cf6',
			'#7c3aed',
			'#6d28d9',
			'#5b21b6',
			'#4c1d95',
			'#2e1065'
		]
	},
	{
		name: 'rose',
		scale: [
			'#fff1f2',
			'#ffe4e6',
			'#fecdd3',
			'#fda4af',
			'#fb7185',
			'#f43f5e',
			'#e11d48',
			'#be123c',
			'#9f1239',
			'#881337',
			'#4c0519'
		]
	},
	{
		name: 'amber',
		scale: [
			'#fffbeb',
			'#fef3c7',
			'#fde68a',
			'#fcd34d',
			'#fbbf24',
			'#f59e0b',
			'#d97706',
			'#b45309',
			'#92400e',
			'#78350f',
			'#451a03'
		]
	}
];

function initial(): string {
	if (!browser) return 'blue';
	return localStorage.getItem('unshackle.accent') || 'blue';
}

export const accent = writable<string>(initial(), 'blue');

function apply(name: string) {
	const a = ACCENTS.find((x) => x.name === name) ?? ACCENTS[0];
	const root = document.documentElement;
	SHADES.forEach((shade, i) => root.style.setProperty(`--accent-${shade}`, a.scale[i]));
}

if (browser) {
	effect(accent, (name) => {
		localStorage.setItem('unshackle.accent', name);
		apply(name);
	});
}

export const useAccent = () => useStore(accent);
