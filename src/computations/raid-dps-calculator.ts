import type { GameMasterData, IGameMasterMove } from '../parsers/types/pokemon';
import { PokemonTypes } from '../parsers/types/pokemon';
import type { DPSEntry } from './utils';
import { computeDPSEntry, getAllChargedMoves, MAX_LEVEL_INDEX } from './utils';

type ComputedDpsRank = DPSEntry & {
	rank: number;
};

class RaidDpsCalculator {
	constructor(
		private readonly gameMasterPokemon: GameMasterData,
		private readonly moves: Record<string, IGameMasterMove>
	) {}

	compute() {
		const output: Record<string, Record<string, ComputedDpsRank>> = {};

		// One ranking per attacking type. The old generic "" (type-agnostic) list
		// was dropped — a raid ranking only makes sense once a type is chosen.
		Object.values(PokemonTypes)
			.map((type) => type.toLocaleLowerCase())
			.forEach((type) => {
				const pokemonEntries = Object.values(this.gameMasterPokemon)
					.filter(
						(p) =>
							!p.aliasId &&
							getAllChargedMoves(p, this.moves).some(
								(m) => this.moves[m].type === type
							)
					)
					.map((p) => computeDPSEntry(p, this.moves, 15, MAX_LEVEL_INDEX, type))
					.filter((e) => e.fastMove && e.chargedMove && e.dps >= 0);

				pokemonEntries.sort((a, b) => {
					if (b.dps !== a.dps) {
						return b.dps - a.dps;
					}

					return a.speciesId.localeCompare(b.speciesId);
				});

				const parsedEntries: Record<string, ComputedDpsRank> = {};
				pokemonEntries.forEach((k, i) => {
					parsedEntries[k.speciesId] = { ...k, rank: i + 1 };
				});

				output[type] = parsedEntries;
			});

		return output;
	}
}

export default RaidDpsCalculator;
