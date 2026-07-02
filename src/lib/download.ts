import type { CliParam, DownloadRequest } from './api/types';

// Catalog of the advanced /api/download options (everything beyond the primary
// quality/range/audio/subtitle/episode selectors handled by chips on the page).
// Types drive both the rendered control and the payload coercion in buildAdvanced.

export type FieldType = 'bool' | 'int' | 'num' | 'text' | 'csv';

export interface Field {
	key: string;
	type: FieldType;
	label: string;
	help?: string;
	placeholder?: string;
}

export interface FieldGroup {
	group: string;
	fields: Field[];
}

export const ADVANCED_FIELDS: FieldGroup[] = [
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

const TYPE_BY_KEY = new Map<string, FieldType>(
	ADVANCED_FIELDS.flatMap((g) => g.fields.map((f) => [f.key, f.type] as const))
);

export function blankAdvanced(): Record<string, string | boolean> {
	const v: Record<string, string | boolean> = {};
	for (const g of ADVANCED_FIELDS)
		for (const f of g.fields) v[f.key] = f.type === 'bool' ? false : '';
	return v;
}

/**
 * Coerce raw form values into a partial DownloadRequest, omitting anything left
 * at its default (false / empty) so the backend keeps its own defaults.
 */
export function buildAdvanced(values: Record<string, string | boolean>): Partial<DownloadRequest> {
	const out: Record<string, unknown> = {};
	for (const [key, raw] of Object.entries(values)) {
		const type = TYPE_BY_KEY.get(key);
		if (!type) continue;
		if (type === 'bool') {
			if (raw === true) out[key] = true;
		} else if (type === 'int' || type === 'num') {
			const s = String(raw).trim();
			if (s !== '' && !Number.isNaN(Number(s))) out[key] = Number(s);
		} else if (type === 'csv') {
			const arr = String(raw)
				.split(',')
				.map((x) => x.trim())
				.filter(Boolean);
			if (arr.length) out[key] = arr;
		} else {
			const s = String(raw).trim();
			if (s === '') continue;
			// `slow` accepts a boolean or a "MIN-MAX" string.
			if (key === 'slow' && (s === 'true' || s === 'false')) out[key] = s === 'true';
			else out[key] = s;
		}
	}
	return out;
}

// Service-specific options come from /api/services cli_params; only real options
// (not the title argument) are user-editable.
export function serviceOptions(params: CliParam[] | undefined): CliParam[] {
	return (params ?? []).filter((p) => p.kind === 'option');
}

const defaultString = (p: CliParam) =>
	p.default == null ? '' : Array.isArray(p.default) ? p.default.join(', ') : String(p.default);

/** Form state pre-filled with each option's default so the form shows it. */
export function blankServiceValues(params: CliParam[]): Record<string, string | boolean> {
	const v: Record<string, string | boolean> = {};
	for (const p of serviceOptions(params)) v[p.name] = p.is_flag ? p.default === true : defaultString(p);
	return v;
}

/**
 * Coerce service-option form values into request-body extras, omitting anything
 * still at its default so the service's own defaults apply server-side.
 */
export function buildServiceValues(
	params: CliParam[],
	values: Record<string, string | boolean>
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const p of serviceOptions(params)) {
		const raw = values[p.name];
		if (p.is_flag) {
			if (raw !== (p.default === true)) out[p.name] = raw === true;
			continue;
		}
		const s = String(raw ?? '').trim();
		if (s === '' || s === defaultString(p)) continue;
		if (p.multiple)
			out[p.name] = s
				.split(',')
				.map((x) => x.trim())
				.filter(Boolean);
		else if ((p.type === 'integer' || p.type === 'float') && !Number.isNaN(Number(s)))
			out[p.name] = Number(s);
		else out[p.name] = s;
	}
	return out;
}

// An episode is done once its SxxEyy code appears in an output filename.
export function episodeProgress(
	wanted: string[] | undefined,
	outputFiles: string[] | undefined
): { wanted: string[]; done: Set<string>; current: string | null } | null {
	if (!wanted?.length) return null;
	const files = (outputFiles ?? []).map((f) => f.toUpperCase());
	const done = new Set(wanted.filter((c) => files.some((f) => f.includes(c.toUpperCase()))));
	return { wanted, done, current: wanted.find((c) => !done.has(c)) ?? null };
}
