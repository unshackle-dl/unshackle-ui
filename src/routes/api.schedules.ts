import { createFileRoute } from '@tanstack/react-router';
import { nextCronRun, validateSchedule } from '../server/scheduler';
import { createSchedule, listSchedules, type ScheduleInput } from '../server/scheduler/store';

function jsonError(message: string, status = 400) {
	return Response.json({ error: message }, { status });
}

export const Route = createFileRoute('/api/schedules')({
	server: {
		handlers: {
			GET: () => Response.json({ schedules: listSchedules() }),
			POST: async ({ request }) => {
				let body: ScheduleInput;
				try { body = await request.json() as ScheduleInput; }
				catch { return jsonError('Invalid JSON body.'); }
				try {
					const nextRunAt = validateSchedule(body);
					return Response.json({ schedule: createSchedule(body, nextRunAt) }, { status: 201 });
				} catch (error) {
					return jsonError(error instanceof Error ? error.message : String(error));
				}
			}
		}
	}
});
