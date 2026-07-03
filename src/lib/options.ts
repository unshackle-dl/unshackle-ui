import type { CliParam } from './api/types';

// Shared field model for both option forms: the advanced catalog and service cli_params.

export type FieldType = 'bool' | 'int' | 'num' | 'text' | 'csv' | 'choice';

export interface Field {
	key: string;
	type: FieldType;
	label: string;
	help?: string;
	placeholder?: string;
	choices?: string[];
	// Untouched value; coerce omits anything still at it. Bools default false, others ''.
	default?: string | boolean;
	group?: string; // section header in OptionForm; undefined = ungrouped
}

const boolDefault = (f: Field) => f.default === true;
const strDefault = (f: Field) =>
	f.default == null || f.default === false ? '' : String(f.default);

/** Form state pre-filled with each field's default so the control shows it. */
export function blankValues(fields: Field[]): Record<string, string | boolean> {
	const v: Record<string, string | boolean> = {};
	for (const f of fields) v[f.key] = f.type === 'bool' ? boolDefault(f) : strDefault(f);
	return v;
}

/** Coerce form values to a partial request body, dropping anything still at its default. */
export function coerce(
	fields: Field[],
	values: Record<string, string | boolean>
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const f of fields) {
		const raw = values[f.key];
		if (f.type === 'bool') {
			if ((raw === true) !== boolDefault(f)) out[f.key] = raw === true;
			continue;
		}
		const s = String(raw ?? '').trim();
		if (s === '' || s === strDefault(f)) continue;
		if (f.type === 'int' || f.type === 'num') {
			if (!Number.isNaN(Number(s))) out[f.key] = Number(s);
		} else if (f.type === 'csv') {
			const arr = s
				.split(',')
				.map((x) => x.trim())
				.filter(Boolean);
			if (arr.length) out[f.key] = arr;
		} else {
			// `slow` accepts a boolean or a "MIN-MAX" string.
			if (f.key === 'slow' && (s === 'true' || s === 'false')) out[f.key] = s === 'true';
			else out[f.key] = s;
		}
	}
	return out;
}

const cliLabel = (p: CliParam) =>
	(p.opts ?? []).find((o) => o.startsWith('--'))?.slice(2) ?? p.name;
const cliDefault = (p: CliParam) =>
	p.default == null ? '' : Array.isArray(p.default) ? p.default.join(', ') : String(p.default);

/** Map a service cli option onto the shared Field shape. */
export function cliParamToField(p: CliParam): Field {
	const type: FieldType = p.is_flag
		? 'bool'
		: p.multiple
			? 'csv'
			: p.choices?.length
				? 'choice'
				: p.type === 'integer'
					? 'int'
					: p.type === 'float'
						? 'num'
						: 'text';
	return {
		key: p.name,
		type,
		label: cliLabel(p),
		help: p.help,
		choices: p.choices,
		placeholder: p.multiple ? 'a, b, c…' : undefined,
		default: p.is_flag ? p.default === true : cliDefault(p)
	};
}

// Only real options (kind === 'option'), not the positional title argument.
export function serviceFields(params: CliParam[] | undefined): Field[] {
	return (params ?? []).filter((p) => p.kind === 'option').map(cliParamToField);
}
