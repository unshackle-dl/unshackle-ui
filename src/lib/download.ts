import { blankValues, coerce, type Field } from './options';
import type { DownloadRequest } from './api/types';

// Advanced /api/download options beyond the primary chip selectors, grouped for authoring.

const GROUPS: { group: string; fields: Omit<Field, 'group'>[] }[] = [
	{
		group: 'Track scope',
		fields: [
			{ key: 'video_only', type: 'bool', label: 'Video only' },
			{ key: 'audio_only', type: 'bool', label: 'Audio only' },
			{ key: 'subs_only', type: 'bool', label: 'Subtitles only' },
			{ key: 'chapters_only', type: 'bool', label: 'Chapters only' },
			{ key: 'no_video', type: 'bool', label: 'No video' },
			{ key: 'no_audio', type: 'bool', label: 'No audio' },
			{ key: 'no_subs', type: 'bool', label: 'No subtitles' },
			{ key: 'no_chapters', type: 'bool', label: 'No chapters' }
		]
	},
	{
		group: 'Quality selection',
		fields: [
			{
				key: 'best_available',
				type: 'bool',
				label: 'Best available',
				help: 'Continue with best available if requested quality is unavailable'
			},
			{
				key: 'worst',
				type: 'bool',
				label: 'Worst',
				help: 'Lowest bitrate within the quality (needs quality)'
			},
			{ key: 'repack', type: 'bool', label: 'REPACK tag' },
			{ key: 'latest_episode', type: 'bool', label: 'Latest episode only' }
		]
	},
	{
		group: 'Video',
		fields: [{ key: 'vbitrate', type: 'int', label: 'Video bitrate (kbps)' }]
	},
	{
		group: 'Audio',
		fields: [
			{ key: 'acodec', type: 'csv', label: 'Audio codec', placeholder: 'AAC, EC3, AC3…' },
			{ key: 'abitrate', type: 'int', label: 'Audio bitrate (kbps)' },
			{ key: 'channels', type: 'num', label: 'Channels', placeholder: '2.0, 5.1, 7.1' },
			{ key: 'no_atmos', type: 'bool', label: 'Exclude Atmos' },
			{ key: 'audio_description', type: 'bool', label: 'Audio description' },
			{ key: 'split_audio', type: 'bool', label: 'Split audio per codec' }
		]
	},
	{
		group: 'Subtitles & languages',
		fields: [
			{ key: 'forced_subs', type: 'bool', label: 'Forced subtitles' },
			{ key: 'exact_lang', type: 'bool', label: 'Exact language match' },
			{ key: 'require_subs', type: 'csv', label: 'Require subtitle langs', placeholder: 'en, es…' },
			{ key: 'sub_format', type: 'text', label: 'Subtitle format', placeholder: 'SRT, VTT…' },
			{ key: 'lang', type: 'csv', label: 'Video+audio lang', placeholder: 'orig, en…' },
			{ key: 'v_lang', type: 'csv', label: 'Video lang' }
		]
	},
	{
		group: 'Output',
		fields: [
			{ key: 'profile', type: 'text', label: 'Profile' },
			{ key: 'tag', type: 'text', label: 'Group tag' },
			{ key: 'output_dir', type: 'text', label: 'Output directory' },
			{ key: 'no_folder', type: 'bool', label: 'No TV folder' },
			{ key: 'no_source', type: 'bool', label: 'No source tag' },
			{ key: 'no_mux', type: 'bool', label: 'No mux' }
		]
	},
	{
		group: 'Pipeline',
		fields: [
			{ key: 'workers', type: 'int', label: 'Workers per track' },
			{ key: 'downloads', type: 'int', label: 'Concurrent tracks' },
			{ key: 'slow', type: 'text', label: 'Slow delay', placeholder: 'true or 20-40' },
			{ key: 'skip_dl', type: 'bool', label: 'Keys only (skip download)' },
			{ key: 'export', type: 'bool', label: 'Export manifest JSON' },
			{ key: 'cdm_only', type: 'bool', label: 'CDM only for keys' },
			{ key: 'enrich', type: 'bool', label: 'Enrich title/year' }
		]
	},
	{
		group: 'Tagging IDs',
		fields: [
			{ key: 'tmdb_id', type: 'int', label: 'TMDB ID' },
			{ key: 'imdb_id', type: 'text', label: 'IMDB ID', placeholder: 'tt1375666' },
			{ key: 'animeapi_id', type: 'text', label: 'AnimeAPI ID', placeholder: 'mal:12345' }
		]
	},
	{
		group: 'Proxy',
		fields: [
			{ key: 'proxy', type: 'text', label: 'Proxy', placeholder: 'URI or country code' },
			{ key: 'no_proxy', type: 'bool', label: 'Disable proxy' },
			{ key: 'no_proxy_download', type: 'bool', label: 'Bypass proxy for segments' }
		]
	},
	{
		group: 'Cache',
		fields: [
			{ key: 'no_cache', type: 'bool', label: 'Bypass title cache' },
			{ key: 'reset_cache', type: 'bool', label: 'Reset title cache' }
		]
	}
];

