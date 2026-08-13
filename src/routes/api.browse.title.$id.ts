import { createFileRoute } from '@tanstack/react-router';
import { countryParam, fail } from '../server/http';
import { getTitle, jwFail } from '../server/justwatch';

export const Route = createFileRoute('/api/browse/title/$id')({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const country = countryParam(request);
				if (!country) return fail(400, 'country must be a 2-letter code');
				try {
					return Response.json(await getTitle(params.id, country));
				} catch (e) {
					return jwFail(e);
				}
			}
		}
	}
});
