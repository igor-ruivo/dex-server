import { describe, expect, it } from 'vitest';

import type {
	GameMasterData,
	GameMasterPokemon,
} from '../parsers/types/pokemon';
import { PokemonTypes } from '../parsers/types/pokemon';
import {
	buildFormIds,
	buildUniqueTypes,
	computeFormIdentifiersForAllSpecies,
	formIdentifierFor,
	generatePokemonId,
	type PokemonForm,
} from './form-identifier-calculator';

const makePokemon = (
	overrides: Partial<GameMasterPokemon>
): GameMasterPokemon => ({
	dex: 1,
	speciesId: 'test_mon',
	speciesName: 'Test Mon',
	types: [PokemonTypes.Normal],
	fastMoves: [],
	chargedMoves: [],
	baseStats: { atk: 100, def: 100, hp: 100 },
	imageUrl: '',
	goImageUrl: '',
	shinyGoImageUrl: '',
	isShadow: false,
	isMega: false,
	isSuperMega: false,
	form: '',
	isLegendary: false,
	isMythical: false,
	isBeast: false,
	...overrides,
});

const asForm = (p: GameMasterPokemon): PokemonForm => ({
	dexNumber: p.dex,
	types: p.types.map((t) => t.toString().toLocaleLowerCase()),
	isShadow: false,
	p,
});

describe('buildUniqueTypes', () => {
	it('flags a type only when exactly one form at that dex has it', () => {
		const forms: Array<PokemonForm> = [
			asForm(makePokemon({ dex: 201, types: [PokemonTypes.Psychic] })),
			asForm(makePokemon({ dex: 201, types: [PokemonTypes.Rock] })),
			asForm(makePokemon({ dex: 201, types: [PokemonTypes.Rock] })),
		];
		const unique = buildUniqueTypes(forms);
		expect(unique[201].has('psychic')).toBe(true);
		// Rock appears on two of the three forms — not unique.
		expect(unique[201].has('rock')).toBe(false);
	});
});

describe('generatePokemonId', () => {
	it('returns a bare dex number when it is the only form at that dex', () => {
		const form = asForm(makePokemon({ dex: 1, types: [PokemonTypes.Grass] }));
		expect(generatePokemonId(1, form.types, {}, [form], form)).toBe('1');
	});

	it('uses the one unique type when the form has one', () => {
		const a = asForm(makePokemon({ dex: 201, types: [PokemonTypes.Psychic] }));
		const b = asForm(makePokemon({ dex: 201, types: [PokemonTypes.Rock] }));
		const c = asForm(makePokemon({ dex: 201, types: [PokemonTypes.Rock] }));
		const siblings = [a, b, c];
		const unique = buildUniqueTypes(siblings);
		expect(generatePokemonId(201, a.types, unique, siblings, a)).toBe(
			'201,psychic'
		);
	});

	it('falls back to enough of its own types plus negated sibling types when nothing is unique', () => {
		// Two dual-typed siblings at the same dex, neither type unique to either.
		const a = asForm(
			makePokemon({ dex: 999, types: [PokemonTypes.Fire, PokemonTypes.Flying] })
		);
		const b = asForm(
			makePokemon({ dex: 999, types: [PokemonTypes.Fire, PokemonTypes.Dragon] })
		);
		const siblings = [a, b];
		const unique = buildUniqueTypes(siblings);
		const id = generatePokemonId(999, a.types, unique, siblings, a);
		// Must disambiguate `a` from `b`: identical Fire alone isn't enough.
		expect(id).not.toBe('999');
		expect(id.startsWith('999')).toBe(true);
	});
});

describe('buildFormIds / formIdentifierFor', () => {
	it('gives a bare dex number to a species with no siblings at its dex', () => {
		const dict: GameMasterData = {
			solo_mon: makePokemon({
				speciesId: 'solo_mon',
				dex: 42,
				types: [PokemonTypes.Water],
			}),
		};
		const ids = buildFormIds(dict);
		expect(formIdentifierFor(dict.solo_mon, ids)).toBe('42');
	});

	it('disambiguates siblings sharing a dex number by their own unique type', () => {
		const dict: GameMasterData = {
			form_a: makePokemon({
				speciesId: 'form_a',
				dex: 201,
				types: [PokemonTypes.Psychic],
			}),
			form_b: makePokemon({
				speciesId: 'form_b',
				dex: 201,
				types: [PokemonTypes.Rock],
			}),
			form_c: makePokemon({
				speciesId: 'form_c',
				dex: 201,
				types: [PokemonTypes.Rock],
			}),
		};
		const ids = buildFormIds(dict);
		expect(formIdentifierFor(dict.form_a, ids)).toBe('201&psychic');
	});

	it('a Shadow species resolves to the exact same identifier as its non-Shadow counterpart', () => {
		const dict: GameMasterData = {
			mon: makePokemon({
				speciesId: 'mon',
				dex: 5,
				types: [PokemonTypes.Fire],
				isShadow: false,
			}),
			mon_shadow: makePokemon({
				speciesId: 'mon_shadow',
				dex: 5,
				types: [PokemonTypes.Fire],
				isShadow: true,
			}),
		};
		const ids = buildFormIds(dict);
		expect(formIdentifierFor(dict.mon_shadow, ids)).toBe(
			formIdentifierFor(dict.mon, ids)
		);
	});

	it('excludes Mega/alias/Shadow forms from the sibling comparison itself', () => {
		// A Mega sharing the dex must not force disambiguation on the base form
		// when the base form would otherwise be the dex's only real candidate.
		const dict: GameMasterData = {
			base: makePokemon({
				speciesId: 'base',
				dex: 6,
				types: [PokemonTypes.Fire, PokemonTypes.Flying],
			}),
			base_mega: makePokemon({
				speciesId: 'base_mega',
				dex: 6,
				types: [PokemonTypes.Fire, PokemonTypes.Dragon],
				isMega: true,
			}),
		};
		const ids = buildFormIds(dict);
		expect(formIdentifierFor(dict.base, ids)).toBe('6');
	});
});

describe('computeFormIdentifiersForAllSpecies', () => {
	it('computes searchFormId for every species', () => {
		const dict: GameMasterData = {
			mon: makePokemon({
				speciesId: 'mon',
				dex: 10,
				types: [PokemonTypes.Bug],
			}),
			mon_shadow: makePokemon({
				speciesId: 'mon_shadow',
				dex: 10,
				types: [PokemonTypes.Bug],
				isShadow: true,
			}),
		};

		const result = computeFormIdentifiersForAllSpecies(dict);

		expect(result.mon.searchFormId).toBe('10');
		expect(result.mon_shadow.searchFormId).toBe('10');
	});

	it('never mutates the input gamemaster', () => {
		const dict: GameMasterData = { mon: makePokemon({}) };
		computeFormIdentifiersForAllSpecies(dict);
		expect(dict.mon).not.toHaveProperty('searchFormId');
	});
});
