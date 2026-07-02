import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Title, Tracks } from './api/types.ts';
import { summarize, wantedCode } from './tracks.ts';

const title = (over: Partial<Title>): Title => ({
	type: 'episode',
	name: 'x',
	id: 'x',
	language: 'en',
	description: null,
	date: null,
	cover_url: null,
	year: 2026,
	...over
});

test('wantedCode pads season + episode', () => {
	assert.equal(wantedCode(title({ season: 1, number: 2 })), 'S01E02');
	assert.equal(wantedCode(title({ season: 12, number: 134 })), 'S12E134');
});

test('wantedCode is null for movies', () => {
	assert.equal(wantedCode(title({ type: 'movie', season: null, number: null })), null);
});

test('summarize dedupes + orders ranges best-first, heights desc', () => {
	const tracks = {
		title: title({}),
		video: [
			{ height: 1080, range: 'SDR', codec: 'HEVC', codec_display: 'H.265' },
			{ height: 2160, range: 'DV', codec: 'HEVC', codec_display: 'H.265' },
			{ height: 2160, range: 'HDR10P', codec: 'HEVC', codec_display: 'H.265' },
			{ height: 1080, range: 'DV', codec: 'HEVC', codec_display: 'H.265' }
		],
		audio: [
			{ language: 'en', codec: 'EC3', codec_display: 'EC3', atmos: true },
			{ language: 'pt-BR', codec: 'AAC', codec_display: 'AAC', atmos: false }
		],
		subtitles: [{ language: 'ar' }, { language: 'en' }, { language: 'ar' }]
	} as unknown as Tracks;

	const s = summarize(tracks);
	assert.deepEqual(s.heights, [2160, 1080]);
	assert.deepEqual(s.ranges, ['DV', 'HDR10P', 'SDR']);
	assert.deepEqual(s.audioLangs, ['en', 'pt-BR']);
	assert.equal(s.atmos, true);
	assert.deepEqual(s.subLangs, ['ar', 'en']);
	assert.deepEqual(s.counts, { video: 4, audio: 2, subtitles: 3 });
});
