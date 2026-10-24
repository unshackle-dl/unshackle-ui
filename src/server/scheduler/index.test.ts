import assert from 'node:assert/strict';
import { afterAll, beforeEach, test, vi } from 'vitest';
import { openTestDatabase } from './test-utils.ts';

vi.mock('../upstream.ts', () => ({ download: vi.fn() }));

const testDb = await openTestDatabase();
const { db } = testDb;
const store = await import('./store.ts');
const scheduler = await import('./index.ts');
const config = (await import('../config.ts')).config;
const upstream = await import('../upstream.ts');
const download = vi.mocked(upstream.download);
const dueInput = () => {
	const at = Date.now() - 1_000;
	return {
		name: 'Example title',
		runAt: new Date(at).toISOString(),
		timeZone: 'America/New_York',
		request: { service: 'TEST', title_id: '123' }
	};
};
const createDueSchedule = () => {
	const input = dueInput();
	return store.createSchedule(
		input,
		Date.parse(input.runAt),
		new Request('http://localhost', { headers: { 'X-Secret-Key': 'owner-key' } })
	);
};

beforeEach(() => {
	db.exec('DELETE FROM schedule');
	config.apiUrlConfigured = true;
	download.mockReset();
});
afterAll(() => testDb.close());

test('submits the due request with its owner key and records the upstream job id', async () => {
	const schedule = createDueSchedule();
	download.mockResolvedValue({ job_id: 'job-123' });

	await scheduler.runSchedulerTick();

	assert.deepEqual(download.mock.calls[0], [schedule.request, 'owner-key']);
	assert.equal(store.getSchedule(schedule.id, 'owner-key')?.state, 'completed');
	assert.equal(store.getSchedule(schedule.id, 'owner-key')?.lastJobId, 'job-123');
	assert.equal(store.getSchedule(schedule.id, 'owner-key')?.lastStatus, 'submitted');
});

test('keeps a weekly schedule active and advances it after submission', async () => {
	const input = {
		...dueInput(),
		recurrence: { daysOfWeek: [2], time: '22:00:00' }
	};
	const schedule = store.createSchedule(
		input,
		Date.now() - 1_000,
		new Request('http://localhost', { headers: { 'X-Secret-Key': 'owner-key' } })
	);
	download.mockResolvedValue({ job_id: 'weekly-job' });

	await scheduler.runSchedulerTick();

	const result = store.getSchedule(schedule.id, 'owner-key');
	assert.equal(result?.state, 'active');
	assert.ok((result?.nextRunAt ?? 0) > Date.now());
	assert.equal(result?.runs[0]?.status, 'submitted');
	assert.equal(result?.runs[0]?.jobId, 'weekly-job');
});

test('records an upstream failure as failed and completed', async () => {
	const schedule = createDueSchedule();
	download.mockRejectedValue(new Error('upstream unavailable'));
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});

	await scheduler.runSchedulerTick();

	const result = store.getSchedule(schedule.id, 'owner-key');
	assert.equal(result?.state, 'completed');
	assert.equal(result?.lastStatus, 'failed');
	assert.equal(result?.lastError, 'upstream unavailable');
	error.mockRestore();
});

test('leaves due schedules pending while the upstream URL is not configured', async () => {
	const schedule = createDueSchedule();
	config.apiUrlConfigured = false;

	await scheduler.runSchedulerTick();

	assert.equal(download.mock.calls.length, 0);
	assert.equal(store.getSchedule(schedule.id, 'owner-key')?.state, 'active');
	assert.ok(store.getSchedule(schedule.id, 'owner-key')?.nextRunAt);
});

test('keeps a pause made while the upstream request is in flight', async () => {
	const schedule = createDueSchedule();
	let resolveDownload!: (value: { job_id: string }) => void;
	download.mockImplementation(
		() =>
			new Promise((resolve) => {
				resolveDownload = resolve;
			})
	);
	const tick = scheduler.runSchedulerTick();
	assert.equal(download.mock.calls.length, 1);
	store.setScheduleState(schedule.id, 'owner-key', 'paused');
	resolveDownload({ job_id: 'job-racing-pause' });
	await tick;

	const result = store.getSchedule(schedule.id, 'owner-key');
	assert.equal(result?.state, 'paused');
	assert.equal(result?.lastJobId, 'job-racing-pause');
});
