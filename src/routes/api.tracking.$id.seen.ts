import { createFileRoute } from '@tanstack/react-router';
import { markSeen } from '../server/db';
import { fail, readJson, str } from '../server/http';
import { callerKey } from '../server/owner';

export const Route = createFileRoute('/api/tracking/$id/seen')({
	server: {
		handlers: {
			// { codes?: string[] }. Omit `codes` to clear every unseen item on the track.
			POST: async ({ request, params }) => {
				const body = (await readJson(request)) ?? {};

				let codes: string[] | undefined;
				if (body.codes != null) {
					if (!Array.isArray(body.codes)) return fail(400, 'codes must be an array of strings.');
					codes = [];
					for (const raw of body.codes) {
						const code = str(raw);
						if (!code) return fail(400, 'codes must be an array of strings.');
						codes.push(code);
					}
				}

				const marked = markSeen(params.id, callerKey(request), codes);
				if (marked === null) return fail(404, 'No such tracked title.');
				return Response.json({ marked });
			}
		}
	}
});
