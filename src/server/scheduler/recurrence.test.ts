import assert from 'node:assert/strict';
import { test } from 'vitest';
import { nextWeeklyRun } from './recurrence.ts';

test('calculates the next local weekday run down to the second', () => {
	const after = Date.parse('2026-10-20T21:59:59-03:00');
	const next = nextWeeklyRun({ daysOfWeek: [2], time: '22:00:00' }, 'America/Sao_Paulo', after);

	assert.equal(new Date(next).toISOString(), '2026-10-21T01:00:00.000Z');
});

test('selects the nearest day when multiple weekdays are configured', () => {
	const after = Date.parse('2026-10-20T22:00:00-03:00');
	const next = nextWeeklyRun({ daysOfWeek: [2, 4], time: '22:00:00' }, 'America/Sao_Paulo', after);

	assert.equal(new Date(next).toISOString(), '2026-10-23T01:00:00.000Z');
});

test('keeps weekly local time across daylight-saving offset changes', () => {
	const after = Date.parse('2026-03-07T20:00:00-05:00');
	const next = nextWeeklyRun({ daysOfWeek: [0], time: '22:00:00' }, 'America/New_York', after);

	assert.equal(new Date(next).toISOString(), '2026-03-09T02:00:00.000Z');
});
