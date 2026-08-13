// Request/response helpers shared by the tracking and browse routes.

/** Error bodies use `error`, the same key the unshackle API uses, so errorMessage() reads them. */
export function fail(status: number, error: string): Response {
	return Response.json({ error }, { status });
}

/** Parsed JSON object body, or null when the body is absent or not a JSON object. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
		return body as Record<string, unknown>;
	} catch {
		return null;
	}
}

/** A non-empty trimmed string, or null. */
export function str(v: unknown): string | null {
	return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** Uppercased 2-letter `country` query param (default US), or null when malformed. */
export function countryParam(request: Request): string | null {
	const c = (new URL(request.url).searchParams.get('country') || 'US').toUpperCase();
	return /^[A-Z]{2}$/.test(c) ? c : null;
}
