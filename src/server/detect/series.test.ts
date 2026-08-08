import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { ItemState } from '../db.ts';
import { diffCodes } from './series.ts';

// The stored side of the diff. Everything defaults to "listed and unseen".
const item = (code: string, over: Partial<ItemState> = {}): ItemState => ({
	code,
	seen_at: null,
	gone_at: null,
	...over
});

const seen = (code: string) => item(code, { seen_at: '2026-01-01T00:00:00.000Z' });
const gone = (code: string, over: Partial<ItemState> = {}) =>
	item(code, { gone_at: '2026-01-01T00:00:00.000Z', ...over });

test('a code with no stored row is new', () => {
	const d = diffCodes([item('S01E01')], ['S01E01', 'S01E02']);
	assert.deepEqual(d.added, ['S01E02']);
	assert.deepEqual(d.vanished, []);
	assert.deepEqual(d.returned, []);
	assert.equal(d.listed, 2);
});

test('nothing to report when the listing is unchanged', () => {
	const d = diffCodes([seen('S01E01'), item('S01E02')], ['S01E01', 'S01E02']);
	assert.deepEqual([d.added, d.returned, d.vanished], [[], [], []]);
});

test('a code that stops being listed is stamped gone, never removed', () => {
	const d = diffCodes([seen('S01E01'), seen('S01E02')], ['S01E01']);
	assert.deepEqual(d.vanished, ['S01E02']);
	// The row survives, so the whole point holds: it is not "added" next time either.
	assert.deepEqual(d.added, []);
});

test('an already-gone code is not stamped gone again', () => {
	const d = diffCodes([seen('S01E01'), gone('S01E02')], ['S01E01']);
	assert.deepEqual(d.vanished, []);
});

test('a gone code that returns is a return, not a new episode', () => {
	const d = diffCodes(
		[seen('S01E01'), gone('S01E02', { seen_at: '2026-01-02T00:00:00.000Z' })],
		['S01E01', 'S01E02']
	);
	assert.deepEqual(d.added, []);
	assert.deepEqual(d.returned, ['S01E02']);
});

test('a service dropping an episode and restoring it never re-flags it as new', () => {
	// The regression this whole design exists for, walked end to end.
	let stored = [seen('S01E01'), seen('S01E02')];
	const drop = diffCodes(stored, ['S01E01']);
	assert.deepEqual(drop.vanished, ['S01E02']);

	// Storage stamps gone_at and keeps seen_at — it never deletes.
	stored = [seen('S01E01'), gone('S01E02', { seen_at: '2026-01-01T00:00:00.000Z' })];
	const back = diffCodes(stored, ['S01E01', 'S01E02']);
	assert.deepEqual(back.added, []);
	assert.deepEqual(back.returned, ['S01E02']);
});

test('a gone code that returns while still unseen stays unseen and stays not-new', () => {
	const d = diffCodes([gone('S01E03')], ['S01E03']);
	assert.deepEqual(d.added, []);
	assert.deepEqual(d.returned, ['S01E03']);
});

test('split-episode parts diff as separate codes', () => {
	const d = diffCodes([seen('S01E01.1')], ['S01E01.1', 'S01E01.2']);
	assert.deepEqual(d.added, ['S01E01.2']);
	assert.deepEqual(d.vanished, []);

	// A whole episode replacing its parts: the parts go, the plain code arrives.
	const merged = diffCodes([seen('S01E01.1'), seen('S01E01.2')], ['S01E01']);
	assert.deepEqual(merged.added, ['S01E01']);
	assert.deepEqual(merged.vanished.sort(), ['S01E01.1', 'S01E01.2']);
});

test('a duplicated listing entry counts once', () => {
	const d = diffCodes([], ['S01E01', 'S01E01']);
	assert.deepEqual(d.added, ['S01E01']);
	assert.equal(d.listed, 1);
});

test('an empty listing stamps every stored code gone', () => {
	// diffCodes is honest about it; detectSeries is what refuses to act on this case,
	// because an empty listing is far more often a broken service than a pulled series.
	const d = diffCodes([item('S01E01'), item('S01E02')], []);
	assert.deepEqual(d.vanished, ['S01E01', 'S01E02']);
});
