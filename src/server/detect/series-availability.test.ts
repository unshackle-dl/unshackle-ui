import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import type { Title, TitleAvailability } from '$lib/api/types';
import type { TrackRecord } from '$lib/tracking/types';
import * as db from '../db';
import * as upstream from '../upstream';
import { detectSeries } from './series';

const episode = (number: number, availability?: TitleAvailability): Title => ({
	type: 'episode',
	id: `example-${number}`,
	name: `Episode ${number}`,
	season: 1,
	number,
	language: null,
	description: null,
	date: null,
	cover_url: null,
	year: null,
	availability
});
const track: TrackRecord = {
	id: 'example-track',
	kind: 'series',
	payload: { service: 'EXAMPLE', title_id: 'example-series' },
	preset: {},
	label: 'Example',
	state: 'active',
	added_at: '2026-01-01T00:00:00.000Z',
	last_checked: null,
	last_error: null,
	interval_ms: null
};

afterEach(() => vi.restoreAllMocks());

function listing(titles: Title[], stored: db.ItemState[] = []) {
	vi.spyOn(upstream, 'listTitles').mockResolvedValue(titles);
	vi.spyOn(db, 'itemStates').mockReturnValue(stored);
	return vi.spyOn(db, 'applyDetection').mockImplementation(() => {});
}

test('only explicit denial is withheld; paid, unknown and older API listings remain eligible', async () => {
	const save = listing([
		episode(1, { paid: true, access: 'denied' }),
		episode(2, { paid: true, access: 'granted' }),
		episode(3, { paid: true, access: 'unknown' }),
		episode(4)
	]);
	const result = await detectSeries(track);
	assert.equal(result.listed, 4);
	assert.deepEqual(result.added, ['S01E02', 'S01E03', 'S01E04']);
	assert.deepEqual(
		save.mock.calls[0][1].added.map((row) => row.code),
		result.added
	);
	assert.equal(vi.mocked(upstream.listTitles).mock.calls.length, 1);
});

test('conflicting duplicate denial wins in both listing orders', async () => {
	for (const titles of [
		[episode(1), episode(1, { access: 'denied' })],
		[episode(1, { access: 'denied' }), episode(1)]
	]) {
		vi.restoreAllMocks();
		const save = listing(titles);
		assert.deepEqual(await detectSeries(track), {
			listed: 1,
			added: [],
			returned: [],
			vanished: []
		});
		assert.equal(save.mock.calls.length, 0);
	}
});

test('an entirely denied catalogue is valid and leaves stored episode state untouched', async () => {
	const save = listing(
		[episode(1, { access: 'denied' })],
		[{ code: 'S01E01', seen_at: null, gone_at: null }]
	);
	assert.deepEqual(await detectSeries(track), { listed: 1, added: [], returned: [], vanished: [] });
	assert.equal(save.mock.calls.length, 0);
});

test('a truly empty catalogue still preserves existing rows with an error', async () => {
	const save = listing([], [{ code: 'S01E01', seen_at: null, gone_at: null }]);
	await assert.rejects(detectSeries(track), /Listing returned no episodes/);
	assert.equal(save.mock.calls.length, 0);
});
