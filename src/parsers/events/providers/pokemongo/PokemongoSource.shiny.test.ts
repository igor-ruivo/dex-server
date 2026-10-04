import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getDomains } from '../../../pokemon/game-master-parser';
import type { GameMasterData } from '../../../types/pokemon';
import PokemonGoSource from './PokemongoSource';

/**
 * Which of an event's Pokémon can be shiny, read from a real Community Day post (October 2026, Zorua, saved as a fixture):
 *  - Featured Pokémon: "If you're lucky, you might encounter a Shiny one" — shiny in the wild;
 *  - Lure Module Bonus: "…an increased chance to be Shiny" — shiny from lures;
 *  - Field Research: "encounters with Zorua that have a Special Background—if you're lucky!" — not shiny: it never says so.
 */
const gameMaster = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'data', 'game-master.json'), 'utf8')
) as GameMasterData;
const html = fs.readFileSync(
	path.join(__dirname, '__fixtures__', 'communityday-october-2026-zorua.html'),
	'utf8'
);

const parse = (post: string) => {
	const source = new PokemonGoSource(
		{} as never,
		gameMaster,
		getDomains(gameMaster).allDomain
	);
	return (
		source as unknown as {
			parseSinglePost: (
				post: unknown,
				gameMaster: unknown
			) => Array<{
				wild: Array<{ speciesId: string; shiny: boolean }>;
				researches: Array<{ speciesId: string; shiny: boolean }>;
				lures: Array<{ speciesId: string; shiny: boolean }>;
			}>;
		}
	).parseSinglePost(
		{
			url: 'https://pokemongo.com/en/news/communityday-october-2026-zorua',
			locale: 'en',
			html: post,
			type: 'news',
		},
		gameMaster
	);
};

const zoruaIn = (list: Array<{ speciesId: string; shiny: boolean }>) =>
	list.filter((p) => p.speciesId === 'zorua');

describe('shiny in a Community Day post', () => {
	const [event] = parse(html);

	it('has Zorua shiny in the wild: the featured section says a Shiny one can be found', () => {
		expect(zoruaIn(event.wild)).toEqual([
			expect.objectContaining({ speciesId: 'zorua', shiny: true }),
		]);
	});

	it('has Zorua shiny from lures: the Lure Module sentence says it', () => {
		expect(zoruaIn(event.lures)).toEqual([
			expect.objectContaining({ speciesId: 'zorua', shiny: true }),
		]);
	});

	it('does not have Zorua shiny in the research: nothing there says shiny, and a featured section does not speak for it', () => {
		expect(zoruaIn(event.researches)).toEqual([
			expect.objectContaining({ speciesId: 'zorua', shiny: false }),
		]);
	});

	it('lists each Pokémon once per list', () => {
		for (const list of [event.wild, event.researches, event.lures]) {
			const ids = list.map((p) => p.speciesId);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('does not depend on the order of the sections: a research section that does say shiny makes it shiny', () => {
		const shinyResearch = html.replace(
			'that have a Special Background—if you’re lucky!',
			'that can be Shiny and have a Special Background!'
		);
		expect(shinyResearch).not.toBe(html);
		const [shiny] = parse(shinyResearch);
		expect(zoruaIn(shiny.researches)).toEqual([
			expect.objectContaining({ speciesId: 'zorua', shiny: true }),
		]);
	});
});
