import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { api, errorMessage } from '$lib/api/client';
import type { RefreshServicesResponse } from '$lib/api/types';
import Badge from '$lib/components/Badge';
import Button from '$lib/components/Button';
import Card from '$lib/components/Card';
import Icon from '$lib/components/Icon';
import { settings, useSettings } from '$lib/config';
import { statusQuery } from '$lib/queries';
import { useMask } from '$lib/stores/incognito';

export const Route = createFileRoute('/settings')({ component: SettingsPage });

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let v = n / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(1)} ${units[i]}`;
}

/** Host, or empty when the value is not a URL at all. */
function hostOf(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return '';
	}
}

type MaintState =
	| { kind: 'idle' }
	| { kind: 'confirm' }
	| { kind: 'running' }
	| { kind: 'ok'; message: string }
	| { kind: 'error'; message: string };

function SettingsPage() {
	const mask = useMask();
	const queryClient = useQueryClient();
	const current = useSettings();

	const [draft, setDraft] = useState({ apiUrl: current.apiUrl, apiKey: current.apiKey });
	const [saved, setSaved] = useState(false);

	function save() {
		settings.set({ apiUrl: draft.apiUrl.trim(), apiKey: draft.apiKey.trim() });
		// Everything cached was fetched from the old base URL / key. removeQueries, not
		// clear(), so the in-flight "test & save" mutation that calls this survives.
		queryClient.removeQueries();
		setSaved(true);
		setTimeout(() => setSaved(false), 1500);
	}

	const test = useMutation({
		mutationFn: () => {
			save();
			return api.health();
		},
		onSuccess: () => {
			server.refetch();
			envChecks.refetch();
		}
	});

	// Server config + environment checks; sections stay hidden until these load.
	const server = useQuery({ queryKey: ['config'], queryFn: () => api.config() });
	const envChecks = useQuery({ queryKey: ['env-check'], queryFn: () => api.envCheck() });

	// The accepted cost of running in server mode: the poller reads UNSHACKLE_API_URL from
	// this app's own environment, while everything on this page uses the URL saved in this
	// browser. They can disagree without either side being wrong, and the failure is silent:
	// background checks hitting a different API than the one you are looking at. So it is
	// surfaced rather than hidden. Host only; the server never reports its key.
	const tracking = useQuery(statusQuery);
	const drift =
		tracking.data && tracking.data.poller !== 'inert' && hostOf(current.apiUrl) !== ''
			? tracking.data.api_url !== hostOf(current.apiUrl)
			: false;

	const [ops, setOps] = useState<Record<'temp' | 'refresh', MaintState>>({
		temp: { kind: 'idle' },
		refresh: { kind: 'idle' }
	});
	const setOp = (key: 'temp' | 'refresh', state: MaintState) =>
		setOps((o) => ({ ...o, [key]: state }));
	const [refreshRepos, setRefreshRepos] = useState<RefreshServicesResponse['repos']>([]);

	async function runClearTemp() {
		setOp('temp', { kind: 'running' });
		try {
			const r = await api.clearTemp();
			setOp('temp', { kind: 'ok', message: `Cleared, freed ${formatBytes(r.freed_bytes)}.` });
		} catch (e) {
			setOp('temp', { kind: 'error', message: errorMessage(e) });
		}
	}

	async function runRefresh() {
		setOp('refresh', { kind: 'running' });
		setRefreshRepos([]);
		try {
			const r = await api.refreshServices();
			setRefreshRepos(r.repos);
			setOp(
				'refresh',
				r.refreshed
					? {
							kind: 'ok',
							message:
								r.repos.length === 0
									? 'No service repos configured.'
									: r.repos.every((repo) => repo.changes.length === 0)
										? 'All service repos already up to date.'
										: 'Service repos refreshed.'
						}
					: { kind: 'error', message: 'One or more repos failed to sync.' }
			);
		} catch (e) {
			setOp('refresh', { kind: 'error', message: errorMessage(e) });
		}
	}

	const health = test.data;
	const tempOp = ops.temp;

	return (
		<>
			<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
			<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
				Point the UI at your unshackle API. Stored in this browser only.
			</p>

			<div className="mt-6 grid items-start gap-8 lg:grid-cols-2">
				<section>
					<h2 className="text-lg font-semibold tracking-tight">Connection</h2>
					<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
						Where this browser sends its requests.
					</p>
					<Card className="mt-4 p-6">
						<div className="space-y-5">
							<div>
								<label
									htmlFor="apiUrl"
									className="block text-sm font-medium text-neutral-700 dark:text-neutral-200"
								>
									API base URL
								</label>
								<input
									id="apiUrl"
									type="url"
									value={draft.apiUrl}
									onChange={(e) => setDraft((d) => ({ ...d, apiUrl: e.target.value }))}
									placeholder="http://localhost:8786"
									className="redact mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
								/>
								<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
									All requests go to this origin. Leave off any trailing{' '}
									<code className="font-mono">/api</code>.
								</p>
							</div>

							<div>
								<label
									htmlFor="apiKey"
									className="block text-sm font-medium text-neutral-700 dark:text-neutral-200"
								>
									Secret key <span className="font-normal text-neutral-400">(optional)</span>
								</label>
								<input
									id="apiKey"
									type="password"
									value={draft.apiKey}
									onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
									placeholder="leave blank for --no-key deployments"
									autoComplete="off"
									className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
								/>
								<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
									Sent as <code className="font-mono">X-Secret-Key</code> on every request when set.
								</p>
							</div>

							<div className="flex items-center gap-3 pt-1">
								<Button onClick={() => test.mutate()} disabled={test.isPending}>
									{test.isPending ? (
										<>
											<Icon name="loader" spin />
											Testing…
										</>
									) : (
										<>
											<Icon name="plug" />
											Test &amp; save
										</>
									)}
								</Button>
								<Button variant="secondary" onClick={save}>
									Save
								</Button>
								{saved && (
									<span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
										<Icon name="check" size={16} /> Saved
									</span>
								)}
							</div>

							{health ? (
								<>
									<div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-300">
										<Icon name="check" size={16} className="mt-0.5" />
										<span>
											Connected. Status <strong>{health.status}</strong>, unshackle{' '}
											<strong>v{health.version}</strong>
											{health.code_hash ? ` (code hash ${health.code_hash})` : ''}.
										</span>
									</div>
									{health.update_check?.update_available && (
										<div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
											<Icon name="alert" size={16} className="mt-0.5" />
											<span>
												Update available → <strong>v{health.update_check.latest_version}</strong>{' '}
												(running v{health.update_check.current_version}).
											</span>
										</div>
									)}
								</>
							) : (
								test.error && (
									<div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
										<Icon name="alert" size={16} className="mt-0.5" />
										<span>{mask.text(errorMessage(test.error))}</span>
									</div>
								)
							)}

							{drift && tracking.data && (
								<div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
									<Icon name="alert" size={16} className="mt-0.5 shrink-0" />
									<span>
										The tracking server polls <strong>{mask.text(tracking.data.api_url)}</strong>,
										while this browser is configured for{' '}
										<strong>{mask.text(hostOf(current.apiUrl))}</strong>. Background checks use the
										server's setting (<code className="font-mono">UNSHACKLE_API_URL</code> in its
										environment), not this one. A tracked title is re-listed against the server's
										API, whatever this page is pointed at.
									</span>
								</div>
							)}

							{tracking.data?.poller === 'inert' && (
								<div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
									<Icon name="alert" size={16} className="mt-0.5 shrink-0" />
									<span>
										No API URL is configured on the tracking server, so it never checks tracked
										titles on its own. Set <code className="font-mono">UNSHACKLE_API_URL</code> or
										add one under Settings on the Tracking page; until then, only the Check buttons
										there do anything.
									</span>
								</div>
							)}
						</div>
					</Card>
				</section>

				{server.data && (
					<>
						<section>
							<h2 className="text-lg font-semibold tracking-tight">Server</h2>
							<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
								Read-only defaults reported by the connected API.
							</p>

							<Card className="mt-4 p-6">
								<dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
									<div>
										<dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
											Max concurrent downloads
										</dt>
										<dd className="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100">
											{server.data.serve.max_concurrent_downloads}
										</dd>
									</div>
									<div>
										<dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
											Job retention
										</dt>
										<dd className="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100">
											{server.data.serve.job_retention_hours} h
										</dd>
									</div>
									<div>
										<dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
											History kept
										</dt>
										<dd className="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100">
											{server.data.serve.history_limit > 0
												? `${server.data.serve.history_limit} jobs`
												: 'unlimited'}
										</dd>
									</div>
									<div>
										<dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
											Output directory
										</dt>
										<dd className="mt-0.5 font-mono text-xs break-all text-neutral-900 dark:text-neutral-100">
											{mask.text(server.data.directories.downloads)}
										</dd>
									</div>
									<div>
										<dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
											Temp directory
										</dt>
										<dd className="mt-0.5 font-mono text-xs break-all text-neutral-900 dark:text-neutral-100">
											{mask.text(server.data.directories.temp)}
										</dd>
									</div>
									<div className="sm:col-span-2">
										<dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
											Allowed services
										</dt>
										<dd className="mt-1 flex flex-wrap gap-1.5">
											{server.data.serve.services === null ? (
												<Badge tone="green">all</Badge>
											) : (
												server.data.serve.services.map((s) => (
													<Badge key={s}>{mask.service(s)}</Badge>
												))
											)}
										</dd>
									</div>
								</dl>
							</Card>
						</section>

						<section>
							<h2 className="text-lg font-semibold tracking-tight">Maintenance</h2>
							<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
								One-off server housekeeping. Clearing is destructive and asks to confirm.
							</p>

							<Card className="mt-4 divide-y divide-neutral-100 p-0 dark:divide-neutral-800">
								<div className="px-6 py-4">
									<div className="flex items-center justify-between gap-4">
										<div className="min-w-0">
											<p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
												Clear temp
											</p>
											<p className="mt-0.5 truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
												Empties {mask.text(server.data.directories.temp)}
											</p>
										</div>
										<div className="flex shrink-0 items-center gap-2">
											{tempOp.kind === 'confirm' ? (
												<>
													<Button variant="danger" onClick={runClearTemp}>
														<Icon name="trash" size={16} /> Confirm
													</Button>
													<Button
														variant="secondary"
														onClick={() => setOp('temp', { kind: 'idle' })}
													>
														Cancel
													</Button>
												</>
											) : (
												<Button
													variant="secondary"
													disabled={tempOp.kind === 'running'}
													onClick={() => setOp('temp', { kind: 'confirm' })}
												>
													{tempOp.kind === 'running' ? (
														<Icon name="loader" spin />
													) : (
														<Icon name="trash" size={16} />
													)}
													Clear temp
												</Button>
											)}
										</div>
									</div>
									{tempOp.kind === 'ok' ? (
										<p className="mt-2 flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
											<Icon name="check" size={14} />
											{tempOp.message}
										</p>
									) : tempOp.kind === 'error' ? (
										<p className="mt-2 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
											<Icon name="alert" size={14} />
											{tempOp.message}
										</p>
									) : null}
								</div>

								<div className="px-6 py-4">
									<div className="flex items-center justify-between gap-4">
										<div className="min-w-0">
											<p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
												Refresh services
											</p>
											<p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
												Sync configured service repos.
											</p>
										</div>
										<Button
											variant="secondary"
											disabled={ops.refresh.kind === 'running'}
											onClick={runRefresh}
										>
											{ops.refresh.kind === 'running' ? (
												<Icon name="loader" spin />
											) : (
												<Icon name="retry" size={16} />
											)}
											Refresh services
										</Button>
									</div>
									{ops.refresh.kind === 'ok' ? (
										<p className="mt-2 flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
											<Icon name="check" size={14} />
											{ops.refresh.message}
										</p>
									) : ops.refresh.kind === 'error' ? (
										<p className="mt-2 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
											<Icon name="alert" size={14} />
											{ops.refresh.message}
										</p>
									) : null}
									{refreshRepos.length > 0 && (
										<div className="mt-2 space-y-1">
											{refreshRepos.map((repo) => (
												<div key={repo.spec} className="text-xs">
													<span
														className={`font-mono ${
															repo.updated
																? 'text-neutral-500 dark:text-neutral-400'
																: 'text-red-600 dark:text-red-400'
														}`}
													>
														{mask.text(repo.spec)}
														{repo.updated ? '' : ' (failed)'}
													</span>
													{repo.changes.map((c) => (
														<p
															key={c}
															className="ml-3 font-mono text-neutral-400 dark:text-neutral-500"
														>
															{mask.text(c)}
														</p>
													))}
												</div>
											))}
										</div>
									)}
								</div>
							</Card>
						</section>
					</>
				)}

				{envChecks.data && (
					<section>
						<h2 className="text-lg font-semibold tracking-tight">Environment</h2>
						<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
							Binaries detected on the server. Versions are best-effort probes.
						</p>

						<Card className="mt-4 p-6">
							<ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
								{envChecks.data.map((c) => (
									<li key={c.name} className="flex items-center gap-2 text-sm">
										{c.installed ? (
											<Icon
												name="check"
												size={14}
												className="shrink-0 text-green-600 dark:text-green-400"
											/>
										) : (
											<Icon
												name="x"
												size={14}
												className={`shrink-0 ${
													c.required
														? 'text-red-600 dark:text-red-400'
														: 'text-neutral-400 dark:text-neutral-500'
												}`}
											/>
										)}
										<span
											className={`truncate ${
												c.installed
													? 'text-neutral-900 dark:text-neutral-100'
													: 'text-neutral-400 dark:text-neutral-500'
											}`}
										>
											{c.name}
										</span>
										{c.version && (
											<span className="truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
												{c.version}
											</span>
										)}
										{c.required && !c.installed && <Badge tone="red">required</Badge>}
									</li>
								))}
							</ul>
						</Card>
					</section>
				)}
			</div>
		</>
	);
}
