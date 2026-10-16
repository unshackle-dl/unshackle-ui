import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db';

export type ScheduleKind = 'once' | 'cron';
export type ScheduleState = 'active' | 'paused' | 'completed';
export interface ScheduleInput {
	name: string;
	kind: ScheduleKind;
	runAt?: string;
	cron?: string;
	timeZone: string;
	request: { service: string; title_id: string; [key: string]: unknown };
}
export interface ScheduleRecord extends ScheduleInput {
	id: string;
	state: ScheduleState;
	createdAt: string;
	nextRunAt: string | null;
	lastRunAt: string | null;
	lastStatus: string | null;
	lastError: string | null;
	lastJobId: string | null;
}

function db(): DatabaseSync {
	const d = getDb();
	d.exec(`CREATE TABLE IF NOT EXISTS schedule (
		id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, run_at TEXT, cron TEXT,
		time_zone TEXT NOT NULL, request_json TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'active',
		created_at TEXT NOT NULL, next_run_at TEXT, last_run_at TEXT, last_status TEXT,
		last_error TEXT, last_job_id TEXT, claimed_at TEXT
	)`);
	d.exec('CREATE INDEX IF NOT EXISTS idx_schedule_due ON schedule(state, next_run_at)');
	return d;
}

function record(r: Record<string, unknown>): ScheduleRecord {
	return {
		id: String(r.id), name: String(r.name), kind: r.kind as ScheduleKind,
		runAt: r.run_at == null ? undefined : String(r.run_at), cron: r.cron == null ? undefined : String(r.cron),
		timeZone: String(r.time_zone), request: JSON.parse(String(r.request_json)), state: r.state as ScheduleState,
		createdAt: String(r.created_at), nextRunAt: r.next_run_at == null ? null : String(r.next_run_at),
		lastRunAt: r.last_run_at == null ? null : String(r.last_run_at), lastStatus: r.last_status == null ? null : String(r.last_status),
		lastError: r.last_error == null ? null : String(r.last_error), lastJobId: r.last_job_id == null ? null : String(r.last_job_id)
	};
}

export function listSchedules(): ScheduleRecord[] {
	return (db().prepare('SELECT * FROM schedule ORDER BY COALESCE(next_run_at, created_at), created_at DESC').all() as Record<string, unknown>[]).map(record);
}
export function getSchedule(id: string): ScheduleRecord | null {
	const row = db().prepare('SELECT * FROM schedule WHERE id = ?').get(id) as Record<string, unknown> | undefined;
	return row ? record(row) : null;
}
export function createSchedule(input: ScheduleInput, nextRunAt: string): ScheduleRecord {
	const id = randomUUID();
	db().prepare(`INSERT INTO schedule (id,name,kind,run_at,cron,time_zone,request_json,state,created_at,next_run_at)
		VALUES (?,?,?,?,?,?,?,'active',?,?)`).run(id, input.name.trim(), input.kind, input.runAt ?? null, input.cron ?? null,
		input.timeZone, JSON.stringify(input.request), new Date().toISOString(), nextRunAt);
	return getSchedule(id)!;
}
export function deleteSchedule(id: string): boolean {
	return db().prepare('DELETE FROM schedule WHERE id = ?').run(id).changes > 0;
}
export function setScheduleState(id: string, state: 'active' | 'paused'): ScheduleRecord | null {
	db().prepare('UPDATE schedule SET state = ? WHERE id = ?').run(state, id);
	return getSchedule(id);
}
export function claimDueSchedules(now: Date): ScheduleRecord[] {
	const d = db();
	// Claim inside an immediate transaction so two requests in this process cannot claim the same task.
	d.exec('BEGIN IMMEDIATE');
	try {
		const due = d.prepare(`SELECT * FROM schedule WHERE state='active' AND next_run_at IS NOT NULL AND next_run_at <= ?
			AND (claimed_at IS NULL OR claimed_at < ?) ORDER BY next_run_at LIMIT 20`).all(now.toISOString(), new Date(now.getTime() - 10 * 60_000).toISOString()) as Record<string, unknown>[];
		const update = d.prepare('UPDATE schedule SET claimed_at = ? WHERE id = ?');
		for (const row of due) update.run(now.toISOString(), String(row.id));
		d.exec('COMMIT');
		return due.map(record);
	} catch (e) { d.exec('ROLLBACK'); throw e; }
}
export function finishSchedule(id: string, result: { nextRunAt: string | null; jobId?: string; error?: string; completed: boolean }): void {
	db().prepare(`UPDATE schedule SET last_run_at=?, last_status=?, last_error=?, last_job_id=?, next_run_at=?,
		state=?, claimed_at=NULL WHERE id=?`).run(new Date().toISOString(), result.error ? 'failed' : 'submitted', result.error ?? null,
		result.jobId ?? null, result.nextRunAt, result.completed ? 'completed' : 'active', id);
}
