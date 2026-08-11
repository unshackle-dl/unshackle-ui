import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState, type ReactNode } from 'react';
import Badge from '$lib/components/Badge';
import Button from '$lib/components/Button';
import Card from '$lib/components/Card';
import EmptyState from '$lib/components/EmptyState';
import Icon from '$lib/components/Icon';
import OptionForm from '$lib/components/OptionForm';
import { ADVANCED_FIELDS } from '$lib/download';
import { serviceFields, type Field } from '$lib/options';
import { servicesQuery, trackingSettingsQuery, tracksQuery } from '$lib/queries';
import { useMask } from '$lib/stores/incognito';
import { tracking, trackingErrorMessage } from '$lib/tracking/client';
import { applyPreset, buildPreset, type PresetForm } from '$lib/tracking/preset';
import type { SettingSource, TrackingSettings, TrackSummary } from '$lib/tracking/types';

export const Route = createFileRoute('/tracking')({ component: TrackingPage });

const when = (t: string | null) => (t ? new Date(t).toLocaleString() : 'never');

function TrackingPage() {
	const queryClient = useQueryClient();
	const tracks = useQuery(tracksQuery);
	const services = useQuery(servicesQuery);

	// Which row has its preset open. One at a time: the forms are tall.
	const [expanded, setExpanded] = useState<string | null>(null);
	const [showConfig, setShowConfig] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [checking, setChecking] = useState(false);

	const list = tracks.data ?? [];
	const unseenTotal = list.reduce((n, t) => n + t.unseen, 0);

	const refresh = () => queryClient.invalidateQueries({ queryKey: ['tracking'] });

	async function run(key: string, fn: () => Promise<unknown>) {
		setBusy(key);
		setError(null);
		try {
			await fn();
			await refresh();
		} catch (e) {
			setError(trackingErrorMessage(e));
		} finally {
			setBusy(null);
		}
	}

	const fieldsFor = useMemo(() => {
		const byTag = new Map((services.data ?? []).map((s) => [s.tag, s.cli_params]));
		return (tag: string): Field[] => serviceFields(byTag.get(tag));
	}, [services.data]);

	return (
		<>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Tracking</h1>
					<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
						Series this server re-lists on a schedule. New episode codes stay unseen until you mark
						them, or until a download of them shows up in history.
					</p>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<Button
						variant="secondary"
						onClick={() =>
							run('check-all', async () => {
								setChecking(true);
								await tracking.check();
							})
						}
						disabled={busy !== null || list.length === 0}
					>
						<Icon name="loader" size={16} spin={busy === 'check-all'} />
						Check all
					</Button>
					<Button
						variant="secondary"
						onClick={() => run('seen-all', () => tracking.seenAll())}
						disabled={busy !== null || unseenTotal === 0}
					>
						<Icon name="check" size={16} />
						Mark all seen
					</Button>
					<Button variant="secondary" onClick={refresh} disabled={tracks.isFetching}>
						<Icon name="retry" size={16} spin={tracks.isFetching} />
						Refresh
					</Button>
					<Button variant="secondary" onClick={() => setShowConfig(true)}>
						<Icon name="settings" size={16} />
						Settings
					</Button>
				</div>
			</div>

			{showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}

			{checking && (
				<p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
					A check is running in the background. Sweeps are staggered on purpose, one title at a
					time, so give it a moment and hit Refresh.
				</p>
			)}

			{(error || tracks.error) && (
				<Card className="mt-4 p-4">
					<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
						<Icon name="alert" size={16} className="mt-0.5" />
						<span>{error ?? trackingErrorMessage(tracks.error)}</span>
					</div>
				</Card>
			)}

			{tracks.isLoading ? (
				<Card className="mt-6">
					<div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500 dark:text-neutral-400">
						<Icon name="loader" spin /> Loading tracked titles…
					</div>
				</Card>
			) : list.length === 0 ? (
				<Card className="mt-6">
					<EmptyState
						icon="bell"
						title="Nothing tracked yet"
						description="Open a title and click Track. Everything currently listed starts unseen, so the tracker doubles as a backlog."
					/>
				</Card>
			) : (
				<div className="mt-6 space-y-3">
					{list.map((track) => (
						<TrackCard
							key={track.id}
							track={track}
							svcFields={fieldsFor(track.payload.service)}
							expanded={expanded === track.id}
							onToggle={() => setExpanded((id) => (id === track.id ? null : track.id))}
							busy={busy}
							onAction={run}
							onSaved={refresh}
						/>
					))}
				</div>
			)}
		</>
	);
}

