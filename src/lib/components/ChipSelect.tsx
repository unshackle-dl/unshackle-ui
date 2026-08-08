import { Fragment } from 'react';

// Reusable multi-select chip group. An empty selection makes the caller omit the
// corresponding API filter, so the backend applies its own default. That default
// is not "all" for every field, so each caller states its own via emptyHint.
export interface ChipOption {
	value: string;
	label: string;
	breakBefore?: boolean; // force this chip onto a new line (e.g. new season)
	// Draw attention to this chip (a newly-detected episode). Marked three ways on
	// purpose — ring, glyph and accessible name — because colour alone is no signal in
	// dark mode, to a colour-blind reader, or on a screen reader.
	highlight?: boolean;
}

export default function ChipSelect({
	label,
	emptyHint = '',
	options,
	selected,
	onChange
}: {
	label: string;
	emptyHint?: string;
	options: ChipOption[];
	selected: string[];
	onChange: (next: string[]) => void;
}) {
	const toggle = (v: string) =>
		onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

	return (
		<div>
			{(label || emptyHint) && (
				<p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
					{label}
					{selected.length === 0 && emptyHint && (
						<span className="font-normal text-neutral-400"> · {emptyHint}</span>
					)}
				</p>
			)}
			<div className="mt-1.5 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
				{options.map((o) => (
					<Fragment key={o.value}>
						{o.breakBefore && <span className="basis-full" />}
						<button
							type="button"
							onClick={() => toggle(o.value)}
							aria-pressed={selected.includes(o.value)}
							aria-label={o.highlight ? `${o.label} (new)` : undefined}
							title={o.highlight ? 'New since you last looked' : undefined}
							className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
								selected.includes(o.value)
									? 'bg-accent-600 text-white'
									: o.highlight
										? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25'
										: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
							} ${o.highlight ? 'ring-1 ring-amber-500 dark:ring-amber-400' : ''}`}
						>
							{o.label}
							{o.highlight && <span aria-hidden="true"> ✦</span>}
						</button>
					</Fragment>
				))}
			</div>
		</div>
	);
}
