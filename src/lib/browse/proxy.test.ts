import assert from 'node:assert/strict';
import { test } from 'vitest';
import { proxySearch } from './proxy.ts';

test('proxySearch: auto proxies only geofenced services, in the browse country', () => {
	assert.deepEqual(proxySearch('', 'US', true), { proxy: 'us' });
	assert.deepEqual(proxySearch('  ', 'US', false), {});
});

test('proxySearch: an explicit choice applies to every service', () => {
	assert.deepEqual(proxySearch('nordvpn:gb', 'US', false), { proxy: 'nordvpn:gb' });
	assert.deepEqual(proxySearch(' ca ', 'US', true), { proxy: 'ca' });
	assert.deepEqual(proxySearch('None', 'US', true), { no_proxy: true });
});
