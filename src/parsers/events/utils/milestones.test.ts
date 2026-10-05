import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { parseMilestoneBonuses } from './milestones';

const card = (
	colors: string,
	tier: string,
	rank: string,
	bullets: Array<string>
) =>
	`<div style="${colors}" class="_component_1okc8_2"><div class="_cardTextWrapper_1okc8_43"><h3 class="_title_1okc8_87"><span>${tier}</span></h3><div class="_subtitle_1okc8_124">${rank}</div><div class="_body_1okc8_144"><ul>${bullets.map((b) => `<li><p>${b}</p></li>`).join('')}</ul></div></div></div>`;

const PAGE = `<div id="bonus-cards"><div class="_bonusCards_1jf8k_8">${card(
	'--title-background-color-1:#9043B7;--title-background-color-2:#543D98;',
	'Tier 1',
	'Rank 1',
	[
		'Trainers level 31 and above will receive one guaranteed Candy XL when trading Pokémon',
		'One additional Candy for trading Pokémon',
	]
)}${card(
	'--title-background-color-1:#B77143;--title-background-color-2:#98583D;',
	'Tier 2',
	'Rank 25',
	['Increased limits on opening Gifts']
)}</div></div>`;

describe('the major milestone bonuses of a season page', () => {
	it('reads each tier with its rank, its bonuses as bullet points and the colours of its header', () => {
		const result = parseMilestoneBonuses(new JSDOM(PAGE).window.document);
		expect(result?.title).toBe('Major Milestone Bonuses');
		expect(result?.tiers).toEqual([
			{
				tier: 'Tier 1',
				rank: 'Rank 1',
				colors: ['#9043B7', '#543D98'],
				blocks: [
					{
						kind: 'item',
						level: 0,
						runs: [
							{
								text: 'Trainers level 31 and above will receive one guaranteed Candy XL when trading Pokémon',
							},
						],
					},
					{
						kind: 'item',
						level: 0,
						runs: [{ text: 'One additional Candy for trading Pokémon' }],
					},
				],
			},
			{
				tier: 'Tier 2',
				rank: 'Rank 25',
				colors: ['#B77143', '#98583D'],
				blocks: [
					{
						kind: 'item',
						level: 0,
						runs: [{ text: 'Increased limits on opening Gifts' }],
					},
				],
			},
		]);
	});

	it('finds nothing in a page without the block', () => {
		expect(
			parseMilestoneBonuses(new JSDOM('<div id="other"></div>').window.document)
		).toBeUndefined();
	});
});
