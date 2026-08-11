import { createFileRoute } from '@tanstack/react-router';
import type { TrackingSettings } from '$lib/tracking/types';
import { pollerMode } from '../server/poller';
import { settingsView, updateSettings } from '../server/settings';

const current = (): TrackingSettings => ({ ...settingsView(), poller: pollerMode() });

export const Route = createFileRoute('/api/tracking/settings')({
	server: {
		handlers: {
			GET: () => Response.json(current()),

			PUT: async ({ request }) => {
				let body: unknown;
				try {
					body = await request.json();
				} catch {
					return Response.json({ error: 'Body must be JSON' }, { status: 400 });
				}
				if (typeof body !== 'object' || body === null || Array.isArray(body))
					return Response.json({ error: 'Body must be an object' }, { status: 400 });
				const result = updateSettings(body as Record<string, unknown>);
				if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
				return Response.json(current());
			}
		}
	}
});
