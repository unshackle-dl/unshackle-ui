import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { CliParam } from './api/types.ts';
import { blankValues, cliParamToField, coerce, serviceFields, type Field } from './options.ts';

const param = (over: Partial<CliParam>): CliParam => ({ name: 'x', kind: 'option', ...over });

test('cliParamToField maps kinds', () => {
	assert.equal(cliParamToField(param({ is_flag: true })).type, 'bool');
	assert.equal(cliParamToField(param({ multiple: true })).type, 'csv');
	assert.equal(cliParamToField(param({ choices: ['a', 'b'] })).type, 'choice');
	assert.equal(cliParamToField(param({ type: 'integer' })).type, 'int');
	assert.equal(cliParamToField(param({ type: 'float' })).type, 'num');
	assert.equal(cliParamToField(param({})).type, 'text');
});

test('cliParamToField label prefers the long --opt', () => {
	assert.equal(cliParamToField(param({ name: 'r', opts: ['-r', '--region'] })).label, 'region');
	assert.equal(cliParamToField(param({ name: 'region' })).label, 'region');
});

test('serviceFields drops non-option params', () => {
	const f = serviceFields([param({ name: 'a' }), param({ name: 'title', kind: 'argument' })]);
	assert.deepEqual(
		f.map((x) => x.key),
		['a']
	);
});

test('blankValues seeds each field at its default', () => {
	const fields: Field[] = [
		{ key: 'flag', type: 'bool', label: 'f', default: true },
		{ key: 'region', type: 'text', label: 'r', default: 'us' },
		{ key: 'n', type: 'int', label: 'n' }
	];
	assert.deepEqual(blankValues(fields), { flag: true, region: 'us', n: '' });
});

test('coerce emits only values that differ from their default', () => {
	const fields: Field[] = [
		{ key: 'flag', type: 'bool', label: 'f', default: true },
		{ key: 'other', type: 'bool', label: 'o' },
		{ key: 'region', type: 'text', label: 'r', default: 'us' },
		{ key: 'n', type: 'int', label: 'n' },
		{ key: 'langs', type: 'csv', label: 'l' }
	];
	// everything left at default → empty payload
	assert.deepEqual(coerce(fields, blankValues(fields)), {});
	// changed values get typed and emitted
	assert.deepEqual(
		coerce(fields, { flag: false, other: true, region: 'gb', n: '5', langs: 'en, es' }),
		{ flag: false, other: true, region: 'gb', n: 5, langs: ['en', 'es'] }
	);
});

test('coerce round-trips a real service param through the field adapter', () => {
	const fields = serviceFields([
		param({ name: 'bitrate', opts: ['--bitrate'], choices: ['CVBR', 'CBR'], default: 'CVBR' }),
		param({ name: 'atmos', opts: ['--atmos'], is_flag: true, default: false })
	]);
	const values = blankValues(fields);
	assert.deepEqual(coerce(fields, values), {}); // untouched → nothing sent
	values.bitrate = 'CBR';
	values.atmos = true;
	assert.deepEqual(coerce(fields, values), { bitrate: 'CBR', atmos: true });
});
