import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

import EventsParser from './EventsParser';

// The matcher is exercised by its own tests: here it just turns a name into its species id, so what is checked is
// which entries the spotlight-hour parser marks as shiny.
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

const SHINY_ICON =
	'<img class="shiny-icon" src="https://cdn.leekduck.com/assets/img/icons/shiny-icon.png" alt="shiny">';

const item = (name: string, shiny: boolean) =>
	`<li class="pkmn-list-item"><div class="pkmn-list-img psychic"><img src="https://cdn.leekduck.com/x.png"></div>${
		shiny ? SHINY_ICON : ''
	}<div class="pkmn-name">${name}</div></li>`;

const page = (spawns: string) => `
<div class="event-description"><p>Pokémon Spotlight Hour will feature a different Pokémon.</p>
<p><strong>October 8</strong>: The featured Pokémon is <strong>Elgyem</strong> and the special bonus is <strong>2× Catch Candy</strong>.</p></div>
<h2 id="spawns" class="event-section-header spawns">Spawns</h2>
<p>The following Pokémon will appear more frequently in the wild.</p>
<ul class="pkmn-list-flex">${spawns}</ul>
<h2 id="graphic" class="event-section-header graphic">Graphic</h2>`;

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
	const htmlDoc = new JSDOM(html).window.document;
	return (
		parser as unknown as {
			parseSpotlightHourEvent: (
				parsed: {
					title: string;
					date: number;
					dateEnd: number;
					htmlDoc: Document;
				},
				gameMaster: unknown,
				url: string
			) =>
				| { pokemons: Array<{ speciesId: string; shiny: boolean }> }
				| undefined;
		}
	).parseSpotlightHourEvent(
		{ title, date: 0, dateEnd: 1, htmlDoc },
		{},
		'https://leekduck.com/events/x/'
	);
};

describe('spotlight hours and the shiny mark', () => {
	it('flags the featured Pokémon as shiny when the page shows the shiny icon next to it', () => {
		const result = parse('Elgyem Spotlight Hour', page(item('Elgyem', true)));
		expect(result?.pokemons).toEqual([
			{ speciesId: 'elgyem', kind: '5', shiny: true },
		]);
	});

	it('leaves the Pokémon non-shiny when the page has no shiny icon for it', () => {
		const result = parse('Elgyem Spotlight Hour', page(item('Elgyem', false)));
		expect(result?.pokemons).toEqual([
			{ speciesId: 'elgyem', kind: '5', shiny: false },
		]);
	});

	it('flags each Pokémon of a dual spotlight by its own icon', () => {
		const result = parse(
			'Elgyem and Axew Spotlight Hour',
			page(item('Elgyem', true) + item('Axew', false))
		);
		expect(result?.pokemons).toEqual([
			{ speciesId: 'elgyem', kind: '5', shiny: true },
			{ speciesId: 'axew', kind: '5', shiny: false },
		]);
	});

	it('matches the names whatever their case', () => {
		const result = parse('ELGYEM Spotlight Hour', page(item('elgyem', true)));
		expect(result?.pokemons[0].shiny).toBe(true);
	});

	it('copes with a page that lists no Pokémon at all', () => {
		const result = parse('Elgyem Spotlight Hour', page(''));
		expect(result?.pokemons).toEqual([
			{ speciesId: 'elgyem', kind: '5', shiny: false },
		]);
	});

	it('ignores a shiny icon that is not inside a Pokémon list item', () => {
		const result = parse(
			'Elgyem Spotlight Hour',
			page(item('Elgyem', false)) + SHINY_ICON
		);
		expect(result?.pokemons[0].shiny).toBe(false);
	});

	it('reads the page leekduck actually serves', () => {
		const html = `<div class="page-content"><div class="event-description"><p>The featured Pokémon is <strong>Elgyem</strong> and the special bonus is <strong>2× Catch Candy</strong>.</p></div>
<p><br><br></p><h2 id="spawns" class="event-section-header spawns">Spawns <img src="https://cdn.leekduck.com/assets/img/events/icons/wild.png"></h2>
<ul class="pkmn-list-flex"><li class="pkmn-list-item" style="z-index: 256;"><div class="pkmn-list-img psychic"><img src="https://cdn.leekduck.com/assets/img/pokemon_icons/pokemon_icon_605_00.png"></div>${SHINY_ICON}<div class="pkmn-name">Elgyem</div></li></ul></div>`;
		expect(parse('Elgyem Spotlight Hour', html)?.pokemons[0].shiny).toBe(true);
	});
});
