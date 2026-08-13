import { createFileRoute } from '@tanstack/react-router';
import { countryParam, fail } from '../server/http';
import { jwFail, popularList } from '../server/justwatch';

export const Route = createFileRoute('/api/browse/popular/$type')({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const country = countryParam(request);
				if (!country) return fail(400, 'country must be a 2-letter code');
				const objectType =
					params.type === 'movies' ? 'MOVIE' : params.type === 'tv' ? 'SHOW' : null;
				if (!objectType) return fail(404, 'type must be movies or tv');
				try {
					return Response.json(await popularList(country, objectType));
				} catch (e) {
					return jwFail(e);
				}
			}
		}
	}
});
