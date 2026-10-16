import { config } from '../config';
import { claimDueSchedules, finishSchedule, type ScheduleInput, type ScheduleRecord } from './store';
import { cronMatches, validCron } from './cron';

export function nextCronRun(expression: string, timeZone: string, after = new Date()): string {
	// Start at the next whole minute. Cap search to one leap-year-sized horizon.
	const candidate = new Date(after);
	candidate.setUTCSeconds(0, 0);
	candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
	for (let i = 0; i < 366 * 24 * 60; i++, candidate.setUTCMinutes(candidate.getUTCMinutes() + 1)) {
		if (cronMatches(expression, candidate, timeZone)) return candidate.toISOString();
	}
	throw new Error('The cron expression has no valid run in the next year.');
}

export function validateSchedule(input: ScheduleInput): string {
	if (!input.name?.trim() || input.name.trim().length > 120) throw new Error('Enter a name of up to 120 characters.');
	if (!input.request || typeof input.request !== 'object' || Array.isArray(input.request)) throw new Error('request must be an object.');
	if (typeof input.request.service !== 'string' || typeof input.request.title_id !== 'string' ||
		!input.request.service.trim() || !input.request.title_id.trim())
		throw new Error('request must contain non-empty service and title_id strings.');
	if (input.request.service.length > 120 || input.request.title_id.length > 500) throw new Error('service or title_id exceeds the maximum length.');
	try { new Intl.DateTimeFormat('en-US', { timeZone: input.timeZone }).format(); }
	catch { throw new Error('Invalid time zone. Use an IANA name such as America/Los_Angeles.'); }
	if (input.kind === 'once') {
		const when = input.runAt ? new Date(input.runAt) : null;
		if (!when || !Number.isFinite(when.getTime())) throw new Error('Enter a valid date and time for the one-time run.');
		if (when.getTime() < Date.now() + 5_000) throw new Error('The run time must be at least 5 seconds in the future.');
		return when.toISOString();
	}
	if (input.kind !== 'cron') throw new Error('Invalid schedule type.');
	if (!input.cron || !validCron(input.cron)) throw new Error('Invalid cron expression. Use five fields: minute hour day-of-month month day-of-week.');
	return nextCronRun(input.cron, input.timeZone);
}

async function execute(schedule: ScheduleRecord): Promise<void> {
	let nextRunAt: string | null = null;
	const completed = schedule.kind === 'once';
	try {
		if (!config.apiUrlConfigured) throw new Error('Configure UNSHACKLE_API_URL in the server environment.');
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (config.apiKey) headers['X-Secret-Key'] = config.apiKey;
		const response = await fetch(`${config.apiUrl}/api/download`, {
			method: 'POST', headers, body: JSON.stringify(schedule.request), signal: AbortSignal.timeout(30_000)
		});
		const body = await response.json().catch(() => ({})) as Record<string, unknown>;
		if (!response.ok) throw new Error(String(body.error ?? body.message ?? `${response.status} ${response.statusText}`));
		if (typeof body.job_id !== 'string') throw new Error('The API response did not include job_id; check the download API contract.');
		const jobId = body.job_id;
		if (!completed) nextRunAt = nextCronRun(schedule.cron!, schedule.timeZone, new Date());
		finishSchedule(schedule.id, { nextRunAt, jobId, completed });
		console.info(`[scheduler] schedule=${schedule.id} submitted job=${jobId}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// A failed one-off remains completed to prevent surprise repeated downloads. The user can create it again.
		if (!completed) {
			try { nextRunAt = nextCronRun(schedule.cron!, schedule.timeZone, new Date()); } catch { nextRunAt = null; }
		}
		finishSchedule(schedule.id, { nextRunAt, error: message, completed });
		console.error(`[scheduler] schedule=${schedule.id} failed: ${message}`);
	}
}

export async function runSchedulerTick(): Promise<void> {
	const due = claimDueSchedules(new Date());
	await Promise.all(due.map(execute));
}

export function startScheduler(): void {
	const g = globalThis as typeof globalThis & { __unshackleSchedulerTimer?: NodeJS.Timeout; __unshackleSchedulerBusy?: boolean };
	if (g.__unshackleSchedulerTimer) return;
	const tick = async () => {
		if (g.__unshackleSchedulerBusy) return;
		g.__unshackleSchedulerBusy = true;
		try { await runSchedulerTick(); }
		catch (error) { console.error('[scheduler] tick failed', error); }
		finally { g.__unshackleSchedulerBusy = false; }
	};
	g.__unshackleSchedulerTimer = setInterval(tick, 5_000);
	g.__unshackleSchedulerTimer.unref();
	void tick();
	console.info('[scheduler] started; checking every 5 seconds');
}
