import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getDomains } from '../../../pokemon/game-master-parser';
import type { GameMasterData } from '../../../types/pokemon';
import type { RichBlock } from '../../../types/rich-text';
import PokemonGoSource from './PokemongoSource';

/** The rewards of the "Featured Pokémon and Rewards" section of a real GO Pass post (October 2026, saved as a fixture). */
const gameMaster = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'data', 'game-master.json'), 'utf8')
) as GameMasterData;
const html = fs.readFileSync(
	path.join(__dirname, '__fixtures__', 'go-pass-october-2026.html'),
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
		) => Array<{
			researches: Array<{ speciesId: string }>;
			rewardBlocks: Array<RichBlock>;
			rewardSectionIndex: number;
		}>;
	}
).parseSinglePost(
	{
		url: 'https://pokemongo.com/en/news/go-pass-october-2026',
		locale: 'en',
		html,
		type: 'news',
	},
	gameMaster
);

const lines = (blocks: Array<RichBlock>) =>
	blocks.map((b) => [b.kind, b.runs.map((r) => r.text).join('')]);

describe('the rewards of a GO Pass post', () => {
	it('still takes the Pokémon from the section as before', () => {
		expect(event.researches.map((p) => p.speciesId)).toContain('kyogre');
	});

	it('keeps the rewards as formatted blocks, with the line of the Pokémon and its shiny remark', () => {
		expect(lines(event.rewardBlocks)).toEqual([
			[
				'text',
				'Complete Pass Tasks to rank up your GO Pass to earn the following rewards.',
			],
			['item', 'Encounter with Kyogre*'],
			['item', 'Rare Candy XL'],
			['item', 'Premium Battle Pass'],
			['item', 'Lucky Egg'],
			['item', 'And even more goodies!'],
			[
				'text',
				'Trainers who upgrade to the GO Pass Deluxe can also earn the following rewards.',
			],
			['item', 'A Lucky Trinket'],
			['item', 'One Super Incubator'],
			['item', 'Additional encounters with even more Pokémon!'],
			['item', 'And even more goodies!'],
			['note', '*You might even encounter a Shiny one—if you’re lucky!'],
		]);
		expect(event.rewardSectionIndex).toBeGreaterThanOrEqual(0);
	});
});
