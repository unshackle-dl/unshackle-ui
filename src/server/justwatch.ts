// Server-side JustWatch client. apis.justwatch.com sends no CORS headers, so the browser
// can never call it directly; the api.browse.* routes proxy through here. No key, no auth:
// country and language are plain GraphQL variables.
import { cleanOfferUrl } from '$lib/browse/match';
import type {
	BrowseOffer,
	BrowseSearchResponse,
	BrowseTitle,
	PopularResponse,
	TitleDetailResponse
} from '$lib/browse/types';
import { fail } from './http';

const ENDPOINT = 'https://apis.justwatch.com/graphql';
const IMAGES = 'https://images.justwatch.com';

export class JustWatchError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
		this.name = 'JustWatchError';
	}
}

/** Error → Response for the api.browse.* handlers; unknown failures read as a bad gateway. */
export function jwFail(e: unknown): Response {
	const status = e instanceof JustWatchError && e.status >= 400 ? e.status : 502;
	return fail(status, e instanceof Error ? e.message : String(e));
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
	let res: Response;
	try {
		res = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query, variables })
		});
	} catch {
		throw new JustWatchError(0, 'Cannot reach JustWatch.');
	}
	if (!res.ok)
		throw new JustWatchError(res.status, `JustWatch replied ${res.status} ${res.statusText}.`);
	const body = (await res.json()) as { data?: T; errors?: { message?: string }[] };
	if (body.errors?.length)
		throw new JustWatchError(502, body.errors[0].message || 'JustWatch query failed.');
	if (!body.data) throw new JustWatchError(502, 'Empty JustWatch response.');
	return body.data;
}

// ponytail: in-memory TTL cache, a restart just refetches; sqlite if that ever hurts
const cache = new Map<string, { at: number; data: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
	const data = await fn();
	cache.set(key, { at: Date.now(), data });
	return data;
}

/** Image paths come back relative; the CDN host is implied. */
const img = (path: string | null | undefined): string | null =>
	path ? (path.startsWith('http') ? path : `${IMAGES}${path}`) : null;

interface ContentNode {
	title?: string | null;
	originalReleaseYear?: number | null;
	shortDescription?: string | null;
	runtime?: number | null;
	fullPath?: string | null;
	genres?: { translation?: string | null }[] | null;
	posterUrl?: string | null;
	backdrops?: { backdropUrl?: string | null }[] | null;
}

interface TitleNode {
	id: string;
	objectType: 'MOVIE' | 'SHOW';
	content?: ContentNode | null;
}

function toTitle(node: TitleNode): BrowseTitle {
	const c = node.content ?? {};
	return {
		id: node.id,
		objectType: node.objectType,
		title: c.title ?? '(untitled)',
		year: c.originalReleaseYear ?? null,
		posterUrl: img(c.posterUrl),
		genres: (c.genres ?? []).map((g) => g?.translation ?? '').filter(Boolean),
		synopsis: c.shortDescription ?? null,
		runtime: c.runtime ?? null,
		backdropUrl: img(c.backdrops?.[0]?.backdropUrl)
	};
}

// One query for both the popular grid and search: searchQuery is just a filter key.
const TITLES_QUERY = `
query Titles($country: Country!, $language: Language!, $filter: TitleFilter!, $first: Int!, $profile: PosterProfile) {
	popularTitles(country: $country, filter: $filter, first: $first, sortBy: POPULAR, sortRandomSeed: 0) {
		edges { node {
			id objectType
			content(country: $country, language: $language) {
				title originalReleaseYear shortDescription
				genres { translation(language: $language) }
				posterUrl(profile: $profile, format: JPG)
			}
		} }
	}
}`;

interface TitlesData {
	popularTitles?: { edges?: { node: TitleNode }[] | null } | null;
}

async function fetchTitles(
	country: string,
	filter: Record<string, unknown>,
	first: number
): Promise<BrowseTitle[]> {
	const data = await graphql<TitlesData>(TITLES_QUERY, {
		country,
		language: 'en',
		filter,
		first,
		profile: 'S332'
	});
	return (data.popularTitles?.edges ?? []).map((e) => toTitle(e.node));
}

export function getPopular(country: string): Promise<PopularResponse> {
	return cached(`popular:${country}`, 6 * 3600_000, async () => {
		const [movies, shows] = await Promise.all([
			fetchTitles(country, { objectTypes: ['MOVIE'] }, 5),
			fetchTitles(country, { objectTypes: ['SHOW'] }, 5)
		]);
		return { movies, shows };
	});
}

/** The "All" page for one type. */
export function popularList(
	country: string,
	objectType: 'MOVIE' | 'SHOW'
): Promise<BrowseSearchResponse> {
	// ponytail: fixed 40 titles, add paging if anyone ever scrolls past them
	return cached(`popular:${country}:${objectType}`, 6 * 3600_000, async () => ({
		results: await fetchTitles(country, { objectTypes: [objectType] }, 40)
	}));
}

