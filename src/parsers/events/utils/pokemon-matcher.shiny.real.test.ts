import fs from 'node:fs';
import path from 'node:path';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { getDomains } from '../../pokemon/game-master-parser';
import type { GameMasterData } from '../../types/pokemon';
import PokemonMatcher, {
	extractPokemonSpeciesIdsFromElements,
} from './pokemon-matcher';

/** The star rule on the real matcher and the real game master, with sections as the Pokémon GO site writes them. */
const gameMaster = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'data', 'game-master.json'), 'utf8')
) as GameMasterData;
const domain = getDomains(gameMaster).allDomain;

const shinyOf = (html: string): Record<string, boolean> => {
	const body = new JSDOM(`<body>${html}</body>`).window.document.body;
	const entries = extractPokemonSpeciesIdsFromElements(
		Array.from(body.children),
		new PokemonMatcher(gameMaster, domain)
	);
	return Object.fromEntries(entries.map((e) => [e.speciesId, e.shiny]));
};

describe('shiny stars in real sections', () => {
	it('Timed Research: names closed by a comma, "and" and a full stop', () => {
		const html = `<div><h2>Timed Research</h2><div><p>Complete Timed Research that awards XP, Poké Balls, a Premium Battle Pass, an Incense, Rare Candy, and encounters with event-themed Pokémon such as Venusaur*, Charizard*, and Blastoise*.</p>
<p>*If you’re lucky, you may encounter a Shiny one!</p></div></div>`;
		expect(shinyOf(html)).toEqual({
			venusaur: true,
			charizard: true,
			blastoise: true,
		});
	});

	it('Wild Encounters with a footnote block: a list that ends in "and more!" and a last name closed by "!"', () => {
		const html = `<div><h2>Wild Encounters</h2><div><p>May encounter event-themed Pokémon in the wild, including Koffing*, Slugma*, Numel*, and more! You might even encounter Magmar*!</p></div><div><div><div>*If you’re lucky, you may encounter a Shiny one!</div></div></div></div>`;
		expect(shinyOf(html)).toEqual({
			koffing: true,
			slugma: true,
			numel: true,
			magmar: true,
		});
	});

	it('leaves the Pokémon without a star non-shiny in the same list', () => {
		const html =
			'<div><p>May encounter Koffing*, Slugma, and Numel*. You might even encounter Magmar!</p><p>*If you’re lucky, you may encounter a Shiny one!</p></div>';
		expect(shinyOf(html)).toEqual({
			koffing: true,
			slugma: false,
			numel: true,
			magmar: false,
		});
	});
});

describe('shiny stars for Pokémon wearing something', () => {
	it('reads the stars of a Wild Encounters section with outfits, times and a footnote', () => {
		const html = `<div><h2>Wild Encounters</h2><div><p>During the event, Trainers may encounter Charmander wearing Friede’s goggles*. If you’re lucky, you might even encounter Pikachu wearing Cap’s hat*!</p>
<p>There will also be different Pokémon featured during different times of the event.</p>
<p>From 5:00 a.m. to 5:00 p.m., you may encounter Fidough*, Wattrel, and more in the wild! You might even encounter Chansey*!</p>
<p>From 5:00 p.m. to 5:00 a.m., you may encounter Eevee*, Hatenna*, and more in the wild! You might even encounter Rockruff*!</p>
<p>*If you’re lucky, you may encounter a Shiny one!</p></div></div>`;
		expect(shinyOf(html)).toEqual({
			charmander: true,
			pikachu: true,
			fidough: true,
			wattrel: false,
			chansey: true,
			eevee: true,
			hatenna: true,
			rockruff: true,
		});
	});

	it('finds the star later in the sentence, after an outfit that is itself cut by "and"', () => {
		const html =
			'<div><p>Trainers may encounter Charmander wearing a hat and goggles*. You might even encounter Squirtle!</p></div>';
		expect(shinyOf(html)).toEqual({ charmander: true, squirtle: false });
	});

	it('does not look past the next comma for the star of a Pokémon wearing something', () => {
		const html =
			'<div><p>Trainers may encounter Charmander wearing a hat, Squirtle*. You might even encounter Pikachu!</p></div>';
		expect(shinyOf(html)).toEqual({
			charmander: false,
			squirtle: true,
			pikachu: false,
		});
	});
});
