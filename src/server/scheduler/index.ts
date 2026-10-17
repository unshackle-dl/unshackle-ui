import { config } from '../config';
import { download } from '../upstream';
import { dueSchedules, finishSchedule, type ScheduleInput, type ScheduleRecord } from './store';

export function validateSchedule(input: ScheduleInput): number {
	if (!input || typeof input !== 'object') throw new Error('Invalid schedule.');
	if (!input.name?.trim() || input.name.trim().length > 120)
		throw new Error('Enter a name of up to 120 characters.');
	if (!input.request || typeof input.request !== 'object' || Array.isArray(input.request))
		throw new Error('request must be an object.');
	if (
		typeof input.request.service !== 'string' ||
		typeof input.request.title_id !== 'string' ||
		!input.request.service.trim() ||
		!input.request.title_id.trim()
	)
		throw new Error('request must contain non-empty service and title_id strings.');
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: input.timeZone }).format();
	} catch {
		throw new Error('Invalid time zone. Use an IANA name such as America/New_York.');
	}
	const when = input.runAt ? Date.parse(input.runAt) : NaN;
	if (!Number.isFinite(when)) throw new Error('Enter a valid date and time for the one-time run.');
	if (when < Date.now() + 5_000)
		throw new Error('The run time must be at least 5 seconds in the future.');
	return when;
}

async function execute(schedule: ScheduleRecord & { ownerKey: string }): Promise<void> {
	if (!config.apiUrlConfigured) return;
	try {
		const result = await download(schedule.request, schedule.ownerKey);
		finishSchedule(schedule.id, { jobId: result.job_id });
		console.info(`[scheduler] schedule=${schedule.id} submitted job=${result.job_id}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		finishSchedule(schedule.id, { error: message });
		console.error(`[scheduler] schedule=${schedule.id} failed: ${message}`);
	}
}

export async function runSchedulerTick(): Promise<void> {
	if (!config.apiUrlConfigured) return;
	await Promise.all(dueSchedules(Date.now()).map(execute));
}

export function startScheduler(): void {
	const g = globalThis as typeof globalThis & {
		__unshackleSchedulerTimer?: NodeJS.Timeout;
		__unshackleSchedulerBusy?: boolean;
	};
	if (!config.apiUrlConfigured || g.__unshackleSchedulerTimer) return;
	const tick = async () => {
		if (g.__unshackleSchedulerBusy) return;
		g.__unshackleSchedulerBusy = true;
		try {
			if (dueSchedules(Date.now()).length === 0) {
				if (dueSchedules(Number.MAX_SAFE_INTEGER).length === 0) {
					clearInterval(g.__unshackleSchedulerTimer);
					g.__unshackleSchedulerTimer = undefined;
				}
				return;
			}
			await runSchedulerTick();
		} catch (error) {
			console.error('[scheduler] tick failed', error);
		} finally {
			g.__unshackleSchedulerBusy = false;
		}
	};
	g.__unshackleSchedulerTimer = setInterval(tick, 5_000);
	g.__unshackleSchedulerTimer.unref();
	void tick();
}

export function restartScheduler(): void {
	const g = globalThis as typeof globalThis & { __unshackleSchedulerTimer?: NodeJS.Timeout };
	if (g.__unshackleSchedulerTimer) clearInterval(g.__unshackleSchedulerTimer);
	g.__unshackleSchedulerTimer = undefined;
	startScheduler();
}
