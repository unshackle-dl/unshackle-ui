import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { schedules } from '$lib/schedules/client';
import type { ScheduleRecord } from '../server/scheduler/store';
import Button from '$lib/components/Button';
import Card from '$lib/components/Card';
import EmptyState from '$lib/components/EmptyState';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function scheduleDescription(schedule: ScheduleRecord): string {
	if (schedule.recurrence) {
		const days = schedule.recurrence.daysOfWeek.map((day) => WEEKDAYS[day]).join(', ');
		return `Every ${days} at ${schedule.recurrence.time} (${schedule.timeZone})`;
	}
	return `Runs ${new Date(schedule.nextRunAt ?? Date.parse(schedule.runAt)).toLocaleString(undefined, {
		timeZone: schedule.timeZone
	})} (${schedule.timeZone})`;
}

export const Route = createFileRoute('/schedules')({ ssr: false, component: Schedules });
function Schedules() {
	const client = useQueryClient();
	const query = useQuery({
		queryKey: ['schedules'],
		queryFn: schedules.list,
		refetchInterval: 10_000
	});
	const update = useMutation({
		mutationFn: ({ id, state }: { id: string; state: 'active' | 'paused' }) =>
			schedules.state(id, state),
		onSuccess: () => client.invalidateQueries({ queryKey: ['schedules'] })
	});
	const remove = useMutation({
		mutationFn: schedules.remove,
		onSuccess: () => client.invalidateQueries({ queryKey: ['schedules'] })
	});
	return (
		<main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
			<header>
				<h1 className="text-2xl font-semibold">Scheduled downloads</h1>
				<p className="mt-1 text-sm text-neutral-500">
					The scheduled time is when the job is submitted to the API. Weekly schedules use their saved time zone.
				</p>
			</header>
			{query.isLoading ? (
				<Card className="p-6">Loading schedules…</Card>
			) : query.error ? (
				<Card className="p-5 text-red-600">{String(query.error)}</Card>
			) : !query.data?.length ? (
				<EmptyState
					title="No scheduled downloads"
					description="Open a title and choose Schedule next to Download."
				/>
			) : (
				<div className="space-y-3">
					{query.data.map((s: ScheduleRecord) => (
						<Card key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
							<div className="min-w-0">
								<h2 className="font-medium">{s.name}</h2>
								<p className="text-sm text-neutral-500">
									{s.request.service} · {s.request.title_id}
								</p>
								<p className="text-xs text-neutral-500">
									{s.state === 'completed' ? `Completed · ${s.lastStatus ?? ''}` : scheduleDescription(s)}
									{s.lastJobId ? ` · Job ${s.lastJobId}` : ''}
								</p>
								{s.lastError && <p className="text-xs text-red-600">{s.lastError}</p>}
								{s.runs.length > 0 && (
									<ul className="mt-2 space-y-1 text-xs text-neutral-500">
										{s.runs.slice(0, 3).map((run, index) => (
											<li key={`${run.runAt}-${index}`}>
												{new Date(run.runAt).toLocaleString(undefined, { timeZone: s.timeZone })} ·{' '}
												{run.status}
												{run.jobId ? ` · Job ${run.jobId}` : ''}
												{run.error ? ` · ${run.error}` : ''}
											</li>
										))}
									</ul>
								)}
							</div>
							<div className="flex gap-2">
								{s.state !== 'completed' && (
									<Button
										variant="secondary"
										onClick={() =>
											update.mutate({ id: s.id, state: s.state === 'active' ? 'paused' : 'active' })
										}
									>
										{s.state === 'active' ? 'Pause' : 'Resume'}
									</Button>
								)}
								<Button variant="secondary" onClick={() => remove.mutate(s.id)}>
									Delete
								</Button>
							</div>
						</Card>
					))}
				</div>
			)}
		</main>
	);
}
