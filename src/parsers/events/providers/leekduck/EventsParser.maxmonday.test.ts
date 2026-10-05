import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

import EventsParser from './EventsParser';

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

const PAGE = `<html><head><meta property="og:image" content="https://cdn.leekduck.com/assets/img/events/max-battles-kanto.jpg"></head><body>
<ul class="pkmn-list-flex"><li class="pkmn-list-item" style="z-index: 256;"><div class="pkmn-list-img dark"><img src="https://cdn.leekduck.com/x.png"></div><img class="shiny-icon" src="https://cdn.leekduck.com/assets/img/icons/shiny-icon.png" alt="shiny"><div class="pkmn-name">Sableye</div></li>
<li class="pkmn-list-item"><div class="pkmn-list-img"><img src="https://cdn.leekduck.com/y.png"></div><div class="pkmn-name">Gible</div></li></ul></body></html>`;

const parse = (title: string, html: string) => {
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
			parseMaxMondayEvent: (
				parsed: {
					title: string;
					date: number;
					dateEnd: number;
					htmlDoc: Document;
				},
				url: string
			) =>
				| {
						pokemons: Array<{
							speciesId: string;
							kind?: string;
							shiny: boolean;
						}>;
						imgUrl?: string;
						title: Record<string, string>;
				  }
				| undefined;
		}
	).parseMaxMondayEvent(
		{ title, date: 0, dateEnd: 1, htmlDoc: new JSDOM(html).window.document },
		'https://leekduck.com/events/max-mondays-2026-10-05/'
	);
};

describe('Max Mondays', () => {
	it('lists the featured Dynamax Pokémon, shiny where the page shows the shiny icon', () => {
		const result = parse('Dynamax Sableye during Max Monday', PAGE);
		expect(result?.pokemons).toEqual([
			{ speciesId: 'sableye', kind: 'dynamax', shiny: true },
			{ speciesId: 'gible', kind: 'dynamax', shiny: false },
		]);
		expect(result?.imgUrl).toBe(
			'https://cdn.leekduck.com/assets/img/events/max-battles-kanto.jpg'
		);
		expect(result?.title.en).toBe('Dynamax Sableye during Max Monday');
	});

	it('takes the Pokémon from the title when the page lists none', () => {
		const result = parse(
			'Dynamax Sizzlipede during Max Monday',
			'<html><body></body></html>'
		);
		expect(result?.pokemons).toEqual([
			{ speciesId: 'sizzlipede', kind: 'dynamax', shiny: false },
		]);
	});

	it('marks the Pokémon of a Gigantamax Monday as Gigantamax', () => {
		const result = parse(
			'Gigantamax Snorlax during Max Monday',
			'<html><body></body></html>'
		);
		expect(result?.pokemons[0]).toMatchObject({
			speciesId: 'snorlax',
			kind: 'gigantamax',
		});
	});
});