export function searchTitles(query: string, country: string): Promise<BrowseSearchResponse> {
	return cached(`search:${country}:${query.toLowerCase()}`, 10 * 60_000, async () => ({
		results: await fetchTitles(country, { searchQuery: query, includeTitlesWithoutUrl: true }, 20)
	}));
}

const DETAIL_QUERY = `
query TitleDetail($nodeId: ID!, $country: Country!, $language: Language!) {
	node(id: $nodeId) {
		... on MovieOrShow {
			id objectType
			content(country: $country, language: $language) {
				title originalReleaseYear shortDescription runtime fullPath
				genres { translation(language: $language) }
				posterUrl(profile: S718, format: JPG)
				backdrops(profile: S1920, format: JPG) { backdropUrl }
			}
			offers(country: $country, platform: WEB, filter: {}) {
				monetizationType standardWebURL
				package { packageId clearName technicalName icon(profile: S100) }
			}
		}
	}
}`;

/**
 * Countries a title has a JustWatch page in, the nearest thing to a "where is this
 * available" signal. From the REST side of the API; [] on any failure.
 */
async function titleCountries(fullPath: string): Promise<string[]> {
	try {
		const res = await fetch(
			`https://apis.justwatch.com/content/urls?path=${encodeURIComponent(fullPath)}`
		);
		if (!res.ok) return [];
		const body = (await res.json()) as { href_lang_tags?: { locale?: string }[] };
		const codes = (body.href_lang_tags ?? [])
			.map((t) => t.locale?.split('_').pop() ?? '')
			.filter((c) => /^[A-Z]{2}$/.test(c));
		return [...new Set(codes)].sort();
	} catch {
		return [];
	}
}

/**
 * JustWatch's Apple TV offer for a show deep-links its first episode, and ATV can't resolve
 * episode ids. The episode page embeds its show's id, so swap the URL for the show page.
 * Returns the input on any failure.
 */
// ponytail: HTML scrape of tv.apple.com, switch to Apple's uts API if it ever breaks
async function appleShowUrl(episodeUrl: string): Promise<string> {
	try {
		const res = await fetch(episodeUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
		if (!res.ok) return episodeUrl;
		const html = await res.text();
		const showId = html.match(/"showId"\s*:\s*"(umc\.cmc\.[a-z0-9]+)"/)?.[1];
		if (!showId) return episodeUrl;
		// Prefer the page's own show link (has the real slug); fall back to a dummy slug,
		// which tv.apple.com redirects and the ATV title_regex accepts either way.
		const path = html.match(
			new RegExp(`(?:/[a-z]{2})?/show/[a-z0-9-]+/${showId.replaceAll('.', '\\.')}`)
		)?.[0];
		return `https://tv.apple.com${path ?? `/us/show/show/${showId}`}`;
	} catch {
		return episodeUrl;
	}
}

interface OfferNode {
	monetizationType?: string | null;
	standardWebURL?: string | null;
	package?: {
		packageId?: number | null;
		clearName?: string | null;
		technicalName?: string | null;
		icon?: string | null;
	} | null;
}

interface DetailData {
	node?: (TitleNode & { offers?: OfferNode[] | null }) | null;
}

export function getTitle(nodeId: string, country: string): Promise<TitleDetailResponse> {
	return cached(`title:${country}:${nodeId}`, 3600_000, async () => {
		const data = await graphql<DetailData>(DETAIL_QUERY, { nodeId, country, language: 'en' });
		const node = data.node;
		if (!node?.id) throw new JustWatchError(404, 'Title not found on JustWatch.');

		// Offers repeat per presentation type (SD/HD/4K) and monetization: one row per
		// provider, monetization types merged, streamable providers first.
		const rank = (m: string) => {
			const i = ['FLATRATE', 'FREE', 'ADS', 'RENT', 'BUY'].indexOf(m);
			return i === -1 ? 99 : i;
		};
		const byPkg = new Map<number, BrowseOffer>();
		const raw = (node.offers ?? []).filter((o) => o.standardWebURL && o.package?.packageId);
		raw.sort((a, b) => rank(a.monetizationType ?? '') - rank(b.monetizationType ?? ''));
		for (const o of raw) {
			const pkg = o.package!;
			const mon = o.monetizationType ?? 'FLATRATE';
			const existing = byPkg.get(pkg.packageId!);
			if (existing) {
				if (!existing.monetization.includes(mon)) existing.monetization.push(mon);
				continue;
			}
			byPkg.set(pkg.packageId!, {
				url: cleanOfferUrl(o.standardWebURL!),
				packageId: pkg.packageId!,
				packageName: pkg.clearName || pkg.technicalName || 'Unknown',
				packageTechnicalName: pkg.technicalName ?? '',
				iconUrl: img(pkg.icon),
				monetization: [mon]
			});
		}
		const offers = [...byPkg.values()];
		for (const offer of offers) {
			if (node.objectType === 'SHOW' && /tv\.apple\.com\/.*\/episode\//.test(offer.url))
				offer.url = await appleShowUrl(offer.url);
		}
		const countries = node.content?.fullPath ? await titleCountries(node.content.fullPath) : [];
		return { title: toTitle(node), offers, countries };
	});
}
