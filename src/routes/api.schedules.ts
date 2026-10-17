import { createFileRoute } from '@tanstack/react-router';
import { fail, readJson, str } from '../server/http';
import { callerKey } from '../server/owner';
import { startScheduler, validateSchedule } from '../server/scheduler';
import { createSchedule, listSchedules, type ScheduleInput } from '../server/scheduler/store';

function sameOriginJson(request: Request): Response | null {
	if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? ''))
		return fail(415, 'Content-Type must be application/json.');
	const origin = request.headers.get('origin');
	if (!origin || origin !== new URL(request.url).origin)
		return fail(403, 'Request origin is not allowed.');
	return null;
}

export function listSchedulesHandler(request: Request): Response {
	return Response.json({ schedules: listSchedules(callerKey(request)) });
}

export async function createScheduleHandler(request: Request): Promise<Response> {
	const guard = sameOriginJson(request);
	if (guard) return guard;
	const body = await readJson(request);
	if (!body) return fail(400, 'Invalid JSON body.');
	const input: ScheduleInput = {
		name: str(body.name) ?? '',
		runAt: str(body.runAt) ?? '',
		timeZone: str(body.timeZone) ?? '',
		request: body.request as ScheduleInput['request']
	};
	try {
		const nextRunAt = validateSchedule(input);
		const schedule = createSchedule(input, nextRunAt, request);
		startScheduler();
		return Response.json({ schedule }, { status: 201 });
	} catch (error) {
		return fail(400, error instanceof Error ? error.message : String(error));
	}
}

export const Route = createFileRoute('/api/schedules')({
	server: {
		handlers: {
			GET: ({ request }) => listSchedulesHandler(request),
			POST: ({ request }) => createScheduleHandler(request)
		}
	}
});
