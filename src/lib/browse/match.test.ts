import { describe, expect, it } from 'vitest';
import type { Service } from '$lib/api/types';
import { cleanOfferUrl, matchOffer, toJsRegex } from './match';

const svc = (tag: string, title_regex: string[] | string): Service => ({
	tag,
	aliases: [],
	geofence: [],
	title_regex,
	url: '',
	help: '',
	cli_params: []
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
			'^(?:https?://www\\.netflix\\.com/(?:[a-z]{2}/)?title/)?  # optional url\n(?P<id>\\d+)$';
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
	});

	it('leaves other hosts and non-URLs alone', () => {
		expect(cleanOfferUrl('https://www.netflix.com/title/81234567?src=jw')).toBe(
			'https://www.netflix.com/title/81234567?src=jw'
		);
		expect(cleanOfferUrl('not a url')).toBe('not a url');
	});
});

describe('matchOffer', () => {
	const services = [
		svc('NF', [String.raw`netflix\.com/title/(?P<id>\d+)`]),
		svc('ATV', [
			String.raw`^(?:https?://tv\.apple\.com(?:/[a-z]{2})?/(?:movie|show|episode)/[a-z0-9-]+/)?(?P<id>umc\.cmc\.[a-z0-9]+)`
		]),
		svc('BROKEN', ['(?P<id>[unclosed'])
	];

	it('finds the service and extracts the id', () => {
		expect(matchOffer('https://tv.apple.com/us/show/x/umc.cmc.1zzly0vah', services)).toEqual({
			service: 'ATV',
			id: 'umc.cmc.1zzly0vah'
		});
		expect(matchOffer('https://www.netflix.com/title/81234567', services)).toEqual({
			service: 'NF',
			id: '81234567'
		});
	});

	it('returns null when nothing matches, surviving broken regexes', () => {
		expect(matchOffer('https://www.hulu.com/series/abc', services)).toBeNull();
	});

	it('accepts title_regex serialized as a bare string, not iterating it as characters', () => {
		const amzn = [
			svc(
				'AMZN',
				String.raw`^(?:https?://(?:www\.)?(?:amazon\.(?:com|co\.uk|de|co\.jp)|primevideo\.com)(?:/.+)?/)?(?P<id>[A-Z0-9]{10,}|amzn1\.dv\.gti\.[a-f0-9-]+)`
			)
		];
		expect(
			matchOffer(cleanOfferUrl('https://watch.amazon.com/detail?gti=amzn1.dv.gti.92c7e5ed'), amzn)
		).toEqual({ service: 'AMZN', id: 'amzn1.dv.gti.92c7e5ed' });
	});

	it('prefers the match that claimed the hostname over a mid-URL path fragment', () => {
		// NOW TV (Italy) shares Peacock's platform, so its generic /asset(...) pattern also
		// matches peacocktv.com URLs, but only from mid-URL. PCOK consumes the host.
		const shared = [
			svc('NOWTVIT', [String.raw`/asset(/[^?#]+)`]),
			svc('PCOK', [
				String.raw`(?:https?://(?:www\.)?peacocktv\.com/watch/asset/|/?)(?P<id>movies/[a-z0-9/./-]+/[a-f0-9-]+)`
			])
		];
		expect(
			matchOffer('https://www.peacocktv.com/watch/asset/movies/obsession/210b50e4-5ccd', shared)
		).toEqual({ service: 'PCOK', id: 'movies/obsession/210b50e4-5ccd' });
	});

	it('rejects catch-all patterns whose optional URL prefix did not participate', () => {
		// Real shape from unshackle: bare-id fallback means the pattern matches ANY string.
		const catchAll = [
			svc('PCOK', [String.raw`^(?:https?://www\.peacocktv\.com/watch/asset/)?(?P<id>.+)$`])
		];
		expect(
			matchOffer('https://watch.amazon.com/detail?gti=amzn1.dv.gti.92c7e5ed', catchAll)
		).toBeNull();
		expect(
			matchOffer(
				'https://www.peacocktv.com/watch/asset/tv/the-office/4902514835143843112',
				catchAll
			)
		).toEqual({ service: 'PCOK', id: 'tv/the-office/4902514835143843112' });
	});
});
