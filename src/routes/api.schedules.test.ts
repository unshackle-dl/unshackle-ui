import assert from 'node:assert/strict';
import { afterAll, beforeEach, test } from 'vitest';
import { openTestDatabase } from '../server/scheduler/test-utils.ts';

const testDb = await openTestDatabase();
const { db } = testDb;
const { createScheduleHandler, listSchedulesHandler } = await import('./api.schedules.ts');
const { deleteScheduleHandler, updateScheduleHandler } = await import('./api.schedules.$id.ts');
const config = (await import('../server/config.ts')).config;
const runAt = new Date(Date.now() + 60_000).toISOString();
const payload = {
	name: 'Example',
	runAt,
	timeZone: 'America/New_York',
	request: { service: 'TEST', title_id: '123' }
};
function request(
	method: string,
	body?: unknown,
	key = 'owner-key',
	options: { origin?: string; contentType?: string } = {}
) {
	return new Request('http://localhost/api/schedules', {
		method,
		headers: {
			'Content-Type': options.contentType ?? 'application/json',
			Origin: options.origin ?? 'http://localhost',
			'X-Secret-Key': key
		},
		...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
	});
}

beforeEach(() => {
	db.exec('DELETE FROM schedule_run; DELETE FROM schedule');
	config.apiUrlConfigured = false;
});
afterAll(() => testDb.close());

test('rejects schedule creation with a non-JSON content type or a foreign origin', async () => {
	const text = await createScheduleHandler(
		request('POST', payload, 'owner-key', { contentType: 'text/plain' })
	);
	const foreign = await createScheduleHandler(
		request('POST', payload, 'owner-key', { origin: 'https://attacker.example' })
	);

	assert.equal(text.status, 415);
	assert.equal(foreign.status, 403);
	assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schedule').get()?.count, 0);
});

test('rejects malformed JSON and a request missing timeZone without reaching SQLite', async () => {
	const malformed = await createScheduleHandler(request('POST', '{'));
	const { timeZone: _timeZone, ...missingTimeZone } = payload;
	const missing = await createScheduleHandler(request('POST', missingTimeZone));

	assert.equal(malformed.status, 400);
	assert.equal(missing.status, 400);
	assert.match((await missing.json()).error, /time zone/i);
	assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schedule').get()?.count, 0);
});

test('creates and lists schedules only for the caller key', async () => {
	const created = await createScheduleHandler(request('POST', payload));
	const createdBody = await created.json();
	const ownList = await listSchedulesHandler(request('GET'));
	const otherList = await listSchedulesHandler(request('GET', undefined, 'other-key'));

	assert.equal(created.status, 201);
	assert.equal(createdBody.schedule.request.title_id, '123');
	assert.equal((await ownList.json()).schedules.length, 1);
	assert.equal((await otherList.json()).schedules.length, 0);
});

test('accepts a weekly recurrence with second precision', async () => {
	const recurring = await createScheduleHandler(
		request('POST', {
			...payload,
			runAt: undefined,
			recurrence: { daysOfWeek: [2], time: '22:00:37' }
		})
	);
	const body = await recurring.json();

	assert.equal(recurring.status, 201);
	assert.deepEqual(body.schedule.recurrence, { daysOfWeek: [2], time: '22:00:37' });
	assert.ok(body.schedule.nextRunAt > Date.now());
});

test('only the owner can pause, resume, or delete a schedule', async () => {
	const created = await createScheduleHandler(request('POST', payload));
	const { schedule } = await created.json();
	const foreignPatch = await updateScheduleHandler(
		request('PATCH', { state: 'paused' }, 'other-key'),
		schedule.id
	);
	const ownerPatch = await updateScheduleHandler(
		request('PATCH', { state: 'paused' }),
		schedule.id
	);
	const foreignDelete = deleteScheduleHandler(
		request('DELETE', undefined, 'other-key'),
		schedule.id
	);
	const ownerDelete = deleteScheduleHandler(request('DELETE'), schedule.id);

	assert.equal(foreignPatch.status, 404);
	assert.equal(ownerPatch.status, 200);
	assert.equal((await ownerPatch.json()).schedule.state, 'paused');
	assert.equal(foreignDelete.status, 404);
	assert.equal(ownerDelete.status, 204);
});

test('rejects invalid state values and non-JSON update requests', async () => {
	const { schedule } = await (await createScheduleHandler(request('POST', payload))).json();
	const invalid = await updateScheduleHandler(request('PATCH', { state: 'running' }), schedule.id);
	const wrongType = await updateScheduleHandler(
		request('PATCH', { state: 'paused' }, 'owner-key', { contentType: 'text/plain' }),
		schedule.id
	);

	assert.equal(invalid.status, 400);
	assert.equal(wrongType.status, 415);
});