const INPUT =
	'mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100';

function human(ms: number): string {
	if (ms % 3_600_000 === 0) return `${ms / 3_600_000}h`;
	if (ms >= 60_000) return `${Math.round(ms / 60_000)}m`;
	return `${Math.round(ms / 1000)}s`;
}

function SourceBadge({ source }: { source: SettingSource }) {
	if (source === 'web') return <Badge tone="accent">set here</Badge>;
	return <Badge tone="neutral">{source === 'env' ? 'from env' : 'default'}</Badge>;
}

type CfgKey = 'apiUrl' | 'apiKey' | 'intervalMs' | 'staggerMs' | 'webhookUrl';

/**
 * Server-side tracking configuration. Every field is stored raw in the tracking db and
 * wins over its env var; a cleared field falls back to env. The two durations are edited
 * in minutes and seconds and converted to ms on save, since nobody thinks in ms.
 */
function ConfigModal({ onClose }: { onClose: () => void }) {
	const queryClient = useQueryClient();
	const q = useQuery(trackingSettingsQuery);
	// Only the keys the user touched; everything else keeps showing the server's answer.
	const [draft, setDraft] = useState<Partial<Record<CfgKey, string>>>({});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	const s = q.data;
	if (!s) {
		return (
			<Overlay onClose={onClose} label="Tracking configuration">
				<div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
					{q.error ? (
						<>
							<Icon name="alert" size={16} /> {trackingErrorMessage(q.error)}
						</>
					) : (
						<>
							<Icon name="loader" size={16} spin /> Loading configuration…
						</>
					)}
				</div>
			</Overlay>
		);
	}

	const dirty = Object.keys(draft).length > 0;
	const edit = (k: CfgKey, v: string) => {
		setSaved(false);
		setDraft((d) => ({ ...d, [k]: v }));
	};

	async function save() {
		const patch: Record<string, string | number | null> = {};
		for (const [k, raw] of Object.entries(draft) as [CfgKey, string][]) {
			const v = raw.trim();
			if (v === '') {
				patch[k] = null;
				continue;
			}
			if (k === 'intervalMs' || k === 'staggerMs') {
				const n = Number(v);
				if (!Number.isFinite(n) || n <= 0) {
					setError(
						`${k === 'intervalMs' ? 'Check interval' : 'Stagger'} must be a positive number`
					);
					return;
				}
				patch[k] = Math.round(n * (k === 'intervalMs' ? 60_000 : 1000));
			} else {
				patch[k] = v;
			}
		}
		setSaving(true);
		setError(null);
		try {
			const next = await tracking.saveSettings(patch);
			queryClient.setQueryData(trackingSettingsQuery.queryKey, next);
			await queryClient.invalidateQueries({ queryKey: ['tracking', 'status'] });
			setDraft({});
			setSaved(true);
		} catch (e) {
			setError(trackingErrorMessage(e));
		} finally {
			setSaving(false);
		}
	}

	const field = (
		k: CfgKey,
		label: string,
		opts: {
			source: SettingSource;
			initial: string;
			placeholder: string;
			hint: string;
			type?: 'text' | 'password' | 'number';
			redact?: boolean;
		}
	) => (
		<div>
			<div className="flex items-center gap-2">
				<label
					htmlFor={`cfg-${k}`}
					className="block text-sm font-medium text-neutral-700 dark:text-neutral-200"
				>
					{label}
				</label>
				<SourceBadge source={opts.source} />
			</div>
			<input
				id={`cfg-${k}`}
				type={opts.type ?? 'text'}
				{...(opts.type === 'number' ? { step: 'any', min: 0 } : {})}
				value={draft[k] ?? opts.initial}
				onChange={(e) => edit(k, e.target.value)}
				placeholder={opts.placeholder}
				autoComplete="off"
				className={`${opts.redact ? 'redact ' : ''}${INPUT}`}
			/>
			<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{opts.hint}</p>
		</div>
	);

	return (
		<Overlay onClose={onClose} label="Tracking configuration">
			<div className="flex items-start justify-between gap-3">
				<h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
					Tracking configuration
				</h2>
				<button
					onClick={onClose}
					aria-label="Close"
					className="rounded-md p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
				>
					<Icon name="x" size={18} />
				</button>
			</div>

			<div className="mt-3">
				{s.poller === 'inert' ? (
					<div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
						<Icon name="alert" size={14} className="mt-0.5 shrink-0" />
						<span>
							The poller is inert: no API URL is configured, so nothing is checked on a schedule.
							Set one below or via <span className="font-mono">UNSHACKLE_API_URL</span>.
						</span>
					</div>
				) : (
					<p className="text-xs text-neutral-500 dark:text-neutral-400">
						{s.poller === 'running'
							? `Poller running: a sweep every ${human(s.interval_ms.value)}.`
							: 'Poller idle: configured, waiting for the first active track.'}
					</p>
				)}
			</div>

			<div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2">
				{field('apiUrl', 'API URL', {
					source: s.api_url.source,
					initial: s.api_url.source === 'web' ? s.api_url.value : '',
					placeholder: s.api_url.value || 'http://localhost:8786',
					redact: true,
					hint: 'What the server itself polls; separate from the browser settings on the Settings page.'
				})}
				{field('apiKey', 'API secret key', {
					type: 'password',
					source: s.api_key.source,
					initial: '',
					placeholder: s.api_key.set ? 'configured (type to replace)' : 'not set',
					hint: 'Sent as X-Secret-Key on poll requests. Never shown back here.'
				})}
				{field('intervalMs', 'Check interval (minutes)', {
					type: 'number',
					source: s.interval_ms.source,
					initial: s.interval_ms.source === 'web' ? String(s.interval_ms.value / 60_000) : '',
					placeholder: String(s.interval_ms.value / 60_000),
					hint: `A full sweep of every tracked title, currently every ${human(s.interval_ms.value)}.`
				})}
				{field('staggerMs', 'Stagger between titles (seconds)', {
					type: 'number',
					source: s.stagger_ms.source,
					initial: s.stagger_ms.source === 'web' ? String(s.stagger_ms.value / 1000) : '',
					placeholder: String(s.stagger_ms.value / 1000),
					hint: 'Gap between titles inside a sweep; re-listing is expensive upstream.'
				})}
				{field('webhookUrl', 'Webhook URL', {
					source: s.webhook_url.source,
					initial: s.webhook_url.source === 'web' ? s.webhook_url.value : '',
					placeholder: s.webhook_url.value || 'not set',
					redact: true,
					hint: 'POSTed a summary whenever a sweep finds new episodes. Blank disables it.'
				})}
				<div>
					<div className="flex items-center gap-2">
						<span className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
							Database
						</span>
						<Badge tone="neutral">env only</Badge>
					</div>
					<p className="redact mt-1.5 truncate font-mono text-sm text-neutral-500 dark:text-neutral-400">
						{s.db_path}
					</p>
					<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
						The overrides on this panel live inside this file, so it stays{' '}
						<span className="font-mono">TRACKING_DB_PATH</span>.
					</p>
				</div>
			</div>

			<div className="mt-5 flex flex-wrap items-center gap-3">
				<Button onClick={save} disabled={saving || !dirty}>
					{saving ? <Icon name="loader" size={16} spin /> : <Icon name="check" size={16} />}
					Save configuration
				</Button>
				<Button
					variant="secondary"
					onClick={() => {
						setDraft({});
						setError(null);
					}}
					disabled={!dirty || saving}
				>
					Discard
				</Button>
				{saved && !saving && (
					<span className="text-xs text-neutral-500 dark:text-neutral-400">
						Saved. Applies immediately without a restart.
					</span>
				)}
				{error && (
					<span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
						<Icon name="alert" size={14} />
						{error}
					</span>
				)}
			</div>
			<p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
				Values saved here are stored in the tracking database and win over the env vars; clear a
				field and save to fall back to env.
			</p>
		</Overlay>
	);
}

