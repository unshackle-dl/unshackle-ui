import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '$lib/api/client';
import type { Title, Tracks } from '$lib/api/types';
import Badge from '$lib/components/Badge';
import Button from '$lib/components/Button';
import Card from '$lib/components/Card';
import ChipSelect from '$lib/components/ChipSelect';
import Icon from '$lib/components/Icon';
import OptionForm, { type OptionValues } from '$lib/components/OptionForm';
import { ADVANCED_FIELDS, blankAdvanced, buildDownloadRequest } from '$lib/download';
import { blankValues, coerce, serviceFields, type Field } from '$lib/options';
import { profilesQuery, servicesQuery, trackQuery, tracksQuery } from '$lib/queries';
import { useMask } from '$lib/stores/incognito';
import { tracking, trackingErrorMessage } from '$lib/tracking/client';
import { buildListParams, buildPreset } from '$lib/tracking/preset';
import type { TrackPreset } from '$lib/tracking/types';
import { hasParts, isEpisodic, summarize, type TrackSummary, wantedCode } from '$lib/tracks';

interface TitleSearch {
	profile?: string;
	proxy?: string;
	no_proxy?: boolean;
	// Service cli options (and tvdb_id/tvdb_order) pass through untouched: which
	// keys exist depends on the service, so they are not enumerated. This is the
	// only channel by which they can reach the loader, which runs before the
	// component (and its svcValues state) exists.
	[key: string]: unknown;
}

export const Route = createFileRoute('/title/$service/$id')({
	// The loader below calls the unshackle API, whose base URL and key are the browser's
	// Settings (localStorage). On the server those are invisible, so a refresh or a pasted
	// title URL would run the loader against the build-time .env defaults and render
	// `unauthorized`. `ssr: false` keeps the loader (and this component) client-only; the
	// shell and the sidebar still render on the server. See the guard in $lib/api/client.
	ssr: false,
	// ponytail: three known optional fields plus a passthrough, so no schema library.
	validateSearch: (search: Record<string, unknown>): TitleSearch => {
		const { profile, proxy, no_proxy, ...rest } = search;
		const out: TitleSearch = { ...rest };
		if (profile) out.profile = String(profile);
		if (proxy) out.proxy = String(proxy);
		if (no_proxy === true || no_proxy === '1') out.no_proxy = true;
		return out;
	},
	loaderDeps: ({ search }) => search,
	// Episode selection and chip picks belong to one title, and the component is
	// otherwise reused when only the params change, carrying them to the next one.
	remountDeps: ({ params }) => params,
	// Loaded up front so the Browse list can show per-row "opening…" feedback while
	// this navigation is pending. Errors render inline, they are not thrown.
	loader: async ({ params, deps }) => {
		// Anything else in the search is a service cli option; transport keys win over it.
		const { profile, proxy, no_proxy, ...svc } = deps;
		try {
			const titles = await api.listTitles({
				...svc,
				service: params.service,
				title_id: params.id,
				profile: profile || undefined,
				proxy: proxy || undefined,
				no_proxy: no_proxy || undefined
			});
			return { titles, error: null as string | null };
		} catch (e) {
			return { titles: [] as Title[], error: errorMessage(e) };
		}
	},
	component: TitlePage
});

// Codecs to request. Fixed list, not derived from tracks: some services (e.g. AMZN)
// only serve a codec when it's explicitly requested, so all must be selectable.
const CODECS = ['H.264', 'H.265', 'VP9', 'AV1'];
// Fixed list like CODECS: manifests don't always advertise every range the service can serve.
const RANGES = ['SDR', 'HLG', 'HDR10', 'HDR10P', 'DV', 'HYBRID'];

interface EpisodeTracks {
	code: string | null;
	title: Title;
	tracks: Tracks;
}

