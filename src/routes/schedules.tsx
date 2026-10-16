import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ADVANCED_FIELDS } from '$lib/download';
import OptionForm, { type OptionValues } from '$lib/components/OptionForm';
import { api } from '$lib/api/client';
import { blankValues, coerce, serviceFields, type Field } from '$lib/options';
import type { DownloadRequest } from '$lib/api/types';
import Button from '$lib/components/Button';
import Card from '$lib/components/Card';
import EmptyState from '$lib/components/EmptyState';
import Icon from '$lib/components/Icon';
import type { ScheduleRecord } from '../server/scheduler/store';

export const Route = createFileRoute('/schedules')({ ssr: false, component: Schedules });

// Selectors handled as chips on the title page are exposed as CSV fields here so a
// scheduled request can carry the same full set of download choices.
const SCHEDULE_FIELDS: Field[] = [
	{ key: 'wanted', type: 'csv', label: 'Episodes (-w)', placeholder: 'S01E01, S01E02', group: 'Main' },
	{ key: 'quality', type: 'csv', label: 'Resolution (p)', placeholder: '1080, 720', group: 'Main' },
	{ key: 'vcodec', type: 'csv', label: 'Video codec', placeholder: 'H.264, H.265', group: 'Main' },
	{ key: 'range', type: 'csv', label: 'Video range', placeholder: 'SDR, HDR10', group: 'Main' },
	{ key: 'a_lang', type: 'csv', label: 'Audio language', placeholder: 'en, ja', group: 'Main' },
	{ key: 's_lang', type: 'csv', label: 'Subtitle language', placeholder: 'en, es', group: 'Main' }
];

const PRIMARY_ADVANCED_KEYS = ['latest_episode', 'latest_episodes', 'acodec', 'lang', 'v_lang', 'imdb_id', 'tmdb_id', 'enrich'];
const PRIMARY_ADVANCED_LABELS: Record<string, string> = {
	latest_episode: 'Latest episode only (--latest-episode)',
	latest_episodes: 'Latest N episodes',
	acodec: 'Audio codec',
	lang: 'Video and audio language',
	v_lang: 'Video language',
	imdb_id: 'IMDb ID',
	tmdb_id: 'TMDB ID',
	enrich: 'Enrich metadata'
};
const PRIMARY_ADVANCED_HELP: Record<string, string> = {
	latest_episode: 'Download only the most recent episode. When enabled, this overrides the episode selection (-w).',
	latest_episodes: 'Download the N most recent episodes. When set, this overrides the episode selection (-w).'
};
const PRIMARY_ADVANCED_FIELDS = PRIMARY_ADVANCED_KEYS.flatMap((key) => {
	const field = ADVANCED_FIELDS.find((candidate) => candidate.key === key);
	return field ? [{ ...field, label: PRIMARY_ADVANCED_LABELS[key] ?? field.label, help: PRIMARY_ADVANCED_HELP[key] ?? field.help, group: 'Main' }] : [];
});
const PRIMARY_FIELDS = [...SCHEDULE_FIELDS, ...PRIMARY_ADVANCED_FIELDS];

const ADVANCED_GROUP_LABELS: Record<string, string> = {
	'Principal': 'Main',
	'Track scope': 'Track types',
	'Quality selection': 'Quality options',
	Video: 'Video',
	Audio: 'Audio',
	'Subtitles & languages': 'Subtitles and languages',
	Output: 'Output',
	Pipeline: 'Download and performance',
	'Tagging IDs': 'Metadata',
	Proxy: 'Proxy',
	Cache: 'Cache'
};

const ALL_SCHEDULE_FIELDS: Field[] = [
	...PRIMARY_FIELDS,
	...ADVANCED_FIELDS.filter((field) => !PRIMARY_ADVANCED_KEYS.includes(field.key)).map((field) => ({
		...field,
		group: ADVANCED_GROUP_LABELS[field.group ?? ''] ?? field.group
	}))
];

function buildScheduleParams(values: OptionValues, fields: Field[]): Record<string, unknown> {
	const parsed = coerce(fields, values);
	if (parsed.quality) {
		const quality = (parsed.quality as string[]).map(Number);
		if (quality.some((value) => !Number.isFinite(value))) throw new Error('Resolution must contain numbers only.');
		parsed.quality = quality;
	}
	return parsed;
}

