import assert from 'node:assert/strict';
import { afterAll, beforeEach, test } from 'vitest';
import { openTestDatabase } from './test-utils.ts';

const testDb = await openTestDatabase();
const { db } = testDb;
const store = await import('./store.ts');
const runAt = (at: number) => new Date(at).toISOString();
const input = (at = Date.now() + 60_000) => ({
	name: 'Example title',
	runAt: runAt(at),
	timeZone: 'America/New_York',
	request: { service: 'TEST', title_id: '123', quality: [1080] }
});
const request = (key: string) =>
	new Request('http://localhost/api/schedules', { headers: { 'X-Secret-Key': key } });

beforeEach(() => db.exec('DELETE FROM schedule_run; DELETE FROM schedule'));
afterAll(() => testDb.close());

test('stores times as epoch milliseconds and isolates schedules by owner key', () => {
	const dueAt = Date.now() + 60_000;
	const own = store.createSchedule(input(dueAt), dueAt, request('user-a'));
	store.createSchedule(input(dueAt), dueAt, request('user-b'));
	const types = db
		.prepare(
			'SELECT typeof(run_at) AS run_at, typeof(created_at) AS created_at, typeof(next_run_at) AS next_run_at FROM schedule LIMIT 1'
		)
		.get() as Record<string, string>;

	assert.equal(types.run_at, 'integer');
	assert.equal(types.created_at, 'integer');
	assert.equal(types.next_run_at, 'integer');
	assert.equal(own.runAt, runAt(dueAt));
	assert.equal(store.listSchedules('user-a').length, 1);
	assert.equal(store.getSchedule(own.id, 'user-b'), null);
	assert.equal(store.deleteSchedule(own.id, 'user-b'), false);
});

test('resuming a paused schedule recalculates its next run into the future', () => {
	const past = Date.now() - 60_000;
	const schedule = store.createSchedule(input(past), past, request('user-a'));
	store.setScheduleState(schedule.id, 'user-a', 'paused');
	const resumed = store.setScheduleState(schedule.id, 'user-a', 'active');

	assert.equal(resumed?.state, 'active');
	assert.ok((resumed?.nextRunAt ?? 0) >= Date.now() + 4_000);
});

test('finishing an in-flight schedule does not overwrite a pause', () => {
	const dueAt = Date.now() - 1_000;
	const schedule = store.createSchedule(input(dueAt), dueAt, request('user-a'));
	assert.equal(store.dueSchedules(Date.now()).length, 1);
	store.setScheduleState(schedule.id, 'user-a', 'paused');
	store.finishSchedule(schedule.id, { jobId: 'job-42' });
	const finished = store.getSchedule(schedule.id, 'user-a');

	assert.equal(finished?.state, 'paused');
	assert.equal(finished?.lastJobId, 'job-42');
	assert.equal(finished?.lastStatus, 'submitted');
	assert.equal(finished?.nextRunAt, null);
});
