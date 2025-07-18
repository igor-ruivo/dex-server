import type { BasePokemon } from '../../types/pokemon';

export const SYNTHETIC_POKEMON: Array<BasePokemon> = [
	{
		dex: 554,
		speciesId: 'darumaka_shadow',
		speciesName: 'Darumaka (Shadow)',
		baseStats: { atk: 153, def: 86, hp: 172 },
		types: ['fire', 'none'],
		fastMoves: ['TACKLE', 'FIRE_FANG'],
		chargedMoves: ['FIRE_PUNCH', 'FLAME_CHARGE'],
		eliteMoves: [],
		legacyMoves: [],
		released: true,
		family: {
			id: 'FAMILY_DARUMAKA',
			evolutions: ['darmanitan_standard_shadow'],
		},
		tags: ['shadow'],
	},
	{
		dex: 115,
		speciesId: 'kangaskhan_shadow',
		speciesName: 'Kangaskhan (Shadow)',
		baseStats: {
			atk: 181,
			def: 165,
			hp: 233,
		},
		types: ['normal', 'none'],
		fastMoves: ['LOW_KICK', 'MUD_SLAP'],
		chargedMoves: [
			'BRICK_BREAK',
			'CRUNCH',
			'EARTHQUAKE',
			'OUTRAGE',
			'STOMP',
			'POWER_UP_PUNCH',
		],
		eliteMoves: ['BRICK_BREAK', 'STOMP'],
		legacyMoves: [],
		released: true,
		tags: ['shadow'],
	},
];
