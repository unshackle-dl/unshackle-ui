import assert from 'node:assert/strict';
import { test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Title } from './api/types';
import { episodeGroups, toggleEpisodeGroup } from './episode-picker';
import EpisodePicker from './components/EpisodePicker';
import { wantedCode } from './tracks';

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
