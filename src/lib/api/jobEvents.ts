import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { jobEventsUrl } from '$lib/api/client';
import { TERMINAL_EVENTS } from '$lib/job';
import { browser } from '$lib/store';
import type { Job } from './types';

// The stream sends a `snapshot` first, then updates, then exactly one terminal
// event, after which the server closes it.
const UPDATE_EVENTS = ['snapshot', 'status', 'progress'] as const;

/**
 * Merge an event's job object onto the cached list. `progress` events carry no
 * `parameters` or `output_files`, so merge rather than replace. Keeps the cached
 * value's identity when the job is not in the list.
 */
export function patchJobList(cached: unknown, event: Job): unknown {
	if (!Array.isArray(cached)) return cached;
	let matched = false;
	const next = (cached as Job[]).map((j) => {
		if (j.job_id !== event.job_id) return j;
		matched = true;
		return { ...j, ...event };
	});
	return matched ? next : cached;
}

/**
 * Streams live progress for the given jobs into the TanStack Query cache, one
 * EventSource per job id. Returns whether any stream is open.
 */
export function useJobEvents(jobIds: string[]): boolean {
	const queryClient = useQueryClient();
	const sources = useRef<Map<string, EventSource>>(new Map());
	const [connected, setConnected] = useState(false);

	// Sorted so a re-rendered array with the same ids does not tear down streams.
	const key = [...jobIds].sort().join(',');

	useEffect(() => {
		if (!browser) return;
		const map = sources.current;
		const ids = key ? key.split(',') : [];
		const sync = () => setConnected(map.size > 0);

		for (const [id, es] of map) {
			if (!ids.includes(id)) {
				es.close();
				map.delete(id);
			}
		}

		for (const id of ids) {
			if (map.has(id)) continue;
			const es = new EventSource(jobEventsUrl(id));

			const apply = (e: MessageEvent) => {
				let job: Job;
				try {
					job = JSON.parse(e.data) as Job;
				} catch {
					return;
				}
				queryClient.setQueriesData({ queryKey: ['jobs'], type: 'active' }, (cached) =>
					patchJobList(cached, job)
				);
			};

			const finish = (e: MessageEvent) => {
				apply(e);
				es.close();
				map.delete(id);
				sync();
				// A job that just left `downloading` may belong in a different filtered list.
				queryClient.invalidateQueries({ queryKey: ['jobs'] });
			};

			for (const name of UPDATE_EVENTS) es.addEventListener(name, apply);
			for (const name of TERMINAL_EVENTS) es.addEventListener(name, finish);

			// No retry: polling covers the gap, and a server without the endpoint
			// would otherwise reconnect forever.
			es.onerror = () => {
				es.close();
				map.delete(id);
				sync();
			};

			map.set(id, es);
		}

		sync();
	}, [key, queryClient]);

	// Unmount-only teardown; the effect above closes departed ids itself.
	useEffect(() => {
		const map = sources.current;
		return () => {
			for (const es of map.values()) es.close();
			map.clear();
		};
	}, []);

	return connected;
}
