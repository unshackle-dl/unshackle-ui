import { useMutation, useQuery } from '@tanstack/react-query';
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
import { blankValues, serviceFields, type Field } from '$lib/options';
import { profilesQuery, servicesQuery } from '$lib/queries';
import { useMask } from '$lib/stores/incognito';
import { hasParts, isEpisodic, summarize, type TrackSummary, wantedCode } from '$lib/tracks';

interface TitleSearch {
	profile?: string;
	proxy?: string;
	no_proxy?: boolean;
}

export const Route = createFileRoute('/title/$service/$id')({
	// ponytail: three optional fields, so no schema library.
	validateSearch: (search: Record<string, unknown>): TitleSearch => {
		const out: TitleSearch = {};
		if (search.profile) out.profile = String(search.profile);
		if (search.proxy) out.proxy = String(search.proxy);
		if (search.no_proxy === true || search.no_proxy === '1') out.no_proxy = true;
		return out;
	},
	loaderDeps: ({ search }) => search,
	// Episode selection and chip picks belong to one title, and the component is
	// otherwise reused when only the params change, carrying them to the next one.
	remountDeps: ({ params }) => params,
	// Loaded up front so the Browse list can show per-row "opening…" feedback while
	// this navigation is pending. Errors render inline, they are not thrown.
	loader: async ({ params, deps }) => {
		try {
			const titles = await api.listTitles({
				service: params.service,
				title_id: params.id,
				profile: deps.profile || undefined,
				proxy: deps.proxy || undefined,
				no_proxy: deps.no_proxy || undefined
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
	const { service, id: titleId } = Route.useParams();
	const search = Route.useSearch();
	const { titles, error } = Route.useLoaderData();

	const episodic = isEpisodic(titles);
	const split = hasParts(titles);
	const first = titles[0];
	const header = first?.series_title || first?.name || 'Title';

	// Episodes picked for download (empty = all episodes). Movies stay empty.
	const [epSel, setEpSel] = useState<string[]>([]);
	// Snapshot of epSel at last load, to flag staleness.
	const [loadedSel, setLoadedSel] = useState<string[]>([]);
	const stale = JSON.stringify(epSel) !== JSON.stringify(loadedSel);

	// Download config. Each is a multi-select; empty omits the filter and lets the
	// backend default apply, which differs per row (see each emptyHint below).
	const [qualitySel, setQualitySel] = useState<string[]>([]);
	const [codecSel, setCodecSel] = useState<string[]>([]);
	const [rangeSel, setRangeSel] = useState<string[]>([]);
	const [audioSel, setAudioSel] = useState<string[]>([]);
	const [subSel, setSubSel] = useState<string[]>([]);
	const [advanced, setAdvanced] = useState<OptionValues>(() => ({
		...blankAdvanced(),
		profile: search.profile ?? '',
		proxy: search.proxy ?? '',
		no_proxy: search.no_proxy ?? false
	}));

	// Named profiles for this service; undefined keeps the free-text advanced field.
	const profiles = useQuery(profilesQuery);
	const profileOptions = profiles.isError ? null : (profiles.data?.[service] ?? null);
	// Drop a stale profile the service doesn't have.
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

	const episodeOptions = useMemo(
		() =>
			titles
				.map((t) => wantedCode(t))
				.filter((c): c is string => c != null)
				// New line at each season boundary (codes start SxxEyy; slice(0,3) = season).
				.map((c, i, all) => ({
					value: c,
					label: c,
					breakBefore: i > 0 && c.slice(0, 3) !== all[i - 1].slice(0, 3)
				})),
		[titles]
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

	// Per-episode summaries shown in "Available tracks".
	const episodeSummaries = trackResults.map((r) => ({
		code: r.code,
		name: r.title.name,
		summary: summarize(r.tracks)
	}));

	// Combined option pool across all loaded episodes drives the download chips.
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
					{/* Row 1: Episodes + Available tracks side by side */}
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

						{/* Available tracks (per selected episode) */}
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

					{/* Row 2: Download (full width) */}
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
		</>
	);
}
