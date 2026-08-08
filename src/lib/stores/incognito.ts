import { useMemo } from 'react';
import { browser, effect, useStore, writable } from '$lib/store';

export const incognito = writable<boolean>(
	browser && localStorage.getItem('unshackle.incognito') === '1',
	false
);

if (browser) {
	effect(incognito, (on) => {
		localStorage.setItem('unshackle.incognito', on ? '1' : '0');
		// The class drives the CSS that dots out free-text inputs, whose values can't be swapped.
		document.documentElement.classList.toggle('incognito', on);
	});
}

export function toggleIncognito() {
	incognito.update((v) => !v);
}

const FAKE_SERVICES = ['INTC', 'VNN', 'ATN', 'UBA', 'OCHO', 'KBBL', 'U62', 'WKRP', 'KBLT', 'HOOL'];
const FAKE_TITLES = [
	'Gold Case',
	'Dealbreakers',
	'Queen of Jordan',
	'Philbert',
	"Horsin' Around",
	"Mr. Peanutbutter's House",
	'Inspector Spacetime',
	'Invitation to Love',
	'Sick Sad World',
	'Tool Time',
	'Wormhole X-Treme!',
	'Mock Trial with J. Reinhold',
	'Rochelle, Rochelle',
	'Prognosis Negative',
	'Sack Lunch',
	'Crime Scene: Scene of the Crime',
	'Ball Fondlers',
	'Personal Space',
	'Two Brothers',
	'Dawn of the Seven',
	'Kalispitron: Hibernation',
	'Lust Conquers All'
];

const FAKE_PROFILES = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace', 'heidi'];

function hash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
	return Math.abs(h);
}
const pick = (list: string[], s: string) => list[hash(s) % list.length];

type Maskable = string | null | undefined;

// Deterministic fake-data mappers: the same real value always shows the same fake value,
// so a service looks identical in its filter chip and in every row.
export function maskers(on: boolean) {
	return {
		service: (s: Maskable) => (on && s ? pick(FAKE_SERVICES, s) : (s ?? '')),
		title: (s: Maskable) => (on && s ? pick(FAKE_TITLES, s) : (s ?? '')),
		id: (s: Maskable) => (on && s ? `id-${hash(s).toString(36)}` : (s ?? '')),
		profile: (s: Maskable) => (on && s ? pick(FAKE_PROFILES, s) : (s ?? '')),
		// Arbitrary free text (descriptions, error output) can't be faked convincingly, so hide it.
		text: (s: Maskable) => (on && s ? '(hidden by incognito)' : (s ?? ''))
	};
}

export type Mask = ReturnType<typeof maskers>;

export const useIncognito = () => useStore(incognito);

export function useMask(): Mask {
	const on = useIncognito();
	return useMemo(() => maskers(on), [on]);
}
