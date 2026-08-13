import { createFileRoute } from '@tanstack/react-router';
import { markAllSeen } from '../server/db';
import { callerKey } from '../server/owner';

export const Route = createFileRoute('/api/tracking/seen')({
	server: {
		handlers: {
			// Clears every unseen item on every track this key owns. No body.
			POST: ({ request }) => Response.json({ marked: markAllSeen(callerKey(request)) })
		}
	}
});
