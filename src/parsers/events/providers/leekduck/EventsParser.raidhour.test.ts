import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

import EventsParser, { expandFormeList } from './EventsParser';

// The matcher is exercised by its own tests: here it just turns a name into its species id.
vi.mock('../../utils/pokemon-matcher', () => ({
	default: class {
		matchPokemonFromText(texts: Array<string>) {
			return texts.map((text) => ({
				speciesId: text.toLowerCase().replaceAll(' ', '_'),
				kind: '5',
				shiny: false,
			}));
		}
	},
	isPokemonResourceReference: () => false,
}));

const parse = (title: string) => {
	const parser = new EventsParser(
		{} as never,
		{},
		{
			nonMegaNonShadowDomain: [],
			nonShadowDomain: [],
			nonMegaDomain: [],
		} as never,
		{}
	);
	return (
		parser as unknown as {
			parseRaidHourEvent: (
				parsed: {
					title: string;
					date: number;
					dateEnd: number;
					htmlDoc: Document;
				},
				gameMaster: unknown,
				url: string
			) =>
				| { raids: Array<{ speciesId: string; kind?: string }>; date: number }
				| undefined;
		}
	).parseRaidHourEvent(
		{
			title,
			date: 5,
			dateEnd: 6,
			htmlDoc: new JSDOM('<html><body></body></html>').window.document,
		},
		{},
		'https://leekduck.com/events/raidhour20261007/'
	);
};

describe('Raid Hours', () => {
	it('takes the Pokémon from before "Raid Hour" in the title, as five-star raids', () => {
		const result = parse('Yveltal Raid Hour');
		expect(result?.raids).toEqual([
			{ speciesId: 'yveltal', kind: '5', shiny: false },
		]);
		expect(result?.date).toBe(5);
	});

	it('takes every Forme a title lists as a Pokémon of its own', () => {
		expect(
			parse(
				'Deoxys (Normal, Defense, Attack, and Speed Formes) Raid Hour'
			)?.raids.map((raid) => raid.speciesId)
		).toEqual([
			'deoxys',
			'deoxys_(defense)',
			'deoxys_(attack)',
			'deoxys_(speed)',
		]);
	});

	it('marks a Mega Raid Hour as Mega raids', () => {
		expect(parse('Mega Latias Raid Hour')?.raids[0].kind).toBe('mega');
	});
});

describe('expandFormeList', () => {
	it.each([
		[
			'Deoxys (Normal, Defense, Attack, and Speed Formes)',
			'Deoxys, Deoxys (Defense), Deoxys (Attack), Deoxys (Speed)',
		],
		[
			'Yveltal and Deoxys (Normal and Speed Formes)',
			'Yveltal, Deoxys, Deoxys (Speed)',
		],
		// one Forme, or none: left for the matcher
		['Landorus (Incarnate Forme)', 'Landorus (Incarnate Forme)'],
		[
			'Giratina (Altered Forme) and Yveltal',
			'Giratina (Altered Forme) and Yveltal',
		],
		['Yveltal', 'Yveltal'],
	])('%s', (title, expanded) => {
		expect(expandFormeList(title)).toBe(expanded);
	});
});
