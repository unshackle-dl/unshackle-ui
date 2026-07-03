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
	proxy: string;
	noProxy: boolean;
	titles: Title[];
	error: string | null;
}> {
	const { service, id } = params;
	const profile = url.searchParams.get('profile') ?? '';
	const proxy = url.searchParams.get('proxy') ?? '';
	const noProxy = url.searchParams.get('no_proxy') === '1';
	try {
		const titles = await api.listTitles({
			service,
			title_id: id,
			profile: profile || undefined,
			proxy: proxy || undefined,
			no_proxy: noProxy || undefined
		});
		return { service, titleId: id, profile, proxy, noProxy, titles, error: null };
	} catch (e) {
		return {
			service,
			titleId: id,
			profile,
			proxy,
			noProxy,
			titles: [],
			error: e instanceof Error ? e.message : String(e)
		};
	}
}
