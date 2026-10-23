// Matching JustWatch offers to configured unshackle services.
//
// A service is identified from the metadata /api/services already gives us (the provider's
// hostname against the service's `url`, its JustWatch name against the service tag and
// aliases), with `title_regex` demoted to one signal among several. Regexes are written per
// service by whoever wrote that service, so they disagree with JustWatch's link shapes and
// 23 of them are missing entirely; they are good for pulling an id out of a URL, not for
// deciding who owns the offer. Dependency-free on purpose: imported by both the browser and
// src/server/justwatch.ts.
import type { Service } from '$lib/api/types';
import type { BrowseOffer } from '$lib/browse/types';

/** Verbose-mode (re.VERBOSE) patterns are multi-line with # comments; JS has no x flag. */
function stripVerbose(p: string): string {
	let out = '';
	let inClass = false;
	for (let i = 0; i < p.length; i++) {
		const ch = p[i];
		if (ch === '\\' && i + 1 < p.length) {
			out += ch + p[i + 1];
			i++;
			continue;
		}
		if (ch === '[') inClass = true;
		else if (ch === ']') inClass = false;
		if (!inClass) {
			if (/\s/.test(ch)) continue;
			if (ch === '#') {
				while (i < p.length && p[i] !== '\n') i++;
				continue;
			}
		}
		out += ch;
	}
	return out;
}

/**
 * Translate a Python regex to a JS RegExp, or null when it uses constructs JS rejects.
 * Null is fine: the offer renders unmatched instead of the page crashing.
 */
export function toJsRegex(pattern: string): RegExp | null {
	let flags = '';
	let p = pattern
		// Inline flags like (?i) are a syntax error in JS; hoist the ones that exist there.
		.replace(/\(\?([aiLmsux]+)\)/g, (_, fs: string) => {
			for (const f of ['i', 'm', 's'] as const) if (fs.includes(f)) flags += f;
			return '';
		})
		.replaceAll('(?P<', '(?<')
		.replace(/\(\?P=(\w+)\)/g, '\\k<$1>');
	// A multi-line pattern is a verbose-mode one. It may even compile in JS, with the
	// whitespace and # comments as literals matching nothing, so squeeze it up front.
	if (p.includes('\n')) p = stripVerbose(p);
	try {
		return new RegExp(p, flags);
	} catch {
		try {
			return new RegExp(stripVerbose(p), flags);
		} catch {
			return null;
		}
	}
}

// ~200 patterns are run against every offer on every render; compiling is not free.
const compiled = new Map<string, RegExp | null>();
function compile(pattern: string): RegExp | null {
	if (!compiled.has(pattern)) compiled.set(pattern, toJsRegex(pattern));
	return compiled.get(pattern)!;
}

/** A single-pattern service serializes title_regex as a bare string, not a one-item list. */
const patternsOf = (svc: Service): string[] =>
	typeof svc.title_regex === 'string' ? [svc.title_regex] : (svc.title_regex ?? []);

const TWO_PART_TLDS = new Set([
	'co.uk',
	'com.au',
	'co.jp',
	'com.br',
	'co.nz',
	'com.tr',
	'co.kr',
	'com.mx',
	'co.in',
	'co.za',
	// ponytail: not the public-suffix list; only every 2-part TLD an installed service or a
	// JustWatch offer has used (iview.abc.net.au, genflix.co.id would otherwise
	// collapse to the bare TLD and domain-match strangers).
	'net.au',
	'co.id'
]);

/** Host down to the registrable domain, so play.hbomax.com and www.hbomax.com agree. */
function registrable(host: string): string {
	const parts = host
		.toLowerCase()
		.replace(/^www\./, '')
		.split('.');
	if (parts.length >= 3 && TWO_PART_TLDS.has(parts.slice(-2).join('.')))
		return parts.slice(-3).join('.');
	return parts.slice(-2).join('.');
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

interface Keys {
	domains: Set<string>;
	names: Set<string>;
}

// Services come from react-query, so the same objects are handed back every render.
const keyCache = new WeakMap<Service, Keys>();
function keysOf(svc: Service): Keys {
	const hit = keyCache.get(svc);
	if (hit) return hit;
	const domains = new Set<string>();
	// `url` is occasionally a comma-separated list (VOYO ships one per region) or prose
	// ("https://netflix.com (PlayReady MGK)"). Parenthetical words parse as dotless
	// hostnames, so require a dot or they leak in as fake name keys ("play", "mgk").
	for (const raw of (svc.url ?? '').split(/[,\s]+/).filter(Boolean)) {
		try {
			const host = new URL(raw.includes('//') ? raw : `https://${raw}`).hostname;
			if (host.includes('.')) domains.add(registrable(host));
		} catch {
			/* not a URL */
		}
	}
	const names = new Set<string>();
	for (const n of [svc.tag, ...(svc.aliases ?? []), ...[...domains].map((d) => d.split('.')[0])]) {
		const k = norm(n);
		// Two-letter names (iP, CW) are too short to match on without dragging in noise.
		if (k.length > 2) names.add(k);
	}
	const keys = { domains, names };
	keyCache.set(svc, keys);
	return keys;
}

const sharedPrefix = (a: string, b: string): number => {
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) i++;
	return i;
};

/**
 * The title argument for /title/$service/$id, from the service's own title_regex, or null
 * when none of its patterns take this URL.
 */
