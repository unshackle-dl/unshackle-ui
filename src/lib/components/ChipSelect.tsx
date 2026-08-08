import { Fragment } from 'react';

// Reusable multi-select chip group. An empty selection makes the caller omit the
// corresponding API filter, so the backend applies its own default. That default
// is not "all" for every field, so each caller states its own via emptyHint.
export interface ChipOption {
	value: string;
	label: string;
	breakBefore?: boolean; // force this chip onto a new line (e.g. new season)
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
							className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
								selected.includes(o.value)
									? 'bg-accent-600 text-white'
									: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
							}`}
						>
							{o.label}
						</button>
					</Fragment>
				))}
			</div>
		</div>
	);
}
