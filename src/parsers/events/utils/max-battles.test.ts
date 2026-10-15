import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import type { IEntry } from '../../types/events';
import {
	maxBattleHeadedLinesOf,
	maxBattleLinesOf,
	maxBattleTier,
	maxFormOfTitle,
	mergeMaxEntries,
	parseMaxBattleEntries,
	parseTieredMaxBattleEntries,
} from './max-battles';
import type PokemonMatcher from './pokemon-matcher';

/** Stands in for the real matcher: a name becomes its species id. */
const matcher = {
	matchPokemonFromText: (texts: Array<string>): Array<IEntry> =>
		texts.map((text) => ({
			speciesId: text.toLowerCase().replaceAll(' ', '_'),
			kind: '5',
			shiny: false,
		})),
} as unknown as PokemonMatcher;

/** The lines of a section the way PokemongoSource reads them: every list item and paragraph after the headline. */
const linesOf = (html: string): Array<string> => {
	const section = new JSDOM(html).window.document.body.firstElementChild!;
	return Array.from(section.children)
		.slice(1)
		.flatMap((body) => {
			const blocks = Array.from(body.querySelectorAll('li, p'));
			return (blocks.length > 0 ? blocks : [body])
				.map((block) => (block.textContent ?? '').replace(/\s+/g, ' ').trim())
				.filter(Boolean);
		});
};

const DYNAMAX_DEBUT = `<div class="_containerBlock_1p4ol_2"><div class="_headlineWrapper_1p4ol_37"><h2 class="_containerHeadline_1p4ol_53">Dynamax Debut!</h2></div><div class="_markdown_13f4f_273"><p>The following Pokémon will make their Pokémon GO Dynamax debut in five-star Max Battles!</p>
<ul>
<li>Dynamax Uxie*: Appearing in the Asia-Pacific region</li>
<li>Dynamax Mesprit*: Appearing in Europe, the Middle East, Africa, and India</li>
<li>Dynamax Azelf*: Appearing in the Americas and Greenland</li>
</ul>
</div><div class="_IconFootnotesBlock_v388d_2"><div><div>*If you’re lucky, you may encounter a Shiny one!</div></div></div></div>`;

const FEATURED = `<div class="_containerBlock_1p4ol_2"><div class="_headlineWrapper_1p4ol_37"><h2>Featured Pokémon</h2></div><div class="_markdown_13f4f_273"><p>The following Pokémon will appear in six-star Max Battles!</p>
<ul><li>Gigantamax Cinderace</li></ul>
<p>For the first time in Pokémon GO, you’ll be able to encounter Shiny Gigantamax Cinderace—if you’re lucky!</p></div></div>`;

describe('the tier of a Dynamax debut', () => {
	it('is the one of the sentence that introduces a name: a debut in GO Pass has none', () => {
		const lines = [
			'The following Pokémon will make its Pokémon GO Dynamax debut in five-star Max Battles!',
			'Dynamax Regidrago*',
			'The following Pokémon will make its Pokémon GO Dynamax debut in GO Pass: Into the Wild!',
			'Dynamax Meltan*',
			'*If you’re lucky, you may encounter a Shiny one!',
		];
		expect(
			parseMaxBattleEntries(lines, matcher).map((e) => [e.speciesId, e.tier])
		).toEqual([
			['regidrago', '5'],
			['meltan', undefined],
		]);
	});
});

describe('Max Battle sections by tier, as the page lays them out', () => {
	const SECTION = `<div><div><h2>Max Battles</h2></div><div><p>The following Dynamax Pokémon will appear in Max Battles. Pokémon appearing in five-star Max Battles will also be featured in an hour of Max Battles from 6:00 p.m. to 7:00 p.m. local time for one day each on the following schedule.</p>
<p><strong>One-Star Max Battles</strong><br>Ralts*</p>
<p><strong>Five-Star Max Battles: Wednesday, November 11</strong><br>Registeel*</p>
<p><strong>Five-Star Max Battles: Friday, November 13</strong><br>Latias*<br>Latios*</p></div></div>`;

	it('splits a heading from the names that share its paragraph with a line break', () => {
		const section = new JSDOM(SECTION).window.document.body.firstElementChild!;
		const lines = maxBattleHeadedLinesOf(Array.from(section.children).slice(1));
		expect(lines).toContain('One-Star Max Battles');
		expect(lines).toContain('Ralts*');
		const entries = parseTieredMaxBattleEntries(lines, matcher, 2026);
		expect(entries.map((e) => [e.speciesId, e.tier, e.window?.label])).toEqual([
			['ralts', '1', undefined],
			['registeel', '5', 'Wednesday, November 11'],
			['latias', '5', 'Friday, November 13'],
			['latios', '5', 'Friday, November 13'],
		]);
	});
});

