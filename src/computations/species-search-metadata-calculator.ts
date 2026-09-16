import type { GameMasterData } from '../parsers/types/pokemon';
import type { SpeciesSearchMetadataMap } from '../parsers/types/species-search-metadata';
import { computeBestIvSpreadsForAllSpecies } from './best-iv-spread-calculator';
import { computeFormIdentifiersForAllSpecies } from './form-identifier-calculator';

/**
 * Combines the IV-spread half (`best-iv-spread-calculator.ts`) and the
 * form-identity half (`form-identifier-calculator.ts`) into the single
 * per-speciesId record written to `species-search-metadata.json` — its own
 * file, separate from `game-master.json`, so go-pokedex fetches it as an
 * independent, optional dataset rather than a field bolted onto every
 * gamemaster entry.
 */
export const computeSpeciesSearchMetadata = (
	gameMasterPokemon: GameMasterData
): SpeciesSearchMetadataMap => {
	const ivSpreads = computeBestIvSpreadsForAllSpecies(gameMasterPokemon);
	const formIdentifiers =
		computeFormIdentifiersForAllSpecies(gameMasterPokemon);

	const result: SpeciesSearchMetadataMap = {};
	for (const speciesId of Object.keys(gameMasterPokemon)) {
		result[speciesId] = {
			...formIdentifiers[speciesId],
			...ivSpreads[speciesId],
		};
	}
	return result;
};
