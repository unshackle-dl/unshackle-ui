import { describe, expect, it } from 'vitest';
import type { Service } from '$lib/api/types';
import { cleanOfferUrl, matchOffer, toJsRegex } from './match';

const svc = (s: Partial<Service> & { tag: string }): Service => ({
	aliases: [],
	geofence: [],
	title_regex: [],
	url: '',
	help: '',
	cli_params: [],
	...s
});

const offer = (url: string, technical = '', name = technical) => ({
	url,
	packageTechnicalName: technical,
	packageName: name
});

describe('toJsRegex', () => {
	it('translates (?P<name>) groups', () => {
		const re = toJsRegex(String.raw`(?P<id>umc\.cmc\.[a-z0-9]+)`);
		expect(re?.exec('https://tv.apple.com/us/show/x/umc.cmc.1zzly0vah')?.groups?.id).toBe(
			'umc.cmc.1zzly0vah'
		);
	});

	it('hoists inline (?i) flags', () => {
		expect(toJsRegex('(?i)netflix')?.test('NETFLIX.com')).toBe(true);
	});

	it('returns null on invalid patterns instead of throwing', () => {
		expect(toJsRegex('(?P<id>[a-z')).toBeNull();
	});

	it('squeezes Python verbose-mode patterns (whitespace + # comments)', () => {
		const verbose =
			'^(?:https://www\\.netflix\\.com/(?:[a-z]{2}/)?title/)?  # optional url\n(?P<id>\\d+)$';
		const re = toJsRegex(verbose);
		expect(re?.exec('https://www.netflix.com/title/81234567')?.groups?.id).toBe('81234567');
	});
});

describe('cleanOfferUrl', () => {
	it('unwraps bn5x.net affiliate links', () => {
		const wrapped =
			'https://www.bn5x.net/c/1234/5678?u=' +
			encodeURIComponent('https://www.disneyplus.com/movies/x/abc123');
		expect(cleanOfferUrl(wrapped)).toBe('https://www.disneyplus.com/movies/x/abc123');
	});

	it('strips tracking query strings from known hosts', () => {
		expect(cleanOfferUrl('https://tv.apple.com/us/show/x/umc.cmc.abc?at=1000&ct=jw')).toBe(
			'https://tv.apple.com/us/show/x/umc.cmc.abc'
		);
		expect(cleanOfferUrl('https://itunes.apple.com/ae/movie/interstellar/id965491522?uo=4')).toBe(
			'https://itunes.apple.com/ae/movie/interstellar/id965491522'
		);
		expect(cleanOfferUrl('https://play.max.com/show/uuid-1?irclickid=x')).toBe(
			'https://play.max.com/show/uuid-1'
		);
	});

	it('rewrites Amazon gti links (any host) to the canonical amazon.com form', () => {
		expect(cleanOfferUrl('https://watch.amazon.com/detail?gti=amzn1.dv.gti.92c7e5ed-9cf4')).toBe(
			'https://www.amazon.com/gp/video/detail/amzn1.dv.gti.92c7e5ed-9cf4/'
		);
		// CA/UK arrive on app.primevideo.com, which the AMZN title_regex doesn't know.
		expect(cleanOfferUrl('https://app.primevideo.com/detail?gti=amzn1.dv.gti.414eb1af')).toBe(
			'https://www.amazon.com/gp/video/detail/amzn1.dv.gti.414eb1af/'
		);
		// JP puts a bare ASIN in gti instead of an amzn1.dv.gti UUID.
		expect(cleanOfferUrl('https://watch.amazon.co.jp/detail?gti=B0H4NDKSCT')).toBe(
			'https://www.amazon.com/gp/video/detail/B0H4NDKSCT/'
		);
		// A gti that is neither form is not an Amazon title; leave the link alone.
		expect(cleanOfferUrl('https://example.com/x?gti=abc')).toBe('https://example.com/x?gti=abc');
	});

	it('leaves other hosts and non-URLs alone', () => {
		expect(cleanOfferUrl('https://www.netflix.com/title/81234567?src=jw')).toBe(
			'https://www.netflix.com/title/81234567?src=jw'
		);
		expect(cleanOfferUrl('not a url')).toBe('not a url');
	});
});

