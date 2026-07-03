import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Job } from './api/types.ts';
import { isActive, isFinished, isRetryable, jobView, tone } from './job.ts';

const job = (over: Partial<Job>): Job => ({ job_id: 'j1', status: 'queued', ...over });

test('status predicates classify active vs terminal', () => {
	assert.ok(isActive('downloading'));
	assert.ok(isActive('MUXING')); // case-insensitive
	assert.ok(isFinished('completed'));
	assert.ok(isRetryable('failed'));
	assert.ok(isRetryable('cancelled'));
	assert.equal(isRetryable('completed'), false);
});

test('tone maps status to a colour bucket', () => {
	assert.equal(tone('completed'), 'green');
	assert.equal(tone('failed'), 'red');
	assert.equal(tone('cancelled'), 'neutral');
	assert.equal(tone('downloading'), 'accent');
	assert.equal(tone('weird-unknown'), 'amber');
});

test('jobView labels a running keys-only job "obtaining keys"', () => {
	const v = jobView(job({ status: 'downloading', parameters: { skip_dl: true }, title: 'Show' }));
	assert.equal(v.label, 'Show');
	assert.ok(v.active);
	assert.ok(v.keysOnly);
	assert.equal(v.statusLabel, 'obtaining keys');
	assert.equal(v.doneLabel, 'Keys obtained');
});

test('jobView label falls back title → title_id → job_id', () => {
	assert.equal(jobView(job({ title_id: 'abc' })).label, 'abc');
	assert.equal(jobView(job({})).label, 'j1');
});

test('jobView progress is null when finished, determinate when a percent exists', () => {
	assert.equal(jobView(job({ status: 'completed' })).progress, null);
	const running = jobView(job({ status: 'downloading', progress: 42 }));
	assert.deepEqual(running.progress, { muxing: false, determinate: true, percent: 42 });
	// muxing phase overrides determinate even with a number present
	const mux = jobView(job({ status: 'muxing', phase: 'muxing', progress: 99 }));
	assert.equal(mux.progress?.muxing, true);
	assert.equal(mux.progress?.determinate, false);
});

test('jobView clamps percent into 0..100', () => {
	assert.equal(jobView(job({ status: 'downloading', progress: 250 })).progress?.percent, 100);
	assert.equal(jobView(job({ status: 'downloading', progress: -5 })).progress?.percent, 0);
});

test('jobView surfaces current episode from output files while active', () => {
	const v = jobView(
		job({
			status: 'downloading',
			parameters: { wanted: ['S01E01', 'S01E02'] },
			output_files: ['Show.S01E01.mkv']
		})
	);
	assert.equal(v.episodes?.done.size, 1);
	assert.equal(v.current, 'S01E02');
});
