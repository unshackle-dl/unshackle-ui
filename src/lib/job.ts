import type { Job } from './api/types';
import { episodeProgress } from './download';

// Job status classification and the downloads-page view-model, shared with history.

export type Tone = 'neutral' | 'accent' | 'green' | 'amber' | 'red';

const ACTIVE = ['queued', 'pending', 'running', 'downloading', 'processing', 'muxing'];
const RETRYABLE = ['failed', 'error', 'cancelled', 'canceled'];
const lc = (s: string | undefined) => (s ?? '').toLowerCase();

export const isActive = (status: string | undefined) => ACTIVE.includes(lc(status));
export const isFinished = (status: string | undefined) => !isActive(status); // completed / failed / cancelled
export const isRetryable = (status: string | undefined) => RETRYABLE.includes(lc(status));
export const isQueued = (status: string | undefined) => lc(status) === 'queued';

export function tone(status: string | undefined): Tone {
	const s = lc(status);
	if (s === 'completed' || s === 'done' || s === 'success') return 'green';
	if (s === 'failed' || s === 'error') return 'red';
	if (s === 'cancelled' || s === 'canceled') return 'neutral';
	if (isActive(s)) return 'accent';
	return 'amber';
}

// --skip-dl jobs fetch keys only, no media; their progress is reworded.
export const isKeysOnly = (params: Record<string, unknown> | undefined) => !!params?.skip_dl;

export interface JobView {
	label: string;
	tone: Tone;
	active: boolean;
	finished: boolean;
	retryable: boolean;
	queued: boolean;
	keysOnly: boolean;
	statusLabel: string; // "obtaining keys" while a keys-only job runs, else raw status
	done: boolean;
	doneLabel: string;
	message: string | null;
	error: string | null;
	episodes: ReturnType<typeof episodeProgress>;
	current: string | null; // episode code downloading now, when active
	progress: { muxing: boolean; determinate: boolean; percent: number } | null;
}

export function jobView(job: Job): JobView {
	const active = isActive(job.status);
	const keysOnly = isKeysOnly(job.parameters);
	const t = tone(job.status);
	const ep = episodeProgress(job.parameters?.wanted, job.output_files);
	const muxing = lc(job.phase) === 'muxing';
	return {
		label: job.title || job.title_id || job.job_id,
		tone: t,
		active,
		finished: !active,
		retryable: isRetryable(job.status),
		queued: isQueued(job.status),
		keysOnly,
		statusLabel: keysOnly && active ? 'obtaining keys' : job.status,
		done: t === 'green',
		doneLabel: keysOnly ? 'Keys obtained' : 'Done',
		message: job.phase || job.message || null,
		error: job.error || job.error_message || null,
		episodes: ep,
		current: active ? (job.current_title ?? ep?.current ?? null) : null,
		progress: active
			? {
					muxing,
					determinate: !muxing && typeof job.progress === 'number',
					percent: Math.max(0, Math.min(100, job.progress ?? 0))
				}
			: null
	};
}
