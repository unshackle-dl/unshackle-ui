import { useMemo, useState, type ReactNode } from 'react';
import type { Title } from '../api/types';
import { episodeGroups, toggleEpisodeGroup } from '../episode-picker';
import { wantedCode } from '../tracks';
import { useMask } from '../stores/incognito';

export default function EpisodePicker({
	titles,
	selected,
	onChange,
	unseen,
	selectable = () => true,
	renderStatus
}: {
	titles: Title[];
	selected: string[];
	onChange: (codes: string[]) => void;
	unseen: Set<string>;
	selectable?: (title: Title) => boolean;
	renderStatus?: (title: Title) => ReactNode;
}) {
	const mask = useMask();
	const groups = useMemo(() => episodeGroups(titles), [titles]);
	const [query, setQuery] = useState('');
	const [open, setOpen] = useState<Set<number>>(
		() => new Set(groups.length ? [groups[0].season] : [])
	);
	const allowed = groups.flatMap((group) =>
		group.episodes.filter(selectable).map((t) => wantedCode(t)!)
	);
	const picked = new Set(selected.filter((code) => allowed.includes(code)));
	const fresh = allowed.filter((code) => unseen.has(code));
	const search = query.trim().toLocaleLowerCase();
	return (
		<section aria-label="Episodes by season" className="space-y-3">
			<div className="flex flex-wrap items-center gap-3 text-xs">
				<h2 className="text-sm font-semibold">
					Episodes · {groups.length} seasons · {picked.size} selected
				</h2>
				<button type="button" onClick={() => onChange(allowed)} className="text-accent-600">
					All
				</button>
				{fresh.length > 0 && (
					<button type="button" onClick={() => onChange(fresh)} className="text-amber-700">
						New ({fresh.length})
					</button>
				)}
				<button type="button" onClick={() => onChange([])} className="text-neutral-500">
					Clear
				</button>
			</div>
			<p className="text-xs text-neutral-500">
				Select episodes to download, or use All to select the entire series.
			</p>
			<input
				aria-label="Search episodes"
				placeholder="Find an episode or S01E02…"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
			/>
			<div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
				{groups.map(({ season, episodes }) => {
					const visible = episodes.filter(
						(t) => !search || `${wantedCode(t)} ${t.name}`.toLocaleLowerCase().includes(search)
					);
					if (!visible.length) return null;
					const codes = visible.filter(selectable).map((t) => wantedCode(t)!);
					const expanded = open.has(season) || !!search;
					return (
						<div
							key={season}
							className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700"
						>
							<div className="flex items-center gap-3 bg-neutral-50 px-3 py-3 dark:bg-neutral-800/50">
								<input
									type="checkbox"
									aria-label={`Select season ${season}`}
									disabled={!codes.length}
									checked={codes.length > 0 && codes.every((code) => picked.has(code))}
									onChange={() => onChange(toggleEpisodeGroup([...picked], codes))}
									className="h-4 w-4 accent-accent-600"
								/>
								<button
									type="button"
									aria-expanded={expanded}
									aria-controls={`season-${season}`}
									onClick={() =>
										setOpen((previous) => {
											const next = new Set(previous);
											next.has(season) ? next.delete(season) : next.add(season);
											return next;
										})
									}
									className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
								>
									<span className="text-sm font-semibold">
										{season === 0 ? 'Specials' : `Season ${season}`}{' '}
										<span className="text-xs font-normal text-neutral-500">
											· {episodes.length} episodes
										</span>
									</span>
									<span aria-hidden="true">{expanded ? '−' : '+'}</span>
								</button>
							</div>
							{expanded && (
								<div
									id={`season-${season}`}
									className="divide-y divide-neutral-100 dark:divide-neutral-800"
								>
									{visible.map((title) => {
										const code = wantedCode(title)!;
										return (
											<label
												key={code}
												className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-3 ${picked.has(code) ? 'bg-accent-50/60 dark:bg-accent-900/10' : ''}`}
											>
												<input
													type="checkbox"
													aria-label={code}
													disabled={!selectable(title)}
													checked={picked.has(code)}
													onChange={() =>
														onChange(
															picked.has(code)
																? [...picked].filter((value) => value !== code)
																: [...picked, code]
														)
													}
													className="h-4 w-4 accent-accent-600"
												/>
												<span className="min-w-0">
													<span className="block font-mono text-xs text-neutral-500">
														{code}
														{unseen.has(code) && selectable(title) && (
															<span className="ml-2 font-sans text-amber-700">New</span>
														)}
													</span>
													<span className="mt-0.5 block truncate text-sm">
														{mask.title(title.name || `Episode ${title.number}`)}
													</span>
												</span>
												{renderStatus && (
													<span className="col-start-2 flex flex-wrap gap-2">
														{renderStatus(title)}
													</span>
												)}
											</label>
										);
									})}
								</div>
							)}
						</div>
					);
				})}
			</div>
			{!groups.some(({ episodes }) =>
				episodes.some(
					(t) => !search || `${wantedCode(t)} ${t.name}`.toLocaleLowerCase().includes(search)
				)
			) && (
				<p role="status" className="text-sm text-neutral-500">
					No matching episodes.
				</p>
			)}
		</section>
	);
}