// Fixtures are the real shapes from /api/services, trimmed to the fields matching reads.
const NF = svc({
	tag: 'NF',
	aliases: ['NF', 'Netflix', 'netflix', 'nf'],
	url: 'https://netflix.com',
	title_regex: String.raw`^(?:https?://(?:www\.)?netflix\.com(?:/[a-z0-9]{2})?/(?:title/|watch/|.+jbv=))?(?P<title_id>\d+)`
});
const NF_PR = svc({
	tag: 'NF_PR',
	aliases: ['NF_PR', 'NetflixPR'],
	url: 'https://netflix.com (PlayReady MGK)',
	title_regex: [
		String.raw`^(?:https?://(?:www\.)?netflix\.com(?:/[a-z0-9]{2})?/(?:title/|watch/|.+jbv=))?(?P<id>\d+)`
	]
});
const AMZN = svc({
	tag: 'AMZN',
	aliases: ['amazon-new', 'prime-new'],
	url: 'https://primevideo.com',
	title_regex: String.raw`^(?:https?://(?:www\.)?(?:amazon\.(?:com|co\.uk|de|co\.jp)|primevideo\.com)(?:/.+)?/)?(?P<id>[A-Z0-9]{10,}|amzn1\.dv\.gti\.[a-f0-9-]+)`
});
const AMZN_WEB = svc({ ...AMZN, tag: 'AMZN_WEB', aliases: [] });
const OSNP = svc({
	tag: 'OSNP',
	url: 'https://osnplus.com',
	title_regex: String.raw`https?://osnplus\.com/en-sa/(?:series|movie)/[^/]+-(?P<id>\d+)$`
});
const HULU = svc({
	tag: 'HULU',
	aliases: ['HULU', 'hulu'],
	url: 'https://hulu.com',
	title_regex: String.raw`^(?:https?://(?:www\.)?hulu\.com/(?P<type>movie|series)/)?(?:(?P<slug>[a-z0-9-]+)-)?(?P<id>[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})`
});
const HULUJP = svc({
	tag: 'HULUJP',
	aliases: ['HULUJP', 'HJ', 'HULUJAPAN'],
	geofence: ['JP'],
	url: 'https://hulu.jp',
	title_regex: [String.raw`^(?:https?://(?:www\.)?hulu\.jp/)?(?P<id>[a-zA-Z0-9-]+)(?:\?.*)?$`]
});
const SKST = svc({
	tag: 'SKST',
	aliases: ['SKST', 'SKY', 'Skyshowtime'],
	url: 'https://skyshowtime.com',
	title_regex: String.raw`https://www\.skyshowtime\.com/watch/asset(?P<slug>/(?P<type>tv|movies)/[^/]+/(?P<id>[a-f0-9-]+))`
});
// Its last pattern matches very nearly any string, which is what makes it the test for
// "a regex hit alone must not claim an offer".
const PCOK = svc({
	tag: 'PCOK',
	aliases: ['PCOK', 'peacock'],
	geofence: ['us'],
	url: 'https://peacocktv.com',
	title_regex: [
		String.raw`(?:https?://(?:www\.)?peacocktv\.com/watch/asset/|/?)(?P<id>movies/[a-z0-9/./-]+/[a-f0-9-]+)`,
		String.raw`(?:https?://(?:www\.)?peacocktv\.com/stream-tv/)?(?P<id>[a-z0-9-/.]+)`
	]
});
const HMAX = svc({
	tag: 'HMAX',
	aliases: ['MAX', 'hbomax', 'HBO'],
	url: 'https://play.hbomax.com/',
	title_regex: String.raw`^(?:https?://(?:www\.|play\.)?hbomax\.com/)?(?P<type>[^/]+)/(?P<id>[^/]+)`
});
const PMTP = svc({
	tag: 'PMTP',
	aliases: ['paramountplus', 'paramount+'],
	url: 'https://paramountplus.com',
	title_regex: String.raw`https?://(?:(?:www(?:\.intl)?)|intl)\.paramountplus\.com(/.*?)?/(?P<type>shows|movies)(/(?P<video>.*?))?/(?P<id>[a-zA-Z0-9_-]+)`
});
// A service with no title_regex at all: 23 of the installed ones look like this.
const ITV = svc({ tag: 'ITV', aliases: ['itvx'], geofence: ['gb'], url: 'https://www.itv.com/' });

const ALL = [NF, NF_PR, AMZN, AMZN_WEB, OSNP, HULU, HULUJP, SKST, PCOK, HMAX, PMTP, ITV];

