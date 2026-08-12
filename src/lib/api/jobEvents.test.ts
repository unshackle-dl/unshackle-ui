import assert from 'node:assert/strict';
import { test } from 'vitest';
import { patchJobList } from './jobEvents.ts';
import type { Job } from './types.ts';

const job = (over: Partial<Job>): Job => ({ job_id: 'j1', status: 'downloading', ...over });

test('patchJobList merges the event onto the matching job only', () => {
	const cached = [job({ job_id: 'j1', progress: 10 }), job({ job_id: 'j2', progress: 90 })];
	const next = patchJobList(cached, job({ job_id: 'j1', progress: 55 })) as Job[];
	assert.equal(next[0].progress, 55);
	assert.equal(next[1].progress, 90);
	assert.equal(next[1], cached[1]); // untouched entries keep their identity
});

// progress events omit parameters/output_files, so a replace would blank the episode chips.
test('patchJobList keeps fields the event does not carry', () => {
	const cached = [
		job({ parameters: { wanted: ['S01E01'] }, output_files: ['Show.S01E01.mkv'], progress: 10 })
	];
	const next = patchJobList(cached, job({ progress: 42, phase: 'downloading video' })) as Job[];
	assert.deepEqual(next[0].parameters, { wanted: ['S01E01'] });
	assert.deepEqual(next[0].output_files, ['Show.S01E01.mkv']);
	assert.equal(next[0].progress, 42);
	assert.equal(next[0].phase, 'downloading video');
});

test('patchJobList returns the cache untouched when the job is not in this list', () => {
	const cached = [job({ job_id: 'j2' })];
	assert.equal(patchJobList(cached, job({ job_id: 'j1' })), cached);
});

test('patchJobList ignores a cache that is not a job list', () => {
	assert.equal(patchJobList(undefined, job({})), undefined);
	assert.deepEqual(patchJobList({ jobs: [] }, job({})), { jobs: [] });
});

test('patchJobList applies terminal fields', () => {
	const cached = [job({ progress: 80, status: 'downloading' })];
	const next = patchJobList(
		cached,
		job({ status: 'completed', progress: 100, output_files: ['Show.S01E01.mkv'] })
	) as Job[];
	assert.equal(next[0].status, 'completed');
	assert.deepEqual(next[0].output_files, ['Show.S01E01.mkv']);
});
