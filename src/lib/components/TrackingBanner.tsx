// The stale-kick banner: when titles are overdue and the poller will not get to them,
// offer to sweep them now.
//
// It exists because the poller only ticks while the server is up, so a machine that was
// asleep or a container that was restarted leaves the tracked list quietly out of date.
//
// It deliberately does not coordinate between tabs. Three tabs firing the same POST cost
// one scan: the server's two-layer re-entrancy guard answers the losers with
// `started: false`. It also does not fetch on the server. __root renders during SSR and
// statusQuery is `enabled: browser` for that reason; with no data this renders null, so a
// hard load of any page is unaffected.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { statusQuery } from '$lib/queries';
import { dismissStale, syncToken, useStaleDismissed } from '$lib/stores/staleKick';
import { tracking, trackingErrorMessage } from '$lib/tracking/client';
import Button from './Button';
import Icon from './Icon';

/** Long enough to read the banner and hit Cancel before it fires. */
const COUNTDOWN_S = 45;

export default function TrackingBanner() {
	const status = useQuery(statusQuery);
	const dismissed = useStaleDismissed();

	const s = status.data;
	if (!s?.stale) return null;
	// The dismissal is pinned to the sync it applied to, so finishing a scan re-arms it.
	const token = syncToken(s.last_sync);
	if (dismissed === token) return null;

	// Keyed so a new stale window starts its countdown from the top rather than inheriting
	// whatever was left of the previous one.
	return <StaleKick key={token} token={token} tracks={s.tracks} lastSync={s.last_sync} />;
}

type Kick =
	| { kind: 'idle' }
	| { kind: 'sending' }
	| { kind: 'sent'; started: boolean }
	| { kind: 'error'; message: string };

function StaleKick({
	token,
	tracks,
	lastSync
}: {
	token: string;
	tracks: number;
	lastSync: string | null;
}) {
	const queryClient = useQueryClient();
	const [left, setLeft] = useState(COUNTDOWN_S);
	const [kick, setKick] = useState<Kick>({ kind: 'idle' });

	useEffect(() => {
		if (kick.kind !== 'idle') return;
		if (left <= 0) {
			void fire();
			return;
		}
		const t = setTimeout(() => setLeft((n) => n - 1), 1000);
		return () => clearTimeout(t);
		// `fire` is intentionally not a dependency: it is recreated every render, and is only
		// reached from the left <= 0 branch, which cannot repeat because it sets `kick` and
		// this effect then returns early.
	}, [kick.kind, left]);

	// On success this banner usually removes itself rather than reporting back: the refetch
	// below sees a scan running, a running server is not stale, and the whole component
	// unmounts. The failure path stays on screen because nothing invalidates, so `stale` is
	// still true.
	async function fire() {
		setKick({ kind: 'sending' });
		try {
			const res = await tracking.check(undefined, 'stale-kick');
			setKick({ kind: 'sent', started: res.started !== false });
			// The sweep is staggered and runs for minutes; this only refreshes `running`,
			// which is what makes the banner stand down.
			await queryClient.invalidateQueries({ queryKey: ['tracking'] });
		} catch (e) {
			setKick({ kind: 'error', message: trackingErrorMessage(e) });
		}
	}

	return (
		<div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
			<Icon name="bell" size={16} className="shrink-0" />
			<div className="min-w-0 flex-1">
				{/* ponytail: counts and timestamps only, so nothing here needs incognito masking. */}
				{kick.kind === 'sending' ? (
					<span>Starting a rescan…</span>
				) : kick.kind === 'sent' ? (
					<span>
						{kick.started
							? 'Rescan started. Checks are staggered, so give it a few minutes.'
							: 'A scan was already running, so nothing new was started.'}
					</span>
				) : kick.kind === 'error' ? (
					<span>Could not start a rescan: {kick.message}</span>
				) : (
					<span>
						Tracked titles are out of date.{' '}
						{lastSync ? (
							<>Last checked {new Date(lastSync).toLocaleString()}.</>
						) : (
							<>Nothing has been checked yet.</>
						)}{' '}
						<strong>
							Rescanning {tracks} {tracks === 1 ? 'title' : 'titles'} in {left}s
						</strong>
						.
					</span>
				)}
			</div>
			{kick.kind === 'idle' && (
				<div className="flex shrink-0 items-center gap-2">
					<Button variant="secondary" onClick={() => dismissStale(token)}>
						Cancel
					</Button>
					<Button variant="secondary" onClick={() => void fire()}>
						<Icon name="retry" size={16} />
						Run now
					</Button>
				</div>
			)}
		</div>
	);
}
