import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getDomains } from '../../../pokemon/game-master-parser';
import type { GameMasterData } from '../../../types/pokemon';
import type { RichBlock } from '../../../types/rich-text';
import PokemonGoSource from './PokemongoSource';

/** The bonuses of a real Community Day post (October 2026, saved as a fixture) keep their formatting. */
const gameMaster = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'data', 'game-master.json'), 'utf8')
) as GameMasterData;
const html = fs.readFileSync(
	path.join(__dirname, '__fixtures__', 'communityday-october-2026-zorua.html'),
	'utf8'
);

const [event] = (
	new PokemonGoSource(
		{} as never,
		gameMaster,
		getDomains(gameMaster).allDomain
	) as unknown as {
		parseSinglePost: (
			post: unknown,
			gameMaster: unknown
		) => Array<{ bonuses: Array<string>; bonusBlocks: Array<RichBlock> }>;
	}
).parseSinglePost(
	{
		url: 'https://pokemongo.com/en/news/communityday-october-2026-zorua',
		locale: 'en',
		html,
		type: 'news',
	},
	gameMaster
);

describe('the bonuses of a Community Day post, formatted', () => {
	it('has the bullet points as items and the asterisk remark under them as a note', () => {
		const items = event.bonusBlocks.filter((b) => b.kind === 'item');
		expect(items).toHaveLength(8);
		expect(items[0].runs).toEqual([{ text: '3× XP for catching Pokémon.' }]);
		const last = event.bonusBlocks[event.bonusBlocks.length - 1];
		expect(last.kind).toBe('note');
		expect(
			last.runs[0].text.startsWith('*While most bonuses are only active')
		).toBe(true);
	});

	it('still has the plain lines the formatted blocks were built beside', () => {
		expect(event.bonuses[0]).toBe('3× XP for catching Pokémon.');
		expect(event.bonuses.length).toBe(event.bonusBlocks.length);
	});
});