function parseExtraOptions(raw: string): Record<string, unknown> {
	let value: unknown;
	try { value = JSON.parse(raw); } catch { throw new Error('Additional options must be valid JSON.'); }
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Additional options must be a JSON object.');
	return value as Record<string, unknown>;
}

function shellQuote(value: unknown): string {
	const text = typeof value === 'string' ? value : JSON.stringify(value);
	return `'${text.replaceAll("'", "'\\''")}'`;
}

function cliEquivalent(request: DownloadRequest): string {
	const args = ['unshackle', 'dl'];
	for (const [key, value] of Object.entries(request)) {
		if (key === 'service' || key === 'title_id' || value == null || value === false) continue;
		const flag = `--${key.replaceAll('_', '-')}`;
		if (value === true) args.push(flag);
		else if (Array.isArray(value)) for (const item of value) args.push(flag, shellQuote(item));
		else args.push(flag, shellQuote(value));
	}
	args.push(shellQuote(request.service), shellQuote(request.title_id));
	return args.join(' ');
}

function restoreValues(fields: Field[], request: Record<string, unknown>): OptionValues {
	const values = blankValues(fields);
	for (const field of fields) {
		const value = request[field.key];
		if (value === undefined || value === null) continue;
		values[field.key] = field.type === 'bool'
			? value === true
			: Array.isArray(value)
				? value.join(', ')
				: String(value);
	}
	return values;
}

