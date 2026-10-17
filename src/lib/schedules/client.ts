import { request } from '$lib/tracking/client';
import { getSettings } from '$lib/config';
import type { ScheduleRecord } from '../../server/scheduler/store';

export const schedules = {
	list: () =>
		request<{ schedules: ScheduleRecord[] }>('/api/schedules', { headers: keyHeader() }).then(
			(r) => r.schedules
		),
	create: (input: {
		name: string;
		runAt: string;
		timeZone: string;
		request: Record<string, unknown>;
	}) =>
		request<{ schedule: ScheduleRecord }>('/api/schedules', {
			method: 'POST',
			headers: keyHeader(),
			body: JSON.stringify(input)
		}).then((r) => r.schedule),
	state: (id: string, state: 'active' | 'paused') =>
		request(`/api/schedules/${encodeURIComponent(id)}`, {
			method: 'PATCH',
			headers: keyHeader(),
			body: JSON.stringify({ state })
		}),
	remove: (id: string) =>
		request(`/api/schedules/${encodeURIComponent(id)}`, { method: 'DELETE', headers: keyHeader() })
};

function keyHeader(): Record<string, string> {
	const key = getSettings().apiKey;
	return key ? { 'X-Secret-Key': key } : {};
}
