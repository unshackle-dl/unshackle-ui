import assert from 'node:assert/strict';
import { test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Title, TitleAvailability } from './api/types';
import {
	accessibleSelection,
	canSelectTitle,
	confirmedSelection,
	uniqueEpisodeTitles
} from './episode-availability';
import EpisodeAccessPicker from './components/EpisodeAccessPicker';
import AvailabilityBadges from './components/AvailabilityBadges';

const episode = (number: number, availability?: TitleAvailability): Title => ({
	type: 'episode',
	id: `fake-${number}`,
	name: `Episode ${number}`,
	season: 1,
	number,
	language: null,
	description: null,
	date: null,
	cover_url: null,
	year: null,
	availability
});

test('only explicit access denial blocks selection; paid, unknown and older API titles work', () => {
	for (const availability of [
		undefined,
		{ paid: true, access: 'granted' as const },
		{ paid: true, access: 'unknown' as const }
	])
		assert.equal(canSelectTitle(episode(1, availability)), true);
	assert.equal(canSelectTitle(episode(1, { paid: false, access: 'denied' })), false);
});

test('fresh availability removes missing and denied codes and deduplicates selections', () => {
	const titles = [episode(1, { access: 'denied' }), episode(2)];
	assert.deepEqual(accessibleSelection(['S01E01', 'S01E02', 'S01E02', 'S01E03'], titles), [
		'S01E02'
	]);
});

test('partial denial requires user review instead of silently submitting a subset', () => {
	assert.throws(
		() => confirmedSelection(['S01E01', 'S01E02'], [episode(1), episode(2, { access: 'denied' })]),
		/Review the updated selection/
	);
	assert.deepEqual(confirmedSelection([], [episode(1)]), ['S01E01']);
	assert.deepEqual(confirmedSelection(['S01E01', 'S01E02'], [episode(1), episode(2)]), [
		'S01E01',
		'S01E02'
	]);
});

test('duplicate codes render once and any explicit denial wins in either order', () => {
	for (const titles of [
		[episode(1), episode(1, { access: 'denied' })],
		[episode(1, { access: 'denied' }), episode(1)]
	]) {
		assert.equal(uniqueEpisodeTitles(titles).length, 1);
		assert.deepEqual(accessibleSelection(['S01E01'], titles), []);
		const html = renderToStaticMarkup(
			<EpisodeAccessPicker
				titles={titles}
				selected={['S01E01']}
				onChange={() => {}}
				unseen={new Set(['S01E01'])}
			/>
		);
		assert.equal((html.match(/aria-pressed=/g) ?? []).length, 1);
		assert.match(html, /0 selected/);
		assert.match(html, /disabled=""/);
		assert.doesNotMatch(html, /New \(1\)/);
	}
});

test('movie denial displays a badge, while missing metadata displays none', () => {
	assert.match(
		renderToStaticMarkup(
			<AvailabilityBadges
				title={{ ...episode(1, { paid: true, access: 'denied' }), type: 'movie' }}
			/>
		),
		/Paid.*No account access/
	);
	assert.equal(renderToStaticMarkup(<AvailabilityBadges title={episode(1)} />), '');
});

test('empty selection resolves all accessible episodes and never falls back to unrestricted download', () => {
	assert.deepEqual(
		confirmedSelection(
			[],
			[episode(1), episode(2, { access: 'denied' }), episode(3, { access: 'unknown' }), episode(1)]
		),
		['S01E01', 'S01E03']
	);
	assert.throws(
		() => confirmedSelection([], [episode(1, { access: 'denied' })]),
		/accessible episode/
	);
	assert.throws(() => confirmedSelection([], []), /accessible episode/);
});
