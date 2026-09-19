import { describe, expect, it } from 'vitest';

import type {
	GameMasterData,
	GameMasterPokemon,
} from '../parsers/types/pokemon';
import { PokemonTypes } from '../parsers/types/pokemon';
import { computeSpeciesSearchMetadata } from './species-search-metadata-calculator';

const makePokemon = (
	overrides: Partial<GameMasterPokemon>
): GameMasterPokemon => ({
	dex: 1,
	speciesId: 'test_mon',
	speciesName: 'Test Mon',
	types: [PokemonTypes.Normal],
	fastMoves: [],
	chargedMoves: [],
	baseStats: { atk: 198, def: 189, hp: 190 },
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

describe('computeSpeciesSearchMetadata', () => {
	it('combines the form-identity and IV-spread halves under one entry per speciesId', () => {
		const dict: GameMasterData = {
			mon: makePokemon({
				speciesId: 'mon',
				dex: 20,
				types: [PokemonTypes.Water],
			}),
			mon_shadow: makePokemon({
				speciesId: 'mon_shadow',
				dex: 20,
				types: [PokemonTypes.Water],
				isShadow: true,
			}),
		};

		const metadata = computeSpeciesSearchMetadata(dict);

		expect(Object.keys(metadata).sort()).toEqual(['mon', 'mon_shadow']);

		expect(metadata.mon.searchFormId).toBe('20');
		expect(metadata.mon.bestIvSpreads).toBeDefined();
		expect(metadata.mon.bestIvSpreadsPurified).toBeUndefined();

		expect(metadata.mon_shadow.searchFormId).toBe('20');
		expect(metadata.mon_shadow.bestIvSpreads).toBeDefined();
		expect(metadata.mon_shadow.bestIvSpreadsPurified).toBeDefined();
	});

	it('never mutates the input gamemaster', () => {
		const dict: GameMasterData = { mon: makePokemon({}) };
		computeSpeciesSearchMetadata(dict);
		expect(dict.mon).not.toHaveProperty('searchFormId');
		expect(dict.mon).not.toHaveProperty('bestIvSpreads');
	});
});
