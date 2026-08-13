import { createFileRoute } from '@tanstack/react-router';
import { countryParam, fail } from '../server/http';
import { getPopular, jwFail } from '../server/justwatch';

export const Route = createFileRoute('/api/browse/popular')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const country = countryParam(request);
				if (!country) return fail(400, 'country must be a 2-letter code');
				try {
					return Response.json(await getPopular(country));
				} catch (e) {
					return jwFail(e);
				}
			}
		}
	}
});
