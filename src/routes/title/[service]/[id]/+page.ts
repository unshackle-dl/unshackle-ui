import { api } from '$lib/api/client';
import type { Title } from '$lib/api/types';

export async function load({
	params,
	url
}: {
	params: { service: string; id: string };
	url: URL;
}): Promise<{
	service: string;
	titleId: string;
	profile: string;
	titles: Title[];
	error: string | null;
}> {
	const { service, id } = params;
	const profile = url.searchParams.get('profile') ?? '';
	try {
		const titles = await api.listTitles({ service, title_id: id, profile: profile || undefined });
		return { service, titleId: id, profile, titles, error: null };
	} catch (e) {
		return {
			service,
			titleId: id,
			profile,
			titles: [],
			error: e instanceof Error ? e.message : String(e)
		};
	}
}