/** Same plain overlay as the title page's track dialog; two uses do not earn a shared modal. */
function Overlay({
	onClose,
	label,
	children
}: {
	onClose: () => void;
	label: string;
	children: ReactNode;
}) {
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={label}
				onClick={(e) => e.stopPropagation()}
				className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
			>
				{children}
			</div>
		</div>
	);
}

function TrackCard({
	track,
	svcFields,
	expanded,
	onToggle,
	busy,
	onAction,
	onSaved
}: {
	track: TrackSummary;
	svcFields: Field[];
	expanded: boolean;
	onToggle: () => void;
	busy: string | null;
	onAction: (key: string, fn: () => Promise<unknown>) => Promise<void>;
	onSaved: () => void;
}) {
	const mask = useMask();
	// Two-click delete rather than a modal: losing a track loses its whole seen/unseen
	// history, and re-adding it re-baselines from scratch.
	const [confirmDelete, setConfirmDelete] = useState(false);
	const disabled = busy !== null;

	return (
		<Card className="p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
							{track.kind === 'search' ? (
								mask.title(track.label)
							) : (
								// A link, never a "download the new ones" button: detection sees the
								// service's native numbering and a download with tvdb_order set
								// renumbers, so nothing here may replay a preset into a download.
								// Picking the episodes on the title page is the user's call.
								<Link
									to="/title/$service/$id"
									params={{ service: track.payload.service, id: track.payload.title_id }}
									className="hover:underline"
								>
									{mask.title(track.label)}
								</Link>
							)}
						</h2>
						<Badge tone="neutral">{mask.service(track.payload.service)}</Badge>
						{track.unseen > 0 ? (
							<Badge tone="accent">
								{track.unseen} new of {track.total}
							</Badge>
						) : (
							<Badge tone="neutral">{track.total} episodes</Badge>
						)}
						{track.state !== 'active' && <Badge tone="amber">{track.state}</Badge>}
						{track.interval_ms != null && (
							<Badge tone="neutral">every {human(track.interval_ms)}</Badge>
						)}
					</div>
					<p className="mt-1 font-mono text-xs text-neutral-400 dark:text-neutral-500">
						{track.kind === 'search'
							? mask.text(track.payload.query)
							: mask.id(track.payload.title_id)}
					</p>
					<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
						Last checked {when(track.last_checked)} · added {when(track.added_at)}
					</p>
				</div>

				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<Button
						variant="secondary"
						onClick={() => onAction(`check-${track.id}`, () => tracking.check(track.id))}
						disabled={disabled}
					>
						<Icon name="loader" size={16} spin={busy === `check-${track.id}`} />
						Check now
					</Button>
					<Button
						variant="secondary"
						onClick={() => onAction(`seen-${track.id}`, () => tracking.seen(track.id))}
						disabled={disabled || track.unseen === 0}
					>
						<Icon name="check" size={16} />
						Mark all seen
					</Button>
					<Button variant="secondary" onClick={onToggle} disabled={disabled}>
						<Icon name="chevron" size={16} className={expanded ? 'rotate-90' : ''} />
						Settings
					</Button>
					<Button
						variant="danger"
						onClick={() => {
							if (!confirmDelete) return setConfirmDelete(true);
							onAction(`delete-${track.id}`, () => tracking.remove(track.id));
						}}
						disabled={disabled}
					>
						<Icon name="trash" size={16} />
						{confirmDelete ? 'Really delete?' : 'Delete'}
					</Button>
				</div>
			</div>

			{track.last_error && (
				<div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
					<Icon name="alert" size={14} className="mt-0.5 shrink-0" />
					<span>Last check failed: {mask.text(track.last_error)}</span>
				</div>
			)}

			{expanded && (
				<PresetEditor
					// Remounted when the service's option set finally loads, so the form is built
					// from the real fields rather than from an empty list.
					key={`${track.id}:${svcFields.map((f) => f.key).join(',')}`}
					track={track}
					svcFields={svcFields}
					onSaved={onSaved}
				/>
			)}
		</Card>
	);
}

