import { describe, expect, it } from 'vitest';

import type { GameMasterData } from '../types/pokemon';
import {
	moveAbbreviation,
	parseLeaderboardTeam,
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
		).toEqual({ speciesId: 'golisopod', moveset: ['SHADOW_CLAW', 'AERIAL_ACE'] });
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
