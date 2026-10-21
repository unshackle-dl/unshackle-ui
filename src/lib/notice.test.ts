import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseNotice } from './notice.ts';

test('parseNotice picks the link and pair code out of a DSNP login notice', () => {
	const n = parseNotice(
		'+ Device register successful\n+ Attempting to device pair code login...\n+ Open URL: https://disneyplus.com/start  + Enter pair code: 1115-3411'
	);
	assert.equal(n.url, 'https://disneyplus.com/start');
	assert.equal(n.code, '1115-3411');
	assert.deepEqual(n.steps, [
		'Device register successful',
		'Attempting to device pair code login...',
		'Open URL: https://disneyplus.com/start',
		'Enter pair code: 1115-3411'
	]);
});

test('parseNotice leaves out what a notice does not carry', () => {
	assert.deepEqual(parseNotice('Approve the sign-in on your TV'), {
		url: undefined,
		code: undefined,
		steps: ['Approve the sign-in on your TV']
	});
});