function TitlePage() {
	const mask = useMask();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { service, id: titleId } = Route.useParams();
	const search = Route.useSearch();
	const { titles, error } = Route.useLoaderData();

	const episodic = isEpisodic(titles);
	const split = hasParts(titles);
	const first = titles[0];
	const header = first?.series_title || first?.name || 'Title';

	// Episodes picked for download (empty = all episodes). Movies stay empty.
	const [epSel, setEpSel] = useState<string[]>([]);
	const [loadedSel, setLoadedSel] = useState<string[]>([]);
	const stale = JSON.stringify(epSel) !== JSON.stringify(loadedSel);

	// Download config. Each is a multi-select; empty omits the filter and lets the
	// backend default apply, which differs per row (see each emptyHint below).
	const [qualitySel, setQualitySel] = useState<string[]>([]);
	const [codecSel, setCodecSel] = useState<string[]>([]);
	const [rangeSel, setRangeSel] = useState<string[]>([]);
	const [audioSel, setAudioSel] = useState<string[]>([]);
	const [subSel, setSubSel] = useState<string[]>([]);
	const [trackOpen, setTrackOpen] = useState(false);
	const [advanced, setAdvanced] = useState<OptionValues>(() => ({
		...blankAdvanced(),
		profile: search.profile ?? '',
		proxy: search.proxy ?? '',
		no_proxy: search.no_proxy ?? false
	}));

	// Named profiles for this service; undefined keeps the free-text advanced field.
	const profiles = useQuery(profilesQuery);
	const profileOptions = profiles.isError ? null : (profiles.data?.[service] ?? null);
	useEffect(() => {
		if (profileOptions && !profileOptions.includes(String(advanced.profile)))
			setAdvanced((v) => ({ ...v, profile: '' }));
	}, [profileOptions, advanced.profile]);

	// This service's own cli options (region, cdn, bitrate mode, …), if it has any.
	// On failure the section simply stays hidden.
	const services = useQuery(servicesQuery);
	const svcFields = useMemo<Field[]>(
		() => serviceFields(services.data?.find((s) => s.tag === service)?.cli_params),
		[services.data, service]
	);
	const [svcValues, setSvcValues] = useState<OptionValues>({});
	useEffect(() => setSvcValues(blankValues(svcFields)), [svcFields]);

	// Advanced fields, with the free-text `profile` swapped for a picker when the
	// service has named profiles (null = fetch failed → keep free text; [] = none → hide).
	const advancedFields = useMemo<Field[]>(() => {
		if (profileOptions === null) return ADVANCED_FIELDS;
		if (profileOptions.length === 0) return ADVANCED_FIELDS.filter((f) => f.key !== 'profile');
		return ADVANCED_FIELDS.map((f) =>
			f.key === 'profile' ? { ...f, type: 'choice' as const, choices: profileOptions } : f
		);
	}, [profileOptions]);

	// Is this title already tracked, and which of its codes are still unseen? Both come
	// from this app's own /api/tracking routes, never from the unshackle API.
	const trackedList = useQuery(tracksQuery);
	const tracked =
		(trackedList.data ?? []).find(
			(t) => t.kind === 'series' && t.payload.service === service && t.payload.title_id === titleId
		) ?? null;
	const trackDetail = useQuery({ ...trackQuery(tracked?.id ?? ''), enabled: tracked != null });
	const unseenCodes = useMemo(
		() =>
			new Set((trackDetail.data?.items ?? []).filter((i) => i.seen_at == null).map((i) => i.code)),
		[trackDetail.data]
	);

	const episodeOptions = useMemo(
		() =>
			titles
				.map((t) => wantedCode(t))
				.filter((c): c is string => c != null)
				// New line at each season boundary (codes start SxxEyy; slice(0,3) = season).
				.map((c, i, all) => ({
					value: c,
					label: c,
					breakBefore: i > 0 && c.slice(0, 3) !== all[i - 1].slice(0, 3),
					highlight: unseenCodes.has(c)
				})),
		[titles, unseenCodes]
	);

	// Manual: load tracks for the selected episodes (or the first episode / movie
	// when nothing is selected). Episode selection alone never triggers this.
	const tracks = useMutation({
		mutationFn: (sel: string[]) => {
			const targets: Title[] =
				episodic && sel.length
					? titles.filter((t) => {
							const c = wantedCode(t);
							return c != null && sel.includes(c);
						})
					: [first];
			return Promise.all(
				targets.map(async (t): Promise<EpisodeTracks> => ({
					code: wantedCode(t),
					title: t,
					tracks: await api.listTracks({
						// Same service options the download will use, so the listed tracks
						// match what it resolves. Transport keys below win over them.
						...coerce(svcFields, svcValues),
						service,
						title_id: titleId,
						wanted: wantedCode(t) ?? undefined,
						profile: String(advanced.profile).trim() || undefined,
						proxy: String(advanced.proxy).trim() || undefined,
						no_proxy: advanced.no_proxy === true || undefined
					})
				}))
			);
		},
		onSuccess: (_data, sel) => {
			setLoadedSel(sel);
			setQualitySel([]);
			setCodecSel([]);
			setRangeSel([]);
			setAudioSel([]);
			setSubSel([]);
		}
	});
	const trackResults = tracks.data ?? [];

	const loadSelection = () => tracks.mutate(epSel);

	// Initial load, once the title data is in. Deliberately not re-run on epSel changes.
	useEffect(() => {
		if (first) tracks.mutate([]);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [service, titleId]);

	const episodeSummaries = trackResults.map((r) => ({
		code: r.code,
		name: r.title.name,
		summary: summarize(r.tracks)
	}));

	const combined = useMemo<TrackSummary | null>(() => {
		if (!trackResults.length) return null;
		const merged: Tracks = {
			title: trackResults[0].tracks.title,
			video: trackResults.flatMap((r) => r.tracks.video),
			audio: trackResults.flatMap((r) => r.tracks.audio),
			subtitles: trackResults.flatMap((r) => r.tracks.subtitles)
		};
		return summarize(merged);
	}, [trackResults]);

	// Which audio languages "orig" would pick. The API flags these per track. Many
	// services leave the title language unset, which is legitimate, so an empty list
	// just means no marker.
	const originalLangs = combined?.originalAudioLangs ?? [];

	const start = useMutation({
		mutationFn: () =>
			api.download(
				buildDownloadRequest(
					{ service, title_id: titleId },
					{
						// An empty selection means all episodes; send them so progress can list them.
						wanted: epSel.length ? epSel : episodeOptions.map((o) => o.value),
						quality: qualitySel,
						vcodec: codecSel,
						range: rangeSel,
						a_lang: audioSel,
						s_lang: subSel
					},
					advanced,
					svcFields,
					svcValues
				)
			),
		onSuccess: () => navigate({ to: '/downloads' })
	});

	return (
		<>
			<Link
				to="/"
				className="inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
			>
				<Icon name="chevron" size={16} className="rotate-180" /> Back to search
			</Link>

			<div className="mt-3 flex flex-wrap items-center gap-3">
				<h1 className="text-2xl font-semibold tracking-tight">{mask.title(header)}</h1>
				{first?.type && <Badge tone="accent">{episodic ? 'series' : first.type}</Badge>}
				{first?.year && (
					<span className="text-sm text-neutral-500 dark:text-neutral-400">{first.year}</span>
				)}
			</div>
			<p className="mt-1 font-mono text-xs text-neutral-400 dark:text-neutral-500">
				{mask.service(service)} · {mask.id(titleId)}
			</p>

			{error ? (
				<Card className="mt-6 p-4">
					<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
						<Icon name="alert" size={16} className="mt-0.5" />
						<span>{mask.text(error)}</span>
					</div>
				</Card>
			) : (
				<>
					<div
						className={`mt-6 grid gap-6 ${
							episodic && episodeOptions.length > 0 ? 'lg:grid-cols-2' : ''
						}`}
					>
						{episodic && episodeOptions.length > 0 && (
							<Card className="p-5">
								<div className="flex items-center justify-between gap-3">
									<p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
										Episodes{' '}
										{epSel.length === 0 ? (
											<span className="font-normal text-neutral-400">
												· all {episodeOptions.length} episodes
											</span>
										) : (
											<span className="font-normal text-neutral-400">
												· {epSel.length} selected
											</span>
										)}
									</p>
									<div className="flex items-center gap-3 text-xs">
										<button
											type="button"
											onClick={loadSelection}
											disabled={tracks.isPending}
											className={`inline-flex items-center gap-1 font-medium disabled:opacity-50 ${
												stale
													? 'text-accent-600 dark:text-accent-400'
													: 'text-neutral-500 dark:text-neutral-400'
											} hover:underline`}
										>
											<Icon name="loader" size={13} spin={tracks.isPending} />
											Refresh selection
										</button>
										<button
											type="button"
											onClick={() => setEpSel(episodeOptions.map((o) => o.value))}
											className="font-medium text-accent-600 hover:underline dark:text-accent-400"
										>
											Select all
										</button>
										<button
											type="button"
											onClick={() => setEpSel([])}
											className="font-medium text-neutral-500 hover:underline dark:text-neutral-400"
										>
											Clear
										</button>
									</div>
								</div>
								<div className="mt-3">
									<ChipSelect
										label=""
										selected={epSel}
										onChange={setEpSel}
										options={episodeOptions}
									/>
								</div>
								{unseenCodes.size > 0 && (
									<p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
										✦ marks the {unseenCodes.size} episode{unseenCodes.size === 1 ? '' : 's'} this
										title has picked up since you last marked it seen.
									</p>
								)}
								{split && (
									<p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
										S01E01.2 is part 2 of one episode. Pick any part on its own, or all of them for
										the whole episode.
									</p>
								)}
								{stale && !tracks.isPending && (
									<p className="mt-2 text-xs text-accent-600 dark:text-accent-400">
										Selection changed. Click "Refresh selection" to update available tracks.
									</p>
								)}
							</Card>
						)}

						<Card className="p-5">
							<div className="flex items-center justify-between">
								<h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
									Available tracks
								</h2>
								{episodic && trackResults.length > 0 && (
									<span className="text-xs text-neutral-400">
										{trackResults.length} {trackResults.length === 1 ? 'episode' : 'episodes'}
									</span>
								)}
							</div>
							{tracks.isPending ? (
								<div className="flex items-center gap-2 py-8 text-sm text-neutral-500 dark:text-neutral-400">
									<Icon name="loader" spin /> Loading tracks…
								</div>
							) : tracks.error ? (
								<div className="flex items-start gap-2 py-4 text-sm text-red-600 dark:text-red-400">
									<Icon name="alert" size={16} className="mt-0.5" />
									<span>{mask.text(errorMessage(tracks.error))}</span>
								</div>
							) : episodeSummaries.length > 0 ? (
								<div className="mt-3 max-h-96 space-y-4 overflow-y-auto pr-1">
									{episodeSummaries.map((e) => (
										<div
											key={e.code ?? e.name}
											className="border-t border-neutral-100 pt-3 first:border-0 first:pt-0 dark:border-neutral-800"
										>
											{e.code && (
												<p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
													{e.code} · {mask.title(e.name)}
												</p>
											)}
											<dl className="mt-1.5 space-y-2 text-sm">
												<div className="flex flex-wrap items-center gap-1.5">
													<dt className="w-16 shrink-0 text-xs font-medium text-neutral-500">
														Video
													</dt>
													{e.summary.heights.map((h) => (
														<Badge key={h}>{h}p</Badge>
													))}
													{e.summary.ranges.map((r) => (
														<Badge key={r} tone="violet">
															{r}
														</Badge>
													))}
													{e.summary.vcodecs.map((c) => (
														<Badge key={c} tone="neutral">
															{c}
														</Badge>
													))}
												</div>
												<div className="flex flex-wrap items-center gap-1.5">
													<dt className="w-16 shrink-0 text-xs font-medium text-neutral-500">
														Audio
													</dt>
													<Badge tone="accent">{e.summary.audioLangs.length} langs</Badge>
													{e.summary.audioCodecs.map((c) => (
														<Badge key={c}>{c}</Badge>
													))}
													{e.summary.atmos && <Badge tone="amber">Atmos</Badge>}
												</div>
												<div className="flex flex-wrap items-center gap-1.5">
													<dt className="w-16 shrink-0 text-xs font-medium text-neutral-500">
														Subs
													</dt>
													<Badge tone="accent">{e.summary.subLangs.length} langs</Badge>
												</div>
											</dl>
										</div>
									))}
								</div>
							) : (
								<p className="py-6 text-sm text-neutral-400 dark:text-neutral-500">
									No tracks loaded. Pick episodes and click "Refresh selection".
								</p>
							)}
						</Card>
					</div>

					<Card className="mt-6 p-5">
						<h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
							Download
						</h2>
						<p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
							Click to pick tracks. An empty row uses the default next to its label.
						</p>
						{combined ? (
							<div className="mt-4 space-y-4">
								<div className="grid gap-4 sm:grid-cols-2">
									<ChipSelect
										label="Quality"
										emptyHint="best available"
										selected={qualitySel}
										onChange={setQualitySel}
										options={combined.heights.map((h) => ({ value: String(h), label: `${h}p` }))}
									/>
									<ChipSelect
										label="Video codecs"
										emptyHint="any"
										selected={codecSel}
										onChange={setCodecSel}
										options={CODECS.map((c) => ({ value: c, label: c }))}
									/>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<ChipSelect
										label="Range"
										emptyHint="SDR"
										selected={rangeSel}
										onChange={setRangeSel}
										options={RANGES.map((r) => ({ value: r, label: r }))}
									/>
									{combined.audioLangs.length > 0 && (
										<ChipSelect
											label="Audio languages"
											emptyHint="original language"
											selected={audioSel}
											onChange={setAudioSel}
											options={combined.audioLangs.map((l) => ({
												value: l,
												label: originalLangs.includes(l) ? `${l} (original)` : l
											}))}
										/>
									)}
								</div>
								{combined.subLangs.length > 0 && (
									<ChipSelect
										label="Subtitle languages"
										emptyHint="all"
										selected={subSel}
										onChange={setSubSel}
										options={combined.subLangs.map((l) => ({ value: l, label: l }))}
									/>
								)}

								{svcFields.length > 0 && (
									<OptionForm
										title={`${mask.service(service)} options`}
										fields={svcFields}
										values={svcValues}
										onChange={setSvcValues}
									/>
								)}

								<OptionForm
									title="Advanced options"
									fields={advancedFields}
									values={advanced}
									onChange={setAdvanced}
								/>

								<div className="flex flex-wrap items-center gap-2">
									<Button
										onClick={() => start.mutate()}
										disabled={start.isPending || tracks.isPending || !!tracks.error}
										className="w-full sm:w-auto"
									>
										{start.isPending ? (
											<>
												<Icon name="loader" spin />
												Starting…
											</>
										) : (
											<>
												<Icon name="download" />
												Start download
											</>
										)}
									</Button>

									{/* Series only: the tracking routes reject every other kind. */}
									{episodic &&
										episodeOptions.length > 0 &&
										(tracked ? (
											<Button
												variant="secondary"
												onClick={() => navigate({ to: '/tracking' })}
												className="w-full sm:w-auto"
											>
												<Icon name="bell" />
												Tracked
												{tracked.unseen > 0 && ` · ${tracked.unseen} new`}
											</Button>
										) : (
											<Button
												variant="secondary"
												onClick={() => setTrackOpen(true)}
												className="w-full sm:w-auto"
											>
												<Icon name="bell" />
												Track
											</Button>
										))}
								</div>
							</div>
						) : (
							<div className="mt-4 flex items-center gap-2 py-4 text-sm text-neutral-400 dark:text-neutral-500">
								{tracks.isPending ? (
									<>
										<Icon name="loader" spin /> Loading tracks…
									</>
								) : (
									'Select an episode to load tracks.'
								)}
							</div>
						)}

						{start.error && (
							<div className="mt-4 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
								<Icon name="alert" size={16} className="mt-0.5" />
								<span>{mask.text(errorMessage(start.error))}</span>
							</div>
						)}
					</Card>
				</>
			)}

			{trackOpen && (
				<TrackDialog
					service={service}
					titleId={titleId}
					defaultLabel={header}
					titles={titles}
					search={search}
					advanced={advanced}
					svcFields={svcFields}
					svcValues={svcValues}
					selectors={{
						quality: qualitySel,
						vcodec: codecSel,
						range: rangeSel,
						a_lang: audioSel,
						s_lang: subSel
					}}
					onClose={() => setTrackOpen(false)}
					onTracked={() => {
						setTrackOpen(false);
						queryClient.invalidateQueries({ queryKey: ['tracking'] });
					}}
				/>
			)}
		</>
	);
}

/**
 * Confirm dialog for the Track button, pre-filled from the page's current selection: the
 * chips, the advanced form and the service's own options, plus whatever inert ids
 * (tvdb_id/tvdb_order) came in through the search params.
 */
function TrackDialog({
	service,
	titleId,
	defaultLabel,
	titles,
	search,
	advanced,
	svcFields,
	svcValues,
	selectors,
	onClose,
	onTracked
}: {
	service: string;
	titleId: string;
	defaultLabel: string;
	titles: Title[];
	search: TitleSearch;
	advanced: OptionValues;
	svcFields: Field[];
	svcValues: OptionValues;
	selectors: {
		quality: string[];
		vcodec: string[];
		range: string[];
		a_lang: string[];
		s_lang: string[];
	};
	onClose: () => void;
	onTracked: () => void;
}) {
	const mask = useMask();
	const [label, setLabel] = useState(defaultLabel);
	const [baseline, setBaseline] = useState(false);
	const [relisting, setRelisting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const payload = { service, title_id: titleId };

	// Anything in the URL that is not a transport key is either a service cli option or an
	// inert id; the form values below win over it, so a duplicated key is not a conflict.
	const searchExtra = useMemo<TrackPreset>(() => {
		const skip = new Set(['profile', 'proxy', 'no_proxy']);
		return Object.fromEntries(
			Object.entries(search).filter(([k, v]) => !skip.has(k) && v != null && v !== '')
		);
	}, [search]);

	const preset = useMemo<TrackPreset>(
		() =>
			buildPreset(
				{
					advanced,
					svcValues,
					// The chip picks live here: no control in either field set, but a later
					// download replays them, and applyPreset hands them back untouched.
					extra: {
						...searchExtra,
						...(selectors.quality.length ? { quality: selectors.quality.map(Number) } : {}),
						...(selectors.vcodec.length ? { vcodec: selectors.vcodec } : {}),
						...(selectors.range.length ? { range: selectors.range } : {}),
						...(selectors.a_lang.length ? { a_lang: selectors.a_lang } : {}),
						...(selectors.s_lang.length ? { s_lang: selectors.s_lang } : {})
					}
				},
				svcFields
			),
		[advanced, svcValues, svcFields, searchExtra, selectors]
	);

	// The page's episode list was fetched by the loader, which can only receive service
	// options through the URL, and nothing writes svcValues there. So whenever the form
	// carries service options, the list on screen may not be the list this preset
	// produces, and seeding from it would report phantom new episodes on the first poll.
	// Conditional, so the common case still costs zero extra list-titles calls.
	const svcSet = coerce(svcFields, svcValues);
	const mustRelist = Object.keys(svcSet).length > 0;

	const seed = (list: Title[]) =>
		list
			.map((t) => ({ code: wantedCode(t), title: t.name }))
			.filter((c): c is { code: string; title: string } => c.code != null);

	const create = useMutation({
		mutationFn: async () => {
			let list = titles;
			if (mustRelist) {
				setRelisting(true);
				try {
					// service/title_id are restated only to satisfy the signature; buildListParams
					// already forces them and they cannot be overridden out of their own title.
					list = await api.listTitles({
						...buildListParams(payload, preset),
						service,
						title_id: titleId
					});
				} finally {
					setRelisting(false);
				}
			}
			return tracking.add({
				label: label.trim() || defaultLabel,
				payload,
				preset,
				codes: seed(list),
				baseline
			});
		},
		onSuccess: onTracked,
		onError: (e) => setError(mustRelist ? errorMessage(e) : trackingErrorMessage(e))
	});

	const entries = Object.entries(preset);

	return (
		// ponytail: a plain overlay, not a <dialog> or a focus trap. The app has no other
		// modal to justify a shared component.
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Track this series"
				onClick={(e) => e.stopPropagation()}
				className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
			>
				<h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
					Track this series
				</h2>
				<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
					{mask.service(service)} · {mask.id(titleId)} · {titles.length} episodes listed
				</p>

				<label className="mt-4 block text-xs text-neutral-600 dark:text-neutral-400">
					Name
					<input
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						className="redact mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
					/>
				</label>

				<div className="mt-4">
					<p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
						Captured from this page · {entries.length}
					</p>
					<p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
						Re-listing uses the transport and service options; the rest is kept for a later
						download. Editable afterwards on the Tracking page.
					</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{entries.length === 0 ? (
							<span className="text-xs text-neutral-400 dark:text-neutral-500">
								Nothing set, so service defaults apply.
							</span>
						) : (
							entries.map(([k, v]) => (
								<Badge key={k} tone="neutral">
									<span className="font-mono">
										{k}={Array.isArray(v) ? v.join(', ') : String(v)}
									</span>
								</Badge>
							))
						)}
					</div>
				</div>

				<label className="mt-4 flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
					<input
						type="checkbox"
						checked={baseline}
						onChange={(e) => setBaseline(e.target.checked)}
						className="mt-0.5 accent-accent-600"
					/>
					<span>
						Mark existing episodes as already seen.
						<span className="block text-neutral-400 dark:text-neutral-500">
							Off by default: everything listed now counts as new, so the tracker doubles as a
							backlog list.
						</span>
					</span>
				</label>

				{mustRelist && (
					<p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
						<Icon name="alert" size={14} className="mt-0.5 shrink-0" />
						<span>
							The episode list on this page was fetched without {mask.service(service)}'s own
							options ({Object.keys(svcSet).join(', ')}), which the loader never sees. It will be
							re-listed with the full preset before the codes are recorded, so the first check does
							not report episodes that were never missing.
						</span>
					</p>
				)}

				{error && (
					<p className="mt-4 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
						<Icon name="alert" size={14} className="mt-0.5 shrink-0" />
						<span>{mask.text(error)}</span>
					</p>
				)}

				<div className="mt-5 flex items-center justify-end gap-2">
					<Button variant="secondary" onClick={onClose} disabled={create.isPending}>
						Cancel
					</Button>
					<Button onClick={() => (setError(null), create.mutate())} disabled={create.isPending}>
						{create.isPending ? (
							<>
								<Icon name="loader" spin />
								{relisting ? 'Re-listing episodes…' : 'Saving…'}
							</>
						) : (
							<>
								<Icon name="bell" />
								Track
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