describe('Max Battle sections by tier', () => {
	const lines = [
		'The following Dynamax Pokémon will appear in Max Battles. Pokémon appearing in five-star Max Battles will also be featured in an hour of Max Battles from 6:00 p.m. to 7:00 p.m. local time for one day each on the following schedule.',
		'One-Star Max Battles',
		'Ralts*',
		'Two-Star Max Battles',
		'Machop*',
		'Five-Star Max Battles: Wednesday, November 11',
		'Registeel*',
		'Five-Star Max Battles: Thursday, November 12',
		'Regidrago*',
		'Five-Star Max Battles: Friday, November 13',
		'Latias*',
		'Latios*',
		'*If you’re lucky, you may encounter a Shiny one!',
	];

	it('reads the plain names under each tier heading, with the tier, the form and the shiny asterisk', () => {
		const entries = parseTieredMaxBattleEntries(lines, matcher, 2026);
		expect(entries.map((e) => [e.speciesId, e.tier, e.kind, e.shiny])).toEqual([
			['ralts', '1', 'dynamax', true],
			['machop', '2', 'dynamax', true],
			['registeel', '5', 'dynamax', true],
			['regidrago', '5', 'dynamax', true],
			['latias', '5', 'dynamax', true],
			['latios', '5', 'dynamax', true],
		]);
	});

	it('keeps the day of a heading as the entry window: the whole day, since only the heading is read (not the hours of the intro)', () => {
		const [ralts, , registeel, , latias] = parseTieredMaxBattleEntries(
			lines,
			matcher,
			2026
		);
		expect(ralts.window).toBeUndefined();
		expect(registeel.window).toEqual({
			label: 'Wednesday, November 11',
			start: Date.UTC(2026, 10, 11, 0, 0),
			end: Date.UTC(2026, 10, 11, 23, 59),
			allDay: true,
		});
		expect(latias.window?.label).toBe('Friday, November 13');
	});

	it('reads the hours from the heading when it gives them', () => {
		const [entry] = parseTieredMaxBattleEntries(
			[
				'Five-Star Max Battles: Wednesday, November 11, from 6:00 p.m. to 7:00 p.m.',
				'Registeel*',
			],
			matcher,
			2026
		);
		expect(entry.window).toMatchObject({
			start: Date.UTC(2026, 10, 11, 18, 0),
			end: Date.UTC(2026, 10, 11, 19, 0),
		});
		expect(entry.window?.allDay).toBeUndefined();
	});

	it('keeps only the label when the year is not known, and reads nothing without a tier heading', () => {
		expect(parseTieredMaxBattleEntries(lines, matcher)[2].window).toEqual({
			label: 'Wednesday, November 11',
		});
		expect(parseTieredMaxBattleEntries(['Ralts*', 'Machop*'], matcher)).toEqual(
			[]
		);
	});
});

