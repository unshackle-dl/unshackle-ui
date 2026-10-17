import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { callerKey, owns } from '../owner';
import { getDb } from '../db';

export interface ScheduleInput {
	name: string;
	runAt: string;
	timeZone: string;
	request: { service: string; title_id: string; [key: string]: unknown };
}
export interface ScheduleRecord extends ScheduleInput {
	id: string;
	state: 'active' | 'paused' | 'completed';
	createdAt: number;
	nextRunAt: number | null;
	lastRunAt: number | null;
	lastStatus: string | null;
	lastError: string | null;
	lastJobId: string | null;
}

function db(): DatabaseSync {
	return getDb();
}
function record(r: Record<string, unknown>): ScheduleRecord {
	return {
		id: String(r.id),
		name: String(r.name),
		runAt: new Date(Number(r.run_at)).toISOString(),
		timeZone: String(r.time_zone),
		request: JSON.parse(String(r.request_json)),
		state: r.state as ScheduleRecord['state'],
		createdAt: Number(r.created_at),
		nextRunAt: r.next_run_at == null ? null : Number(r.next_run_at),
		lastRunAt: r.last_run_at == null ? null : Number(r.last_run_at),
		lastStatus: r.last_status == null ? null : String(r.last_status),
		lastError: r.last_error == null ? null : String(r.last_error),
		lastJobId: r.last_job_id == null ? null : String(r.last_job_id)
	};
}
function ownedRow(id: string, caller: string): Record<string, unknown> | null {
	const row = db().prepare('SELECT * FROM schedule WHERE id = ?').get(id) as
		Record<string, unknown> | undefined;
	return row && owns(String(row.owner_key), caller) ? row : null;
}
export function listSchedules(caller: string): ScheduleRecord[] {
	return (
		db()
			.prepare(
				'SELECT * FROM schedule WHERE owner_key = ? ORDER BY COALESCE(next_run_at, created_at), created_at DESC'
			)
			.all(caller) as Record<string, unknown>[]
	).map(record);
}
export function getSchedule(id: string, caller: string): ScheduleRecord | null {
	const row = ownedRow(id, caller);
	return row ? record(row) : null;
}
export function createSchedule(
	input: ScheduleInput,
	nextRunAt: number,
	request: Request
): ScheduleRecord {
	const id = randomUUID();
	const now = Date.now();
	const caller = callerKey(request);
	db()
		.prepare(
			`INSERT INTO schedule (id,name,run_at,time_zone,request_json,owner_key,state,created_at,next_run_at)
		VALUES (?,?,?,?,?,?,'active',?,?)`
		)
		.run(
			id,
			input.name.trim(),
			Date.parse(input.runAt),
			input.timeZone,
			JSON.stringify(input.request),
			caller,
			now,
			nextRunAt
		);
	return getSchedule(id, caller)!;
}
export function deleteSchedule(id: string, caller: string): boolean {
	return (
		db().prepare('DELETE FROM schedule WHERE id = ? AND owner_key = ?').run(id, caller).changes > 0
	);
}
export function setScheduleState(
	id: string,
	caller: string,
	state: 'active' | 'paused'
): ScheduleRecord | null {
	const next =
		state === 'active'
			? Math.max(Date.now() + 5_000, Number(ownedRow(id, caller)?.run_at ?? Date.now()))
			: null;
	db()
		.prepare(
			"UPDATE schedule SET state = ?, next_run_at = ?, last_error = NULL WHERE id = ? AND owner_key = ? AND state != 'completed'"
		)
		.run(state, next, id, caller);
	return getSchedule(id, caller);
}
export function dueSchedules(now: number): (ScheduleRecord & { ownerKey: string })[] {
	return (
		db()
			.prepare(
				"SELECT * FROM schedule WHERE state='active' AND next_run_at IS NOT NULL AND next_run_at <= ? ORDER BY next_run_at"
			)
			.all(now) as Record<string, unknown>[]
	).map((row) => ({ ...record(row), ownerKey: String(row.owner_key) }));
}
export function finishSchedule(id: string, result: { jobId?: string; error?: string }): void {
	db()
		.prepare(
			`UPDATE schedule SET last_run_at=?, last_status=?, last_error=?, last_job_id=?, next_run_at=NULL,
		state=CASE WHEN state='paused' THEN 'paused' ELSE 'completed' END WHERE id=?`
		)
		.run(
			Date.now(),
			result.error ? 'failed' : 'submitted',
			result.error ?? null,
			result.jobId ?? null,
			id
		);
}
