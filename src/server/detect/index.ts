// kind → detector. Adding movie or search tracking needs an entry here and a relaxed guard
// on POST /api/tracking, not a schema migration.
//
// `movie` and `search` are deliberately absent. Storage already accepts them, so a record
// of either kind can exist; runScan records that on the record's last_error and moves on
// rather than throwing, because one unsupported record must not abort a whole sweep.
import type { TrackKind, TrackRecord } from '$lib/tracking/types';
import type { DetectResult } from './series';
import { detectSeries } from './series';

export type Detector = (track: TrackRecord) => Promise<DetectResult>;

export const detectors: Partial<Record<TrackKind, Detector>> = {
	series: detectSeries
};

export type { DetectResult };
