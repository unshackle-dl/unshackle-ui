import type { Title, Tracks } from './api/types';

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * The unshackle `wanted` episode selector, e.g. "S01E02". Returns null for
 * movies / anything without a season+episode number (whole-title download).
 */
export function wantedCode(t: Title): string | null {
	if (t.season == null || t.number == null) return null;
	return `S${pad2(t.season)}E${pad2(t.number)}`;
}

export function isEpisodic(titles: Title[]): boolean {
	return titles.some((t) => t.season != null && t.number != null);
}

// Order video dynamic ranges best-first for display.
const RANGE_RANK: Record<string, number> = { DV: 0, HDR10P: 1, HDR10: 2, HLG: 3, SDR: 4 };

export interface TrackSummary {
	heights: number[]; // distinct, desc
	ranges: string[]; // distinct, best-first
	vcodecs: string[];
	audioLangs: string[];
	audioCodecs: string[];
	atmos: boolean;
	subLangs: string[];
	counts: { video: number; audio: number; subtitles: number };
}

function distinct<T>(xs: T[]): T[] {
	return [...new Set(xs)];
}

export function summarize(tracks: Tracks): TrackSummary {
	const v = tracks.video ?? [];
	const a = tracks.audio ?? [];
	const s = tracks.subtitles ?? [];
	return {
		heights: distinct(v.map((t) => t.height)).sort((x, y) => y - x),
		ranges: distinct(v.map((t) => t.range)).sort(
			(x, y) => (RANGE_RANK[x] ?? 9) - (RANGE_RANK[y] ?? 9)
		),
		vcodecs: distinct(v.map((t) => t.codec_display || t.codec)),
		audioLangs: distinct(a.map((t) => t.language ?? '').filter(Boolean)).sort(),
		audioCodecs: distinct(a.map((t) => t.codec_display || t.codec)),
		atmos: a.some((t) => t.atmos),
		subLangs: distinct(s.map((t) => t.language ?? '').filter(Boolean)).sort(),
		counts: { video: v.length, audio: a.length, subtitles: s.length }
	};
}
