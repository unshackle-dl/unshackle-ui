// Ownership, mirroring unshackle-live's `caller_key` / `owns_job`
// (unshackle/core/api/handlers.py:283-300) so a tracked record behaves like a job:
// stamped with the creating key, only visible to that key, and shared when the stored
// owner is NULL (records written before this column existed, or by another writer).
//
// Note the Python stamps `caller_key(request)` on create, which is the literal string
// "anonymous" when no key is sent — so a --no-key deployment ends up with every record
// owned by "anonymous" and therefore visible to every caller. That is the intended
// behaviour, not an accident: do not "fix" it into NULL.
import { timingSafeEqual } from 'node:crypto';

/** The authenticating X-Secret-Key for a request, or 'anonymous' when unauthenticated. */
export function callerKey(request: Request): string {
	return request.headers.get('X-Secret-Key') ?? 'anonymous';
}

// `hmac.compare_digest` returns False for a length mismatch; `timingSafeEqual` throws.
// Both leak the length, so the early return matches the Python's observable behaviour.
function constantTimeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a, 'utf8');
	const bb = Buffer.from(b, 'utf8');
	if (ab.length !== bb.length) return false;
	return timingSafeEqual(ab, bb);
}

/** Whether the calling key owns this record. A NULL stored owner stays shared. */
export function owns(ownerKey: string | null, caller: string): boolean {
	if (ownerKey === null) return true;
	return constantTimeEqual(ownerKey, caller);
}
