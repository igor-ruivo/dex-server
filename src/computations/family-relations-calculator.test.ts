import { describe, expect, it } from 'vitest';

import type {
	GameMasterData,
	GameMasterPokemon,
} from '../parsers/types/pokemon';
import { PokemonTypes } from '../parsers/types/pokemon';
import { augmentGameMasterWithFamilyRelations } from './family-relations-calculator';

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

describe('augmentGameMasterWithFamilyRelations — Mega/Primal <-> base', () => {
	it('a single Mega form gets baseSpecies, and the base gets a one-element megaFormsIds', () => {
		const dict: GameMasterData = {
			gengar: makePokemon({ speciesId: 'gengar', dex: 94 }),
			gengar_mega: makePokemon({
				speciesId: 'gengar_mega',
				dex: 94,
				isMega: true,
			}),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.gengar_mega.baseSpecies).toBe('gengar');
		expect(dict.gengar.megaFormsIds).toEqual(['gengar_mega']);
	});

	it('two Mega forms (X/Y) both point back to the same base, which lists both', () => {
		const dict: GameMasterData = {
			charizard: makePokemon({ speciesId: 'charizard', dex: 6 }),
			charizard_mega_x: makePokemon({
				speciesId: 'charizard_mega_x',
				dex: 6,
				isMega: true,
			}),
			charizard_mega_y: makePokemon({
				speciesId: 'charizard_mega_y',
				dex: 6,
				isMega: true,
			}),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.charizard_mega_x.baseSpecies).toBe('charizard');
		expect(dict.charizard_mega_y.baseSpecies).toBe('charizard');
		expect(dict.charizard.megaFormsIds).toEqual([
			'charizard_mega_x',
			'charizard_mega_y',
		]);
	});

	it('a Primal form resolves via the same id-splitting rule as Mega', () => {
		const dict: GameMasterData = {
			kyogre: makePokemon({ speciesId: 'kyogre', dex: 382 }),
			kyogre_primal: makePokemon({
				speciesId: 'kyogre_primal',
				dex: 382,
				isMega: true,
			}),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.kyogre_primal.baseSpecies).toBe('kyogre');
		expect(dict.kyogre.megaFormsIds).toEqual(['kyogre_primal']);
	});

	it('a species with no Mega form gets no megaFormsIds field at all (absent, not empty array)', () => {
		const dict: GameMasterData = {
			charmeleon: makePokemon({ speciesId: 'charmeleon', dex: 5 }),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.charmeleon.megaFormsIds).toBeUndefined();
	});

	it('a non-Mega species sharing a dex with an unrelated Mega is never linked to it — no exceptions list needed', () => {
		// Regression case: Galarian Slowbro shares dex 80 with Slowbro, which has
		// its own Mega. The old dex-number-matching heuristic needed a hardcoded
		// exception for this; id-splitting never even considers it, since
		// "slowbro_mega".split('_mega')[0] is "slowbro", never "slowbro_galarian".
		const dict: GameMasterData = {
			slowbro: makePokemon({ speciesId: 'slowbro', dex: 80 }),
			slowbro_galarian: makePokemon({ speciesId: 'slowbro_galarian', dex: 80 }),
			slowbro_mega: makePokemon({
				speciesId: 'slowbro_mega',
				dex: 80,
				isMega: true,
			}),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.slowbro_mega.baseSpecies).toBe('slowbro');
		expect(dict.slowbro.megaFormsIds).toEqual(['slowbro_mega']);
		expect(dict.slowbro_galarian.megaFormsIds).toBeUndefined();
	});

	it('ignores an alias entry even if flagged isMega', () => {
		const dict: GameMasterData = {
			gengar: makePokemon({ speciesId: 'gengar', dex: 94 }),
			gengar_mega_alias: makePokemon({
				speciesId: 'gengar_mega_alias',
				dex: 94,
				isMega: true,
				aliasId: 'gengar_mega',
			}),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.gengar_mega_alias.baseSpecies).toBeUndefined();
		expect(dict.gengar.megaFormsIds).toBeUndefined();
	});
});

