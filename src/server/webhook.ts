// The one outbound notification: a single summary POST per check cycle.
//
// Per cycle, never per episode. A season drop is one notification about twelve codes,
// because a tracker that spams its own target gets muted. Cycles that found nothing send
// nothing.
//
// The URL is generic on purpose: whatever accepts a JSON POST, be it Discord, ntfy or a
// shell script behind a reverse proxy. No per-target formatting lives here, because the
// moment it does this file grows a plugin registry.
import type { ScanTrigger } from '$lib/tracking/types';
import { config } from './config';

/** One tracked title that gained codes this cycle. Only tracks with new codes appear. */
export interface WebhookTrack {
	id: string;
	label: string;
	service: string;
	title_id: string;
	/** Codes detected as new. Service-native numbering; see the tvdb_order note below. */
	new_codes: string[];
}

/** A track whose check failed. Same text as the record's `last_error`. */
export interface WebhookError {
	id: string;
	label: string;
	error: string;
}

export interface ScanSummary {
	/** Constant, so a shared endpoint can tell who sent this. */
	source: 'unshackle-ui';
	scan_id: number;
	trigger: ScanTrigger;
	finished_at: string;
	new_count: number;
	tracks: WebhookTrack[];
	errors: WebhookError[];
}

const TIMEOUT_MS = 10_000;

/**
 * Fire-and-forget. Deliberately not awaited by the caller and deliberately never throws:
 * a webhook is a courtesy, and a dead or hanging endpoint must not stall a sweep or lose
 * a detection that is already committed to sqlite. Failures are logged and dropped; there
 * is no retry queue, because a retry queue needs persistence, back-off and its own
 * failure mode.
 *
 * The codes carried here are the service's own episode numbering, which is what detection
 * sees; nothing downstream may replay them into a download. See the tvdb_order note on the
 * Tracking page.
 */
export function notifyScan(summary: ScanSummary): void {
	if (!config.webhookUrl) return;
	if (summary.new_count <= 0) return;
	void post(summary);
}

async function post(summary: ScanSummary): Promise<void> {
	try {
		const res = await fetch(config.webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(summary),
			// Without this a webhook target that accepts the connection and never answers
			// would leave the request pending for as long as the process lives.
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!res.ok) {
			console.warn(`[webhook] ${res.status} ${res.statusText} from ${config.webhookUrl}`);
			return;
		}
		console.log(`[webhook] sent scan ${summary.scan_id}: ${summary.new_count} new`);
	} catch (e) {
		console.warn('[webhook] delivery failed:', e instanceof Error ? e.message : String(e));
	}
}
