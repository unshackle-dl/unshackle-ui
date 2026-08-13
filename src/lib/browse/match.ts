// Matching JustWatch offers to configured unshackle services.
//
// Each service's title_regex (from /api/services) is a Python regex that pulls a title id
// out of a pasted URL. Run against an offer's deep link, a match names the service and
// gives the id for /title/$service/$id. Dependency-free on purpose: imported by both the
// browser and src/server/justwatch.ts.
import type { Service } from '$lib/api/types';

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
 * Null is fine: the offer just renders unmatched instead of the page crashing.
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

/**
 * Best service whose title_regex matches the URL, with the extracted title id.
 *
 * Several services share a platform (Peacock and NOW TV both use /watch/asset/ paths), so
 * more than one regex can match. The one starting earliest, longest on a tie, claimed the
 * hostname rather than a path fragment, so it names the right service.
 */
export function matchOffer(
	url: string,
	services: Service[]
): { service: string; id: string } | null {
	let best: { service: string; id: string; index: number; len: number } | null = null;
	for (const svc of services) {
		// A single-pattern service serializes title_regex as a bare string; iterating
		// that as-is would yield one character at a time.
		const patterns =
			typeof svc.title_regex === 'string' ? [svc.title_regex] : (svc.title_regex ?? []);
		for (const pattern of patterns) {
			const m = toJsRegex(pattern)?.exec(url);
			if (!m) continue;
			const id = m.groups?.id ?? m[1];
			// Most patterns make their URL prefix optional so bare ids also match, which
			// turns some of them into catch-alls against a full URL. Only trust a match
			// where the prefix actually consumed something and the id isn't the URL itself.
			if (!id || id.includes('://') || m[0].length <= id.length) continue;
			if (!best || m.index < best.index || (m.index === best.index && m[0].length > best.len))
				best = { service: svc.tag, id, index: m.index, len: m[0].length };
		}
	}
	return best && { service: best.service, id: best.id };
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
	// A gti param carries the title on hosts the AMZN title_regex doesn't know
	// (watch.amazon.com, app.primevideo.com, ...). The format is Amazon-only, so any
	// link with one can be rewritten to the canonical form the regex does know.
	const gti = url.searchParams.get('gti');
	if (gti?.startsWith('amzn1.dv.gti.')) return `https://www.amazon.com/gp/video/detail/${gti}/`;
	// These carry only tracking in the query string; the title id lives in the path.
	const stripQuery = ['tv.apple.com', 'play.max.com', 'watch.plex.tv', 'therokuchannel.roku.com'];
	if (stripQuery.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`)))
		return url.origin + url.pathname;
	return url.toString();
}
