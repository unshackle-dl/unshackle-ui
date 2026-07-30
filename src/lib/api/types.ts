// Shapes mirror the live unshackle API (probed against /api/docs/swagger.json +
// real ATV responses). Response bodies for search/titles/tracks are not in the
// OpenAPI schema, so these are derived from actual payloads.

export interface Health {
	status: string;
	version: string;
	code_hash?: string | null;
	update_check?: {
		update_available: boolean;
		current_version: string;
		latest_version: string | null;
	};
}

export interface CliParam {
	name: string;
	kind: string;
	required?: boolean;
	opts?: string[];
	is_flag?: boolean;
	default?: unknown;
	help?: string;
	type?: string;
	choices?: string[];
	multiple?: boolean;
}

export interface Service {
	tag: string;
	aliases: string[];
	geofence: string[];
	title_regex: string[];
	url: string;
	help: string;
	cli_params: CliParam[];
}

export interface SearchResult {
	id: string;
	title: string;
	description: string | null;
	label?: string;
	url?: string;
}

export interface SearchResponse {
	results: SearchResult[];
	count: number;
}

export interface Title {
	type: string; // "episode" | "movie" | ...
	name: string;
	id: string;
	language: string | null;
	description: string | null;
	date: string | null;
	cover_url: string | null;
	year: number | null;
	series_title?: string | null;
	season?: number | null;
	number?: number | null;
}

export interface VideoTrack {
	id: string;
	codec: string;
	codec_display: string;
	bitrate: number;
	width: number;
	height: number;
	resolution: string;
	fps: number;
	range: string; // SDR | HDR10 | HDR10P | DV
	range_display: string;
	language: string | null;
	drm: string | null;
	descriptor: string;
}

export interface AudioTrack {
	id: string;
	codec: string;
	codec_display: string;
	bitrate: number;
	channels: number;
	language: string | null;
	is_original: boolean;
	atmos: boolean;
	descriptive: boolean;
	drm: string | null;
	descriptor: string;
}

export interface SubtitleTrack {
	id: string;
	codec: string;
	language: string | null;
	forced: boolean;
	sdh: boolean;
	cc: boolean;
	descriptor: string;
}

export interface Tracks {
	title: Title;
	video: VideoTrack[];
	audio: AudioTrack[];
	subtitles: SubtitleTrack[];
}

// /api/download accepts ~60 optional fields; we type the ones the UI uses and
// allow the rest. service + title_id are required.
export interface DownloadRequest {
	service: string;
	title_id: string;
	profile?: string;
	quality?: number[];
	range?: string[];
	vcodec?: string[];
	acodec?: string;
	wanted?: string[];
	lang?: string[];
	v_lang?: string[];
	a_lang?: string[];
	s_lang?: string[];
	video_only?: boolean;
	audio_only?: boolean;
	subs_only?: boolean;
	no_subs?: boolean;
	no_audio?: boolean;
	no_video?: boolean;
	[key: string]: unknown;
}

export interface DownloadJobRef {
	job_id: string;
	status: string;
	created_time: string;
}

// Live job record from /api/download/jobs[/{id}]. Fields beyond the core set
// vary by job state, so extra keys are allowed.
export interface Job {
	job_id: string;
	status: string; // queued | downloading | completed | failed | cancelled ...
	created_time?: string;
	progress?: number; // 0-100
	service?: string;
	title_id?: string;
	title?: string;
	phase?: string; // human-readable current step, e.g. "downloading video 288p SDR"
	current_title?: string | null; // SxxEyy of the episode downloading now
	completed_tracks?: number;
	total_tracks?: number;
	active_tracks?: string[];
	track_progress?: { label: string; progress: number; speed?: string | null }[];
	segments_done?: number;
	segments_total?: number;
	speed?: string | null;
	eta?: string | null;
	message?: string;
	error?: string;
	skipped_subtitles?: { id: string; language: string; title?: string | null }[];
	// Present when the list is fetched with full=true (and on /jobs/{id}).
	parameters?: { wanted?: string[]; [key: string]: unknown };
	started_time?: string | null;
	completed_time?: string | null;
	output_files?: string[];
	error_message?: string | null;
	error_code?: string | null;
	error_details?: string | null;
	error_traceback?: string | null;
	worker_stderr?: string | null;
	[key: string]: unknown;
}

// POST /api/download/jobs/clear-finished
export interface ClearFinishedResponse {
	removed: number;
}

// GET /api/profiles. Only services with named credential mappings appear.
export interface ProfilesResponse {
	profiles: Record<string, string[]>;
}

// GET /api/config. api_secret and users are never included.
export interface ServerConfig {
	dl: Record<string, unknown>;
	serve: {
		max_concurrent_downloads: number;
		job_retention_hours: number;
		history_limit: number;
		services: string[] | null; // null = all allowed
		remote_only: boolean;
		cdm_overrides: string[] | true | null;
		allow_job_credentials: boolean;
	};
	directories: {
		downloads: string;
		temp: string;
		cache: string;
	};
	services: string[];
}

export interface ConfigResponse {
	config: ServerConfig;
}

// GET /api/history
export interface HistoryEntry {
	job_id: string;
	service: string;
	title_id: string;
	title: string | null;
	status: 'completed' | 'failed' | 'cancelled';
	created_time: string;
	completed_time: string | null;
	output_files: string[];
	parameters?: { wanted?: string[]; skip_dl?: boolean; [key: string]: unknown };
	error_message: string | null;
}

export interface HistoryResponse {
	history: HistoryEntry[];
	count: number;
}

// POST /api/maintenance/clear-cache | clear-temp
export interface MaintenanceClearResponse {
	cleared: boolean;
	freed_bytes: number;
}

// POST /api/maintenance/refresh-services
export interface RefreshServicesResponse {
	refreshed: boolean;
	repos: { spec: string; updated: boolean; changes: string[] }[];
}

// GET /api/env/check
export interface EnvCheck {
	name: string;
	installed: boolean;
	version: string | null;
	required: boolean;
}

export interface EnvCheckResponse {
	checks: EnvCheck[];
}

// POST /api/download/jobs/{id}/priority
export interface PriorityResponse {
	job_id: string;
	position: 'front';
}
