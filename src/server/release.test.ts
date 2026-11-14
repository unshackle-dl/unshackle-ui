import assert from 'node:assert/strict';
import { test } from 'vitest';
import { previousRelease } from './release';

test('returns the most recent weekly release window in UTC', () => {
	const before = Date.parse('2026-01-01T21:59:00Z');
	const at = Date.parse('2026-01-01T22:00:00Z');
	assert.equal(previousRelease(4, '22:00', 'UTC', before), Date.parse('2025-12-25T22:00:00Z'));
	assert.equal(previousRelease(4, '22:00', 'UTC', at), at);
});

test('uses the configured local timezone across a date boundary', () => {
	const now = Date.parse('2026-01-02T07:00:00Z');
	assert.equal(
		previousRelease(4, '22:00', 'America/Los_Angeles', now),
		Date.parse('2026-01-02T06:00:00Z')
	);
});

test('accounts for daylight-saving offset changes in the selected timezone', () => {
	const now = Date.parse('2026-03-13T07:30:00Z');
	assert.equal(
		previousRelease(4, '22:00', 'America/Los_Angeles', now),
		Date.parse('2026-03-13T05:00:00Z')
	);
});
