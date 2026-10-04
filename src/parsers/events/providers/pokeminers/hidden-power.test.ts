import { describe, expect, it } from 'vitest';

import { computeDPSEntry } from '../../../../computations/utils';
import { POKEMON_CONFIG } from '../../../pokemon/config/pokemon-config';
import { AvailableLocales } from '../../../services/gamemaster-translator';
import type {
	GameMasterPokemon,
	IGameMasterMove,
} from '../../../types/pokemon';
import { PokemonTypes } from '../../../types/pokemon';
import { expandHiddenPower } from './hidden-power';

const names = (en: string, pt?: string) =>
	Object.fromEntries(
		Object.values(AvailableLocales).map((l) => [
			l,
			l === AvailableLocales.ptbr && pt ? pt : en,
		])
	);

const move = (overrides: Partial<IGameMasterMove>): IGameMasterMove => ({
	moveId: 'X',
	isSuperMega: false,
	vId: '1',
	type: 'normal',
	isFast: true,
	pvpPower: 9,
	pvePower: 15,
	pvpEnergy: 8,
	pveEnergy: 15,
	pvpCooldown: 1.5,
	pveCooldown: 1.5,
	moveName: names('X'),
	...overrides,
});

const generic = move({
	moveId: 'HIDDEN_POWER',
	moveName: names('Hidden Power', 'Poder Oculto'),
});
const typeNames: Record<string, string> = { psychic: 'Psíquico' };
const typeName = (locale: AvailableLocales, type: string) =>
	locale === AvailableLocales.ptbr ? typeNames[type] : undefined;

describe('expandHiddenPower', () => {
	const moves = expandHiddenPower(
		{ HIDDEN_POWER: generic, TACKLE: move({ moveId: 'TACKLE' }) },
		typeName
	);

	it('replaces the generic move with one per type, and leaves the other moves alone', () => {
		expect(moves.HIDDEN_POWER).toBeUndefined();
		expect(moves.TACKLE).toBeDefined();
		const variants = Object.keys(moves).filter((id) =>
			id.startsWith('HIDDEN_POWER_')
		);
		expect(variants.sort()).toEqual([...POKEMON_CONFIG.HIDDEN_POWERS].sort());
		expect(variants).toHaveLength(16);
	});

	it('gives each variant its own type and the generic move’s numbers', () => {
		for (const id of POKEMON_CONFIG.HIDDEN_POWERS) {
			const variant = moves[id];
			expect(variant.moveId).toBe(id);
			expect(id.toLowerCase()).toBe(`hidden_power_${variant.type}`);
			expect(variant).toMatchObject({
				pvePower: 15,
				pveEnergy: 15,
				pvpPower: 9,
				pvpEnergy: 8,
				isFast: true,
			});
		}
	});

	it('names each one "<Hidden Power> <Type>" in every language, falling back to the English type', () => {
		expect(moves.HIDDEN_POWER_PSYCHIC.moveName[AvailableLocales.en]).toBe(
			'Hidden Power Psychic'
		);
		expect(moves.HIDDEN_POWER_PSYCHIC.moveName[AvailableLocales.ptbr]).toBe(
			'Poder Oculto Psíquico'
		);
		expect(moves.HIDDEN_POWER_FIRE.moveName[AvailableLocales.ptbr]).toBe(
			'Poder Oculto Fire'
		);
	});

	it('gives each variant the generic name too, for lists that show them as one', () => {
		expect(moves.HIDDEN_POWER_PSYCHIC.groupName?.[AvailableLocales.en]).toBe(
			'Hidden Power'
		);
		expect(moves.HIDDEN_POWER_PSYCHIC.groupName?.[AvailableLocales.ptbr]).toBe(
			'Poder Oculto'
		);
	});

	it('does not change the input, and passes a game master without the generic move through', () => {
		const input = { HIDDEN_POWER: generic };
		expandHiddenPower(input, typeName);
		expect(input.HIDDEN_POWER).toBe(generic);
		const without = { TACKLE: move({ moveId: 'TACKLE' }) };
		expect(expandHiddenPower(without, typeName)).toBe(without);
	});
});

describe('Hidden Power in the raid damage calculation', () => {
	const pokemon = {
		dex: 1,
		speciesId: 'psymon',
		speciesName: 'Psymon',
		types: [PokemonTypes.Psychic],
		fastMoves: [
			'HIDDEN_POWER_PSYCHIC',
			'HIDDEN_POWER_FIGHTING',
			'HIDDEN_POWER_BUG',
		],
		chargedMoves: ['PSYCHIC_CHARGE', 'FIGHT_CHARGE'],
		baseStats: { atk: 200, def: 150, hp: 150 },
		isShadow: false,
		isMega: false,
		isSuperMega: false,
	} as unknown as GameMasterPokemon;
	const charged = (id: string, type: string) =>
		move({
			moveId: id,
			type,
			isFast: false,
			pvePower: 90,
			pveEnergy: -50,
			pveCooldown: 2.5,
			pveDamageWindowStart: 1,
			pveDamageWindowEnd: 2,
		});
	const all = {
		...expandHiddenPower({ HIDDEN_POWER: generic }, typeName),
		PSYCHIC_CHARGE: charged('PSYCHIC_CHARGE', 'psychic'),
		FIGHT_CHARGE: charged('FIGHT_CHARGE', 'fighting'),
	};

	it('picks the Hidden Power of the type being ranked when it is super effective, and the Pokémon’s own type for STAB', () => {
		const fighting = computeDPSEntry(pokemon, all, 15, 80, 'fighting');
		expect(fighting.fastMove).toBe('HIDDEN_POWER_FIGHTING');
		// no super-effective Hidden Power for this type is better than the same move without the type
		const psychic = computeDPSEntry(pokemon, all, 15, 80, 'psychic');
		expect(psychic.fastMove).toBe('HIDDEN_POWER_PSYCHIC');
	});

	it('does more damage with a Hidden Power that has STAB than the same Hidden Power of an unrelated type', () => {
		const stab = computeDPSEntry(
			{ ...pokemon, fastMoves: ['HIDDEN_POWER_PSYCHIC'] },
			all,
			15,
			80,
			'fighting'
		);
		const plain = computeDPSEntry(
			{ ...pokemon, fastMoves: ['HIDDEN_POWER_BUG'] },
			all,
			15,
			80,
			'fighting'
		);
		expect(stab.fastMoveDmg).toBeGreaterThan(plain.fastMoveDmg);
	});
});