describe('matchOffer', () => {
	it('matches on the provider hostname and extracts the id from the regex', () => {
		expect(
			matchOffer(offer('https://www.netflix.com/title/81234567', 'netflix'), ALL, 'US')
		).toEqual({ service: 'NF', id: '81234567', alts: ['NF_PR'] });
	});

	it('matches a service that ships no title_regex, handing over the URL', () => {
		const o = offer('https://www.itv.com/watch/vera/2a0967/2a0967a0001', 'itv', 'ITVX');
		expect(matchOffer(o, ALL, 'GB')).toEqual({
			service: 'ITV',
			id: 'https://www.itv.com/watch/vera/2a0967/2a0967a0001',
			alts: []
		});
	});

	it('matches OSN+ on the domain even though its regex rejects JustWatch’s link shape', () => {
		// /en/movie/19038 is not the /en-sa/<type>/<slug>-<id> the OSNP regex wants.
		const o = offer('https://osnplus.com/en/movie/19038', 'osn', 'OSN+');
		expect(matchOffer(o, ALL, 'AE')).toEqual({
			service: 'OSNP',
			id: 'https://osnplus.com/en/movie/19038',
			alts: []
		});
	});

	it('matches the amazon.* family through the shared name stem', () => {
		// The service url is primevideo.com; the offers land on amazon.com, and JustWatch
		// names every channel separately (amazonepix, amazonmgmplus, ...).
		const o = offer(
			'https://www.amazon.com/gp/video/detail/amzn1.dv.gti.92c7e5ed-9cf4/',
			'amazonepix',
			'Epix Amazon Channel'
		);
		expect(matchOffer(o, ALL, 'US')).toEqual({
			service: 'AMZN',
			id: 'amzn1.dv.gti.92c7e5ed-9cf4',
			// AMZN_WEB shares the regex but nothing names it, so it is not offered as a
			// switch here; on the canonical "amazonprimevideo" package it is.
			alts: []
		});
		const canonical = offer(
			'https://www.amazon.com/gp/video/detail/amzn1.dv.gti.92c7e5ed-9cf4/',
			'amazonprimevideo',
			'Amazon Prime Video'
		);
		expect(matchOffer(canonical, ALL, 'US')?.alts).toEqual(['AMZN_WEB']);
	});

	it('separates same-brand services by domain (hulu.jp is HULUJP, not HULU)', () => {
		expect(
			matchOffer(offer('https://www.hulu.jp/kaiju-no-8', 'hulu', 'Hulu'), ALL, 'JP')?.service
		).toBe('HULUJP');
		const us = 'https://www.hulu.com/movie/x-34bc6b99-813f-4d5d-bbe7-f3099b458701';
		expect(matchOffer(offer(us, 'hulu', 'Hulu'), ALL, 'US')?.service).toBe('HULU');
	});

	it('lets the domain outrank a loose regex from another service', () => {
		// PCOK's stream-tv pattern matches the skyshowtime path too; SKST owns the host.
		const o = offer('https://www.skyshowtime.com/watch/asset/movies/x/abc123', 'skyshowtime');
		expect(matchOffer(o, ALL, 'GB')?.service).toBe('SKST');
	});

	it('hands over the URL when a pattern captured a fragment it would not accept as an id', () => {
		// HMAX's regex expects <type>/<id> but this shape is <country>/<lang>/...; it
		// captures id="en", which its own bare-id branch rejects, so the URL wins.
		const gb = 'https://www.hbomax.com/gb/en/movies/troy/7ac50197-160f-4d38-8f4a-21a023e4aec7';
		expect(matchOffer(offer(gb, 'max', 'Max'), ALL, 'GB')).toEqual({
			service: 'HMAX',
			id: gb,
			alts: []
		});
		// PMTP's lazy groups shift on deep /video/ links until `id` captures "video".
		const deep = 'https://www.paramountplus.com/shows/lioness/video/GcIUYWxUdC/lioness';
		expect(matchOffer(offer(deep, 'paramountplus', 'Paramount+'), ALL, 'US')?.id).toBe(deep);
	});

	it('ignores prose in a service url instead of minting name keys from it', () => {
		// NF_PR's url ends in "(PlayReady MGK)"; "MGK)" parses as a dotless hostname and
		// must not become a name key that claims an unrelated provider called MGK.
		expect(matchOffer(offer('https://mgk.tv/show/1', 'mgk', 'MGK'), ALL, 'US')).toBeNull();
	});

	it('rejects an offer that only a loose regex matched', () => {
		// A German DVD shop, matched by PCOK's catch-all pattern and nothing else.
		expect(
			matchOffer(offer('https://www.jpc.de/-/art/spider-man/hnum/1234', 'jpc'), ALL, 'DE')
		).toBeNull();
		expect(matchOffer(offer('https://www.zavvi.com/dvd/x', 'zavvi'), ALL, 'GB')).toBeNull();
	});

	it('rejects an offer whose deep link is just the provider’s home page', () => {
		// JustWatch links some channel offers at the bare host: nothing to open there.
		expect(matchOffer(offer('https://www.itv.com/', 'itv', 'ITVX'), ALL, 'GB')).toBeNull();
	});

	it('survives an unparseable URL and a service whose regex will not compile', () => {
		const broken = [
			svc({ tag: 'BROKEN', url: 'https://broken.tv', title_regex: '(?P<id>[unclosed' })
		];
		expect(matchOffer(offer('not a url', 'x'), ALL, 'US')).toBeNull();
		expect(matchOffer(offer('https://broken.tv/show/1', 'broken'), broken, 'US')).toEqual({
			service: 'BROKEN',
			id: 'https://broken.tv/show/1',
			alts: []
		});
	});
});
