import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Field } from '../options.ts';
import { applyPreset, buildListParams, buildPreset, LIST_AFFECTING_KEYS } from './preset.ts';

const svcFields: Field[] = [
	{ key: 'is_movie', type: 'bool', label: 'movie' },
	{ key: 'region', type: 'text', label: 'region' },
	{ key: 'extras', type: 'csv', label: 'extras' }
];

const payload = { service: 'VIKI', title_id: '41504c' };

test('buildListParams keeps transport options and service cli params', () => {
	const params = buildListParams(payload, {
		profile: 'main',
		proxy: 'jp',
		no_proxy: true,
		is_movie: true,
		region: 'JP'
	});
	assert.deepEqual(params, {
		profile: 'main',
		proxy: 'jp',
		no_proxy: true,
		is_movie: true,
		region: 'JP',
		service: 'VIKI',
		title_id: '41504c'
	});
});

test('buildListParams drops track-level options that cannot change the episode list', () => {
	const params = buildListParams(payload, { quality: [1080], vcodec: ['H.265'], no_mux: true });
	assert.deepEqual(Object.keys(params).sort(), ['service', 'title_id']);
});

test('buildListParams drops the keys that are inert during detection', () => {
	// Listing never runs apply_tvdb_order or the enrich step, so these would be noise.
	const params = buildListParams(payload, {
		tvdb_order: 'dvd',
		tvdb_id: 1234,
		tmdb_id: 99,
		animeapi_id: 'mal:1',
		enrich: true
	});
	assert.deepEqual(Object.keys(params).sort(), ['service', 'title_id']);
});

test('buildListParams cannot be overridden out of its own title', () => {
	const params = buildListParams(payload, { service: 'AMZN', title_id: 'other' });
	assert.equal(params.service, 'VIKI');
	assert.equal(params.title_id, '41504c');
});

test('LIST_AFFECTING_KEYS is the transport whitelist', () => {
	assert.deepEqual([...LIST_AFFECTING_KEYS], ['profile', 'proxy', 'no_proxy', 'cdm_type']);
});

test('buildPreset coerces both field sets and drops latest_episode', () => {
	const preset = buildPreset(
		{
			advanced: { profile: 'main', latest_episode: true, quality: '', no_mux: true },
			svcValues: { is_movie: true, region: ' JP ', extras: 'a, b' },
			extra: { tvdb_order: 'dvd' }
		},
		svcFields
	);
	assert.deepEqual(preset, {
		tvdb_order: 'dvd',
		profile: 'main',
		no_mux: true,
		is_movie: true,
		region: 'JP',
		extras: ['a', 'b']
	});
});

test('applyPreset routes each key to its own control and keeps the orphans', () => {
	const form = applyPreset(
		{ profile: 'main', region: 'JP', extras: ['a', 'b'], is_movie: true, tvdb_order: 'dvd' },
		svcFields
	);
	assert.equal(form.advanced.profile, 'main');
	assert.equal(form.svcValues.region, 'JP');
	assert.equal(form.svcValues.extras, 'a, b');
	assert.equal(form.svcValues.is_movie, true);
	assert.deepEqual(form.extra, { tvdb_order: 'dvd' });
	// Untouched fields sit at their defaults, so coercing back omits them.
	assert.equal(form.advanced.no_mux, false);
	assert.equal(form.advanced.workers, '');
});

test('applyPreset gives a service field priority over a catalog field of the same name', () => {
	const clash: Field[] = [{ key: 'profile', type: 'text', label: 'profile' }];
	const form = applyPreset({ profile: 'svc' }, clash);
	assert.equal(form.svcValues.profile, 'svc');
	assert.equal(form.advanced.profile, '');
});

test('a stored preset survives a form round trip', () => {
	const stored = {
		profile: 'main',
		proxy: 'jp',
		no_proxy: true,
		quality: [1080],
		vcodec: ['H.265'],
		workers: 4,
		slow: true,
		is_movie: true,
		region: 'JP',
		extras: ['a', 'b'],
		tvdb_order: 'dvd'
	};
	assert.deepEqual(buildPreset(applyPreset(stored, svcFields), svcFields), stored);
});

test('round trip of an empty preset stays empty', () => {
	assert.deepEqual(buildPreset(applyPreset({}, svcFields), svcFields), {});
});
