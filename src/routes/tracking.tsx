import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import Badge from '$lib/components/Badge';
import Button from '$lib/components/Button';
import Card from '$lib/components/Card';
import EmptyState from '$lib/components/EmptyState';
import Icon from '$lib/components/Icon';
import OptionForm from '$lib/components/OptionForm';
import { ADVANCED_FIELDS } from '$lib/download';
import { serviceFields, type Field } from '$lib/options';
import { servicesQuery, tracksQuery } from '$lib/queries';
import { useMask } from '$lib/stores/incognito';
import { tracking, trackingErrorMessage } from '$lib/tracking/client';
import { applyPreset, buildPreset, type PresetForm } from '$lib/tracking/preset';
import type { TrackSummary } from '$lib/tracking/types';

export const Route = createFileRoute('/tracking')({ component: TrackingPage });

const when = (t: string | null) => (t ? new Date(t).toLocaleString() : 'never');

function TrackingPage() {
	const queryClient = useQueryClient();
	const tracks = useQuery(tracksQuery);
	const services = useQuery(servicesQuery);

	// Which row has its preset open. One at a time: the forms are tall.
	const [expanded, setExpanded] = useState<string | null>(null);
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
				</div>
			</div>

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
						Preset
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
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	const extraEntries = Object.entries(form.extra);
	const tvdbOrder = form.extra.tvdb_order;

	async function save() {
		setSaving(true);
		setError(null);
		try {
			await tracking.patch(track.id, { preset: buildPreset(form, svcFields) });
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

			<div className="flex items-center gap-3">
				<Button onClick={save} disabled={saving}>
					{saving ? <Icon name="loader" size={16} spin /> : <Icon name="check" size={16} />}
					Save preset
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
