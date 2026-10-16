import { createFileRoute } from '@tanstack/react-router';
import { deleteSchedule, getSchedule, setScheduleState } from '../server/scheduler/store';

export const Route = createFileRoute('/api/schedules/$id')({
	server: {
		handlers: {
			PATCH: async ({ request, params }) => {
				const existing = getSchedule(params.id);
				if (!existing) return Response.json({ error: 'Schedule not found.' }, { status: 404 });
				let body: { state?: string };
				try { body = await request.json() as { state?: string }; }
				catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
				if (body.state !== 'active' && body.state !== 'paused') return Response.json({ error: 'state must be active or paused.' }, { status: 400 });
				if (existing.state === 'completed') return Response.json({ error: 'Completed schedules cannot be reactivated.' }, { status: 409 });
				const schedule = setScheduleState(params.id, body.state);
				return schedule ? Response.json({ schedule }) : Response.json({ error: 'Schedule not found.' }, { status: 404 });
			},
			DELETE: ({ params }) => deleteSchedule(params.id)
				? new Response(null, { status: 204 })
				: Response.json({ error: 'Schedule not found.' }, { status: 404 })
		}
	}
});
