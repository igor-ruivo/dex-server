import { describe, expect, it } from 'vitest';

import { calculateCP } from '../../computations/best-iv-spread-calculator';
import type { GameMasterData } from '../types/pokemon';
import {
	moveAbbreviation,
	parseLeaderboardTeam,
	pickBestIvs,
	resolveLeaderboardMember,
} from './team-builder-parser';

const gameMaster = {
	jellicent: {
		speciesId: 'jellicent',
		fastMoves: ['HEX', 'BUBBLE'],
		chargedMoves: ['SURF', 'SHADOW_BALL', 'ICE_BEAM'],
	},
	golisopodsh: {
		speciesId: 'golisopodsh',
		aliasId: 'golisopod',
		fastMoves: ['SHADOW_CLAW'],
		chargedMoves: ['AERIAL_ACE'],
	},
} as unknown as GameMasterData;

const abbreviations: Record<string, string> = {
	HEX: 'H',
	BUBBLE: 'Bu',
	SURF: 'S',
	SHADOW_BALL: 'SB',
	ICE_BEAM: 'IB',
	SHADOW_CLAW: 'SC',
	AERIAL_ACE: 'AA',
};

describe('moveAbbreviation', () => {
	it('prefers PvPoke explicit abbreviations', () => {
		expect(moveAbbreviation({ moveId: 'ACID', abbreviation: 'Ac' })).toBe('Ac');
	});

	it('falls back to the initials of each word', () => {
		expect(moveAbbreviation({ moveId: 'SHADOW_BALL' })).toBe('SB');
	});
});

describe('resolveLeaderboardMember', () => {
	it('resolves abbreviations inside the species own move pool', () => {
		expect(
			resolveLeaderboardMember('jellicent H/S/SB', gameMaster, abbreviations)
		).toEqual({
			speciesId: 'jellicent',
			moveset: ['HEX', 'SURF', 'SHADOW_BALL'],
		});
	});

	it('supports a single charged move and follows species aliases', () => {
		expect(
			resolveLeaderboardMember('golisopodsh SC/AA', gameMaster, abbreviations)
		).toEqual({
			speciesId: 'golisopod',
			moveset: ['SHADOW_CLAW', 'AERIAL_ACE'],
		});
	});

	it('fails loudly on an abbreviation the species cannot learn', () => {
		expect(() =>
			resolveLeaderboardMember('jellicent H/S/AA', gameMaster, abbreviations)
		).toThrow('has abbreviation "AA"');
	});

	it('fails loudly on an unknown species', () => {
		expect(() =>
			resolveLeaderboardMember('missingno H/S', gameMaster, abbreviations)
		).toThrow('unknown species');
	});
});

describe('parseLeaderboardTeam', () => {
	it('splits a team string into its members', () => {
		const team = parseLeaderboardTeam(
			{ team: 'jellicent H/S|golisopodsh SC/AA', teamScore: 550.5, games: 12 },
			gameMaster,
			abbreviations
		);
		expect(team.members.map((m) => m.speciesId)).toEqual([
			'jellicent',
			'golisopod',
		]);
		expect(team.score).toBe(550.5);
	});
});

describe('pickBestIvs', () => {
	const azumarill = { atk: 112, def: 152, hp: 225 };

	it('takes the only tied pattern and puts it at the highest level that fits the cap', () => {
		const [level, atk, def, hp] = pickBestIvs(
			[{ A: 0, D: 15, S: 15 }],
			azumarill,
			1500
		)!;
		expect([atk, def, hp]).toEqual([0, 15, 15]);
		const cp = (l: number) =>
			calculateCP(
				azumarill.atk,
				0,
				azumarill.def,
				15,
				azumarill.hp,
				15,
				(l - 1) * 2
			);
		expect(cp(level)).toBeLessThanOrEqual(1500);
		expect(cp(level + 0.5)).toBeGreaterThan(1500);
	});

	it('breaks ties toward the highest numbers: Attack first, then Defense, then HP', () => {
		expect(
			pickBestIvs(
				[
					{ A: 14, D: 15, S: 15 },
					{ A: 15, D: 13, S: 15 },
					{ A: 15, D: 14, S: 12 },
					{ A: 15, D: 14, S: 14 },
				],
				azumarill,
				Number.MAX_VALUE
			)!.slice(1)
		).toEqual([15, 14, 14]);
	});

	it('uses level 50 when the cap does not bind', () => {
		expect(
			pickBestIvs([{ A: 15, D: 15, S: 15 }], azumarill, Number.MAX_VALUE)
		).toEqual([50, 15, 15, 15]);
	});

	it('has nothing to pick when the cap admits no spread', () => {
		expect(pickBestIvs([], azumarill, 1500)).toBeUndefined();
		expect(
			pickBestIvs([{ A: 0, D: 0, S: 0 }], { atk: 400, def: 400, hp: 400 }, 100)
		).toBeUndefined();
	});
});