function PresetEditor({
	track,
	svcFields,
	onSaved
}: {
	track: TrackSummary;
	svcFields: Field[];
	onSaved: () => void;
}) {
	const mask = useMask();
	// `extra` holds every stored key with no control here: tvdb_id/tvdb_order, the chip
	// selections, and options belonging to a different service. It is state so it rides
	// straight back into buildPreset. Drop it and saving would silently delete them.
	const [form, setForm] = useState<PresetForm>(() => applyPreset(track.preset, svcFields));
	const [intervalMin, setIntervalMin] = useState(() =>
		track.interval_ms == null ? '' : String(track.interval_ms / 60_000)
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	const extraEntries = Object.entries(form.extra);
	const tvdbOrder = form.extra.tvdb_order;

	async function save() {
		let interval_ms: number | null = null;
		if (intervalMin.trim() !== '') {
			const n = Number(intervalMin);
			if (!Number.isFinite(n) || n < 1) {
				setError('Check interval must be at least 1 minute, or blank for the default.');
				return;
			}
			interval_ms = Math.round(n * 60_000);
		}
		setSaving(true);
		setError(null);
		try {
			await tracking.patch(track.id, { preset: buildPreset(form, svcFields), interval_ms });
			setSaved(true);
			onSaved();
		} catch (e) {
			setError(trackingErrorMessage(e));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="mt-4 space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
			<p className="text-xs text-neutral-500 dark:text-neutral-400">
				The params this title is re-listed with. Transport options and the service's own cli options
				decide which episodes are found; the rest is stored for a later download.
			</p>

			{svcFields.length > 0 && (
				<OptionForm
					title={`${mask.service(track.payload.service)} options`}
					fields={svcFields}
					values={form.svcValues}
					onChange={(svcValues) => (setSaved(false), setForm({ ...form, svcValues }))}
				/>
			)}

			{/* ponytail: the plain catalog, no per-service profile picker. This page can show
			    several services at once, and each would need its own profiles lookup. */}
			<OptionForm
				title="Advanced options"
				fields={ADVANCED_FIELDS}
				values={form.advanced}
				onChange={(advanced) => (setSaved(false), setForm({ ...form, advanced }))}
			/>

			{extraEntries.length > 0 && (
				<div className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700">
					<p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
						Also stored · {extraEntries.length}
					</p>
					<p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
						No control here: chip selections and ids captured from the title page. Kept as they are
						when you save.
					</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{extraEntries.map(([k, v]) => (
							<Badge key={k} tone="neutral">
								<span className="font-mono">
									{k}={Array.isArray(v) ? v.join(', ') : String(v)}
								</span>
							</Badge>
						))}
					</div>
				</div>
			)}

			{tvdbOrder != null && tvdbOrder !== '' && (
				<div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
					<Icon name="alert" size={14} className="mt-0.5 shrink-0" />
					<span>
						This preset sets <span className="font-mono">tvdb_order={String(tvdbOrder)}</span>.
						Detection does not use it: listing never applies TVDB ordering, so every code counted
						here is {mask.service(track.payload.service)}'s own episode numbering. A download made
						with this preset does renumber. The two orderings can disagree, so a code detected as
						new may not be the episode a download with that code fetches. Nothing reconciles them,
						so open the title and check the episode before you download it.
					</span>
				</div>
			)}

			<div className="rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-700">
				<label
					htmlFor={`ivl-${track.id}`}
					className="block text-xs font-medium text-neutral-700 dark:text-neutral-200"
				>
					Check interval (minutes)
				</label>
				<input
					id={`ivl-${track.id}`}
					type="number"
					step="any"
					min={1}
					value={intervalMin}
					onChange={(e) => (setSaved(false), setIntervalMin(e.target.value))}
					placeholder="server default"
					className="mt-1.5 w-full max-w-48 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
				/>
				<p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
					Just for this title. Blank uses the server-wide interval from the Settings dialog.
				</p>
			</div>

			<div className="flex items-center gap-3">
				<Button onClick={save} disabled={saving}>
					{saving ? <Icon name="loader" size={16} spin /> : <Icon name="check" size={16} />}
					Save settings
				</Button>
				{saved && !saving && (
					<span className="text-xs text-neutral-500 dark:text-neutral-400">Saved.</span>
				)}
				{error && (
					<span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
						<Icon name="alert" size={14} />
						{error}
					</span>
				)}
			</div>
		</div>
	);
}
