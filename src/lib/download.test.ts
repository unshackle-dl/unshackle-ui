import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ADVANCED_FIELDS, blankAdvanced, buildAdvanced, episodeProgress } from './download.ts';

// Keys the backend honors (DEFAULT_DOWNLOAD_PARAMS in unshackle/core/api/handlers.py),
// minus the primary selectors (quality/range/wanted/a_lang/s_lang/bitrate ranges) the page handles.
const BACKEND_HONORED = new Set([
	'profile',
	'vcodec',
	'acodec',
	'vbitrate',
	'abitrate',
	'channels',
	'no_atmos',
	'latest_episode',
	'lang',
	'v_lang',
	'require_subs',
	'forced_subs',
	'exact_lang',
	'sub_format',
	'video_only',
	'audio_only',
	'subs_only',
	'chapters_only',
	'no_subs',
	'no_audio',
	'no_chapters',
	'no_video',
	'audio_description',
	'slow',
	'split_audio',
	'skip_dl',
	'export',
	'cdm_only',
	'proxy',
	'no_proxy',
	'no_proxy_download',
	'no_folder',
	'no_source',
	'no_mux',
	'workers',
	'downloads',
	'worst',
	'best_available',
	'repack',
	'tag',
	'tmdb_id',
	'imdb_id',
	'animeapi_id',
	'enrich',
	'output_dir',
	'no_cache',
	'reset_cache'
]);

test('every advanced field maps to a backend-honored download param', () => {
	const keys = ADVANCED_FIELDS.flatMap((g) => g.fields.map((f) => f.key));
	assert.deepEqual(
		keys.filter((k) => !BACKEND_HONORED.has(k)),
		[]
	);
	assert.equal(new Set(keys).size, keys.length); // no duplicate keys
});

test('blankAdvanced omits everything by default', () => {
	assert.deepEqual(buildAdvanced(blankAdvanced()), {});
});

test('buildAdvanced coerces types and drops empties', () => {
	const v = blankAdvanced();
	v.video_only = true;
	v.no_atmos = false; // stays off → omitted
	v.vbitrate = '8000';
	v.channels = '5.1';
	v.lang = 'orig, en';
	v.require_subs = ' en , es ';
	v.tag = 'GROUP';
	v.output_dir = '   '; // whitespace → omitted
	v.slow = 'true';

	assert.deepEqual(buildAdvanced(v), {
		video_only: true,
		vbitrate: 8000,
		channels: 5.1,
		lang: ['orig', 'en'],
		require_subs: ['en', 'es'],
		tag: 'GROUP',
		slow: true
	});
});

test('buildAdvanced keeps slow range strings', () => {
	const v = blankAdvanced();
	v.slow = '20-40';
	assert.deepEqual(buildAdvanced(v), { slow: '20-40' });
});

test('buildAdvanced ignores non-numeric numbers', () => {
	const v = blankAdvanced();
	v.workers = 'abc';
	assert.deepEqual(buildAdvanced(v), {});
});

test('episodeProgress marks done episodes from output files', () => {
	const p = episodeProgress(
		['S01E01', 'S01E02', 'S01E03'],
		['/dl/Show.S01E01.1080p.mkv', '/dl/Show.s01e02.1080p.mkv']
	);
	assert.ok(p);
	assert.deepEqual([...p.done], ['S01E01', 'S01E02']);
	assert.equal(p.current, 'S01E03');
});

test('episodeProgress handles no wanted list and full completion', () => {
	assert.equal(episodeProgress(undefined, ['a.mkv']), null);
	assert.equal(episodeProgress([], []), null);
	const p = episodeProgress(['S01E01'], ['Show.S01E01.mkv']);
	assert.equal(p?.current, null);
});
