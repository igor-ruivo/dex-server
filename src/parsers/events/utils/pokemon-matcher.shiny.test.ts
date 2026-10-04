import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import type { IEntry } from '../../types/events';
import type PokemonMatcher from './pokemon-matcher';
import { extractPokemonSpeciesIdsFromElements } from './pokemon-matcher';

/**
 * Whether an event section's Pokémon can be shiny is read from the phrase that talks about each one: a sentence that names
 * it and says "shiny". "If you're lucky" alone does not mean shiny (it also introduces Special Backgrounds).
 */
const KNOWN = ['zorua', 'axew', 'elgyem', 'ponyta', 'hoppip', 'electrike', 'dwebble', 'bramblin', 'growlithe', 'nincada', 'helioptile', 'sandile'];

/** Stands in for the real matcher: finds the known names in a text, each species once per call. */
const fakeMatcher = {
	matchPokemonFromText: (texts: Array<string>): Array<IEntry> => {
		const seen = new Set<string>();
		const out: Array<IEntry> = [];
		for (const text of texts) {
			for (const name of KNOWN) {
				if (text.toLowerCase().includes(name) && !seen.has(name)) {
					seen.add(name);
					out.push({ speciesId: name, kind: '5', shiny: false });
				}
			}
		}
		return out;
	},
	plainNameOf: (speciesId: string) => (KNOWN.includes(speciesId) ? speciesId : undefined),
} as unknown as PokemonMatcher;

const shinyOf = (html: string): Record<string, boolean> => {
	const body = new JSDOM(`<body>${html}</body>`).window.document.body;
	const entries = extractPokemonSpeciesIdsFromElements(Array.from(body.children), fakeMatcher);
	return Object.fromEntries(entries.map((e) => [e.speciesId, e.shiny]));
};

