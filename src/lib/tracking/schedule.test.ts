import assert from 'node:assert/strict';
import { test } from 'vitest';
import { isReleaseDay, isReleaseTime, isTimeZone } from './schedule';

test('accepts weekday indexes from Sunday through Saturday', () => {
	for (const day of [0, 1, 2, 3, 4, 5, 6]) assert.equal(isReleaseDay(day), true);
	for (const day of [-1, 7, 1.5, '4', null]) assert.equal(isReleaseDay(day), false);
});

test('accepts 24-hour release times in HH:mm format', () => {
	for (const time of ['00:00', '09:05', '22:30', '23:59']) assert.equal(isReleaseTime(time), true);
	for (const time of ['24:00', '9:05', '12:60', 'noon', ''])
		assert.equal(isReleaseTime(time), false);
});

test('accepts valid IANA time zones and rejects invalid values', () => {
	assert.equal(isTimeZone('America/Recife'), true);
	assert.equal(isTimeZone('UTC'), true);
	assert.equal(isTimeZone('Not/AZone'), false);
	assert.equal(isTimeZone(''), false);
});
