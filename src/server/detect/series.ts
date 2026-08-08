// Series detection: re-list the title with its stored preset, turn the listing into the
// same episode codes the browser shows, and diff that set against what is stored.
//
// The diff is a *set* diff, never a count delta: a service that reorders, backfills or
// renumbers within a season would make counts lie. Codes are produced by wantedCode()
// from $lib/tracks — the very function the title page selects with — because the poller
// and the browser disagreeing about what "S01E02" means is the one bug that would make
// every later phase untrustworthy.
import type { Title } from '$lib/api/types';
import { wantedCode } from '$lib/tracks';
import { buildListParams } from '$lib/tracking/preset';
import type { TitlePayload, TrackRecord } from '$lib/tracking/types';
import type { ItemState } from '../db';
import { applyDetection, itemStates } from '../db';
import { listTitles } from '../upstream';

export interface DetectResult {
	/** How many episode codes the listing produced. */
	listed: number;
	/** Codes never seen on this track before — these are the "new episode" notifications. */
	added: string[];
	/** Codes that had been marked gone and are back. Not new; see the diff rules below. */
	returned: string[];
	/** Codes that stopped being listed. Stamped `gone_at`, never deleted. */
	vanished: string[];
}

/**
 * The whole of the interesting logic, kept pure so it is testable without a database.
 *
 * Three rules, all of them load-bearing:
 *
 * 1. A code not stored at all is **new**.
 * 2. A stored code missing from the listing is **not deleted** — it is stamped `gone_at`.
 *    Services drop episodes temporarily (regional windows, re-encodes, catalogue churn).
 *    Deleting the row would make the episode arrive as brand new when it returns, which
 *    is exactly the false alarm the tracker exists to avoid.
 * 3. A gone code that is listed again is **returned**: clear `gone_at`, leave `seen_at`
 *    alone. If it had already been watched it stays seen; if it was still unseen it stays
 *    unseen. Either way it never becomes "new" a second time.
 */
export function diffCodes(stored: readonly ItemState[], listed: readonly string[]): DetectResult {
	const seenNow = new Set(listed);
	const known = new Map(stored.map((s) => [s.code, s]));
	const added: string[] = [];
	const returned: string[] = [];
	for (const code of seenNow) {
		const prev = known.get(code);
		if (!prev) added.push(code);
		else if (prev.gone_at !== null) returned.push(code);
	}
	const vanished = stored
		.filter((s) => s.gone_at === null && !seenNow.has(s.code))
		.map((s) => s.code);
	return { listed: seenNow.size, added, returned, vanished };
}

/** Listing → episode codes, in listing order, deduplicated. Non-episodes have no code. */
function codesOf(titles: Title[]): Map<string, string | null> {
	const out = new Map<string, string | null>();
	for (const t of titles ?? []) {
		const code = wantedCode(t);
		if (code && !out.has(code)) out.set(code, t.name ?? null);
	}
	return out;
}

export async function detectSeries(track: TrackRecord): Promise<DetectResult> {
	const payload = track.payload as TitlePayload;
	// buildListParams decides which stored keys may reach a listing call — the service's
	// own cli options matter, the download-only ones are filtered out there, not here.
	const titles = await listTitles(
		buildListParams(payload, track.preset) as { service: string; title_id: string }
	);
	const codes = codesOf(titles);

	// A listing that produces no episode codes at all, for a track that has some, is far
	// more likely to be a service returning junk than a series being pulled in its
	// entirety. Refusing to act on it costs one skipped cycle; acting on it would stamp
	// every episode gone.
	const stored = itemStates(track.id);
	if (codes.size === 0 && stored.length > 0)
		throw new Error(
			`Listing returned no episodes for ${payload.service} ${payload.title_id}; leaving ${stored.length} stored code(s) untouched.`
		);

	const diff = diffCodes(stored, [...codes.keys()]);
	if (diff.added.length || diff.returned.length || diff.vanished.length)
		applyDetection(
			track.id,
			{
				added: diff.added.map((code) => ({ code, title: codes.get(code) ?? null })),
				returned: diff.returned,
				vanished: diff.vanished
			},
			new Date().toISOString()
		);
	return diff;
}
