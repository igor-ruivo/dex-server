import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getDomains } from '../../../pokemon/game-master-parser';
import type { IMilestoneBonuses } from '../../../types/events';
import type { GameMasterData } from '../../../types/pokemon';
import PokemonGoSource from './PokemongoSource';

/** The "Major Milestone Bonuses" section of a real GO Pass post (October 2026, saved as a fixture). */
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
			milestoneBonuses?: IMilestoneBonuses;
			milestoneSectionIndex: number;
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

const text = (blocks: Array<{ runs: Array<{ text: string }> }>) =>
	blocks.map((b) => b.runs.map((r) => r.text).join(''));

describe('the major milestone bonuses of a GO Pass post', () => {
	it('keeps the sentence that introduces them, with the title the seasons use', () => {
		expect(event.milestoneSectionIndex).toBeGreaterThanOrEqual(0);
		expect(event.milestoneBonuses?.title).toBe('Major Milestone Bonuses');
		expect(text(event.milestoneBonuses?.intro ?? [])).toEqual([
			'Reach Major Milestones on your GO Pass to unlock the following bonuses.',
		]);
	});

	it('has a card per tier with its rank and its bullet points', () => {
		const tiers = event.milestoneBonuses?.tiers ?? [];
		expect(tiers.map((t) => [t.tier, t.rank])).toEqual([
			['Tier 1', 'Rank 1'],
			['Tier 2', 'Rank 25'],
			['Tier 3', 'Rank 50'],
			['Tier 4', 'Rank 75'],
			['Tier 2', 'Rank 25'],
		]);
		expect(text(tiers[0].blocks)).toEqual([
			'One additional Candy for trading Pokémon.',
			'Trainers level 31 and above will receive one guaranteed Candy XL when trading Pokémon.',
		]);
	});

	it('puts the GO Pass Deluxe sentence on the stronger version of the bonus that follows it', () => {
		const deluxe = event.milestoneBonuses?.tiers[4];
		expect(deluxe?.blocks[0]).toMatchObject({ kind: 'text' });
		expect(text(deluxe?.blocks ?? [])[0]).toBe(
			'Upgrade to the GO Pass Deluxe to strengthen the following bonus.'
		);
		expect(deluxe?.blocks.filter((b) => b.kind === 'item')).toHaveLength(3);
	});
});
