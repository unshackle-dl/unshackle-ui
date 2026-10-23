import { createFileRoute } from '@tanstack/react-router';
import { fail, readJson } from '../server/http';
import { callerKey } from '../server/owner';
import { startScheduler } from '../server/scheduler';
import { getSchedule, setScheduleState, deleteSchedule } from '../server/scheduler/store';

function guard(request: Request): Response | null {
	if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? ''))
		return fail(415, 'Content-Type must be application/json.');
	const origin = request.headers.get('origin');
	if (!origin || origin !== new URL(request.url).origin)
		return fail(403, 'Request origin is not allowed.');
	return null;
}
export async function updateScheduleHandler(request: Request, id: string): Promise<Response> {
	const blocked = guard(request);
	if (blocked) return blocked;
	const caller = callerKey(request);
	const existing = getSchedule(id, caller);
	if (!existing) return fail(404, 'Schedule not found.');
	const body = await readJson(request);
	if (!body) return fail(400, 'Invalid JSON body.');
	if (body.state !== 'active' && body.state !== 'paused')
		return fail(400, 'state must be active or paused.');
	if (existing.state === 'completed')
		return fail(409, 'Completed schedules cannot be reactivated.');
	const schedule = setScheduleState(id, caller, body.state);
	if (body.state === 'active') startScheduler();
	return Response.json({ schedule });
}

export function deleteScheduleHandler(request: Request, id: string): Response {
	const blocked = guard(request);
	if (blocked) return blocked;
	return deleteSchedule(id, callerKey(request))
		? new Response(null, { status: 204 })
		: fail(404, 'Schedule not found.');
}

export const Route = createFileRoute('/api/schedules/$id')({
	server: {
		handlers: {
			PATCH: ({ request, params }) => updateScheduleHandler(request, params.id),
			DELETE: ({ request, params }) => deleteScheduleHandler(request, params.id)
		}
	}
});