function titleId(svc: Service, url: string): string | null {
	for (const pattern of patternsOf(svc)) {
		const re = compile(pattern);
		const m = re?.exec(url);
		if (!m) continue;
		// The id group is named `id` on most services but `content_id`, `movie_id`,
		// `bare_id`, ... on others; take the first group whose name ends in `id`, else
		// the first captured one. (A looser /id/i also caught PMTP's `video` group.)
		const named = Object.entries(m.groups ?? {}).find(
			([k, v]) => v != null && /(?:^|_)id$/i.test(k)
		);
		const captured = named?.[1] ?? m.slice(1).find((g) => g != null);
		// Most patterns make their URL prefix optional so bare ids also match, which
		// turns some of them into catch-alls against a full URL. Only trust a match
		// where the prefix consumed something and the id is not the URL itself.
		if (!captured || captured.includes('://') || m[0].length <= captured.length) continue;
		// The pattern's own bare-id branch is the arbiter of what an id looks like: a
		// match that stopped mid-path on a URL shape the author did not know (HMAX on
		// hbomax.com/gb/en/… captures "en") holds a path fragment, not an id.
		if (re!.test(captured)) return captured;
		// A pattern that consumed the whole URL and has no bare-id branch (OSNP) takes
		// only a URL as its title argument, so hand the URL over rather than an id
		// unshackle would reject.
		if (m[0] === url) return url;
	}
	return null;
}

export interface OfferMatch {
	service: string;
	/** Title argument: an extracted id where the service's regex yields one, else the URL. */
	id: string;
	/** Other services that also scored, best first: the title page offers them as a switch. */
	alts: string[];
}

/**
 * Best service for an offer, scored across four weak signals rather than one strict regex.
 *
 * Domain and name are what identify the provider; a regex hit only adds weight (and the id).
 * Requiring a domain or name signal is what keeps a loose pattern from claiming a stranger's
 * URL: PCOK's `(?:...|/?)(?P<id>.+)` otherwise matches a German DVD shop.
 */
export function matchOffer(
	offer: Pick<BrowseOffer, 'url' | 'packageName' | 'packageTechnicalName'>,
	services: Service[],
	country: string
): OfferMatch | null {
	let url: URL;
	try {
		url = new URL(offer.url);
	} catch {
		return null;
	}
	const host = registrable(url.hostname);
	const offerNames = [norm(offer.packageTechnicalName ?? ''), norm(offer.packageName ?? '')].filter(
		Boolean
	);
	const cc = country.toUpperCase();

	const scored: { tag: string; id: string | null; score: number; geo: number }[] = [];
	for (const svc of services) {
		const { domains, names } = keysOf(svc);
		let score = 0;
		let identified = false;
		if (domains.has(host)) {
			score += 3;
			identified = true;
		}
		let name = 0;
		for (const k of offerNames)
			for (const n of names) {
				if (k === n) name = Math.max(name, 3);
				// "amazonprimevideo" ⊃ "primevideo", "amazonepix" and "amazonnew" share a stem.
				else if (k.includes(n) || n.includes(k) || sharedPrefix(k, n) >= 6)
					name = Math.max(name, 1);
			}
		if (name) {
			score += name;
			identified = true;
		}
		const id = titleId(svc, offer.url);
		if (id) score += 2;
		if (!identified || score < 3) continue;
		const geofence = (svc.geofence ?? []).map((g) => g.toUpperCase());
		scored.push({ tag: svc.tag, id, score, geo: geofence.includes(cc) ? 1 : 0 });
	}
	// Duplicate services for one provider (NF/NF_PR, HULU/HULUJP) tie on score: prefer the
	// one geofenced to the country being browsed, then the plainer tag.
	scored.sort(
		(a, b) =>
			b.score - a.score ||
			b.geo - a.geo ||
			a.tag.length - b.tag.length ||
			a.tag.localeCompare(b.tag)
	);
	const best = scored[0];
	if (!best) return null;
	// Aggregators sometimes deep-link nothing but the site root ("Paramount+ Apple TV
	// channel" is a bare https://tv.apple.com/): no id, and the URL names no title either.
	if (!best.id && !url.pathname.replace(/\/+$/, '') && !url.search) return null;
	return { service: best.tag, id: best.id ?? offer.url, alts: scored.slice(1).map((s) => s.tag) };
}

/**
 * Strip the affiliate/tracking noise JustWatch wraps deep links in, so title_regex sees
 * the URL a user would paste. Unknown hosts pass through untouched.
 */
export function cleanOfferUrl(raw: string): string {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return raw;
	}
	// Disney+ arrives as a bn5x.net affiliate redirect with the real link in `u`.
	if (url.hostname.endsWith('bn5x.net')) {
		const u = url.searchParams.get('u');
		if (u) {
			try {
				url = new URL(u);
			} catch {
				return raw;
			}
		}
	}
	// A gti param carries the title on hosts the AMZN title_regex does not know
	// (watch.amazon.com, app.primevideo.com, ...). Usually an amzn1.dv.gti UUID, but a
	// bare ASIN on watch.amazon.co.jp; both forms are Amazon-only, so any link with one
	// can be rewritten to the canonical form the regex does know.
	// ponytail: the one provider-specific block left; it dies the day AMZN's TITLE_RE
	// (in unshackle-live's services/_repos) learns these hosts itself.
	const gti = url.searchParams.get('gti');
	if (gti && /^(?:amzn1\.dv\.gti\.[a-f0-9-]+|[A-Z0-9]{10,})$/.test(gti))
		return `https://www.amazon.com/gp/video/detail/${gti}/`;
	// These carry only tracking in the query string; the title id lives in the path.
	const stripQuery = [
		'tv.apple.com',
		'itunes.apple.com',
		'play.max.com',
		'watch.plex.tv',
		'therokuchannel.roku.com'
	];
	if (stripQuery.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`)))
		return url.origin + url.pathname;
	return url.toString();
}
