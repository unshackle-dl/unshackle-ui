// Preset round-tripping: the flat param dict stored on a tracked record, converted to
// and from the title page's form state, and narrowed to what a listing call may carry.
//
// Pure and isomorphic — the poller and the browser must share one implementation, so this
// imports only $lib/options and $lib/download, both of which are type-and-logic only.
import { ADVANCED_FIELDS, blankAdvanced } from '$lib/download';
import { blankValues, coerce, type Field } from '$lib/options';
import type { TitlePayload, TrackPreset } from './types';

export type FormValues = Record<string, string | boolean>;

export interface PresetForm {
	/** Values for ADVANCED_FIELDS. */
	advanced: FormValues;
	/** Values for the service's own cli options. */
	svcValues: FormValues;
	/**
	 * Stored keys with no control in either field set — `tvdb_id` / `tvdb_order` arrive
	 * through the title page's search params, and a preset captured for one service can
	 * hold another's cli option. Carried through untouched so editing a preset in the UI
	 * cannot silently drop them.
	 */
	extra: TrackPreset;
}

const ADVANCED_KEYS = new Set(ADVANCED_FIELDS.map((f) => f.key));

/**
 * Advanced-catalog keys that actually reach `get_titles()`. Verified against
 * `build_parent_ctx` / `instantiate_service`: listing only ever receives the transport
 * options plus the service's own cli params. Everything else in the catalog is
 * track-level and cannot change which episodes exist.
 *
 * `cdm_type` is not in the catalog today; it is whitelisted so it works the moment it is.
 */
export const LIST_AFFECTING_KEYS: readonly string[] = ['profile', 'proxy', 'no_proxy', 'cdm_type'];

/**
 * Stored so a later download can replay them, but INERT during detection: neither
 * `apply_tvdb_order` nor the enrich step runs on the listing path, so detection always
 * sees the service's native episode numbering.
 *
 * `tvdb_order` is the sharp one. A download with it set renumbers, so replaying a detected
 * code through the stored preset can fetch a different episode than the one detected.
 * Nothing here fixes that — it is filtered out of the listing call only so the call carries
 * exactly what shaped the result. Auto-download must decide explicitly what to do with it.
 */
const INERT_KEYS = new Set(['tvdb_id', 'tvdb_order', 'tmdb_id', 'animeapi_id', 'enrich']);

/**
 * The title page's chip selectors. They are not in the advanced catalog, so the
 * pass-through rule below would otherwise mistake them for service cli options. Verified:
 * no service's `get_titles()` reads vcodec/quality/range, and `build_parent_ctx` only ever
 * populates `{proxy, no_proxy}` during listing.
 */
const TRACK_LEVEL_KEYS = new Set(['wanted', 'quality', 'vcodec', 'range', 'a_lang', 's_lang']);

/**
 * Build the `POST /api/list-titles` body for a tracked title.
 *
 * Keeps the transport options plus every key that is not part of the advanced download
 * catalog — those are the service's own cli options (DSNP `extras`, VIKI `is_movie`,
 * NOWTV `region`, …), and ~40 services read one in `get_titles()`. Omitting them makes
 * detection disagree with what a download would resolve.
 */
export function buildListParams(
	payload: TitlePayload,
	preset: TrackPreset
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(preset)) {
		if (INERT_KEYS.has(k) || TRACK_LEVEL_KEYS.has(k)) continue;
		if (ADVANCED_KEYS.has(k) && !LIST_AFFECTING_KEYS.includes(k)) continue;
		out[k] = v;
	}
	// Transport keys last: service/title_id identify the title and must not be overridden.
	return { ...out, service: payload.service, title_id: payload.title_id };
}

/** Form state → the flat dict stored on the record. */
export function buildPreset(form: PresetForm, svcFields: Field[]): TrackPreset {
	const preset: TrackPreset = {
		...form.extra,
		...coerce(ADVANCED_FIELDS, form.advanced),
		...coerce(svcFields, form.svcValues)
	};
	// Never store it: `latest_episode` re-resolves "latest" at download time, which fights
	// a tracker that drives selection through explicit `wanted` codes.
	delete preset.latest_episode;
	return preset;
}

// coerce() produces request-shaped values (numbers, arrays, booleans); the form controls
// want strings, except for checkboxes.
function toFormValue(field: Field, v: unknown): string | boolean {
	if (field.type === 'bool') return v === true;
	if (Array.isArray(v)) return v.join(', ');
	if (v == null) return '';
	return String(v);
}

/** The stored dict → form state, each field left at its default when the preset omits it. */
export function applyPreset(preset: TrackPreset, svcFields: Field[]): PresetForm {
	const advanced = blankAdvanced();
	const svcValues = blankValues(svcFields);
	const extra: TrackPreset = {};
	const advancedByKey = new Map(ADVANCED_FIELDS.map((f) => [f.key, f]));
	const svcByKey = new Map(svcFields.map((f) => [f.key, f]));
	for (const [k, v] of Object.entries(preset)) {
		// Service fields win: a service may legitimately name an option the catalog also
		// has, and the service's own control is the one shown for it.
		const svc = svcByKey.get(k);
		if (svc) {
			svcValues[k] = toFormValue(svc, v);
			continue;
		}
		const adv = advancedByKey.get(k);
		if (adv) advanced[k] = toFormValue(adv, v);
		else extra[k] = v;
	}
	return { advanced, svcValues, extra };
}
