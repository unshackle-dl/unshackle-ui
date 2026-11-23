import type { Title } from './api/types';
import { wantedCode } from './tracks';

/** Stable wanted codes are the selection unit, including specials and episode parts. */
export function episodeGroups(titles: Title[]) {
	const unique = new Map<string, Title>();
	for (const title of titles) {
		const code = wantedCode(title);
		if (code !== null && !unique.has(code)) unique.set(code, title);
	}
	const seasons = new Map<number, Title[]>();
	for (const title of unique.values()) {
		const season = title.season!;
		const group = seasons.get(season) ?? [];
		group.push(title);
		seasons.set(season, group);
	}
	return [...seasons]
		.sort(([a], [b]) => b - a)
		.map(([season, episodes]) => ({
			season,
			episodes: episodes.sort((a, b) => a.number! - b.number! || (a.part ?? 0) - (b.part ?? 0))
		}));
}

export function toggleEpisodeGroup(selected: string[], codes: string[]): string[] {
	const picked = new Set(selected);
	return codes.length > 0 && codes.every((code) => picked.has(code))
		? [...picked].filter((code) => !codes.includes(code))
		: [...new Set([...selected, ...codes])];
}
