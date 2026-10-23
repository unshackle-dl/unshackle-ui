import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '$lib/api/client';
import { useSettings } from '$lib/config';
import { parseNotice } from '$lib/notice';
import { useMask } from '$lib/stores/incognito';
import { buttonClass } from './Button';
import Icon from './Icon';
import InputPrompt from './InputPrompt';
import Overlay from './Overlay';

// What the popup can show: a question a download job asks (answered here), or a notice a login
// shows while it waits on the user elsewhere (a URL and pair code), from a download job or from a
// list call the serve runs through a remote server.
type Ask = {
	key: string;
	heading: string;
	label: string;
	service?: string;
	text: string;
	send?: (response: string) => Promise<unknown>; // set for a question, which takes an answer
};

/** A question that takes an answer, else a notice to act on elsewhere, else nothing. */
function toAsks(
	id: string,
	base: { label: string; service?: string },
	question: { heading: string; text?: string | null; send: Ask['send'] },
	notice?: string | null
): Ask[] {
	if (question.text)
		return [{ ...base, ...question, key: `q${id}${question.text}`, text: question.text }];
	if (notice)
		return [{ ...base, key: `n${id}${notice}`, heading: 'Approve the sign-in', text: notice }];
	return [];
}

/** A login notice: the link to open and the code to enter, with the remote's lines underneath. */
export function Notice({ text }: { text: string }) {
	const { url, code, steps } = parseNotice(text);
	return (
		<>
			{(url || code) && (
				<div className="mt-4 flex flex-wrap items-center gap-3">
					{url && (
						<a href={url} target="_blank" rel="noreferrer" className={buttonClass()}>
							Open {new URL(url).host.replace(/^www\./, '')}
							<Icon name="chevron" size={16} />
						</a>
					)}
					{code && (
						<span className="rounded-lg bg-neutral-100 px-3 py-1.5 font-mono text-lg font-semibold tracking-widest text-neutral-900 select-all dark:bg-neutral-800 dark:text-neutral-100">
							{code}
						</span>
					)}
				</div>
			)}
			<ul className="mt-4 space-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
				{steps.map((step, i) => (
					<li key={i} className="break-words">
						{step}
					</li>
				))}
			</ul>
		</>
	);
}

/**
 * Pops up wherever the app is when the serve needs the user: a download job's `input_prompt`
 * (an OTP, PIN, device code) or `notice`, or a remote login's prompt or notice while a title listing waits
 * on it. "Later" hides that one; a job's answer box stays on its Downloads card, and a notice
 * goes away by itself once the login moves on.
 */
export default function JobPromptModal() {
	const mask = useMask();
	const queryClient = useQueryClient();
	const { remote } = useSettings();
	const [closed, setClosed] = useState<Set<string>>(new Set());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// ponytail: 3s polls, paused in a hidden tab; SSE if it ever matters. Only a running job asks.
	const jobs = useQuery({
		queryKey: ['jobs', 'prompts'],
		queryFn: () => api.jobs({ status: 'downloading' }),
		refetchInterval: 3000,
		retry: false
	});
	const logins = useQuery({
		queryKey: ['remote-logins'],
		queryFn: () => api.remoteLogins(),
		refetchInterval: 3000,
		retry: false,
		enabled: !!remote
	});

	const asks: Ask[] = [
		...(jobs.data ?? []).flatMap((j) =>
			toAsks(
				`j${j.job_id}`,
				{ label: j.title || j.title_id || j.job_id, service: j.service },
				{
					heading: 'A download needs your input',
					text: j.input_prompt,
					send: (r) => api.answerJob(j.job_id, r)
				},
				j.notice
			)
		),
		...(logins.data ?? []).flatMap((l) =>
			toAsks(
				`l${l.id}`,
				{ label: `via ${l.remote}`, service: l.service },
				{
					heading: 'Sign-in needs your input',
					text: l.prompt,
					send: (r) => api.answerRemoteLogin(l.id, r)
				},
				l.notice
			)
		)
	];
	const ask = asks.find((a) => !closed.has(a.key));
	if (!ask) return null;

	const close = () => {
		setClosed((s) => new Set(s).add(ask.key));
		setError(null);
	};

	async function answer(response: string) {
		setBusy(true);
		try {
			await ask!.send!(response);
			close();
			void queryClient.invalidateQueries({ queryKey: ['jobs'] });
			void queryClient.invalidateQueries({ queryKey: ['remote-logins'] });
		} catch (e) {
			setError(errorMessage(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Overlay onClose={close} label={ask.heading}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
						{ask.heading}
					</h2>
					<p className="mt-0.5 truncate text-sm text-neutral-500 dark:text-neutral-400">
						{ask.service && `${mask.service(ask.service)} · `}
						{mask.title(ask.label)}
					</p>
				</div>
				<button
					onClick={close}
					aria-label="Close"
					title="Later"
					className="rounded-md p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
				>
					<Icon name="x" size={18} />
				</button>
			</div>
			{ask.send ? (
				<InputPrompt prompt={ask.text} busy={busy} onAnswer={answer} />
			) : (
				<Notice text={ask.text} />
			)}
			{error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
		</Overlay>
	);
}
