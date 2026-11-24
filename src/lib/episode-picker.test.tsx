import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Title } from './api/types';
import { episodeGroups, toggleEpisodeGroup } from './episode-picker';
import EpisodePicker from './components/EpisodePicker';
import { wantedCode } from './tracks';
import * as incognito from './stores/incognito';

const episode = (season: number, number: number, part?: number): Title => ({
	type: 'episode',
	id: `fake-${season}-${number}-${part}`,
	name: `Episode ${number}`,
	season,
	number,
	part,
	language: null,
	description: null,
	date: null,
	cover_url: null,
	year: null
});

test('groups specials and seasons, sorts parts, and deduplicates wanted codes', () => {
	const groups = episodeGroups([
		episode(1, 2, 2),
		episode(0, 1),
		episode(1, 2, 1),
		episode(1, 2, 1),
		episode(2, 1)
	]);
	assert.deepEqual(
		groups.map((group) => group.season),
		[2, 1, 0]
	);
	assert.deepEqual(groups[1].episodes.map(wantedCode), ['S01E02.1', 'S01E02.2']);
});

test('season toggles merge without duplicates and deselect only that group', () => {
	assert.deepEqual(toggleEpisodeGroup(['S02E01', 'S01E01'], ['S01E01', 'S01E02']), [
		'S02E01',
		'S01E01',
		'S01E02'
	]);
	assert.deepEqual(toggleEpisodeGroup(['S02E01', 'S01E01', 'S01E02'], ['S01E01', 'S01E02']), [
		'S02E01'
	]);
	assert.deepEqual(toggleEpisodeGroup([], []), []);
});

test('renders All and New quick-select, excludes stale selections, and uses generic search', () => {
	const html = renderToStaticMarkup(
		<EpisodePicker
			titles={[episode(1, 1), episode(1, 1), episode(1, 2)]}
			selected={['S01E01', 'S99E99', 'S01E01']}
			onChange={() => {}}
			unseen={new Set(['S01E02'])}
		/>
	);
	assert.match(html, />All</);
	assert.match(html, /New \(1\)/);
	assert.match(html, /1 selected/);
	assert.match(html, /S01E02…/);
	assert.equal((html.match(/aria-label="S01E01"/g) ?? []).length, 1);
});

test('optional selectable rows are excluded from counts and New', () => {
	const html = renderToStaticMarkup(
		<EpisodePicker
			titles={[episode(1, 1)]}
			selected={['S01E01']}
			onChange={() => {}}
			unseen={new Set(['S01E01'])}
			selectable={() => false}
		/>
	);
	assert.match(html, /0 selected/);
	assert.match(html, /disabled=""/);
	assert.doesNotMatch(html, /New \(1\)/);
});

test('empty selection explains the all-episodes default and singular season counts', () => {
	const html = renderToStaticMarkup(
		<EpisodePicker titles={[episode(1, 1)]} selected={[]} onChange={() => {}} unseen={new Set()} />
	);
	assert.match(html, /leave the selection empty to download all episodes/);
	assert.match(html, /1 season · 0 selected/);
	assert.match(html, /· 1 episode</);
	assert.doesNotMatch(html, /1 episodes|1 seasons/);
});

test('existing metadata stays accessible without loading artwork', () => {
	const title = {
		...episode(1, 1),
		name: 'Example episode',
		year: 2026,
		description: 'Example description',
		cover_url: 'https://example.invalid/cover.jpg'
	};
	const html = renderToStaticMarkup(
		<EpisodePicker
			titles={[title]}
			selected={[]}
			onChange={() => {}}
			unseen={new Set()}
			renderStatus={() => <span>Example status</span>}
		/>
	);
	assert.match(html, /Example episode/);
	assert.match(html, /2026/);
	assert.match(html, /title="Example description"/);
	assert.match(html, /aria-describedby="([^"]+)"/);
	const descriptionId = html.match(/aria-describedby="([^"]+)"/)![1];
	assert.ok(html.includes(`id="${descriptionId}"`));
	assert.match(html, /Example status/);
	assert.doesNotMatch(html, /<img|cover\.jpg/);
});

test('incognito masks the new year and description surfaces', () => {
	const title = {
		...episode(1, 1),
		name: 'Private episode name',
		year: 2026,
		description: 'Private description'
	};
	const mock = vi.spyOn(incognito, 'useMask').mockReturnValue(incognito.maskers(true));
	try {
		const html = renderToStaticMarkup(
			<EpisodePicker titles={[title]} selected={[]} onChange={() => {}} unseen={new Set()} />
		);
		assert.doesNotMatch(html, /Private episode name|Private description|2026/);
		assert.match(html, /hidden by incognito/);
	} finally {
		mock.mockRestore();
	}
});
