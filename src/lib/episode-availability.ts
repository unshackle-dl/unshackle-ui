import type { Title } from './api/types';
import { wantedCode } from './tracks';

/** Paid does not mean denied; older APIs and unknown access remain selectable. */
export function canSelectTitle(title: Title): boolean {
	return title.availability?.access !== 'denied';
}

/** One row per wanted code. Conflicting duplicate access is treated conservatively. */
export function uniqueEpisodeTitles(titles: Title[]): Title[] {
	const episodes = new Map<string, Title>();
	for (const title of titles) {
		const code = wantedCode(title);
		if (code !== null && (!episodes.has(code) || !canSelectTitle(title))) episodes.set(code, title);
	}
	return [...episodes.values()];
}

export function selectableEpisodeCodes(titles: Title[]): string[] {
	return uniqueEpisodeTitles(titles)
		.filter(canSelectTitle)
		.map((t) => wantedCode(t)!);
}

/** Intersect with the fresh listing so stale or denied choices cannot reach a batch. */
export function accessibleSelection(selected: string[], titles: Title[]): string[] {
	const allowed = new Set(selectableEpisodeCodes(titles));
	return [...new Set(selected)].filter((code) => allowed.has(code));
}

/** Availability changes require review; never silently submit only part of a batch. */
export function confirmedSelection(selected: string[], titles: Title[]): string[] {
	const current = selected.length
		? accessibleSelection(selected, titles)
		: selectableEpisodeCodes(titles);
	if (!current.length) throw new Error('Select at least one accessible episode.');
	if (selected.length && current.length !== new Set(selected).size)
		throw new Error('Episode availability changed. Review the updated selection and start again.');
	return current;
}
