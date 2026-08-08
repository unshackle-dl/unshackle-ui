import { useMemo } from 'react';
import { coerce, type Field } from '$lib/options';
import { useMask } from '$lib/stores/incognito';

export type OptionValues = Record<string, string | boolean>;

// Collapsible option form for any Field[]: bools as chips, the rest as a grid, groups headed.
export default function OptionForm({
	title,
	fields,
	values,
	onChange
}: {
	title: string;
	fields: Field[];
	values: OptionValues;
	onChange: (next: OptionValues) => void;
}) {
	const mask = useMask();
	const set = (key: string, v: string | boolean) => onChange({ ...values, [key]: v });

	// "N set" = however many values coerce would actually send.
	const setCount = Object.keys(coerce(fields, values)).length;

	const groups = useMemo(() => {
		const out: { name: string | undefined; bools: Field[]; inputs: Field[] }[] = [];
		for (const f of fields) {
			let g = out.at(-1);
			if (!g || g.name !== f.group) {
				g = { name: f.group, bools: [], inputs: [] };
				out.push(g);
			}
			(f.type === 'bool' ? g.bools : g.inputs).push(f);
		}
		return out;
	}, [fields]);

	return (
		<details className="group rounded-lg border border-neutral-200 dark:border-neutral-700">
			<summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-neutral-700 select-none dark:text-neutral-200">
				<span>
					{title}
					{setCount > 0 && (
						<span className="ml-1 text-xs font-normal text-accent-600 dark:text-accent-400">
							· {setCount} set
						</span>
					)}
				</span>
				<span className="text-neutral-400 transition-transform group-open:rotate-90">›</span>
			</summary>

			<div className="space-y-4 border-t border-neutral-200 px-3 py-3 dark:border-neutral-700">
				{groups.map((g) => (
					<div key={g.name ?? '_'}>
						{g.name && (
							<p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
								{g.name}
							</p>
						)}
						{g.bools.length > 0 && (
							<div className="mt-1.5 flex flex-wrap gap-1.5">
								{g.bools.map((f) => (
									<button
										key={f.key}
										type="button"
										title={f.help}
										onClick={() => set(f.key, values[f.key] !== true)}
										aria-pressed={values[f.key] === true}
										className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
											values[f.key] === true
												? 'bg-accent-600 text-white'
												: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
										}`}
									>
										{f.label}
									</button>
								))}
							</div>
						)}
						{g.inputs.length > 0 && (
							<div className={`grid grid-cols-2 gap-2.5 ${g.bools.length ? 'mt-2' : 'mt-1.5'}`}>
								{g.inputs.map((f) => (
									<label
										key={f.key}
										className="block text-xs text-neutral-600 dark:text-neutral-400"
									>
										<span title={f.help}>{f.label}</span>
										{f.type === 'choice' ? (
											<select
												value={String(values[f.key] ?? '')}
												onChange={(e) => set(f.key, e.target.value)}
												className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
											>
												{!f.default && <option value="">default</option>}
												{(f.choices ?? []).map((c) => (
													<option key={c} value={c}>
														{f.key === 'profile' ? mask.profile(c) : c}
													</option>
												))}
											</select>
										) : (
											<input
												type={f.type === 'int' || f.type === 'num' ? 'number' : 'text'}
												step={f.type === 'num' ? 'any' : undefined}
												placeholder={f.placeholder}
												value={String(values[f.key] ?? '')}
												onChange={(e) => set(f.key, e.target.value)}
												className="redact mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
											/>
										)}
										{f.help && (
											<span className="mt-0.5 block text-[11px] text-neutral-400 dark:text-neutral-500">
												{f.help}
											</span>
										)}
									</label>
								))}
							</div>
						)}
					</div>
				))}
			</div>
		</details>
	);
}
