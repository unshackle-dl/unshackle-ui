import assert from 'node:assert/strict';
import { test } from 'vitest';
import { autoDownloadCodes } from './auto-download';

test('includes seeded unseen episodes as well as newly detected ones', () => {
	assert.deepEqual(autoDownloadCodes([], ['S02E01'], ['S01E07', 'S01E08']), [
		'S02E01',
		'S01E07',
		'S01E08'
	]);
});

test('retries pending episodes and removes duplicate codes', () => {
	assert.deepEqual(autoDownloadCodes(['S02E01'], ['S02E01'], ['S02E01', 'S02E02']), [
		'S02E01',
		'S02E02'
	]);
});
