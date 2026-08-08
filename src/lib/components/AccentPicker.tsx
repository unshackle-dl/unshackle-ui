import { accent, ACCENTS, useAccent } from '$lib/stores/accent';

export default function AccentPicker() {
	const name = useAccent();
	const current = ACCENTS.find((a) => a.name === name) ?? ACCENTS[0];

	// Single swatch (current accent); hover/focus expands the full set downward.
	return (
		<div className="group relative">
			<button
				className="block h-5 w-5 rounded-full ring-1 ring-neutral-300 ring-offset-1 ring-offset-white transition group-hover:scale-110 dark:ring-neutral-600 dark:ring-offset-neutral-900"
				style={{ backgroundColor: current.scale[5] }}
				aria-label={`Accent color: ${current.name}`}
				title="Accent color"
			/>

			{/* Opens upward (sidebar bottom); pb-2 keeps the hover area continuous. */}
			<div className="invisible absolute bottom-full left-1/2 z-10 -translate-x-1/2 pb-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
				<div
					className="flex flex-col items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
					role="radiogroup"
					aria-label="Accent color"
				>
					{ACCENTS.map((a) => (
						<button
							key={a.name}
							onClick={() => accent.set(a.name)}
							className={`h-5 w-5 rounded-full transition ${
								name === a.name
									? 'ring-2 ring-neutral-400 ring-offset-1 ring-offset-white dark:ring-neutral-500 dark:ring-offset-neutral-800'
									: 'hover:scale-110'
							}`}
							style={{ backgroundColor: a.scale[5] }}
							title={a.name}
							aria-label={a.name}
							aria-checked={name === a.name}
							role="radio"
						/>
					))}
				</div>
			</div>
		</div>
	);
}