export const ADVANCED_FIELDS: Field[] = GROUPS.flatMap((g) =>
	g.fields.map((f) => ({ ...f, group: g.group }))
);

export const blankAdvanced = (): Record<string, string | boolean> => blankValues(ADVANCED_FIELDS);

export const buildAdvanced = (values: Record<string, string | boolean>): Partial<DownloadRequest> =>
	coerce(ADVANCED_FIELDS, values);

export interface Selectors {
	wanted: string[]; // episode codes (epSel)
	quality: string[]; // height strings from combined.heights
	vcodec: string[];
	range: string[];
	a_lang: string[];
	s_lang: string[];
}

// Empty selection means omit the filter. Spread order (selectors, advanced, service) is last-wins.
export function buildDownloadRequest(
	base: { service: string; title_id: string },
	sel: Selectors,
	advancedValues: Record<string, string | boolean>,
	svcFields: Field[],
	svcValues: Record<string, string | boolean>
): DownloadRequest {
	return {
		...base,
		...(sel.wanted.length ? { wanted: sel.wanted } : {}),
		...(sel.quality.length ? { quality: sel.quality.map(Number) } : {}),
		...(sel.vcodec.length ? { vcodec: sel.vcodec } : {}),
		...(sel.range.length ? { range: sel.range } : {}),
		...(sel.a_lang.length ? { a_lang: sel.a_lang } : {}),
		...(sel.s_lang.length ? { s_lang: sel.s_lang } : {}),
		...buildAdvanced(advancedValues),
		...coerce(svcFields, svcValues)
	};
}

const PART_CODE = /^(.+)\.(\d+)$/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A part selects as "S01E01.2" but lands on disk as "S01E01.Part.2", in whichever
// separator the series template uses. Substring matching cannot work here: plain
// "S01E01.2" also matches "S01E01.2160p".
function outputMatcher(code: string): (upperFile: string) => boolean {
	const up = code.toUpperCase();
	const m = PART_CODE.exec(up);
	if (!m) return (f) => f.includes(up);
	const re = new RegExp(`${escapeRe(m[1])}[^0-9A-Z]*PART[^0-9A-Z]*${m[2]}(?![0-9])`);
	return (f) => re.test(f);
}

// An episode is done once its SxxEyy code appears in an output filename.
export function episodeProgress(
	wanted: string[] | undefined,
	outputFiles: string[] | undefined
): { wanted: string[]; done: Set<string>; current: string | null } | null {
	if (!wanted?.length) return null;
	const files = (outputFiles ?? []).map((f) => f.toUpperCase());
	const done = new Set(wanted.filter((c) => files.some(outputMatcher(c))));
	return { wanted, done, current: wanted.find((c) => !done.has(c)) ?? null };
}