describe('shiny in an event section', () => {
	it('flags the Pokémon of a Lure Module phrase that names it next to "Shiny"', () => {
		const lure = `<p>From 2:00 p.m. to 9:00 p.m. local time, <strong>Zorua</strong> will have a very high chance of appearing at PokéStops with active regular Lure Modules. Zorua attracted to regular Lure Modules will still have an increased chance to be Shiny and may have a Special Background. That’s more chances to encounter the featured Pokémon even after the event hours!</p>`;
		expect(shinyOf(lure)).toEqual({ zorua: true });
	});

	it('does not flag a Field Research phrase whose "if you’re lucky" is about a Special Background', () => {
		const research = `<p>October Community Day–themed Field Research will be available! Catch <strong>Zorua</strong> to earn rewards such as Stardust, Ultra Balls, additional encounters with Zorua, and more! You may even find Field Research that leads to encounters with Zorua that have a Special Background—if you’re lucky!</p>`;
		expect(shinyOf(research)).toEqual({ zorua: false });
	});

	it('flags the Pokémon of a phrase that says it can be shiny if you are lucky', () => {
		expect(shinyOf('<p>If you’re lucky, <strong>Zorua</strong> may be Shiny!</p>')).toEqual({ zorua: true });
	});

	it('lets a lucky-and-shiny remark that names no Pokémon speak for the Pokémon of its paragraph', () => {
		expect(shinyOf('<p><strong>Zorua</strong>, <strong>Axew</strong> will be easier to find. If you’re lucky, they may be Shiny!</p>')).toEqual({
			zorua: true,
			axew: true,
		});
	});

	it('flags only the Pokémon named in the sentence that says shiny', () => {
		expect(shinyOf('<p><strong>Zorua</strong> will be easier to find. Shiny <strong>Axew</strong> will be available too.</p>')).toEqual({
			zorua: false,
			axew: true,
		});
	});

	it('keeps "p.m." inside its sentence', () => {
		expect(shinyOf('<p>From 2:00 p.m. to 9:00 p.m. local time, <strong>Zorua</strong> has an increased chance to be Shiny.</p>')).toEqual({
			zorua: true,
		});
	});

	it('does not flag a Pokémon in a text that never says shiny', () => {
		expect(shinyOf('<p><strong>Zorua</strong> will be easier to find.</p>')).toEqual({ zorua: false });
	});

	it('reads each paragraph on its own: shiny in one does not flag the Pokémon of another', () => {
		const html = '<p><strong>Zorua</strong> will be easier to find.</p><p><strong>Axew</strong> has an increased chance to be Shiny.</p>';
		expect(shinyOf(html)).toEqual({ zorua: false, axew: true });
	});

	it('reads a phrase that runs through inline tags', () => {
		expect(shinyOf('<div><p>Catch <em>Zorua</em> and <strong>Axew</strong>. <b>Axew</b> can be <i>Shiny</i>.</p></div>')).toEqual({
			zorua: false,
			axew: true,
		});
	});

	describe('a section that marks the shiny ones with an asterisk (Incense Encounters)', () => {
		const intro = '<p>The following Pokémon will be attracted to Incense (excluding Daily Adventure Incense) during the event on the following days.</p>';
		const day1 = '<p>October 13 at 10:00 a.m. to October 16, 2026, at 10:00 a.m. local time</p>';
		const day2 = '<p>October 16 at 10:00 a.m. to October 19, 2026, at 8:00 p.m. local time</p>';
		const footnote = '<p>*If you’re lucky, you may encounter a Shiny one!</p>';
		const expected = {
			ponyta: true,
			hoppip: true,
			electrike: true,
			dwebble: true,
			bramblin: false,
			growlithe: true,
			nincada: true,
			helioptile: true,
		};

		it('flags the starred Pokémon and not the others, whatever the footnote says', () => {
			const list = (names: Array<string>) => names.map((n) => `<p>${n}</p>`).join('');
			const html =
				intro +
				day1 +
				list(['Galarian Ponyta*', 'Hoppip*', 'Electrike*', 'Dwebble*', 'Bramblin']) +
				day2 +
				list(['Hisuian Growlithe*', 'Nincada*', 'Electrike*', 'Helioptile*', 'Bramblin']) +
				footnote;
			expect(shinyOf(html)).toEqual(expected);
		});

		it('does the same when the names are one line break apart in a single paragraph', () => {
			const lines = (names: Array<string>) => names.join('<br>');
			const html =
				intro +
				day1 +
				`<p>${lines(['Galarian Ponyta*', 'Hoppip*', 'Electrike*', 'Dwebble*', 'Bramblin'])}</p>` +
				day2 +
				`<p>${lines(['Hisuian Growlithe*', 'Nincada*', 'Electrike*', 'Helioptile*', 'Bramblin'])}<br>*If you’re lucky, you may encounter a Shiny one!</p>`;
			expect(shinyOf(html)).toEqual(expected);
		});

		it('keeps a starred Pokémon shiny when the same one is listed again without a star', () => {
			expect(shinyOf('<p>Hoppip*</p><p>Bramblin</p><p>Hoppip</p>')).toEqual({ hoppip: true, bramblin: false });
		});

		it('does not let the list de-duplication shift the stars onto other Pokémon', () => {
			// Electrike is listed twice, so the list is shorter than the fragments: the star of Helioptile must stay with it
			expect(shinyOf('<p>Electrike*</p><p>Electrike*</p><p>Bramblin</p><p>Helioptile*</p>')).toEqual({
				electrike: true,
				bramblin: false,
				helioptile: true,
			});
		});
	});

	describe('a Hatch Day (Featured Pokémon)', () => {
		const text =
			'Sandile will hatch much more frequently from 2 km Eggs. You’ll also have an increased chance of hatching Shiny Sandile!';

		it.each([
			['a paragraph', `<p>${text}</p>`],
			['a heading and a paragraph', `<h2>Featured Pokémon</h2><p>${text}</p>`],
			['a heading and loose text in the same block', `<div><h2>Featured Pokémon</h2>${text}</div>`],
			['the name in its own tag', `<p><strong>Sandile</strong> will hatch much more frequently from 2 km Eggs. You’ll also have an increased chance of hatching Shiny <strong>Sandile</strong>!</p>`],
			['line breaks', `<p>Featured Pokémon<br>${text}</p>`],
			['a list item', `<ul><li>${text}</li></ul>`],
		])('flags the Pokémon: %s', (_name, html) => {
			expect(shinyOf(html)).toEqual({ sandile: true });
		});

		it('does not flag it when the sentences never say shiny', () => {
			expect(shinyOf('<p>Sandile will hatch much more frequently from 2 km Eggs.</p>')).toEqual({ sandile: false });
		});
	});

	it('still flags a Pokémon marked with an asterisk', () => {
		expect(shinyOf('<p>Zorua*, Axew</p>')).toEqual({ zorua: true, axew: false });
	});
});
