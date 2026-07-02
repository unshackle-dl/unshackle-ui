import { api } from '$lib/api/client';
import type { Service } from '$lib/api/types';

export async function load(): Promise<{ services: Service[]; error: string | null }> {
	try {
		const services = await api.services();
		services.sort((a, b) => a.tag.localeCompare(b.tag));
		return { services, error: null };
	} catch (e) {
		return { services: [], error: e instanceof Error ? e.message : String(e) };
	}
}