describe('Max Battle sections', () => {
	it('reads the Dynamax debut: each name with its form, its tier and the shiny asterisk, without the region text', () => {
		expect(parseMaxBattleEntries(linesOf(DYNAMAX_DEBUT), matcher)).toEqual([
			{ speciesId: 'uxie', kind: 'dynamax', tier: '5', shiny: true },
			{ speciesId: 'mesprit', kind: 'dynamax', tier: '5', shiny: true },
			{ speciesId: 'azelf', kind: 'dynamax', tier: '5', shiny: true },
		]);
	});

	it('does not make a Pokémon shiny that has no asterisk when the section uses asterisks', () => {
		const lines = [
			'Dynamax Uxie*: Appearing in Europe',
			'Dynamax Azelf: Appearing in Asia',
		];
		expect(
			parseMaxBattleEntries(lines, matcher).map((e) => [e.speciesId, e.shiny])
		).toEqual([
			['uxie', true],
			['azelf', false],
		]);
	});

	it('reads a featured Gigantamax Pokémon, and its shiny from a "Shiny Gigantamax …" sentence', () => {
		expect(parseMaxBattleEntries(linesOf(FEATURED), matcher)).toEqual([
			{ speciesId: 'cinderace', kind: 'gigantamax', tier: '6', shiny: true },
		]);
	});

	it('finds nothing in text that merely speaks of Dynamax Pokémon in general', () => {
		expect(
			parseMaxBattleEntries(
				['These Dynamax Pokémon may appear in Max Battles.'],
				matcher
			)
		).toEqual([]);
	});

	it('reads the tier from "five-star", "6-star" and the like', () => {
		expect(maxBattleTier('five-star Max Battles')).toBe('5');
		expect(maxBattleTier('6-star Max Battles')).toBe('6');
		expect(maxBattleTier('no tier here')).toBeUndefined();
	});

	it('says which form a title is about', () => {
		expect(maxFormOfTitle('Gigantamax Cinderace Max Battle Day')).toBe(
			'gigantamax'
		);
		expect(
			maxFormOfTitle('Dynamax Uxie, Mesprit, and Azelf Max Battle Day')
		).toBe('dynamax');
		expect(maxFormOfTitle('October Max Battle Day')).toBe('dynamax');
		expect(maxFormOfTitle('Community Day')).toBeUndefined();
	});

	it('keeps a species once per form when merging, shiny if any mention says so', () => {
		const list: Array<IEntry> = [
			{ speciesId: 'uxie', kind: 'dynamax', shiny: false },
		];
		mergeMaxEntries(list, [
			{ speciesId: 'uxie', kind: 'dynamax', shiny: true, tier: '5' },
			{ speciesId: 'uxie', kind: 'gigantamax', shiny: false },
		]);
		expect(list).toEqual([
			{ speciesId: 'uxie', kind: 'dynamax', shiny: true, tier: '5' },
			{ speciesId: 'uxie', kind: 'gigantamax', shiny: false },
		]);
	});
});

const SEASON_DEBUTS = `<div id="max-pokemon-debuts"><div>Max Pokémon Debuts</div><p>Dynamax Rhyhorn, Dynamax Sneasel, Dynamax Sizzlipede, and more will make their way into Max Battles throughout the Season. Keep an eye out for new Dynamax Pokémon at Power Spots!</p><p>Dynamax Uxie, Dynamax Mesprit, and Dynamax Azelf will appear in a Max Battle Day during Twilight Trails.</p>
<div class="_pokemonImageGridBlock_xa9u5_2"><div><div><div class="_pokemonImageGridBlockGridPokemonCaption_xa9u5_44">Dynamax Rhyhorn</div></div><div><div class="_pokemonImageGridBlockGridPokemonCaption_xa9u5_44">Dynamax Sneasel</div></div><div><div class="_pokemonImageGridBlockGridPokemonCaption_xa9u5_44">Dynamax Sizzlipede</div></div><div><div class="_pokemonImageGridBlockGridPokemonCaption_xa9u5_44">Dynamax Uxie</div></div><div><div class="_pokemonImageGridBlockGridPokemonCaption_xa9u5_44">Dynamax Mesprit</div></div><div><div class="_pokemonImageGridBlockGridPokemonCaption_xa9u5_44">Dynamax Azelf</div></div></div></div></div>`;

describe('the season page’s Max Pokémon debuts', () => {
	it('lists each Dynamax Pokémon once, from the paragraphs and the picture captions', () => {
		const root = new JSDOM(SEASON_DEBUTS).window.document.getElementById(
			'max-pokemon-debuts'
		) as Element;
		expect(parseMaxBattleEntries(maxBattleLinesOf(root), matcher)).toEqual(
			['rhyhorn', 'sneasel', 'sizzlipede', 'uxie', 'mesprit', 'azelf'].map(
				(speciesId) => ({ speciesId, kind: 'dynamax', shiny: false })
			)
		);
	});
});
