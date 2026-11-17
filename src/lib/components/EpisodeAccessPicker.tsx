import type { Title } from '../api/types';
import {
	accessibleSelection,
	canSelectTitle,
	selectableEpisodeCodes,
	uniqueEpisodeTitles
} from '../episode-availability';
import { wantedCode } from '../tracks';
import AvailabilityBadges from './AvailabilityBadges';

export default function EpisodeAccessPicker({
	titles,
	selected,
	onChange,
	unseen
}: {
	titles: Title[];
	selected: string[];
	onChange: (codes: string[]) => void;
	unseen: Set<string>;
}) {
	const episodes = uniqueEpisodeTitles(titles);
	const allowed = selectableEpisodeCodes(titles);
	const picked = accessibleSelection(selected, titles);
	const fresh = allowed.filter((code) => unseen.has(code));
	const denied = episodes.length - allowed.length;
	return (
		<section aria-label="Episodes">
			<div className="flex flex-wrap items-center gap-3 text-xs">
				<h2 className="text-sm font-semibold">Episodes · {picked.length} selected</h2>
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
				{denied > 0 && <span className="text-red-600">{denied} without access</span>}
			</div>
			<p className="mt-2 text-xs text-neutral-500">
				Select episodes to download. Only confirmed lack of account access blocks selection.
			</p>
			<div className="mt-3 flex max-h-64 flex-wrap gap-2 overflow-y-auto p-1">
				{episodes.map((title) => {
					const code = wantedCode(title)!;
					const disabled = !canSelectTitle(title);
					return (
						<button
							key={code}
							type="button"
							disabled={disabled}
							aria-pressed={picked.includes(code)}
							aria-label={`${code}${disabled ? ' · No account access' : ''}`}
							onClick={() =>
								onChange(
									picked.includes(code) ? picked.filter((c) => c !== code) : [...picked, code]
								)
							}
							className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60 ${picked.includes(code) ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/20' : 'border-neutral-200 dark:border-neutral-700'}`}
						>
							<span>
								{code}
								{unseen.has(code) && !disabled ? ' ✦ New' : ''}
							</span>
							<AvailabilityBadges title={title} />
						</button>
					);
				})}
			</div>
		</section>
	);
}
