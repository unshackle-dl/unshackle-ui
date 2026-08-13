// Wire types for the UI's own JustWatch proxy routes (/api/browse/*), shared by
// src/server/justwatch.ts and the browser client, like tracking/types.

export interface BrowseTitle {
	/** JustWatch GraphQL node id, the param of /browse/$id. */
	id: string;
	objectType: 'MOVIE' | 'SHOW';
	title: string;
	year: number | null;
	/** Absolute URL (images.justwatch.com), or null when JustWatch has no artwork. */
	posterUrl: string | null;
	genres: string[];
	synopsis: string | null;
	runtime: number | null;
	backdropUrl: string | null;
}

export interface BrowseOffer {
	/** Cleaned provider deep link (affiliate wrappers unwrapped, tracking params stripped). */
	url: string;
	packageId: number;
	packageName: string;
	packageTechnicalName: string;
	iconUrl: string | null;
	/** FLATRATE / FREE / ADS / RENT / BUY …, deduped per provider, best-first. */
	monetization: string[];
}

export interface PopularResponse {
	movies: BrowseTitle[];
	shows: BrowseTitle[];
}

export interface BrowseSearchResponse {
	results: BrowseTitle[];
}

export interface TitleDetailResponse {
	title: BrowseTitle;
	offers: BrowseOffer[];
	/** Countries the title has a JustWatch page in, sorted; [] when unknown. */
	countries: string[];
}