type Kind = 'once' | 'cron';
const localDateTime = () => {
	const d = new Date(Date.now() + 60_000);
	return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const when = (value: string | null) => value ? new Date(value).toLocaleString('en-US') : '—';
const message = (e: unknown) => e instanceof Error ? e.message : String(e);

async function loadSchedules(): Promise<ScheduleRecord[]> {
	const r = await fetch('/api/schedules');
	const body = await r.json();
	if (!r.ok) throw new Error(body.error ?? 'Could not load schedules.');
	return body.schedules;
}

function Schedules() {
	const client = useQueryClient();
	const query = useQuery({ queryKey: ['schedules'], queryFn: loadSchedules, refetchInterval: 10_000 });
	const services = useQuery({ queryKey: ['services'], queryFn: () => api.services(), staleTime: 5 * 60_000 });
	const [name, setName] = useState('');
	const [kind, setKind] = useState<Kind>('once');
	const [runAt, setRunAt] = useState(localDateTime());
	const [cron, setCron] = useState('0 3 * * *');
	const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles');
	const [service, setService] = useState('');
	const [titleId, setTitleId] = useState('');
	const [options, setOptions] = useState('{}');
	const [selection, setSelection] = useState<OptionValues>(() => blankValues(ALL_SCHEDULE_FIELDS));
	const svcFields = useMemo<Field[]>(() => serviceFields(services.data?.find((s) => s.tag === service)?.cli_params), [services.data, service]);
	const [svcValues, setSvcValues] = useState<OptionValues>({});
	const preserveServiceValues = useRef(false);
	useEffect(() => {
		if (preserveServiceValues.current) preserveServiceValues.current = false;
		else setSvcValues(blankValues(svcFields));
	}, [svcFields]);
	const [formError, setFormError] = useState<string | null>(null);
	const requestPreview = useMemo(() => {
		if (!service.trim() || !titleId.trim()) return null;
		try {
			return {
				request: {
					...parseExtraOptions(options),
					...buildScheduleParams(selection, ALL_SCHEDULE_FIELDS),
					...coerce(svcFields, svcValues),
					service, title_id: titleId
				} as DownloadRequest,
				error: null
			};
		} catch (error) {
			return { request: null, error: message(error) };
		}
	}, [service, titleId, options, selection, svcFields, svcValues]);

	const create = useMutation({
		mutationFn: async () => {
			const request = requestPreview?.request;
			if (!request) throw new Error(requestPreview?.error ?? 'Enter a service and title ID.');
			const body = { name, kind, ...(kind === 'once' ? { runAt: new Date(runAt).toISOString() } : { cron }), timeZone, request };
			const r = await fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			const data = await r.json();
			if (!r.ok) throw new Error(data.error ?? 'Could not create the schedule.');
			return data.schedule as ScheduleRecord;
		},
		onSuccess: async () => { setName(''); setTitleId(''); setFormError(null); await client.invalidateQueries({ queryKey: ['schedules'] }); },
		onError: (e) => setFormError(message(e))
	});
	const action = useMutation({
		mutationFn: async ({ id, state }: { id: string; state?: 'active' | 'paused' }) => {
			const r = await fetch(`/api/schedules/${id}`, state
				? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) }
				: { method: 'DELETE' });
			if (!r.ok) { const data = await r.json().catch(() => ({})); throw new Error(data.error ?? 'Could not update the schedule.'); }
		},
		onSuccess: () => client.invalidateQueries({ queryKey: ['schedules'] }),
		onError: (e) => setFormError(message(e))
	});
	const reuse = (schedule: ScheduleRecord) => {
		const request = schedule.request as Record<string, unknown>;
		const nextServiceFields = serviceFields(services.data?.find((item) => item.tag === schedule.request.service)?.cli_params);
		const fields = [...ALL_SCHEDULE_FIELDS, ...nextServiceFields];
		const known = new Set([...fields.map((field) => field.key), 'service', 'title_id']);
		const extra = Object.fromEntries(Object.entries(request).filter(([key]) => !known.has(key)));
		setName(`${schedule.name} (copy)`.slice(0, 120));
		setKind(schedule.kind);
		setRunAt(localDateTime());
		if (schedule.cron) setCron(schedule.cron);
		setTimeZone(schedule.timeZone);
		setService(schedule.request.service);
		setTitleId(schedule.request.title_id);
		setSelection(restoreValues(ALL_SCHEDULE_FIELDS, request));
		preserveServiceValues.current = service !== schedule.request.service;
		setSvcValues(restoreValues(nextServiceFields, request));
		setOptions(JSON.stringify(extra, null, 2));
		setFormError(null);
		document.getElementById('schedule-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const input = 'mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100';
	const label = 'block text-sm font-medium text-neutral-700 dark:text-neutral-300';

	return <div className="space-y-6">
		<div className="flex items-start justify-between gap-3">
			<div><h1 className="text-2xl font-semibold tracking-tight">Schedules</h1><p className="mt-1 text-sm text-neutral-500">Schedule Unshackle downloads for a specific date or on a recurring basis.</p></div>
			<Button variant="secondary" onClick={() => query.refetch()}><Icon name="refresh" size={16} /> Refresh</Button>
		</div>

		<Card className="p-5">
			<h2 className="text-base font-semibold">New schedule</h2>
			<p className="mt-1 text-sm text-neutral-500">The server runs the task even when this page is closed.</p>
			<form id="schedule-form" className="mt-5 grid gap-4 md:grid-cols-2 scroll-mt-4" onSubmit={(e) => { e.preventDefault(); setFormError(null); create.mutate(); }}>
				<div><label className={label}>Task name</label><input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="e.g. Download a new episode" /></div>
				<div><label className={label}>Title ID</label><input required value={titleId} onChange={(e) => setTitleId(e.target.value)} className={input} placeholder="ID expected by the API" /></div>
				<div><label className={label}>Schedule type</label><select className={input} value={kind} onChange={(e) => setKind(e.target.value as Kind)}><option value="once">One time</option><option value="cron">Recurring (cron)</option></select></div>
				<div><label className={label}>Time zone (IANA)</label><input required value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={input} placeholder="America/Los_Angeles" /><p className="mt-1 text-xs text-neutral-500">One-time schedules use your browser's local time zone.</p></div>
				{kind === 'once' ? <div><label className={label}>Local date and time</label><input required type="datetime-local" min={localDateTime()} value={runAt} onChange={(e) => setRunAt(e.target.value)} className={input} /></div> : <div><label className={label}>Cron expression (5 fields)</label><input required value={cron} onChange={(e) => setCron(e.target.value)} className={input} placeholder="0 3 * * *" /><p className="mt-1 text-xs text-neutral-500">Example: 0 3 * * * = every day at 03:00.</p></div>}
				<div><label className={label}>Service</label>{services.data?.length ? <select required value={service} onChange={(e) => setService(e.target.value)} className={input}><option value="">Select a service</option>{services.data.map((s) => <option key={s.tag} value={s.tag}>{s.tag}</option>)}</select> : <input required value={service} onChange={(e) => setService(e.target.value)} className={input} placeholder="e.g. netflix" />}<p className="mt-1 text-xs text-neutral-500">The service list and its options come from the connected API.</p></div>
				<div className="md:col-span-2"><OptionForm title="Episode and track selection" fields={ALL_SCHEDULE_FIELDS} values={selection} onChange={setSelection} collapsibleGroups openFirstGroup /></div>
				{svcFields.length > 0 && <div className="md:col-span-2"><OptionForm title={`${service} options`} fields={svcFields} values={svcValues} onChange={setSvcValues} /></div>}
				<div className="md:col-span-2"><label className={label}>Additional options (JSON)</label><textarea rows={3} value={options} onChange={(e) => setOptions(e.target.value)} className={`${input} font-mono`} spellCheck={false} placeholder={'{"quality":[1080],"wanted":["S01E01"]}'} /><p className="mt-1 text-xs text-neutral-500">Use this for future parameters or options not shown above. Values in the fields above take precedence.</p></div>
				{requestPreview?.request && <div className="md:col-span-2 space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"><div><h3 className="text-sm font-medium">Equivalent Unshackle command</h3><p className="mt-1 text-xs text-neutral-500">The scheduler sends this configuration to <code>/api/download</code>; the command below represents the same options in the CLI.</p><pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-neutral-50 p-3 font-mono text-xs dark:bg-neutral-900">{cliEquivalent(requestPreview.request)}</pre></div><details><summary className="cursor-pointer text-xs text-neutral-500">View exact API request</summary><pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-900">{JSON.stringify(requestPreview.request, null, 2)}</pre></details></div>}
				{requestPreview?.error && <p className="md:col-span-2 text-xs text-amber-700 dark:text-amber-300">Preview unavailable: {requestPreview.error}</p>}
				{formError && <p role="alert" className="md:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{formError}</p>}
				<div className="md:col-span-2"><Button type="submit" disabled={create.isPending}><Icon name="calendar" size={16} />{create.isPending ? 'Saving…' : 'Create schedule'}</Button></div>
			</form>
		</Card>

		<section className="space-y-3">
			<div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Scheduled tasks</h2><span className="text-sm text-neutral-500">{query.data?.length ?? 0} total</span></div>
			{query.isLoading ? <Card className="p-6 text-sm text-neutral-500">Loading schedules…</Card> : query.error ? <Card className="p-5 text-sm text-red-600">{message(query.error)}</Card> : !query.data?.length ? <EmptyState title="No schedules yet" description="Create your first schedule using the form above." /> : <div className="space-y-3">{query.data.map((s) => <Card key={s.id} className="p-4">
				<div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{s.name}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.state === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : s.state === 'paused' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{s.state === 'active' ? 'Active' : s.state === 'paused' ? 'Paused' : 'Completed'}</span><span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{s.kind === 'once' ? 'One time' : 'Cron'}</span></div>
					<p className="mt-1 break-all text-sm text-neutral-500">{s.request.service} · {s.request.title_id}</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-neutral-500">Next run: </span>{when(s.nextRunAt)}</p><p><span className="text-neutral-500">Last attempt: </span>{when(s.lastRunAt)}</p>{s.kind === 'cron' && <p><span className="text-neutral-500">Cron: </span><code>{s.cron}</code> ({s.timeZone})</p>}{s.lastJobId && <p><span className="text-neutral-500">Job: </span><code>{s.lastJobId}</code></p>}</div><details className="mt-3"><summary className="cursor-pointer text-xs text-neutral-500">Submitted configuration ({Object.keys(s.request).length - 2} parameters)</summary><pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-900">{JSON.stringify(Object.fromEntries(Object.entries(s.request).filter(([key]) => key !== 'service' && key !== 'title_id')), null, 2)}</pre></details>{s.lastError && <p className="mt-2 text-sm text-red-600 dark:text-red-300">Error: {s.lastError}</p>}{s.lastStatus && <p className="mt-1 text-xs text-neutral-500">Last result: {s.lastStatus}</p>}</div>
				<div className="flex shrink-0 flex-wrap gap-2"><Button variant="secondary" onClick={() => reuse(s)}>Reuse</Button>{s.state !== 'completed' && <Button variant="secondary" disabled={action.isPending} onClick={() => action.mutate({ id: s.id, state: s.state === 'active' ? 'paused' : 'active' })}>{s.state === 'active' ? 'Pause' : 'Activate'}</Button>}<Button variant="danger" disabled={action.isPending} onClick={() => { if (confirm(`Delete the schedule “${s.name}”?`)) action.mutate({ id: s.id }); }}>Delete</Button></div></div>
			</Card>)}</div>}
		</section>
	</div>;
}