describe('augmentGameMasterWithFamilyRelations — Shadow <-> non-Shadow', () => {
	it('a Mega form sharing its base species dex+types is never linked to that base’s Shadow (regression: Mega Charizard Y false-positiving on Charizard Shadow)', () => {
		const dict: GameMasterData = {
			charizard: makePokemon({
				speciesId: 'charizard',
				dex: 6,
				types: [PokemonTypes.Fire, PokemonTypes.Flying],
			}),
			// Real data: Mega Charizard Y is Fire/Flying too — identical to base
			// Charizard's own types, which is exactly what made it false-positive
			// match Charizard Shadow before the `isMega` exclusion.
			charizard_mega_y: makePokemon({
				speciesId: 'charizard_mega_y',
				dex: 6,
				types: [PokemonTypes.Fire, PokemonTypes.Flying],
				isMega: true,
			}),
			charizard_shadow: makePokemon({
				speciesId: 'charizard_shadow',
				dex: 6,
				types: [PokemonTypes.Fire, PokemonTypes.Flying],
				isShadow: true,
			}),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.charizard.shadowSpecies).toBe('charizard_shadow');
		expect(dict.charizard_mega_y.shadowSpecies).toBeUndefined();
	});

	it('an alternate forme sharing its default forme’s dex+types is never linked to that forme’s Shadow (regression: Dialga Origin false-positiving on Dialga Shadow)', () => {
		// Real data: Dialga and Dialga Origin share dex 483 and both are
		// Steel/Dragon — only the default forme was ever released as Shadow.
		// `form` is the one field that actually differs between them.
		const dict: GameMasterData = {
			dialga: makePokemon({
				speciesId: 'dialga',
				dex: 483,
				types: [PokemonTypes.Steel, PokemonTypes.Dragon],
				form: '',
			}),
			dialga_origin: makePokemon({
				speciesId: 'dialga_origin',
				dex: 483,
				types: [PokemonTypes.Steel, PokemonTypes.Dragon],
				form: 'Origin',
			}),
			dialga_shadow: makePokemon({
				speciesId: 'dialga_shadow',
				dex: 483,
				types: [PokemonTypes.Steel, PokemonTypes.Dragon],
				form: '',
				isShadow: true,
			}),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.dialga.shadowSpecies).toBe('dialga_shadow');
		expect(dict.dialga_origin.shadowSpecies).toBeUndefined();
		expect(dict.dialga_shadow.nonShadowSpecies).toBe('dialga');
	});

	it('a matching-type Shadow counterpart gets linked both ways', () => {
		const dict: GameMasterData = {
			machop: makePokemon({
				speciesId: 'machop',
				dex: 66,
				types: [PokemonTypes.Fighting],
			}),
			machop_shadow: makePokemon({
				speciesId: 'machop_shadow',
				dex: 66,
				types: [PokemonTypes.Fighting],
				isShadow: true,
			}),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.machop.shadowSpecies).toBe('machop_shadow');
		expect(dict.machop_shadow.nonShadowSpecies).toBe('machop');
	});

	it('a species with no Shadow counterpart gets no shadowSpecies field at all', () => {
		const dict: GameMasterData = {
			ditto: makePokemon({ speciesId: 'ditto', dex: 132 }),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.ditto.shadowSpecies).toBeUndefined();
	});

	it('a dex-matching Shadow with different types is never linked (e.g. a regional-form false positive guard)', () => {
		const dict: GameMasterData = {
			mon: makePokemon({
				speciesId: 'mon',
				dex: 9,
				types: [PokemonTypes.Grass],
			}),
			other_shadow: makePokemon({
				speciesId: 'other_shadow',
				dex: 9,
				types: [PokemonTypes.Fire],
				isShadow: true,
			}),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.mon.shadowSpecies).toBeUndefined();
		expect(dict.other_shadow.nonShadowSpecies).toBeUndefined();
	});

	it('ignores an alias entry on either side', () => {
		const dict: GameMasterData = {
			mon: makePokemon({
				speciesId: 'mon',
				dex: 11,
				types: [PokemonTypes.Water],
			}),
			mon_shadow_alias: makePokemon({
				speciesId: 'mon_shadow_alias',
				dex: 11,
				types: [PokemonTypes.Water],
				isShadow: true,
				aliasId: 'mon_shadow',
			}),
		};

		augmentGameMasterWithFamilyRelations(dict);

		expect(dict.mon.shadowSpecies).toBeUndefined();
	});

	it('mutates and returns the same object reference', () => {
		const dict: GameMasterData = { mon: makePokemon({}) };
		expect(augmentGameMasterWithFamilyRelations(dict)).toBe(dict);
	});
});
