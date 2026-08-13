import { createFileRoute } from '@tanstack/react-router';
import { countryParam, fail, str } from '../server/http';
import { jwFail, searchTitles } from '../server/justwatch';

export const Route = createFileRoute('/api/browse/search')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const country = countryParam(request);
				if (!country) return fail(400, 'country must be a 2-letter code');
				const q = str(new URL(request.url).searchParams.get('q'));
				if (!q) return fail(400, 'q is required');
				try {
					return Response.json(await searchTitles(q, country));
				} catch (e) {
					return jwFail(e);
				}
			}
		}
	}
});
